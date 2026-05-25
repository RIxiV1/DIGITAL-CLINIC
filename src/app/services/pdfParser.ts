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
 *  this resolution to read small lab-table fonts reliably. */
const PDF_RENDER_SCALE = 2.5;

/** Minimum char count before we trust the PDF text layer. Below this,
 *  the layer is probably stripped/empty (scanned PDF) — fall to OCR. */
const MIN_USABLE_TEXT_LENGTH = 50;

/** Per-page OCR timeout. Tesseract usually finishes in 5-15s, but can
 *  hang on garbage input. 45s is generous and still well below "the
 *  user gives up and refreshes". */
const OCR_PAGE_TIMEOUT_MS = 45_000;

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
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
        .default;
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
export function normalizeMu(s: string): string {
  return s.replace(/µ/g, 'μ');
}

function normalize(text: string): string {
  let t = normalizeMu(text);
  t = t.replace(/[ \t\r\f\v]+/g, ' ');             // collapse horizontal ws
  t = t.replace(/ *\n+ */g, '\n');                 // clean newlines
  t = t.replace(/(\d) \./g, '$1.');                // "5 ." -> "5."
  t = t.replace(/\. (\d)/g, '.$1');                // ". 5" -> ".5"
  t = t.replace(/(\d) %/g, '$1%');                 // "5 %" -> "5%"
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
  const items: PdfTextItemLike[] = [];
  for (const it of content.items) {
    if (isPdfTextItem(it) && it.str.trim()) items.push(it);
  }
  if (items.length === 0) return '';

  // Adaptive Y tolerance — median glyph height × 0.6.
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
    const width =
      item.width ?? item.str.length * (item.height ?? 8) * 0.5;
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
  ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']
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
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
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
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

async function runImageOcr(file: Blob): Promise<string> {
  const createWorker = await loadTesseract();
  const worker = await createWorker('eng');
  try {
    const result = await withTimeout(
      worker.recognize(file),
      OCR_PAGE_TIMEOUT_MS,
      'OCR',
    );
    return result.data.text;
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
};

async function runPdfOcr(pdf: PdfDoc): Promise<PdfOcrResult> {
  const createWorker = await loadTesseract();
  const worker = await createWorker('eng');
  try {
    let fullText = '';
    const pagesAttempted = Math.min(pdf.numPages, OCR_MAX_PAGES);
    let pagesSkipped = 0;
    for (let i = 1; i <= pagesAttempted; i++) {
      try {
        const imgData = await renderPageToImage(pdf, i);
        const result = await withTimeout(
          worker.recognize(imgData),
          OCR_PAGE_TIMEOUT_MS,
          `OCR page ${i}`,
        );
        fullText += result.data.text + '\n';
      } catch (pageErr) {
        // eslint-disable-next-line no-console
        console.warn(`Skipping page ${i}:`, pageErr);
        fullText += `\n[page ${i} skipped]\n`;
        pagesSkipped += 1;
      }
    }
    return { text: fullText, pagesAttempted, pagesSkipped };
  } finally {
    await worker.terminate();
  }
}

/* ------------------------------------------------------------------ */
/* Catalog matching                                                     */
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
function extractMarkerValue(
  text: string,
  template: BiomarkerTemplate,
): number | null {
  const between = '[\\s\\S]{0,80}?';
  const numPattern = '(-?\\d+(?:\\.\\d+)?)';
  // Between number and unit: no digits or newlines allowed. Without this
  // restriction, "Vitamin D (25-OH)    28      ng/mL" matched by the bare
  // 'Vitamin D' alias would capture '25' (from '25-OH') as the value
  // because 'ng/mL' appears within 30 chars later. Disallowing digits
  // in the tail forces the regex to either bind to the value
  // immediately or fail this alias and move on.
  const tail = '[^\\d\\n]{0,30}?';

  // normalizeMu on the catalog side mirrors the call inside normalize()
  // for the input text — without both sides agreeing on µ vs μ, units
  // that differ only in code point silently fail to match.
  const unitTokens = template.unit
    ? [template.unit, ...(template.unitAliases ?? [])]
        .filter((u) => u.length > 0)
        .map((u) => escapeRegex(normalizeMu(u)))
    : [];
  const unitGate = unitTokens.length > 0 ? `(?:${unitTokens.join('|')})` : '';

  for (const alias of template.aliases) {
    const aliasEsc = escapeRegex(alias);
    const skipUnit = !template.unit || aliasContainsUnit(alias, template);
    const pattern = skipUnit
      ? `${aliasEsc}${between}${numPattern}`
      : `${aliasEsc}${between}${numPattern}${tail}${unitGate}`;
    const m = text.match(new RegExp(pattern, 'i'));
    if (!m) continue;
    const v = parseFloat(m[1]);
    if (Number.isNaN(v)) continue;
    // Sanity bound — wildly outside-band values are mis-parses.
    const span = template.max - template.min || 1;
    if (v < template.min - 5 * span || v > template.max + 5 * span) continue;
    return v;
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
  const seen = new Set<string>();
  for (const template of biomarkerCatalog) {
    if (seen.has(template.id)) continue;
    const value = extractMarkerValue(normalized, template);
    if (value === null) continue;
    found.push(markerFromTemplate(template, value));
    seen.add(template.id);
  }
  return found;
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
// Caches the unit-anchored row regex once per module load. Built from
// the *normalized* (U+03BC) form of every catalog unit so it agrees
// with the text returned from normalize(). If you ever start mutating
// biomarkerCatalog at runtime, invalidate this cache too.
let unknownRowRegex: RegExp | null = null;
function getUnknownRowRegex(): RegExp {
  if (unknownRowRegex) return unknownRowRegex;
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
  unknownRowRegex = new RegExp(
    `([A-Za-z][\\w\\s\\(\\)\\-\\/\\.,'#]{2,50}?)(?:\\s*[:\\-=\\u2013\\u2212]\\s*|\\s+)(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?![A-Za-z0-9])`,
    'gi',
  );
  return unknownRowRegex;
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
  const normalized = normalize(text);
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
    if (kw.includes(' ') || kw.includes('-') || kw.includes('/') || kw.includes('+')) {
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
    if (/password/i.test(message) || (err instanceof Error && err.name === 'PasswordException')) {
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
      const tc = await page.getTextContent();
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
        rawText: ocr.text,
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
    };
  } finally {
    // Release pdfjs worker buffers. Without this, repeated uploads on
    // low-end mobile devices accumulate memory until the tab OOMs.
    void pdf.destroy().catch(() => {});
  }
}

async function parseImage(file: File): Promise<PdfParseResult> {
  const text = await runImageOcr(file);
  const biomarkers = extractBiomarkersFromText(text);
  return {
    biomarkers,
    source: 'image-ocr',
    rawText: text,
    unrecognizedRows: findUnrecognizedRows(text, biomarkers),
  };
}
