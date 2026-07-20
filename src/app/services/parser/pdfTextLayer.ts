/**
 * PDF text-layer processing: turn a pdfjs text-content object (or raw OCR
 * text) into clean candidate strings for the catalog matcher.
 *
 * Contains, in pipeline order:
 *   - type guards over pdfjs text items (avoid `any` casts)
 *   - normalize(): decimal/whitespace/comma repair (used on BOTH text-layer
 *     and OCR text, so it lives here as the shared cleanup step)
 *   - symbol-font (PUA) glyph recovery for broken subset-font text layers
 *   - the three reconstruction strategies (position / EOL / stream)
 *
 * Extracted verbatim from pdfParser.ts — no behaviour change.
 */

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

export function isPdfTextItem(item: unknown): item is PdfTextItemLike {
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

export function normalize(text: string): string {
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

export type TextContentLike = { items: unknown[] };

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
export function dePuaGlyphs(s: string): string {
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
export function remapPuaTextContent(tc: TextContentLike): TextContentLike {
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
export function reconstructByPosition(content: TextContentLike): string {
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
export function reconstructByEOL(content: TextContentLike): string {
  let out = '';
  for (const it of content.items) {
    if (!isPdfTextItem(it)) continue;
    out += it.str;
    out += it.hasEOL ? '\n' : ' ';
  }
  return out;
}

/** Naive stream-order join — fine for simple linear PDFs. */
export function reconstructByStream(content: TextContentLike): string {
  return content.items
    .filter(isPdfTextItem)
    .map((it) => it.str)
    .join(' ');
}
