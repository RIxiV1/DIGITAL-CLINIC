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

import {
  biomarkerCatalog,
  markerFromTemplate,
  deriveComputedMarkers,
  type Biomarker,
  type BiomarkerTemplate,
} from '../data/biomarkers';

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

/** Hard cap on input to the unknown-row matcher. Defensive — the regex
 *  is bounded (`{0,50}?` on the label window), but `matchAll` over a
 *  100 KB OCR blob with adversarial structure can still spike a phone
 *  CPU. 80 KB is well above any real lab report (a normal extraction
 *  is 2-15 KB) and well below the size where the matcher becomes
 *  noticeable. */
const UNKNOWN_ROW_INPUT_CAP = 80_000;

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
      createWorker(OCR_LANG),
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
/* Type guards (avoid `any` casts on pdfjs items)                       */
/* ------------------------------------------------------------------ */

type PdfTextItemLike = {
  str: string;
  height?: number;
  width?: number;
  transform?: number[];
  hasEOL?: boolean;
};

function isPdfTextItem(item: unknown): item is PdfTextItemLike {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str: unknown }).str === 'string'
  );
}

/* ------------------------------------------------------------------ */
/* Text normalisation — decimal repair + whitespace cleanup             */
/* ------------------------------------------------------------------ */

/**
 * Collapse Micro Sign (U+00B5, "µ") into Greek small letter mu
 * (U+03BC, "μ"). Visually identical, but distinct code points — lab
 * PDFs use both inconsistently (some labs emit U+00B5, OCR engines
 * often emit U+03BC). Without this collapse, "µIU/mL" in a report
 * never matches a catalog template whose unit string is "μIU/mL"
 * (or vice versa), and the marker silently doesn't extract.
 *
 * Canonical form is U+03BC because it's what the catalog tends to be
 * authored in and what most fonts render identically. The PDF export
 * path (reportPdf.ts) flips back to U+00B5 because that's the only
 * one in Helvetica's WinAnsiEncoding.
 */
function normalizeMu(s: string): string {
  return s.replace(/µ/g, 'μ');
}

function normalize(text: string): string {
  let t = normalizeMu(text);
  t = t.replace(/[ \t\r\f\v]+/g, ' '); // collapse horizontal ws
  t = t.replace(/ *\n+ */g, '\n'); // clean newlines
  t = t.replace(/(\d) \./g, '$1.'); // "5 ." -> "5."
  t = t.replace(/\. (\d)/g, '.$1'); // ". 5" -> ".5"
  t = t.replace(/(\d) %/g, '$1%'); // "5 %" -> "5%"
  // Strip number-internal commas — handles both US "240,000" and
  // Indian "2,40,000" notation. Without this, "Platelets 2,40,000"
  // parses as 2 (the regex only captures up to the first comma).
  // Multiple passes because a single replace doesn't catch repeated
  // matches like "2,40,000" (overlapping captures).
  for (let i = 0; i < 3; i++) {
    t = t.replace(/(\d),(\d)/g, '$1$2');
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Three PDF text reconstruction strategies                             */
/*                                                                      */
/* Each strategy is one way to turn pdfjs's flat text-items array into  */
/* a string. Different lab PDFs respond best to different strategies —  */
/* we run all three and let the catalog matcher pick the winner.        */
/* ------------------------------------------------------------------ */

type TextContentLike = { items: unknown[] };

/* ------------------------------------------------------------------ */
/* Symbol-font (PUA) glyph recovery                                     */
/* ------------------------------------------------------------------ */

/**
 * Map one Microsoft "symbol font" (cmap 3,0) code point back to its ASCII
 * byte, or return null if it isn't a symbol-range code point.
 *
 * The OpenType cmap spec says a (3,0) subtable derives its codes by adding
 * a 0xF?00 offset to the base byte, and the valid ranges are 0xF000–0xF0FF
 * (the overwhelmingly common one), 0xF100–0xF1FF, and 0xF200–0xF2FF. We
 * reverse all three. See
 * https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
 */
function symbolPuaToByte(cp: number): number | null {
  if (cp >= 0xf000 && cp <= 0xf0ff) return cp - 0xf000;
  if (cp >= 0xf100 && cp <= 0xf1ff) return cp - 0xf100;
  if (cp >= 0xf200 && cp <= 0xf2ff) return cp - 0xf200;
  return null;
}

/**
 * Recover "symbol-encoded" subset fonts. Many lab PDF generators — very
 * common in Indian pathology software — embed body fonts whose glyphs are
 * addressed in the symbol-font PUA (ASCII + 0xF?00) with NO ToUnicode
 * CMap. pdfjs renders them correctly, but getTextContent hands back the
 * raw U+F0xx code points, so the extracted "text" is invisible garbage:
 * the catalog matcher finds nothing and the pipeline falls back to OCR,
 * which then mis-reads numbers and drops whole result rows.
 *
 * Observed in P006 (Dr Lal PathLabs seminogram): the entire body was
 * ASCII+0xF000, so OCR turned pH 7.5 into "75" and lost the Motility and
 * Morphology result blocks entirely. The encoding is trivially reversible
 * (subtract the 0xF?00 offset). A fast pre-scan makes this a no-op for the
 * normal case of a properly mapped text layer.
 */
function dePuaGlyphs(s: string): string {
  let hasSymbol = false;
  for (const ch of s) {
    if (symbolPuaToByte(ch.codePointAt(0)!) !== null) {
      hasSymbol = true;
      break;
    }
  }
  if (!hasSymbol) return s;
  let out = '';
  for (const ch of s) {
    const byte = symbolPuaToByte(ch.codePointAt(0)!);
    out += byte !== null ? String.fromCharCode(byte) : ch;
  }
  return out;
}

/** A page is treated as symbol-encoded (and recovered) only when this
 *  share of its visible characters fall in the symbol PUA. Gating at the
 *  page level means a normal text layer that happens to use a stray PUA
 *  glyph (a dingbat, a logo ligature) is left untouched — we only rewrite
 *  when the layer is genuinely broken, which is the failure we're fixing. */
const SYMBOL_PUA_PAGE_THRESHOLD = 0.5;

/**
 * Apply {@link dePuaGlyphs} to every text item of a pdfjs text-content
 * object — but only when the page is dominantly symbol-encoded. Run once
 * at ingestion so the char-count gate, all three reconstructions, the
 * matcher, and the "what we read" display all see recovered text from a
 * single place.
 */
function remapPuaTextContent(tc: TextContentLike): TextContentLike {
  let symbolChars = 0;
  let visibleChars = 0;
  for (const it of tc.items) {
    if (!isPdfTextItem(it)) continue;
    for (const ch of it.str) {
      const cp = ch.codePointAt(0)!;
      if (cp > 0x20) visibleChars += 1;
      if (symbolPuaToByte(cp) !== null) symbolChars += 1;
    }
  }
  if (
    visibleChars === 0 ||
    symbolChars / visibleChars < SYMBOL_PUA_PAGE_THRESHOLD
  ) {
    return tc;
  }
  return {
    items: tc.items.map((it) =>
      isPdfTextItem(it) ? { ...it, str: dePuaGlyphs(it.str) } : it,
    ),
  };
}

/**
 * Position-aware reconstruction: groups items by Y coordinate
 * (adaptive tolerance based on median glyph height), sorts each line
 * left-to-right, and joins WITHOUT spaces when the gap between two
 * items is smaller than ~30% of a character width.
 *
 * Why the smart joining matters: pdfjs sometimes splits a single
 * rendered word into separate text items at the bounds of font runs.
 * A naive space-join turns "43" into "4 3" — which parses as 4.
 */
function reconstructByPosition(content: TextContentLike): string {
  const rawItems: PdfTextItemLike[] = [];
  for (const it of content.items) {
    if (isPdfTextItem(it) && it.str.trim()) rawItems.push(it);
  }
  if (rawItems.length === 0) return '';

  // Adaptive Y tolerance — median glyph height × 0.6, computed from a
  // TRIMMED set that excludes the top-decile outliers. Without trimming,
  // a page carrying multiple oversize items (e.g., a "DUPLICATE COPY"
  // stamp + a lab-name banner + a doctor-signature image label) would
  // shift the median upward enough that body-text headers (1.4–1.6×
  // body height) survive the watermark filter — defeating it precisely
  // on the reports where it's most needed.
  const heightsRaw = rawItems
    .map((it) => it.height ?? it.transform?.[0] ?? 0)
    .filter((h) => h > 0);
  const sortedHeights = heightsRaw.slice().sort((a, b) => a - b);
  // Use the median of the bottom 90% — drops the top decile of
  // outliers before computing. For a 200-item page, that's the lower
  // 180 items' median; resilient to up to ~10% oversize garbage.
  const trimmedEnd = Math.max(1, Math.floor(sortedHeights.length * 0.9));
  const trimmed = sortedHeights.slice(0, trimmedEnd);
  const medianHeight = trimmed.length
    ? trimmed[Math.floor(trimmed.length / 2)]
    : 0;

  // Watermark / stamp filter: drop items whose font height is >1.8× the
  // trimmed median. Apollo, Crystal Data, Dr Lal templates frequently
  // embed "DUPLICATE COPY", "FOR REFERENCE ONLY", or doctor-signature
  // stamps as oversize text items at arbitrary Y coordinates. Without
  // this filter those items get clustered into whichever Y bucket they
  // fall closest to, polluting the surrounding row. The 1.8× threshold
  // sits well above normal headers (typically 1.3–1.5× body) and well
  // below the 2–3× stamp range.
  const items =
    medianHeight > 0
      ? rawItems.filter((it) => {
          const h = it.height ?? it.transform?.[0] ?? medianHeight;
          return h <= medianHeight * 1.8;
        })
      : rawItems;
  if (items.length === 0) return '';

  // Recompute tolerance from the filtered set so a removed oversize
  // outlier doesn't skew the value.
  const heights = items
    .map((it) => it.height ?? it.transform?.[0] ?? 0)
    .filter((h) => h > 0);
  const yTolerance = heights.length
    ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] * 0.6
    : 5;

  type Line = { y: number; runs: { x: number; width: number; str: string }[] };
  const lineMap = new Map<number, Line>();

  for (const item of items) {
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const width = item.width ?? item.str.length * (item.height ?? 8) * 0.5;
    const bucket = Math.round(y / yTolerance);

    // Look at this bucket and ±1 to handle items straddling boundaries.
    // Match against the line's MOST RECENT y (line.y is updated below),
    // not its first y — this lets a long horizontal row of items drift
    // smoothly even if cumulative drift across the row would exceed
    // yTolerance from the first item.
    let line: Line | undefined;
    for (const b of [bucket, bucket - 1, bucket + 1]) {
      const existing = lineMap.get(b);
      if (existing && Math.abs(existing.y - y) < yTolerance) {
        line = existing;
        break;
      }
    }
    if (!line) {
      line = { y, runs: [] };
    } else {
      // Drift the line's y anchor to the joining item so the next
      // neighbour matches against the most recent y, not the (possibly
      // stale) first y. Without this, a long row spanning 3+ buckets
      // would have its tail items rejected by the tolerance check.
      line.y = y;
    }
    // Always register the line under THIS item's bucket too — without
    // this, the ±1 fanout from a later bucket can't find a line that
    // was first registered three buckets back, even when the items are
    // all within tolerance of their immediate neighbour.
    lineMap.set(bucket, line);
    line.runs.push({ x, width, str: item.str });
  }

  // Multiple buckets can now point to the same Line (the always-register
  // step above), so dedupe by reference before sorting.
  const lines = [...new Set(lineMap.values())].sort((a, b) => b.y - a.y); // PDF Y up

  return lines
    .map((line) => {
      line.runs.sort((a, b) => a.x - b.x);
      let out = '';
      for (let i = 0; i < line.runs.length; i++) {
        const cur = line.runs[i];
        if (i > 0) {
          const prev = line.runs[i - 1];
          const prevEnd = prev.x + prev.width;
          const gap = cur.x - prevEnd;
          const charWidth = prev.width / Math.max(prev.str.length, 1);
          out += gap > charWidth * 0.3 ? ' ' : '';
        }
        out += cur.str;
      }
      return out;
    })
    .join('\n');
}

/** Respect EOL hints from pdfjs's textContent. */
function reconstructByEOL(content: TextContentLike): string {
  let out = '';
  for (const it of content.items) {
    if (!isPdfTextItem(it)) continue;
    out += it.str;
    out += it.hasEOL ? '\n' : ' ';
  }
  return out;
}

/** Naive stream-order join — fine for simple linear PDFs. */
function reconstructByStream(content: TextContentLike): string {
  return content.items
    .filter(isPdfTextItem)
    .map((it) => it.str)
    .join(' ');
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

/**
 * Preprocess a photo/screenshot of a lab report before handing it to
 * Tesseract. Two passes:
 *   1. Grayscale conversion (Rec. 601 luma).
 *   2. Fixed-threshold binarization at 160 → pure B&W.
 *
 * Why: many Indian lab templates (Dr Lal PathLabs, Crystal Data Inc.,
 * Thyrocare) use a yellow or pale-blue tint behind the table. Tesseract
 * reads colored-on-colored text poorly — value cells like "12.00" come
 * back as "Taw", "37.70" as "sre". Reducing to pure black-on-white
 * eliminates the tint as a confounder. The threshold (160/255) is
 * tuned for the typical Indian lab template's light background +
 * black text contrast; aggressive enough to remove most tints, gentle
 * enough not to erode thin digit strokes.
 *
 * Falls back to the original blob on any failure — preprocessing
 * helping is gravy, not contractual.
 */
async function preprocessImageForOcr(file: Blob): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined') return file;
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imageData.data;
    for (let i = 0; i < px.length; i += 4) {
      const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const v = gray > 160 ? 255 : 0;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
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
): Promise<{ text: string; confidence: number }> {
  const createWorker = await loadTesseract();
  const worker = await withTimeout(
    createWorker(OCR_LANG),
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
    await worker.setParameters({ tessedit_pageseg_mode: '6' as never });
    const preprocessed = await preprocessImageForOcr(file);
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
    createWorker(OCR_LANG),
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

/* ------------------------------------------------------------------ */
/* Catalog matching                                                     */
/*                                                                      */
/* Strategy: linear regex per template, anchored on the alias text.    */
/* The pattern walks `alias → between → number → tail-with-refrange →  */
/* unit` and captures (value, refMin?, refMax?, printed-unit?). The    */
/* tail's optional ref-range absorber + the cutoff-prefix lookbehind   */
/* defend the "Reference Range Trap" (capturing the lab's upper bound  */
/* as the user's value) that linear scans are most vulnerable to.      */
/*                                                                      */
/* Audit note: an alternative architecture would do TRUE column-       */
/* geometry extraction — detect the "Result" / "Reference" column     */
/* headers, project each text item to a column, and only consider     */
/* values in the Result column. This is more robust on adversarial    */
/* multi-column templates but a multi-day rewrite. The current         */
/* defenses (ref-range absorber, cutoff lookbehind, bounded between-   */
/* window, page-boundary sentinel) close the specific failure modes   */
/* the audit identified for the linear approach. Column geometry is a  */
/* deferred backlog item, not an active defect.                        */
/* ------------------------------------------------------------------ */

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasContainsUnit(
  alias: string,
  template: BiomarkerTemplate,
): boolean {
  if (!template.unit) return false;
  const a = alias.toLowerCase();
  if (a.includes(template.unit.toLowerCase())) return true;
  for (const u of template.unitAliases ?? []) {
    if (u.length > 0 && a.includes(u.toLowerCase())) return true;
  }
  return false;
}

/**
 * Detect a count-prefix multiplier in a printed unit string.
 *
 * Indian labs print platelets/WBC as "245 thou/cumm" or "2.45 lakh/cumm"
 * rather than the canonical raw count. The catalog's `platelets`
 * template uses /cumm (raw); a captured value of `245` against a
 * printed unit of `thou/cumm` is actually 245,000.
 *
 * Returns the linear multiplier (1, 1e3, 1e5, 1e6). The reconciliation
 * step in `extractMarkerValue` computes `printedMult / catalogMult` and
 * scales — so a catalog template already in `million/cumm` (RBC) gets
 * multiplier 1e6 too and values pass through unscaled.
 *
 * Mirror of aiParser.ts's identical helper. Mass/concentration units
 * (mg/dL, ng/mL, g/dL) return 1; per-marker canonical unit already
 * enforces scale on those.
 */
function unitMultiplier(unit: string | null | undefined): number {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  // Lakh = 1e5. Indian English convention. Variants: lakh, lakhs,
  // lac (older), lacs (older plural).
  if (/(^|[^a-z])(lakh|lakhs|lac|lacs)([^a-z]|$)/.test(u)) return 1e5;
  // Million = 1e6. Variants: million, mill, mio (German/European
  // notation seen on some imported labs), and the various 10^6
  // typesettings — plain `10^6`, the superscript `10⁶`, the `E`
  // notation `10E6`, and `x10^6` / `x 10^6` with optional space.
  if (
    /(^|[^a-z])(millions|million|mill|mio)([^a-z]|$)/.test(u) ||
    /\b10\s*\^?\s*6\b/.test(u) ||
    /x\s*10\s*\^?\s*6/.test(u) ||
    /10\s*e\s*6\b/.test(u) ||
    /10⁶/.test(u)
  ) {
    return 1e6;
  }
  // Thousand = 1e3. Variants: thou, thousand, 10^3 / 10³ / 10E3 /
  // x10^3 with optional spacing.
  if (
    /(^|[^a-z])(thousands|thousand|thou)([^a-z]|$)/.test(u) ||
    /\b10\s*\^?\s*3\b/.test(u) ||
    /x\s*10\s*\^?\s*3/.test(u) ||
    /10\s*e\s*3\b/.test(u) ||
    /10³/.test(u)
  ) {
    return 1e3;
  }
  return 1;
}

/**
 * Extract a single marker's value from text using its template.
 *
 * Per-alias gating:
 *   - alias contains its own unit ("Density (million per ml)")
 *       → `alias <80 chars> number`                  (no unit gate)
 *   - alias doesn't name its unit, template has one
 *       → `alias <80 chars> number <30 chars> unit`  (strict)
 *   - template has no unit (pH)
 *       → `alias <80 chars> number`
 *
 * Sanity check: rejects values >5× outside the healthy band — catches
 * data-entry errors and mis-parses (e.g. picking up the page number
 * instead of the value).
 */
type ExtractedMarker = {
  value: number;
  /** The reference range the lab itself printed alongside the value,
   *  captured by the `tail` regex's ref-range slot. Undefined when the
   *  row didn't include a printed range or the parser couldn't fit it
   *  into the recognised shape. */
  labRefMin?: number;
  labRefMax?: number;
};

function extractMarkerValue(
  text: string,
  template: BiomarkerTemplate,
): ExtractedMarker | null {
  // Bounded between-window: allow AT MOST one newline between the
  // alias and the number. Cross-row glue matches were a real false-
  // positive vector — a marker on row N could pair with a number on
  // row N+5 if both fell within 80 chars under the old `[\\s\\S]`
  // version. We still need to admit the common "label on its own line,
  // value on the next line" layout (Indian-lab tabular reports use it
  // heavily after reconstructByPosition splits cells onto separate
  // lines), so we permit exactly one `\n` with a tight pre-newline
  // budget. The PAGE_BOUNDARY_SENTINEL emitted by OCR carries `\n\n`
  // around it, which this pattern can't cross — page-skip glue is
  // structurally prevented.
  // Make the optional cross-newline alternation LAZY (`??`) so the
  // engine prefers same-line matches when one is available. Without
  // the lazy quantifier the greedy `?` would happily skip a digit on
  // the current line to land on a digit on the next line — turning
  // "Total WBC Count 7200 /cumm\nTotal RBC Count 5.2 …" into a WBC
  // match for "5.2" when the right answer is "7200" on the same line.
  // Two binding shapes, same-line preferred:
  //   sameLine — alias and number on one reconstructed line.
  //   nextLine — the "label on its own line, value on the next line"
  //     tabular layout Indian labs use heavily. The post-newline run is
  //     LETTER-FREE so we only bind to a bare value cell ("13.5",
  //     "5.00 %"), never to a DIFFERENT row's label+value.
  // Why the letter-free guard: when OCR drops a section's real data rows,
  // a leftover row can sit directly under the section header. The header
  // word then reaches across the newline into that unrelated row —
  // "Motility\nVitality 5.00 %" made Total motility read 5 (vitality), and
  // "Morphology (Pap stain)\nExcess residual cytoplasm 0.00 %" made
  // Morphology read 0. Both are a header binding to the next labelled
  // row's value; banning letters before the number on the crossed line
  // structurally prevents it while preserving genuine value-cell layouts.
  const sameLine = '[^\\n]{0,80}?';
  const nextLine = '[^\\n]{0,40}?\\n[^A-Za-z\\n]{0,80}?';
  const between = `(?:${sameLine}|${nextLine})`;
  // Number pattern with a leading negative lookbehind. Rejects:
  //   - one-sided reference cutoffs (`<2.00`, `>5.00`, `≤140`, `≥1.5`)
  //     — labs print these as their reference threshold, not as the
  //     user's measured value.
  //   - mid-decimal starts (digit or `.` immediately before) — without
  //     this, the cutoff `<2.00` would have its `<` blocked but the
  //     engine could backtrack and bind `00` as the value (starting
  //     at the `.`'s right boundary).
  //   - mid-digit starts — `(?<!\\d)` so a captured number can't begin
  //     inside another number.
  const numPattern = '(?<![<>≤≥\\d.])(-?\\d+(?:\\.\\d+)?)';
  // Between number and unit: up to 30 non-digit chars, OPTIONALLY
  // followed by a reference-range shape ("12-14", "150 to 450",
  // "80–99") and then up to 30 more non-digit chars before the unit.
  //
  // Why the optional ref-range slot exists: many Indian lab reports
  // (and older British/Commonwealth formats) print the row as
  // `Marker  Value  RefMin - RefMax  Unit` — the reference range sits
  // BETWEEN the value and the unit, not after them. The previous tail
  // ([^\d\n]{0,30}?) refused to span digits, so it either failed the
  // match (best case) or captured the ref-range max as the value
  // (worst case, e.g. "Hemoglobin 15 male: 14 - 16 g%" captured 16).
  //
  // The optional ref-range is shaped strictly — `\d+(.\d+)? sep \d+(.\d+)?`
  // where sep is a hyphen/en-dash/em-dash or the literal word "to" —
  // so it only absorbs digits that LOOK like a range. The original
  // protection against "Vitamin D (25-OH) 28 ng/mL" capturing "25" is
  // preserved because "(25-OH)" doesn't match the ref-range shape:
  // the engine then backtracks and captures 28 correctly.
  //
  // The ref-range slot is now CAPTURED via groups so we can surface
  // the lab's printed range in the UI (CRITICAL 2 in the architectural
  // audit — "lab said normal, app says concern" trust break). Indices
  // m[3], m[4] hold refMin / refMax when matched. The pattern also
  // accepts the one-sided forms "<X" and ">X" (common in Indian labs)
  // and the ":" / "Reference Range" lead-ins that some templates use.
  const refRangeBody =
    '(\\d+(?:\\.\\d+)?)\\s*(?:[-–—]|to)\\s*(\\d+(?:\\.\\d+)?)';
  const tail = `[^\\d\\n]{0,30}?(?:${refRangeBody}[^\\d\\n]{0,30}?)?`;

  // normalizeMu on the catalog side mirrors the call inside normalize()
  // for the input text — without both sides agreeing on µ vs μ, units
  // that differ only in code point silently fail to match.
  // Alt-unit spellings (SI mmol/L, µmol/L, …) are admitted into the gate
  // too, so a report printed in those units still matches. The captured
  // token is reconciled to the canonical unit below via the template's
  // per-marker conversion factor.
  const altUnitTokens = (template.altUnits ?? []).flatMap((a) => a.units);
  const unitTokens = template.unit
    ? [template.unit, ...(template.unitAliases ?? []), ...altUnitTokens]
        .filter((u) => u.length > 0)
        .map((u) => escapeRegex(normalizeMu(u)))
    : [];
  // Capture the matched unit token so we can apply unitMultiplier
  // reconciliation when the lab prints in a different magnitude than
  // our catalog's canonical unit (e.g. "245 thou/cumm" → 245,000
  // against a /cumm template).
  //
  // Also widen the unit gate to admit count-prefixes IN FRONT of the
  // catalog unit. The catalog can't list every prefix×base combo
  // explicitly because they multiply combinatorially (thou/cumm,
  // lakh/cumm, thou/mm3, lakh/μL, …). Instead we accept an optional
  // prefix word (lakh|lac|thou|thousand|million|mill or a 10^N
  // shorthand) immediately before a known catalog unit, and let
  // unitMultiplier() figure out the scaling.
  // Optional count-prefix that can sit before the catalog's bare unit.
  // Mirrors the families recognised by unitMultiplier(): the named
  // prefixes (lakh/lac/thou/thousand/million/mill/mio) and the
  // exponent typesettings (10^N, 10ᴺ, 10EN, x10^N) for N ∈ {3, 6}.
  const prefixPattern =
    '(?:' +
    '(?:lakh|lakhs|lac|lacs|thou|thousand|million|mill|mio)\\s*[/]?\\s*' +
    '|' +
    '(?:x?\\s*10\\s*(?:\\^|e|⁶|³)?\\s*[36]?)\\s*[/]?\\s*' +
    ')?';
  const unitGate =
    unitTokens.length > 0
      ? `(${prefixPattern}(?:${unitTokens.join('|')}))`
      : '';

  for (const alias of template.aliases) {
    const aliasEsc = escapeRegex(alias);
    const skipUnit = !template.unit || aliasContainsUnit(alias, template);
    // L-8: Even when we skip the unit gate (alias names its own unit, or
    // the template is unitless), require the number to end on a non-word
    // boundary. Without this, "Density (million per ml) reading 2024"
    // would capture the year 2024 as a value — the surrounding word
    // characters were valid as a number boundary under the looser
    // version of the pattern. Adding `(?!\\w)` makes the engine reject
    // a digit run that abuts a letter on the right, which catches the
    // metadata-row false positives.
    // Token-boundary guards around the alias. Without a RIGHT-side
    // letter boundary, a short alias that is a prefix of a longer word
    // matches inside it: 'pH' matched the "Ph" in "Physical Examination"
    // (the seminogram section header), and the between-window then bound
    // the next number — "Collection time 11.00" — so pH surfaced as 11
    // instead of the real 7.5 two rows down. The LEFT-side guard is the
    // mirror case (alias as a suffix, e.g. a stray "...someRBC"). Digits
    // and symbols are intentionally NOT boundaries: aliases legitimately
    // abut a value ("Density (million per ml)103") or end in '%'/')'.
    const lb = '(?<![A-Za-z])';
    const rb = '(?![A-Za-z])';
    const pattern = skipUnit
      ? `${lb}${aliasEsc}${rb}${between}${numPattern}(?!\\w)`
      : `${lb}${aliasEsc}${rb}${between}${numPattern}${tail}${unitGate}`;
    const m = text.match(new RegExp(pattern, 'i'));
    if (!m) continue;
    const raw = parseFloat(m[1]);
    if (Number.isNaN(raw)) continue;
    // Capture group layout depends on whether skipUnit branched off.
    //   skipUnit=true:  m[1]=value (no other groups)
    //   skipUnit=false: m[1]=value, m[2]=refMin?, m[3]=refMax?, m[4]=unit
    // refMin/refMax exist only when the lab printed a ref-range
    // matching the strict `\d+(.\d+)? sep \d+(.\d+)?` shape; otherwise
    // they're undefined (the tail's outer `(?:...)?` was skipped).
    const printedUnit = !skipUnit && m[4] ? m[4] : '';
    const labRefMinStr = !skipUnit && m[2] ? m[2] : '';
    const labRefMaxStr = !skipUnit && m[3] ? m[3] : '';
    // Reconcile the lab's printed unit against the catalog's canonical
    // unit. Only do the reconciliation when we actually captured a
    // printed unit token (non-skipUnit path). When skipUnit is true,
    // the alias text already names the catalog's canonical unit
    // ("Density (million per ml)"), so the captured numeric is in
    // catalog units by construction — applying the multiplier ratio
    // would WRONGLY divide by the catalog's prefix (1e6 for
    // million/ml) and turn 103 into 0.000103.
    let scale = 1;
    if (!skipUnit && printedUnit) {
      // SI / alternative-unit conversion takes priority: when the printed
      // unit is one of the marker's altUnits, apply its exact per-marker
      // factor (e.g. glucose mmol/L → mg/dL ×18.0156). Otherwise fall back
      // to the count-prefix reconciliation (lakh / thou / million).
      const normPrinted = normalizeMu(printedUnit).toLowerCase();
      const alt = template.altUnits?.find((a) =>
        a.units.some((u) => normPrinted.includes(normalizeMu(u).toLowerCase())),
      );
      scale = alt
        ? alt.toCanonical
        : unitMultiplier(printedUnit) / unitMultiplier(template.unit);
    }
    // Clean up float-precision noise introduced by scaling — 2.45 * 1e5
    // yields 245000.00000000003 in IEEE-754, which is silly to surface
    // on a clinical dashboard. `toPrecision(12)` keeps 12 significant
    // digits (well above any real measurement precision) and drops the
    // floating-point error.
    const v = scale !== 1 ? parseFloat((raw * scale).toPrecision(12)) : raw;
    // Reject obviously-broken values up front. Floor at 0 (biomarkers
    // are non-negative even though the regex now refuses '-' anyway,
    // belt-and-braces).
    if (v < 0) continue;
    // A percentage cannot exceed 100. Values above it are data errors,
    // not measurements — e.g. P006's dummy seminogram printed "Total
    // motile (a+b+c) 117.00 %" and "Immotile (d) -17.00 %". Charting an
    // impossible 117% motility is worse than omitting it; reject and let
    // it surface in the unrecognized-rows panel instead. (The < 0 guard
    // above already drops the negative case.)
    if (template.unit === '%' && v > 100) continue;
    // Physical bound check — use template's explicit physicalMin/Max
    // when set, otherwise fall back to the 5×-span heuristic. Critical
    // status is decided later by statusForValue; this check is only
    // about rejecting values that are physically/clinically impossible.
    const span = template.max - template.min || 1;
    const physMin =
      typeof template.physicalMin === 'number'
        ? template.physicalMin
        : template.min - 5 * span;
    const physMax =
      typeof template.physicalMax === 'number'
        ? template.physicalMax
        : template.max + 5 * span;
    if (v < physMin || v > physMax) continue;
    // Scale the captured ref-range too — same multiplier logic as the
    // value. A lab printing "Platelet Count 245 (150 - 450) thou/cumm"
    // captures refMin=150, refMax=450 in printed thou units; we
    // multiply by the same scale so the user sees the lab's range in
    // the catalog's canonical units.
    const labRefMinNum = labRefMinStr ? parseFloat(labRefMinStr) : NaN;
    const labRefMaxNum = labRefMaxStr ? parseFloat(labRefMaxStr) : NaN;
    const labRef =
      Number.isFinite(labRefMinNum) && Number.isFinite(labRefMaxNum)
        ? {
            min:
              scale !== 1
                ? parseFloat((labRefMinNum * scale).toPrecision(12))
                : labRefMinNum,
            max:
              scale !== 1
                ? parseFloat((labRefMaxNum * scale).toPrecision(12))
                : labRefMaxNum,
          }
        : undefined;
    return { value: v, labRefMin: labRef?.min, labRefMax: labRef?.max };
  }
  return null;
}

/**
 * Run the entire biomarker catalog against text. Returns the resulting
 * Biomarker array (with derived status/copy) for every template that
 * matched.
 */
export function extractBiomarkersFromText(text: string): Biomarker[] {
  const normalized = normalize(text);
  const found: Biomarker[] = [];
  for (const template of biomarkerCatalog) {
    // biomarkerCatalog contains each template exactly once — the prior
    // `seen` Set/dedup was dead code that suggested an enforced
    // invariant the loop body didn't need. Dropped to keep the loop
    // readable; if catalog duplication ever needs to be defended
    // against, dedupe at the catalog source, not here.
    const extracted = extractMarkerValue(normalized, template);
    if (extracted === null) continue;
    const labRef =
      typeof extracted.labRefMin === 'number' &&
      typeof extracted.labRefMax === 'number'
        ? { min: extracted.labRefMin, max: extracted.labRefMax }
        : undefined;
    found.push(markerFromTemplate(template, extracted.value, labRef));
  }
  return deriveComputedMarkers(found);
}

/**
 * Lazy-built regex that matches a single label-value-unit triplet
 * anchored by a unit token that appears anywhere in the catalog.
 *
 * Why anchor on the unit: lab metadata rows ("Patient ID: 12345",
 * "Age: 35 yrs", "Page 2 of 5") rarely carry a clinical unit, so
 * gating on known units kills almost all the false positives without
 * needing a more sophisticated layout parser.
 */
// Caches the unit-anchored row regex per `biomarkerCatalog` reference
// — WeakMap keyed on the catalog array means HMR or a future test that
// swaps the catalog gets a fresh regex automatically, without us having
// to remember to invalidate. Built from the *normalized* (U+03BC) form
// of every catalog unit so it agrees with the text returned from
// normalize().
const UNKNOWN_ROW_REGEX_CACHE: WeakMap<typeof biomarkerCatalog, RegExp> =
  new WeakMap();
function getUnknownRowRegex(): RegExp {
  const cached = UNKNOWN_ROW_REGEX_CACHE.get(biomarkerCatalog);
  if (cached) return cached;
  const units = new Set<string>();
  for (const t of biomarkerCatalog) {
    if (t.unit) units.add(normalizeMu(t.unit));
    for (const u of t.unitAliases ?? []) {
      if (u.length > 0) units.add(normalizeMu(u));
    }
  }
  // Sort longer first so e.g. "ng/dL" wins over a substring "g/dL"
  // when both could match.
  const unitPattern = [...units]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const re = new RegExp(
    `([A-Za-z][\\w\\s\\(\\)\\-\\/\\.,'#]{2,50}?)(?:\\s*[:\\-=\\u2013\\u2212]\\s*|\\s+)(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?![A-Za-z0-9])`,
    'gi',
  );
  UNKNOWN_ROW_REGEX_CACHE.set(biomarkerCatalog, re);
  return re;
}

/**
 * Find label-value-unit rows in the text that the catalog didn't
 * extract. Two-step heuristic:
 *
 *   1. Match every `<label> <number> <unit>` triplet where the unit is
 *      known to the catalog. The unit gate kills most metadata rows.
 *   2. Drop triplets whose (value, unit) pair already appears in the
 *      extracted markers — we assume one numeric+unit pair per lab row.
 *
 * Returns up to 10 deduped rows. Surfaced in the confirm step so the
 * user knows whether a short extraction list reflects an unusual report
 * or a parser gap.
 */
export function findUnrecognizedRows(
  text: string,
  extracted: Biomarker[],
): string[] {
  // M-4: Cap the input size so matchAll doesn't run a 50ms+ scan over
  // an adversarial blob on phones. Real lab extractions are well under
  // the cap; anything beyond is either junk OCR output or a deliberately
  // crafted hostile input — neither case benefits from a complete
  // scan. The truncation is invisible to the user since the function
  // returns at most 10 rows anyway.
  const normalized = normalize(text).slice(0, UNKNOWN_ROW_INPUT_CAP);
  const extractedByUnit = new Map<string, Set<number>>();
  for (const m of extracted) {
    const unit = (m.unit || '').toLowerCase();
    if (!extractedByUnit.has(unit)) extractedByUnit.set(unit, new Set());
    extractedByUnit.get(unit)!.add(m.value);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  const re = getUnknownRowRegex();
  // matchAll needs a fresh lastIndex on each call when reused.
  re.lastIndex = 0;
  for (const match of normalized.matchAll(re)) {
    const label = match[1].trim().replace(/\s+/g, ' ');
    const value = parseFloat(match[2]);
    const unit = match[3];

    if (extractedByUnit.get(unit.toLowerCase())?.has(value)) continue;
    // Skip labels that are obviously not biomarker names — numeric
    // prefixes, all-caps single words (likely section headers).
    if (/^\d/.test(label)) continue;
    if (label.length < 3) continue;
    // Skip rows that are clearly part of a reference-range printout
    // rather than a marker measurement. Indian labs often include
    // explanatory rows like "Normal Range 200 mg/dL" or
    // "Biological Reference 100 mg/dL" next to a marker — these match
    // the label+number+unit shape but they're metadata, not
    // measurements, and surface as noise in the "we saw these rows
    // but couldn't map them" panel. (Range-style rows like
    // "Reference Range: 70-100 mg/dL" don't match the regex at all
    // because the colon isn't in the label char class and the dash
    // breaks the number-then-unit shape — those don't need filtering.)
    if (REF_ROW_KEYWORDS.test(label)) continue;

    const key = `${label.toLowerCase()}::${value}::${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(`${label} ${value} ${unit}`);
    if (out.length >= 10) break;
  }
  return out;
}

/** Words that mark a row as printed reference-range metadata rather
 *  than a marker measurement. Case-insensitive substring match. */
const REF_ROW_KEYWORDS =
  /\b(reference|ref\s*range|normal\s*range|biological\s*reference|bio\s*ref|desirable|optimal\s*range)\b/i;

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
/* Scope verification                                                  */
/*                                                                      */
/* The product is scoped to general metabolic biomarkers + HPA-axis    */
/* endocrine panels (see catalog in data/biomarkers.ts). Other lab     */
/* outputs people might upload — viral antigen panels, X-ray narrative */
/* reports, dental records — would otherwise fall through to the       */
/* generic "we read it but didn't recognise any lab values" error.     */
/* That message is technically correct but doesn't tell the user WHY:  */
/* they wonder if our parser is buggy, when actually the document is   */
/* fundamentally a different category of report.                       */
/*                                                                      */
/* This classifier looks for clusters of keywords that strongly imply  */
/* an out-of-scope document, so the UI can show a category-specific    */
/* refusal message instead of "no matches."                            */
/*                                                                      */
/* Threshold: 2+ DISTINCT keyword hits from a single category. A lone  */
/* mention of "HIV antibody" inside an otherwise-comprehensive panel   */
/* doesn't trigger — only documents that are dominantly out-of-scope.  */
/* ------------------------------------------------------------------ */

export type OutOfScopeCategory = 'viral' | 'imaging' | 'physical-exam';

/**
 * Per-category keyword sets, with a "definitive" subset that's specific
 * enough to fire on a single hit.
 *
 * Stored lowercased; we match against the normalized lowercased text.
 * `keywords` is the full pool used to count distinct hits (relaxed
 * mode: 1 definitive OR 2+ distinct; strict mode: 2+ distinct only).
 *
 * Definitive terms MUST also appear in `keywords` — this invariant is
 * asserted at module init below, so a future divergence becomes a
 * loud test failure rather than a silent tie-break bug.
 */
type OutOfScopeKeywordSet = {
  /** Anything plausibly indicative of the category. Multiple hits
   *  required to trigger out-of-scope on its own. Conservative entries
   *  ("x-ray" inside a referral note) live here too — the 2+ gate
   *  keeps them safe. */
  keywords: readonly string[];
  /** Specific enough that a single appearance is sufficient to flag
   *  the category. Used for relaxed-mode triggering on the failure
   *  path; ignored in strict mode. */
  definitive: readonly string[];
};

const OUT_OF_SCOPE: Record<OutOfScopeCategory, OutOfScopeKeywordSet> = {
  viral: {
    keywords: [
      'dengue ns1',
      'dengue igm',
      'dengue igg',
      'dengue',
      // "Dengue Combo NS1+IgM+IgG" / "NS1+IgM/IgG" style row labels —
      // some labs print them as a single combo line, so the
      // dengue-specific keywords above only hit once. Adding the
      // bare antibody fragments lifts the hit count past the
      // 2-distinct gate. False-positive risk is low: ns1 and igm/igg
      // outside an infectious-panel context are extremely rare in a
      // metabolic/HPA report.
      'ns1',
      'igm/igg',
      'igm+igg',
      'plasmodium',
      'malaria',
      'mp test',
      'sars-cov-2',
      'sars cov 2',
      'covid-19',
      'covid 19',
      'rt-pcr',
      'rt pcr',
      'hiv 1',
      'hiv 2',
      'hiv antibody',
      'anti-hiv',
      'hbsag',
      'hbeag',
      'anti-hcv',
      'anti-hbs',
      'hepatitis b surface',
      'hepatitis c',
      'influenza a',
      'influenza b',
      'h1n1',
      'h3n2',
      'chikungunya',
      'syphilis',
      'vdrl',
      'tpha',
      'rpr',
      'typhoid',
      'widal',
      'salmonella typhi',
    ],
    definitive: [
      'dengue',
      'hbsag',
      'anti-hcv',
      'anti-hbs',
      'widal',
      'vdrl',
      'tpha',
      'chikungunya',
      'plasmodium',
    ],
  },
  imaging: {
    keywords: [
      'x-ray',
      'x ray',
      'radiograph',
      'magnetic resonance',
      'mri brain',
      'mri chest',
      'mri abdomen',
      'mri pelvis',
      'ct scan',
      'computed tomography',
      'ct chest',
      'ct abdomen',
      'ultrasonography',
      'sonography',
      'usg abdomen',
      'usg pelvis',
      'doppler study',
      'no focal opacity',
      'no significant abnormality detected',
      'impression:',
      // ECG/EKG — tracings, not lab values
      'ecg',
      'ekg',
      'electrocardiogram',
      'qrs complex',
      'sinus rhythm',
      'st elevation',
      'st depression',
    ],
    definitive: [
      'no focal opacity',
      'no significant abnormality detected',
      'computed tomography',
      'sinus rhythm',
      'qrs complex',
    ],
  },
  'physical-exam': {
    keywords: [
      'audiometry',
      'audiogram',
      'pure tone average',
      'air conduction',
      'bone conduction',
      'visual acuity',
      'snellen',
      'refraction',
      'fundus examination',
      'intraocular pressure',
      'periodontal',
      'gingival',
      'occlusion',
      'mandibular',
      'maxillary',
      'caries',
      'oral cavity',
      'tonsillar',
      'turbinate',
    ],
    definitive: [
      'audiometry',
      'pure tone average',
      'snellen',
      'fundus examination',
      'periodontal',
      'caries',
    ],
  },
};

// Invariant: every definitive term must also live in the main keyword
// list. Without this guarantee, a definitive-only term would never
// contribute to the `hits` count used for tie-breaking — its category
// would lose ties to any 1-hit category from another domain. Run this
// check at module load (cheap, runs once) so divergence shows up as a
// loud failure at app/test boot rather than as a quiet
// misclassification at runtime.
for (const cat of Object.keys(OUT_OF_SCOPE) as OutOfScopeCategory[]) {
  const main = new Set(OUT_OF_SCOPE[cat].keywords);
  for (const term of OUT_OF_SCOPE[cat].definitive) {
    if (!main.has(term)) {
      throw new Error(
        `OUT_OF_SCOPE invariant: definitive term "${term}" in category "${cat}" is missing from the main keywords list. Add it (or drop it from definitive).`,
      );
    }
  }
}

/** Count distinct keyword hits within one category. We match on the
 *  lowercased text and require WORD-ish boundaries to avoid e.g.
 *  matching "dengue" inside "endenguered" — admittedly contrived, but
 *  this also protects against partial substrings like "ent" matching
 *  inside "patient". For multi-word keywords (e.g. "dengue ns1") we
 *  fall back to plain substring matching since adding regex anchors
 *  would over-restrict legitimate variants ("Dengue-NS1", "Dengue/NS1"). */
function countDistinctHits(text: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (
      kw.includes(' ') ||
      kw.includes('-') ||
      kw.includes('/') ||
      kw.includes('+')
    ) {
      if (text.includes(kw)) hits += 1;
    } else {
      // Single-word — require non-letter boundary to avoid substring traps.
      const re = new RegExp(`(^|[^a-z])${escapeRegex(kw)}([^a-z]|$)`, 'i');
      if (re.test(text)) hits += 1;
    }
  }
  return hits;
}

/**
 * Returns the strongest out-of-scope category if the text appears to be
 * dominated by it, or null otherwise.
 *
 * Trigger thresholds:
 *   - strict mode (default): 2+ distinct keywords from one category.
 *   - relaxed mode: ALSO triggers on a single definitive-term hit, for
 *     compact reports where the panel header is the only signal
 *     ("HBsAg ELISA: Non-reactive" alone is enough to know).
 *
 * The two call sites use different modes on purpose:
 *   - parseUploadedReport's FAILURE branch uses relaxed — a zero-match
 *     extraction is the moment to be most generous about reclassifying
 *     "this isn't a lab panel".
 *   - parseUploadedReport's SUCCESS branch uses strict — a mostly-
 *     metabolic report that boilerplates "Dengue Antibody: Not tested"
 *     shouldn't trip the "we ignored some sections" banner on a single
 *     polite no-test row.
 *
 * Ties broken by total hit count (`hits` from the main keyword list,
 * NOT the definitive subset). Pure function — no side effects.
 */
export function classifyOutOfScope(
  text: string,
  mode: 'strict' | 'relaxed' = 'relaxed',
): OutOfScopeCategory | null {
  if (!text) return null;
  const lowered = text.toLowerCase();
  let best: { category: OutOfScopeCategory; hits: number } | null = null;
  for (const category of Object.keys(OUT_OF_SCOPE) as OutOfScopeCategory[]) {
    const hits = countDistinctHits(lowered, OUT_OF_SCOPE[category].keywords);
    const definitiveHit =
      mode === 'relaxed' &&
      countDistinctHits(lowered, OUT_OF_SCOPE[category].definitive) > 0;
    if ((hits >= 2 || definitiveHit) && (!best || hits > best.hits)) {
      best = { category, hits };
    }
  }
  return best?.category ?? null;
}

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
  let pdf: PdfDoc;
  try {
    pdf = await pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
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
      const ocrBiomarkers = extractBiomarkersFromText(ocr.text);
      return {
        biomarkers: ocrBiomarkers,
        source: 'pdf-ocr',
        rawText: rawTextForDisplay(ocr.text),
        unrecognizedRows: findUnrecognizedRows(ocr.text, ocrBiomarkers),
        ocrPagesAttempted: ocr.pagesAttempted,
        ocrPagesSkipped: ocr.pagesSkipped,
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
      return {
        biomarkers: winner.biomarkers,
        source: 'pdf-text',
        strategy: winner.name,
        rawText: winner.text,
        unrecognizedRows: findUnrecognizedRows(winner.text, winner.biomarkers),
      };
    }

    // Text layer present but zero catalog matches → try OCR. Scanned-
    // into-PDF reports with a thin text layer of metadata sometimes
    // hit this path.
    const ocr = await runPdfOcr(pdf);
    const ocrBiomarkers = extractBiomarkersFromText(ocr.text);
    return {
      biomarkers: ocrBiomarkers,
      source: 'pdf-ocr',
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

async function parseImage(file: File): Promise<PdfParseResult> {
  const { text, confidence } = await runImageOcr(file);
  const biomarkers = extractBiomarkersFromText(text);
  return {
    biomarkers,
    source: 'image-ocr',
    rawText: text,
    unrecognizedRows: findUnrecognizedRows(text, biomarkers),
    ocrConfidence: confidence,
  };
}
