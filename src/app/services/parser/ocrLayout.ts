/**
 * OCR layout reconstruction from word bounding boxes.
 *
 * Tesseract returns a text blob whose line grouping (in PSM 6, "single uniform
 * block") can INTERLEAVE the columns of a lab table — the result column and the
 * reference-range column get read across each other, so two markers' rows come
 * out fused ("MCH 27.00 - 3200 py 24.8 MCHC 30.00 3500"). But Tesseract also
 * exposes every word's bounding box. Re-grouping words strictly by VERTICAL
 * position (rows) and ordering each row LEFT-TO-RIGHT reconstructs the visual
 * table far more faithfully than the flat `data.text`.
 *
 * This module is PURE and dependency-free so it can be unit-tested with
 * synthetic word boxes — the one part of the OCR path that CAN be tested
 * without a real recogniser. It is wired in as an ADDITIONAL candidate string
 * (see pdfParser): the matcher still picks whichever candidate yields the most
 * markers, so a poor reconstruction can only ever be ignored, never regress the
 * raw-text path.
 */

export type OcrBbox = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; bbox: OcrBbox };

/**
 * Flatten a Tesseract `Page.blocks` hierarchy (block → paragraph → line →
 * word) into a flat word list. Fully defensive: tolerates null/missing levels
 * and unexpected shapes, returning only well-formed {text, bbox} words. Never
 * throws — a malformed blocks tree yields [], and the caller falls back to the
 * raw OCR text.
 */
export function wordsFromBlocks(blocks: unknown): OcrWord[] {
  const out: OcrWord[] = [];
  if (!Array.isArray(blocks)) return out;
  const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
  for (const block of blocks) {
    const paras = (block as { paragraphs?: unknown })?.paragraphs;
    if (!Array.isArray(paras)) continue;
    for (const para of paras) {
      const lines = (para as { lines?: unknown })?.lines;
      if (!Array.isArray(lines)) continue;
      for (const line of lines) {
        const words = (line as { words?: unknown })?.words;
        if (!Array.isArray(words)) continue;
        for (const w of words) {
          const text = (w as { text?: unknown })?.text;
          const b = (w as { bbox?: Partial<OcrBbox> })?.bbox;
          if (
            typeof text === 'string' &&
            text.trim() &&
            b &&
            num(b.x0) &&
            num(b.y0) &&
            num(b.x1) &&
            num(b.y1)
          ) {
            out.push({
              text: text.trim(),
              bbox: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 },
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Re-group OCR words into rows by vertical overlap, order each row
 * left-to-right, and emit one text line per row.
 *
 * Algorithm (O(n log n)):
 *   1. Sort words top-to-bottom (by y0, then x0).
 *   2. Sweep: a word joins the current row if it overlaps the row's running
 *      y-band by ≥40% of the smaller height; otherwise it starts a new row.
 *      (Sorting by y0 means only the current row can be the match.)
 *   3. Within each row, sort by x0 and join with spaces.
 *
 * The 40% overlap threshold tolerates sub/superscripts and slight baseline
 * skew while still splitting genuinely separate rows — which is exactly what
 * un-interleaves a table Tesseract read across.
 */
export function reconstructLinesFromWords(words: OcrWord[]): string {
  const clean = words.filter(
    (w) => w.text && w.bbox && w.bbox.y1 > w.bbox.y0,
  );
  if (clean.length === 0) return '';
  const sorted = [...clean].sort(
    (a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0,
  );
  const rows: OcrWord[][] = [];
  let bandY0 = -Infinity;
  let bandY1 = -Infinity;
  for (const w of sorted) {
    if (rows.length > 0) {
      const overlap =
        Math.min(bandY1, w.bbox.y1) - Math.max(bandY0, w.bbox.y0);
      const minH = Math.max(
        1,
        Math.min(bandY1 - bandY0, w.bbox.y1 - w.bbox.y0),
      );
      if (overlap >= minH * 0.4) {
        rows[rows.length - 1].push(w);
        bandY0 = Math.min(bandY0, w.bbox.y0);
        bandY1 = Math.max(bandY1, w.bbox.y1);
        continue;
      }
    }
    rows.push([w]);
    bandY0 = w.bbox.y0;
    bandY1 = w.bbox.y1;
  }
  return rows
    .map((row) =>
      row
        .sort((a, b) => a.bbox.x0 - b.bbox.x0)
        .map((w) => w.text)
        .join(' '),
    )
    .join('\n');
}
