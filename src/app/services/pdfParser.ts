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
import {
  loadPdfjs,
  runPdfOcr,
  runImageOcr,
  rawTextForDisplay,
  tagOcrConfidence,
  MIN_USABLE_TEXT_LENGTH,
  UNSHARP_AMOUNT,
  OCR_SECOND_PASS_MIN_MARKERS,
  type PdfDoc,
} from './parser/ocrPipeline';
// prewarmOcr is called by the upload screen via api.ts, which imports it
// from './pdfParser' — keep that path working with a re-export.
export { prewarmOcr } from './parser/ocrPipeline';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

/** Mean Tesseract confidence (0–100) at or below which an OCR read is
 *  treated as degraded. Clean scans land ~85–95; low-resolution, noisy,
 *  or oddly-encoded pages drop well under this. We don't discard the
 *  values — OCR can still be mostly right — but the confirm screen shows
 *  a "double-check these against your report" banner so a shaky read
 *  isn't presented as authoritative. Surfaced via `ocrConfidence` on the
 *  parse result; the UI imports this threshold so the line lives once. */
export const OCR_LOW_CONFIDENCE_THRESHOLD = 65;

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
