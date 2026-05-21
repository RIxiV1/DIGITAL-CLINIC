/**
 * Tests for the three PDF text reconstruction strategies in pdfParser.ts.
 *
 * These exercise the most fragile bit of the parser — the multi-strategy
 * reassembly of pdfjs's flat text-items array into a usable string. The
 * tests run against hand-built textContent shapes that mimic what pdfjs
 * actually emits for known-tricky Indian-lab PDFs, so we don't need
 * pdfjs itself running in the test environment.
 *
 * Why mocks instead of real PDFs:
 *   pdfjs-dist 5.7 requires node ≥22.13 (this project pins ≥20.11), and
 *   needs DOMMatrix shims to run in node at all. Running it in vitest
 *   would be a larger infra lift than the safety it buys — these mocked
 *   shapes hit the exact edge cases that drove the multi-strategy
 *   reconstruction logic.
 */

import { describe, it, expect } from 'vitest';
import { __testInternals } from './pdfParser';

const {
  normalize,
  reconstructByPosition,
  reconstructByEOL,
  reconstructByStream,
} = __testInternals;

/** Shape pdfjs's TextItem actually has (the bits we care about). */
type Item = {
  str: string;
  height?: number;
  width?: number;
  /** pdfjs transform matrix [a, b, c, d, e, f] — we read e (x) and f (y). */
  transform?: number[];
  hasEOL?: boolean;
};

function item(
  str: string,
  opts: { x?: number; y?: number; width?: number; height?: number; hasEOL?: boolean } = {},
): Item {
  const { x = 0, y = 0, width, height = 10, hasEOL } = opts;
  return {
    str,
    height,
    width: width ?? str.length * height * 0.5,
    transform: [height, 0, 0, height, x, y],
    hasEOL,
  };
}

/* ------------------------------------------------------------------ */
/* normalize                                                            */
/* ------------------------------------------------------------------ */

describe('normalize', () => {
  it('collapses repeated horizontal whitespace', () => {
    expect(normalize('Hb     14.5')).toBe('Hb 14.5');
  });

  it('repairs decimal points split across text items ("5 ." → "5.")', () => {
    expect(normalize('HbA1c 5 .4 %')).toBe('HbA1c 5.4%');
  });

  it('repairs decimal points split the other way (". 4" → ".4")', () => {
    expect(normalize('Glucose 95 . 0 mg/dL')).toBe('Glucose 95.0 mg/dL');
  });

  it('strips US-format comma grouping (240,000 → 240000)', () => {
    expect(normalize('Platelets 240,000')).toBe('Platelets 240000');
  });

  it('strips Indian-format lakh grouping (2,40,000 → 240000)', () => {
    expect(normalize('Platelets 2,40,000')).toBe('Platelets 240000');
  });

  it('handles nested newlines deterministically', () => {
    expect(normalize('Hb\n\n  14.5\n\n\nWBC 7200')).toBe('Hb\n14.5\nWBC 7200');
  });
});

/* ------------------------------------------------------------------ */
/* reconstructByStream — simplest baseline                              */
/* ------------------------------------------------------------------ */

describe('reconstructByStream', () => {
  it('joins items with single spaces in stream order', () => {
    expect(
      reconstructByStream({
        items: [item('Hemoglobin'), item('14.5'), item('g/dL')],
      }),
    ).toBe('Hemoglobin 14.5 g/dL');
  });

  it('ignores non-text items defensively', () => {
    expect(
      reconstructByStream({
        items: [item('Hb'), { foo: 'bar' }, item('14.5')],
      }),
    ).toBe('Hb 14.5');
  });
});

/* ------------------------------------------------------------------ */
/* reconstructByEOL — respects hasEOL hints                            */
/* ------------------------------------------------------------------ */

describe('reconstructByEOL', () => {
  it('inserts newline on hasEOL=true, space otherwise', () => {
    expect(
      reconstructByEOL({
        items: [
          item('Hemoglobin'),
          item('14.5'),
          item('g/dL', { hasEOL: true }),
          item('WBC'),
          item('7200'),
        ],
      }),
    ).toBe('Hemoglobin 14.5 g/dL\nWBC 7200 ');
  });

  it('handles all-EOL items (each on its own line)', () => {
    expect(
      reconstructByEOL({
        items: [
          item('A', { hasEOL: true }),
          item('B', { hasEOL: true }),
          item('C', { hasEOL: true }),
        ],
      }),
    ).toBe('A\nB\nC\n');
  });
});

/* ------------------------------------------------------------------ */
/* reconstructByPosition — the position-aware reassembly                */
/* ------------------------------------------------------------------ */

describe('reconstructByPosition', () => {
  it('returns empty string on empty input', () => {
    expect(reconstructByPosition({ items: [] })).toBe('');
  });

  it('groups items on the same Y into one line, sorted left-to-right', () => {
    // Out-of-order in the items array but same Y → one line, sorted by X.
    const result = reconstructByPosition({
      items: [
        item('14.5', { x: 200, y: 700 }),
        item('Hemoglobin', { x: 50, y: 700 }),
        item('g/dL', { x: 280, y: 700 }),
      ],
    });
    expect(result).toBe('Hemoglobin 14.5 g/dL');
  });

  it('sorts multiple lines top-to-bottom (PDF Y axis points up)', () => {
    // Larger Y is higher on the page in PDF coordinates.
    const result = reconstructByPosition({
      items: [
        item('Line two', { x: 50, y: 600 }),
        item('Line one', { x: 50, y: 700 }),
        item('Line three', { x: 50, y: 500 }),
      ],
    });
    expect(result).toBe('Line one\nLine two\nLine three');
  });

  it('joins adjacent items WITHOUT a space when the X gap is < 30% of char width', () => {
    // Real Indian-lab bug: pdfjs sometimes splits "43" into separate
    // "4" and "3" text items at a tiny inter-glyph gap. A naive space
    // join would yield "4 3" which the regex parses as 4 — silently
    // halving the value of e.g. sperm motility %.
    //
    // Item layout: "4" at x=100 width=6 (ends at 106), "3" at x=107.
    // Gap = 1, charWidth = 6, threshold = 6 * 0.3 = 1.8 → gap < threshold → no space.
    const result = reconstructByPosition({
      items: [
        item('4', { x: 100, y: 700, width: 6 }),
        item('3', { x: 107, y: 700, width: 6 }),
      ],
    });
    expect(result).toBe('43');
  });

  it('joins WITH a space when the X gap exceeds the char-width threshold', () => {
    // Same scenario but with a real inter-word gap (e.g. column separator).
    // "Vitamin" at x=50 width=42 (ends at 92), "D" at x=110.
    // Gap = 18, charWidth = 42/7 = 6, threshold = 6 * 0.3 = 1.8 → gap >> threshold → space.
    const result = reconstructByPosition({
      items: [
        item('Vitamin', { x: 50, y: 700, width: 42 }),
        item('D', { x: 110, y: 700, width: 6 }),
      ],
    });
    expect(result).toBe('Vitamin D');
  });

  it('clusters items whose Y values straddle a bucket boundary into the same line', () => {
    // Adaptive Y tolerance — median glyph height × 0.6. With height=10,
    // tolerance is 6, so items within 6 PDF units of each other on the Y
    // axis should land on the same line even though their bucket indices
    // (Math.round(y/6)) differ by 1.
    //
    // y=700 → bucket 117, y=703 → bucket 117 too (rounds to same).
    // Use y=700 vs y=705: bucket 117 vs 117 still. Try y=700 vs y=704:
    // 117 vs 117. y=702 vs y=706: 117 vs 118. Both within 6 of each
    // other → ±1 bucket lookup catches it.
    const result = reconstructByPosition({
      items: [
        item('Total', { x: 50, y: 702, height: 10 }),
        item('Cholesterol', { x: 90, y: 706, height: 10 }),
        item('195', { x: 200, y: 702, height: 10 }),
      ],
    });
    // All three should be on one line (sorted by X).
    expect(result).toBe('Total Cholesterol 195');
  });

  it('separates items into different lines when Y differs by more than tolerance', () => {
    const result = reconstructByPosition({
      items: [
        item('Hemoglobin 14.5'.replace(/ /g, ''), { x: 50, y: 700, height: 10 }),
        item('LDL 120'.replace(/ /g, ''), { x: 50, y: 680, height: 10 }),
      ],
    });
    // 700 vs 680 = 20 apart, well beyond tolerance of 6 → two lines.
    expect(result.split('\n')).toHaveLength(2);
  });

  it('clusters items that drift across MULTIPLE buckets but stay within tolerance', () => {
    // Regression: the previous version only registered the line under
    // its first bucket. With height=10 → tolerance=6, three items at
    // y=700, y=703, y=706 sit in buckets 117, 117, 118 — the ±1 fanout
    // was fine. But pull them further apart: y=702, y=706, y=710 sit in
    // buckets 117, 118, 118 — and the ±1 fanout from 118 finds 117 OK,
    // but only if we registered the line under bucket 118 when item B
    // merged. Without the always-register fix, item C sees buckets 117
    // and 119 (118 ±1), neither has the line, and creates a fresh line.
    //
    // Adversarial choice: heights so tolerance = ~6, items spaced ~4
    // apart so a string of 4 items drifts across 3 buckets while still
    // being within tolerance of any one neighbor.
    const result = reconstructByPosition({
      items: [
        item('A', { x: 50, y: 712, height: 10 }),
        item('B', { x: 60, y: 708, height: 10 }),
        item('C', { x: 70, y: 704, height: 10 }),
        item('D', { x: 80, y: 700, height: 10 }),
      ],
    });
    // All four are within ~4 of their immediate neighbor (well under
    // tolerance of 6) so they should land on a single line.
    expect(result.split('\n')).toHaveLength(1);
    expect(result).toBe('A B C D');
  });

  it('handles a realistic dense-table fixture end to end', () => {
    // Mimics what pdfjs emits for a single row of a tightly-packed
    // Indian-lab table: label, value, unit, ref range — all in one Y
    // band but at distinct X positions.
    const result = reconstructByPosition({
      items: [
        item('Total Cholesterol', { x: 50, y: 600, width: 96 }),
        item('195', { x: 200, y: 600, width: 18 }),
        item('mg/dL', { x: 240, y: 600, width: 28 }),
        item('<200', { x: 300, y: 600, width: 24 }),

        item('LDL Cholesterol', { x: 50, y: 580, width: 84 }),
        item('120', { x: 200, y: 580, width: 18 }),
        item('mg/dL', { x: 240, y: 580, width: 28 }),
        item('<100', { x: 300, y: 580, width: 24 }),
      ],
    });
    expect(result).toBe(
      ['Total Cholesterol 195 mg/dL <200', 'LDL Cholesterol 120 mg/dL <100'].join('\n'),
    );
  });
});
