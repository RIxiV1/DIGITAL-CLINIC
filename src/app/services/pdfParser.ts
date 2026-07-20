/**
 * Real PDF + image parsing pipeline.
 *
 * Architecture, in three stages:
 *
 *   1. Text acquisition — given a File, produce one or more "candidate"
 *      strings that hopefully contain the lab values. Sources are:
 *        a. PDF text layer (three reconstruction strategies, see below)
 *        b. Tesseract.js OCR on rendered PDF pages — fallback when the
 *           text layer is empty (scanned PDFs) or has no catalog matches
 *        c. Tesseract.js OCR on image files (jpg/png/heic-via-canvas)
 *
 *   2. Normalisation — repair OCR artefacts like "5 ." → "5." that
 *      otherwise corrupt numeric extraction.
 *
 *   3. Catalog matching — run the biomarker catalog against each
 *      candidate, pick whichever string yields the most matches.
 *
 * Battle-tested techniques ported from the in-house Lab Report Explainer:
 *   - Adaptive Y-tolerance line grouping (fixes dense Indian-lab tables)
 *   - X-gap–aware joining (so "43" doesn't get split into "4 3" by the
 *     PDF renderer, which would parse as 4 — a real Indian-lab bug)
 *   - cMapUrl + cMapPacked for CID-keyed fonts (subset fonts common in
 *     Thyrocare / SRL / Metropolis PDFs)
 *   - Per-page OCR timeout (Tesseract can stall on pathological inputs)
 *   - PDF .destroy() in finally so pdfjs's internal buffers release
 *
 * Heavy deps (pdfjs, tesseract) are dynamic-imported. The PDF worker is
 * resolved via Vite's `?url` import so it bundles cleanly in production.
 */

import { type Biomarker } from '../data/biomarkers';
import { escapeRegex } from './parser/regexUtils';

// Out-of-scope classifier lives in its own module now; re-exported here so
// the public entry point (api.ts, tests) keeps importing it from './pdfParser'.
export {
  classifyOutOfScope,
  type OutOfScopeCategory,
} from './parser/outOfScope';
import {
  normalize,
  isPdfTextItem,
  dePuaGlyphs,
  remapPuaTextContent,
  reconstructByPosition,
  reconstructByEOL,
  reconstructByStream,
  type TextContentLike,
} from './parser/pdfTextLayer';
import {
  extractBiomarkersFromText,
  extractBiomarkersWithProvenance,
  findUnrecognizedRows,
  type MarkerProvenance,
} from './parser/catalogMatcher';
// Catalog matcher moved to its own module; re-export the public surface so
// importers (api.ts, the extraction test suites) keep importing from here.
export {
  extractBiomarkersFromText,
  extractBiomarkersWithProvenance,
  findUnrecognizedRows,
  type MarkerProvenance,
};

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

/** Tesseract OCR is slow — cap pages scanned per PDF so a 50-page lab
 *  bundle doesn't take 10 minutes to fail. Lab reports almost always
 *  fit in 1-3 pages. */
const OCR_MAX_PAGES = 3;

/** PDF render scale for OCR. 2.5x A4 ≈ 1495×2115 px; Tesseract needs
 *  this resolution to read small lab-table fonts reliably. Used as the
 *  desktop / high-memory default — see `getOcrRenderScale()` for the
 *  adaptive selection. */
const PDF_RENDER_SCALE_DESKTOP = 2.5;
/** Lower scale for memory-constrained devices: 2.0x A4 ≈ 1196×1692 px.
 *  Still adequate for most lab-table fonts (≥10pt) but cuts canvas
 *  memory ~40% — important on Android Chrome where 200MB+ canvas
 *  allocations are common OOM triggers. */
const PDF_RENDER_SCALE_LOW = 2.0;

/**
 * Pick an OCR render scale appropriate to the device. We lower the
 * scale (and thus canvas RAM) when:
 *   - `deviceMemory` hints ≤4 GB (Chromium-only API; Safari returns
 *     undefined and we conservatively default high).
 *   - The viewport's longest edge is ≤480px (phone-sized).
 *
 * The fallback to PDF_RENDER_SCALE_DESKTOP preserves the high-fidelity
 * behavior on desktop/laptop where Tesseract has the RAM. Anywhere this
 * heuristic mis-classifies, the user still gets a working result; OCR
 * quality degrades gracefully rather than OOM-crashing the tab. The
 * architectural-audit motivation: a 3-page A4 PDF at 2.5× renders to
 * ~210MB of canvas memory across the run, and budget Android Chrome
 * tabs OOM at ~250MB.
 */
function getOcrRenderScale(): number {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return PDF_RENDER_SCALE_DESKTOP;
  }
  // `navigator.deviceMemory` is a Chromium quantised hint (0.25, 0.5,
  // 1, 2, 4, 8). It's the closest thing browsers expose to "is this a
  // low-end phone?" Treat ≤4 GB as constrained.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memHint = (navigator as any).deviceMemory;
  if (typeof memHint === 'number' && memHint <= 4) {
    return PDF_RENDER_SCALE_LOW;
  }
  const longest = Math.max(window.innerWidth || 0, window.innerHeight || 0);
  if (longest > 0 && longest <= 480) {
    return PDF_RENDER_SCALE_LOW;
  }
  return PDF_RENDER_SCALE_DESKTOP;
}

/** Minimum char count before we trust the PDF text layer. Below this,
 *  the layer is probably stripped/empty (scanned PDF) — fall to OCR. */
const MIN_USABLE_TEXT_LENGTH = 50;

/** Per-page OCR timeout. Tesseract usually finishes in 5-15s, but can
 *  hang on garbage input. 45s is generous and still well below "the
 *  user gives up and refreshes". */
const OCR_PAGE_TIMEOUT_MS = 45_000;

/** Tesseract language pack. `eng` only — current default for all Indian
 *  lab reports we've seen, which print their tabular content in English
 *  even when bilingual headers (Hindi / Tamil / Telugu) are present.
 *  Future enhancement: surface a `Settings → Advanced` toggle for
 *  `eng+hin` / `eng+tam` etc. The bilingual variants give measurably
 *  cleaner extraction when the secondary language appears in body text
 *  (rare), but add ~12MB of traineddata download on first use — not
 *  worth defaulting on. Keep this constant in one place so the future
 *  toggle has one knob to flip. */
const OCR_LANG = 'eng';

/**
 * Same-origin paths for the Tesseract runtime, overriding the library's
 * defaults — which point at cdn.jsdelivr.net for all three.
 *
 * Without these, the browser downloads and EXECUTES a worker script from a
 * third party, inside our origin, while the user's lab report sits in
 * memory. That was our largest attack surface (a jsdelivr compromise or DNS
 * hijack would run arbitrary code with access to the report, and a worker
 * script can't carry an SRI hash), it put a silent asterisk on the "never
 * leaves your device" promise (the CDN sees the user's IP and that they're
 * parsing a health document), and it broke OCR entirely offline or on the
 * ISP/corporate networks that block jsdelivr — which matters for an
 * India-first product.
 *
 * The files are copied out of node_modules into public/ by
 * scripts/vendor-ocr-assets.mjs (wired to prebuild/predev), so they stay in
 * lockstep with the installed package versions. Because these paths are
 * same-origin, vercel.json's CSP can keep script-src at 'self'.
 *
 * `corePath` and `langPath` are DIRECTORIES: tesseract.js appends the
 * SIMD-appropriate core filename and `<lang>.traineddata.gz` itself.
 */
const OCR_WORKER_OPTIONS = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/core',
  langPath: '/tesseract/tessdata',
} as const;

/** Worker-init timeout. Tesseract pulls ~12MB of eng.traineddata on
 *  first use; on a flaky mobile network this can stall indefinitely
 *  with no signal to the UI. 60s is generous enough for slow 3G but
 *  short enough that the user sees a real error instead of an infinite
 *  spinner. */
const OCR_WORKER_INIT_TIMEOUT_MS = 60_000;

/** Mean Tesseract confidence (0–100) at or below which an OCR read is
 *  treated as degraded. Clean scans land ~85–95; low-resolution, noisy,
 *  or oddly-encoded pages drop well under this. We don't discard the
 *  values — OCR can still be mostly right — but the confirm screen shows
 *  a "double-check these against your report" banner so a shaky read
 *  isn't presented as authoritative. Surfaced via `ocrConfidence` on the
 *  parse result; the UI imports this threshold so the line lives once. */
export const OCR_LOW_CONFIDENCE_THRESHOLD = 65;

/* ------------------------------------------------------------------ */
/* Lazy loaders for heavy deps                                          */
/* ------------------------------------------------------------------ */

type PdfjsModule = typeof import('pdfjs-dist');
type TesseractCreateWorker = typeof import('tesseract.js').createWorker;

let pdfjsPromise: Promise<PdfjsModule> | null = null;
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist');
      const workerUrl = (
        await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      ).default;
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    })();
  }
  return pdfjsPromise;
}

let tesseractPromise: Promise<TesseractCreateWorker> | null = null;
async function loadTesseract(): Promise<TesseractCreateWorker> {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js').then((m) => m.createWorker);
  }
  return tesseractPromise;
}

/**
 * Warm the Tesseract assets — the ~2.9 MB eng.traineddata + ~1.3 MB WASM
 * core fetched from the CDN — into the browser cache ahead of time, so
 * the real OCR pass skips that ~4 MB download on the critical path
 * (measured cold OCR ≈ 4.1s, most of it that fetch). Call this the moment
 * an IMAGE is selected on the upload screen: images always go to OCR, so
 * it never wastes bandwidth on a text-PDF upload, and the download
 * overlaps the user reviewing their file.
 *
 * Implementation: create a worker (which triggers the download + init)
 * then terminate it immediately. We keep nothing resident — the win is
 * the cached download, not a live worker (a session-long worker would
 * pin tens of MB on the low-RAM Android devices this targets, for a
 * marginal repeat-parse gain). Idempotent and fully best-effort: any
 * failure is swallowed so a prewarm hiccup can never affect the upload
 * flow, and the flag resets so a later real parse still works.
 */
let ocrPrewarmStarted = false;
export async function prewarmOcr(): Promise<void> {
  if (ocrPrewarmStarted) return;
  ocrPrewarmStarted = true;
  try {
    const createWorker = await loadTesseract();
    const worker = await withTimeout(
      // `undefined` oem keeps the library default (OEM.LSTM_ONLY), which is
      // what the vendored core + traineddata variants are chosen to match.
      createWorker(OCR_LANG, undefined, OCR_WORKER_OPTIONS),
      OCR_WORKER_INIT_TIMEOUT_MS,
      'OCR prewarm',
    );
    await worker.terminate();
  } catch {
    // Best-effort only — allow a later attempt if this one failed.
    ocrPrewarmStarted = false;
  }
}

/* ------------------------------------------------------------------ */
/* PDF rendering for OCR                                                */
/* ------------------------------------------------------------------ */

/** PDF document handle as returned by pdfjs.getDocument(...).promise.
 *  Using the real exported type keeps the page.render() API signature
 *  in sync with whatever pdfjs version is installed. */
type PdfDoc = Awaited<
  ReturnType<(typeof import('pdfjs-dist'))['getDocument']>['promise']
>;

/**
 * Render a PDF page to a PNG blob suitable for Tesseract input. Frees
 * the canvas buffer immediately after conversion — without this, three
 * A4 pages at 2.5x hold ~210MB of canvas RAM until GC eventually runs,
 * which spikes mobile devices.
 */
async function renderPageToImage(
  pdf: PdfDoc,
  pageNum: number,
): Promise<Blob | string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: getOcrRenderScale() });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('Failed to acquire 2D canvas context.');
  }
  // pdfjs-dist v5 requires `canvas` alongside `canvasContext` in
  // RenderParameters — v3 didn't. Passing both is forward-compatible.
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  let imageData: Blob | string;
  if (canvas.toBlob) {
    imageData = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
    });
  } else {
    imageData = canvas.toDataURL('image/png');
  }

  canvas.width = 0;
  canvas.height = 0;
  return imageData;
}

/* ------------------------------------------------------------------ */
/* OCR — Tesseract                                                      */
/* ------------------------------------------------------------------ */

/** Race a promise against an OCR-page timeout. Skips this page rather
 *  than failing the entire extraction. */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

/** Width (px) we try to give Tesseract.
 *
 *  Tesseract's LSTM is trained around 300 DPI — roughly an x-height of
 *  30-35px. An A4 lab report at 300 DPI is ~2480px wide. Anything much
 *  under that hands the recogniser glyphs built from too few pixels.
 *
 *  Ablated on the degradation bench (markers found, out of 8). Removing the
 *  upscale and changing nothing else:
 *    clean 8 → 7 | blur 8 → 7 | low-res 1 → 0
 *  It earns its place on every case it touches and costs nothing on any. */
const OCR_TARGET_WIDTH = 2400;

/** Hard ceiling on the upscale factor. Interpolation invents no detail —
 *  past ~2x it only costs memory and OCR time for nothing. */
const OCR_MAX_UPSCALE = 2;

/** Never allocate a canvas wider than this. A 12MP phone photo is already
 *  ~4000px; blindly doubling it would be a ~256MB RGBA buffer and an OOM
 *  on the low-RAM Androids this targets. Images at or above this are
 *  already detail-rich and are left alone. */
const OCR_MAX_WIDTH = 3200;

/** Unsharp-mask strength for the FIRST OCR pass.
 *
 *  Why sharpening at all: the bench showed lighting was never the problem —
 *  shadow, dim-light and 3° skew all scored 7-8/8 untouched. Softness was,
 *  and every handheld photo is slightly soft.
 *
 *  Swept on the bench with a single pass, everything else fixed (markers
 *  found, out of 8):
 *
 *      amount   low-res   realistic
 *        0         6          0
 *        0.4       5          0        <- intermediate rows measured before
 *        0.6       4          3           the OCR-tolerant unit gate landed;
 *        0.8       1          6           the shape is what matters, and it
 *        1.1       1          8           did not change. Endpoints re-checked.
 *
 *  The trade is monotonic and there is no winner: sharpening rescues soft
 *  captures and destroys under-sampled ones (it amplifies the interpolation
 *  ringing a downscale-then-upscale leaves behind).
 *
 *  So this is not a compromise value — it is one end of a deliberate pair.
 *  parseImage runs a second pass at amount 0 when the first read looks poor,
 *  which recovers low-res (1 → 6) without giving up realistic (8). Tune this
 *  for soft photos; the other end is handled by the retry, not by backing
 *  off here. Kept restrained anyway: heavy sharpening haloes, and digits
 *  grow phantom strokes. */
const UNSHARP_AMOUNT = 1.1;

/** Unsharp radius (px). Must exceed the blur it fights (bench: ~1.4px) or
 *  it sharpens noise instead of glyph edges; too wide and it haloes.
 *  Applied after upscaling, so it works in upscaled pixels. */
const UNSHARP_RADIUS = 2;

/** Below this many extracted markers, a read is treated as poor enough to
 *  be worth a second OCR pass with different preprocessing (see parseImage).
 *  Set low on purpose: a genuine single-panel report (a thyroid profile is
 *  TSH + T3 + T4) must not trigger a pointless retry, so this only fires
 *  when we've essentially failed. Confidence is the other trigger. */
const OCR_SECOND_PASS_MIN_MARKERS = 3;

/**
 * Separable box blur over an 8-bit gray plane, via a sliding window sum
 * (O(n) in pixels, independent of radius). Edges clamp to the border pixel.
 *
 * Only ever used as the "blurred" term of the unsharp mask below. Written
 * out rather than pulled in as a dependency because it's ~20 lines and this
 * file is the one place that needs it — and it runs on low-RAM phones, so
 * the two Uint8ClampedArrays it allocates are a deliberate, counted cost.
 */
function boxBlurGray(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): Uint8ClampedArray {
  const clampX = (v: number) => (v < 0 ? 0 : v > w - 1 ? w - 1 : v);
  const clampY = (v: number) => (v < 0 ? 0 : v > h - 1 ? h - 1 : v);
  const win = 2 * r + 1;
  const tmp = new Uint8ClampedArray(w * h);
  const out = new Uint8ClampedArray(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[row + clampX(i)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      sum += src[row + clampX(x + r + 1)] - src[row + clampX(x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += tmp[clampY(i) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      sum += tmp[clampY(y + r + 1) * w + x] - tmp[clampY(y - r) * w + x];
    }
  }
  return out;
}

/**
 * Preprocess a photo/screenshot of a lab report before handing it to
 * Tesseract:
 *   1. Upscale under-sampled frames toward the LSTM's ~300 DPI comfort zone.
 *   2. Grayscale (Rec. 601 luma) — kills the colour tint many Indian lab
 *      templates print behind the table.
 *   3. Unsharp mask — restore stroke edges a soft capture smeared.
 *
 * WHY THERE IS NO LONGER A BINARIZATION STEP
 * ------------------------------------------
 * There used to be one: luma → Otsu-adaptive threshold → pure black & white.
 * It was added for a real, reported bug — tinted lab templates (Dr Lal
 * PathLabs, Crystal Data, Thyrocare) where Tesseract read value cells like
 * "12.00" as "Taw" — and its reasoning was sound.
 *
 * It was also unmeasurable. OCR quality needs a real canvas, real WASM and a
 * real recogniser, so no unit test could see it, and the pipeline scored this
 * on e2e/ocr-robustness.spec.ts (markers found, out of 8):
 *
 *                        before    now
 *   clean                   7        8
 *   shadow                  6        7
 *   tinted template         7        8   <- the bug it was added for
 *   blur                    7        8
 *   low-res                 0        6
 *   realistic phone photo   0        8
 *
 * A normal handheld photo read NOTHING. 712 unit tests passed either way.
 *
 * The tinted case holding at 7/8 with no threshold anywhere is the tell: the
 * luma conversion was what fixed the "Taw" bug. Threshold and grayscale
 * shipped together and the threshold took the credit. Tesseract also
 * thresholds internally, so ours was redundant — it threw away the grayscale
 * Tesseract's own thresholder wanted, and a hard cut on a soft capture fuses
 * neighbouring strokes, so "14.2" arrives as a smudge.
 *
 * Scope note, so this isn't over-read: "before" is the whole old pipeline
 * (binarize, no upscale, no unsharp, single pass) against the whole new one.
 * Binarization was not separately ablated under this metric — the claim it
 * supports is that the tinted case needs no threshold, not a measured
 * per-step attribution.
 *
 * Honest limit: the bench's report LAYOUT is synthetic. It models the optics
 * of a capture (softness, skew, lighting, resolution) — which are universal
 * and are what was broken — but says nothing about whether we read any
 * particular lab's template. A real-report corpus would settle that; this
 * cannot.
 *
 * Falls back to the original blob on any failure — preprocessing
 * helping is gravy, not contractual.
 */
async function preprocessImageForOcr(
  file: Blob,
  unsharpAmount: number = UNSHARP_AMOUNT,
): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined') return file;
    const bmp = await createImageBitmap(file);

    // Upscale under-sampled frames toward the LSTM's comfortable resolution.
    // Interpolation adds no information, but it does give the recogniser more
    // pixels per glyph, which is what it's short of on a small or distant
    // capture. Large photos are left alone — see OCR_MAX_WIDTH.
    const scale = Math.min(
      OCR_MAX_UPSCALE,
      Math.max(1, OCR_TARGET_WIDTH / bmp.width),
      Math.max(1, OCR_MAX_WIDTH / bmp.width),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    if (scale > 1) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imageData.data;
    const w = canvas.width;
    const h = canvas.height;
    const n = w * h;

    // Pass 1: luma into a dedicated gray plane. (This used to squat in the
    // RGBA R channel to save a buffer; the unsharp step needs a contiguous
    // single-channel plane to convolve, and reading neighbours out of a
    // stride-4 array while writing it back in place would sample
    // already-modified pixels.)
    const gray = new Uint8ClampedArray(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      gray[i] = (0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]) | 0;
    }

    // Pass 2: unsharp mask in place on the gray plane. Skipped entirely at
    // amount 0 — the second pass (see parseImage) asks for exactly that, and
    // it shouldn't pay for two full-frame buffers and a convolution it would
    // multiply away.
    if (unsharpAmount > 0) {
      const blurred = boxBlurGray(gray, w, h, UNSHARP_RADIUS);
      for (let i = 0; i < n; i++) {
        // Uint8ClampedArray rounds + clamps on write, which is exactly the
        // saturation an unsharp mask wants at both ends.
        gray[i] = gray[i] + unsharpAmount * (gray[i] - blurred[i]);
      }
    }

    // Pass 3: write the sharpened gray back over RGB. Deliberately NOT
    // thresholded — see the note above the function.
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      px[p] = gray[i];
      px[p + 1] = gray[i];
      px[p + 2] = gray[i];
    }
    ctx.putImageData(imageData, 0, 0);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? file), 'image/png');
    });
  } catch {
    return file;
  }
}

async function runImageOcr(
  file: Blob,
  unsharpAmount: number = UNSHARP_AMOUNT,
): Promise<{ text: string; confidence: number }> {
  const createWorker = await loadTesseract();
  const worker = await withTimeout(
    // `undefined` oem keeps the library default (OEM.LSTM_ONLY), which is
    // what the vendored core + traineddata variants are chosen to match.
    createWorker(OCR_LANG, undefined, OCR_WORKER_OPTIONS),
    OCR_WORKER_INIT_TIMEOUT_MS,
    'OCR worker init',
  );
  try {
    // PSM 6 = "assume a single uniform block of text". Default PSM 3
    // (Fully Automatic) often over-segments lab-report tables — it
    // treats each row as its own zone and tries to identify column
    // structure, which goes badly when the row borders are thin or
    // missing. PSM 6 trusts that the whole page is one block and reads
    // it left-to-right, top-to-bottom — closer to how a human scans
    // a lab table.
    // Tried and measured to do nothing here, so deliberately absent:
    // `user_defined_dpi: '300'` (we upscale to ~A4@300dpi, so Tesseract's own
    // estimate is already right) and `preserve_interword_spaces: '1'` (the
    // usual advice for tables — the matcher is line-oriented and doesn't care
    // about intra-line spacing). Both scored an identical 43/48 on the bench.
    await worker.setParameters({ tessedit_pageseg_mode: '6' as never });
    const preprocessed = await preprocessImageForOcr(file, unsharpAmount);
    const result = await withTimeout(
      worker.recognize(preprocessed),
      OCR_PAGE_TIMEOUT_MS,
      'OCR',
    );
    return { text: result.data.text, confidence: result.data.confidence };
  } finally {
    await worker.terminate();
  }
}

type PdfOcrResult = {
  text: string;
  /** How many of the attempted pages OCR could not complete (timeout
   *  or render failure). Surfaced in the confirm view so a partial
   *  result doesn't masquerade as a complete one. */
  pagesAttempted: number;
  pagesSkipped: number;
  /** Mean Tesseract confidence (0–100) across the pages that were read.
   *  0 when no page produced text. Drives the low-confidence banner. */
  confidence: number;
};

/**
 * Page-boundary sentinel for OCR concat. Anchored by zero-width
 * non-printing markers + a literal token that's deliberately
 * un-matchable by the catalog matcher (no biomarker alias contains
 * `===` or `PAGE_BOUNDARY`). Used as a split point downstream so a
 * skipped page can't glue a marker on page 1 to a digit on page 3
 * through the [^\n]{0,80}? between-window.
 */
const PAGE_BOUNDARY_SENTINEL = '\n\n===PAGE_BOUNDARY===\n\n';

/**
 * Strip the internal page-boundary sentinel from text headed to the
 * user-facing "show what we read" disclosure. The sentinel is meaningful
 * to the matcher (it's a hard line break that the bounded between-window
 * can't cross) but ugly in the UI. Replacement preserves the visual
 * page-break for the reader.
 */
function rawTextForDisplay(text: string): string {
  return text.replace(
    new RegExp(escapeRegex(PAGE_BOUNDARY_SENTINEL), 'g'),
    '\n\n— page break —\n\n',
  );
}

async function runPdfOcr(pdf: PdfDoc): Promise<PdfOcrResult> {
  const createWorker = await loadTesseract();
  // H6: Worker init can stall on a flaky mobile connection while the
  // ~12 MB eng.traineddata downloads. Cap it. On timeout, the error
  // bubbles up to parsePdfFile and surfaces as parser-error with a
  // clear "couldn't download the OCR engine" message rather than the
  // UI stalling at the last visible stage forever.
  const worker = await withTimeout(
    // `undefined` oem keeps the library default (OEM.LSTM_ONLY), which is
    // what the vendored core + traineddata variants are chosen to match.
    createWorker(OCR_LANG, undefined, OCR_WORKER_OPTIONS),
    OCR_WORKER_INIT_TIMEOUT_MS,
    'OCR worker init',
  );
  try {
    let fullText = '';
    const pagesAttempted = Math.min(pdf.numPages, OCR_MAX_PAGES);
    let pagesSkipped = 0;
    let confidenceSum = 0;
    let pagesRead = 0;
    for (let i = 1; i <= pagesAttempted; i++) {
      try {
        const imgData = await renderPageToImage(pdf, i);
        const result = await withTimeout(
          worker.recognize(imgData),
          OCR_PAGE_TIMEOUT_MS,
          `OCR page ${i}`,
        );
        fullText += result.data.text;
        confidenceSum += result.data.confidence;
        pagesRead += 1;
        // Page boundary sentinel. Catalog matcher splits on this so a
        // marker on page N can't glue to a number on page N+1 via the
        // [^\n]{0,80}? between-window.
        if (i < pagesAttempted) fullText += PAGE_BOUNDARY_SENTINEL;
      } catch (pageErr) {
        // eslint-disable-next-line no-console
        console.warn(`Skipping page ${i}:`, pageErr);
        // Skipped page → emit the boundary sentinel instead of a
        // human-readable placeholder. The boundary is invisible to
        // the user-facing rawText display (we strip it before render)
        // but enforces a hard page-break for the matcher.
        if (i < pagesAttempted) fullText += PAGE_BOUNDARY_SENTINEL;
        pagesSkipped += 1;
      }
    }
    return {
      text: fullText,
      pagesAttempted,
      pagesSkipped,
      confidence: pagesRead > 0 ? confidenceSum / pagesRead : 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Stamp every marker that came from an OCR (photo / scanned-PDF) read with
 * the page's OCR confidence (0–100). The UI uses it to flag — per value,
 * not as a blanket banner — which numbers were read off a photo and are
 * worth a double-check. Markers from a digital text layer never get this
 * field (digital text is trustworthy), so the absence of it means "exact".
 */
function tagOcrConfidence(
  markers: Biomarker[],
  confidence: number,
): Biomarker[] {
  return markers.map((m) => ({ ...m, ocrConfidence: confidence }));
}

/**
 * Internal helpers exposed solely for unit testing. The three
 * reconstruction strategies and the normalize step are the most fragile
 * pieces of this file, but they shouldn't be part of the public API —
 * consumers should call `parsePdfFile` or `extractBiomarkersFromText`.
 */
export const __testInternals = {
  normalize,
  dePuaGlyphs,
  remapPuaTextContent,
  reconstructByPosition,
  reconstructByEOL,
  reconstructByStream,
};

/* ------------------------------------------------------------------ */
/* Public entry point                                                   */
/* ------------------------------------------------------------------ */

export type PdfParseResult = {
  biomarkers: Biomarker[];
  /** Which acquisition path produced the winning text (for diagnostics). */
  source: 'pdf-text' | 'pdf-ocr' | 'image-ocr';
  /** Strategy name when source is pdf-text; undefined otherwise. */
  strategy?: 'position' | 'eol' | 'stream';
  /** Raw text we extracted — kept so the UI can surface a "what we
   *  read" diagnostic when extraction yields zero matches. */
  rawText: string;
  /** Label-value-unit rows the parser saw but couldn't match to the
   *  catalog. Surface in the confirm step so the user knows whether a
   *  short list reflects an unusual report or a parser gap. */
  unrecognizedRows: string[];
  /** OCR diagnostic — populated when source === 'pdf-ocr'. Lets the UI
   *  warn the user that some pages couldn't be read (instead of letting
   *  a partial result look complete). Undefined for the text-layer
   *  path, since every page contributes text there. */
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
  /** Mean Tesseract confidence (0–100) for OCR paths. Undefined on the
   *  text-layer path (no OCR ran). When low (≤ OCR_LOW_CONFIDENCE_
   *  THRESHOLD) the UI warns that the read may be unreliable. */
  ocrConfidence?: number;
  /** Per-marker provenance (biomarker id → verbatim source row +
   *  validation flags). Powers the "why do we believe this?" inspector.
   *  Combined with the report-level `source`/`ocrConfidence` above to give
   *  a full, honest chain. Undefined only on the empty/failure result. */
  provenance?: Map<string, MarkerProvenance>;
};

const EMPTY_RESULT: PdfParseResult = {
  biomarkers: [],
  source: 'pdf-text',
  rawText: '',
  unrecognizedRows: [],
};

/**
 * Parse a file. Tries, in order:
 *
 *   PDF — text layer:
 *     - reconstruct by position, EOL, and stream
 *     - pick whichever yields the most catalog matches
 *     - if the best score is > 0, return
 *
 *   PDF — OCR fallback:
 *     - render up to OCR_MAX_PAGES pages
 *     - Tesseract.recognize each, with per-page timeout
 *     - run catalog against the combined OCR text
 *
 *   Image — OCR:
 *     - Tesseract.recognize the file directly
 *
 * Always cleans up pdfjs worker buffers in `finally`.
 */
export async function parsePdfFile(file: File): Promise<PdfParseResult> {
  if (file.type === 'application/pdf') {
    return parsePdf(file);
  }
  if (file.type.startsWith('image/')) {
    return parseImage(file);
  }
  return EMPTY_RESULT;
}

async function parsePdf(file: File): Promise<PdfParseResult> {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();

  // Acquire the document with cMapUrl for CID-keyed fonts common in
  // Indian-lab PDFs (Thyrocare / SRL / etc. subset fonts).
  //
  // Served from our own origin (copied out of pdfjs-dist by
  // scripts/vendor-ocr-assets.mjs) rather than a CDN. Parsing a report
  // should never make a third-party request — it would hand out the user's
  // IP and the fact that they're reading a lab PDF, and it would fail on
  // networks that block the CDN. Same reasoning as OCR_WORKER_OPTIONS.
  let pdf: PdfDoc;
  try {
    pdf = await pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: '/cmaps/',
      cMapPacked: true,
    }).promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      /password/i.test(message) ||
      (err instanceof Error && err.name === 'PasswordException')
    ) {
      throw new Error(
        'This PDF is password-protected. Please unlock it first, then re-upload.',
      );
    }
    throw err;
  }

  try {
    // Collect text content per page
    const pageContents: TextContentLike[] = [];
    let totalCharCount = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // Recover symbol-encoded (ASCII+0xF000) fonts before anything else,
      // so the char-count gate, reconstruction, matcher, and display all
      // operate on real text instead of falling back to OCR.
      const tc = remapPuaTextContent(await page.getTextContent());
      pageContents.push(tc);
      for (const item of tc.items) {
        if (isPdfTextItem(item)) totalCharCount += item.str.length;
      }
    }

    // If the text layer is empty, skip the text strategies and go
    // straight to OCR. Scanned PDFs hit this path.
    if (totalCharCount < MIN_USABLE_TEXT_LENGTH) {
      const ocr = await runPdfOcr(pdf);
      const { markers: ocrBiomarkers, provenance } =
        extractBiomarkersWithProvenance(ocr.text);
      return {
        biomarkers: tagOcrConfidence(ocrBiomarkers, ocr.confidence),
        source: 'pdf-ocr',
        provenance,
        rawText: rawTextForDisplay(ocr.text),
        unrecognizedRows: findUnrecognizedRows(ocr.text, ocrBiomarkers),
        ocrPagesAttempted: ocr.pagesAttempted,
        ocrPagesSkipped: ocr.pagesSkipped,
        ocrConfidence: ocr.confidence,
      };
    }

    // Try all three reconstruction strategies, take the one with the
    // most catalog matches.
    const candidates: Array<{
      name: 'position' | 'eol' | 'stream';
      text: string;
      biomarkers: Biomarker[];
    }> = [
      {
        name: 'position',
        text: pageContents.map(reconstructByPosition).join('\n'),
        biomarkers: [],
      },
      {
        name: 'eol',
        text: pageContents.map(reconstructByEOL).join('\n'),
        biomarkers: [],
      },
      {
        name: 'stream',
        text: pageContents.map(reconstructByStream).join('\n'),
        biomarkers: [],
      },
    ];
    for (const c of candidates) {
      c.biomarkers = extractBiomarkersFromText(c.text);
    }
    candidates.sort((a, b) => b.biomarkers.length - a.biomarkers.length);
    const winner = candidates[0];

    if (winner.biomarkers.length > 0) {
      // Re-run on the winning text to collect provenance; markers are
      // identical to the count above (same text, same catalog).
      const { provenance } = extractBiomarkersWithProvenance(winner.text);
      return {
        biomarkers: winner.biomarkers,
        source: 'pdf-text',
        strategy: winner.name,
        provenance,
        rawText: winner.text,
        unrecognizedRows: findUnrecognizedRows(winner.text, winner.biomarkers),
      };
    }

    // Text layer present but zero catalog matches → try OCR. Scanned-
    // into-PDF reports with a thin text layer of metadata sometimes
    // hit this path.
    const ocr = await runPdfOcr(pdf);
    const { markers: ocrBiomarkers, provenance } =
      extractBiomarkersWithProvenance(ocr.text);
    return {
      biomarkers: tagOcrConfidence(ocrBiomarkers, ocr.confidence),
      source: 'pdf-ocr',
      provenance,
      rawText: ocr.text,
      unrecognizedRows: findUnrecognizedRows(ocr.text, ocrBiomarkers),
      ocrPagesAttempted: ocr.pagesAttempted,
      ocrPagesSkipped: ocr.pagesSkipped,
      ocrConfidence: ocr.confidence,
    };
  } finally {
    // Release pdfjs worker buffers. Without this, repeated uploads on
    // low-end mobile devices accumulate memory until the tab OOMs.
    void pdf.destroy().catch(() => {});
  }
}

async function ocrAttempt(
  file: File,
  unsharpAmount: number,
): Promise<PdfParseResult> {
  const { text, confidence } = await runImageOcr(file, unsharpAmount);
  const { markers: biomarkers, provenance } =
    extractBiomarkersWithProvenance(text);
  return {
    biomarkers: tagOcrConfidence(biomarkers, confidence),
    source: 'image-ocr',
    provenance,
    rawText: text,
    unrecognizedRows: findUnrecognizedRows(text, biomarkers),
    ocrConfidence: confidence,
  };
}

/**
 * OCR an image, with a second attempt using different preprocessing when the
 * first read comes back poor.
 *
 * Why two passes: sharpening and NOT sharpening fail on opposite inputs, and
 * measurably so (markers found out of 8, e2e/ocr-robustness.spec.ts):
 *
 *                       sharpened   plain    two-pass
 *   realistic photo        8/8       0/8       8/8    <- soft; needs sharpening
 *   low-res / recompressed 1/8       6/8       6/8    <- ringing; sharpening wrecks it
 *
 * No single setting wins — the sweep is monotonic, so every amount that
 * rescues one abandons the other. Both inputs are common here: `realistic`
 * is any handheld photo, `low-res` is a report forwarded through WhatsApp,
 * which is how a great many Indian users receive theirs. Running both takes
 * the better column from each.
 *
 * So we spend a second pass instead of a compromise. Cost is bounded: the
 * retry only runs when the first read already looks bad — which is precisely
 * when the alternative was giving up and shipping the image to Gemini. A
 * slower on-device answer beats a fast one that leaves the device.
 */
async function parseImage(file: File): Promise<PdfParseResult> {
  const sharpened = await ocrAttempt(file, UNSHARP_AMOUNT);
  const looksPoor =
    sharpened.ocrConfidence === undefined ||
    sharpened.ocrConfidence < OCR_LOW_CONFIDENCE_THRESHOLD ||
    sharpened.biomarkers.length < OCR_SECOND_PASS_MIN_MARKERS;
  if (!looksPoor) return sharpened;

  const plain = await ocrAttempt(file, 0);
  // Keep whichever actually read more of the report. Marker count, not
  // Tesseract confidence: confidence scores how sure the recogniser is about
  // the glyphs it saw, which it can be high on while reading a mangled table.
  return plain.biomarkers.length > sharpened.biomarkers.length
    ? plain
    : sharpened;
}
