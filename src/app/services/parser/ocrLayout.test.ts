import { describe, it, expect } from 'vitest';
import {
  reconstructLinesFromWords,
  wordsFromBlocks,
  type OcrWord,
} from './ocrLayout';

/** Build a word at a given row/column with a nominal 20px-tall box. */
function w(text: string, x: number, y: number, width = 40): OcrWord {
  return { text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 } };
}

describe('reconstructLinesFromWords', () => {
  it('orders a single row left-to-right regardless of input order', () => {
    const out = reconstructLinesFromWords([
      w('mg/dL', 300, 100),
      w('Glucose', 20, 100),
      w('95', 200, 100),
    ]);
    expect(out).toBe('Glucose 95 mg/dL');
  });

  it('splits two rows by vertical position even when words arrive interleaved', () => {
    // The real failure: Tesseract fused two markers' rows. Given words from
    // both rows in scrambled order, bbox grouping must separate them cleanly.
    const out = reconstructLinesFromWords([
      w('MCHC', 20, 130),
      w('MCH', 20, 100),
      w('30.5', 200, 130),
      w('24.8', 200, 100),
      w('g/dL', 300, 130),
      w('pg', 300, 100),
    ]);
    expect(out).toBe('MCH 24.8 pg\nMCHC 30.5 g/dL');
  });

  it('keeps a reverse-column row (value rightmost) intact and ordered', () => {
    const out = reconstructLinesFromWords([
      w('7.7', 400, 100),
      w('WBC', 20, 100),
      w('x10^3/uL', 250, 100),
      w('4-11', 150, 100),
    ]);
    expect(out).toBe('WBC 4-11 x10^3/uL 7.7');
  });

  it('treats a slightly skewed word (baseline drift) as the same row', () => {
    // Second word sits 6px lower but overlaps the band by >40% → same row.
    const out = reconstructLinesFromWords([
      w('Hemoglobin', 20, 100),
      w('14.2', 200, 106),
    ]);
    expect(out).toBe('Hemoglobin 14.2');
  });

  it('separates rows that do not overlap vertically', () => {
    const out = reconstructLinesFromWords([
      w('A', 20, 100),
      w('B', 20, 140), // 40px lower, no overlap with a 20px-tall band
    ]);
    expect(out).toBe('A\nB');
  });

  it('returns empty string on no usable words', () => {
    expect(reconstructLinesFromWords([])).toBe('');
    expect(
      reconstructLinesFromWords([{ text: '', bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } }]),
    ).toBe('');
  });
});

describe('wordsFromBlocks', () => {
  it('flattens a well-formed block → paragraph → line → word tree', () => {
    const blocks = [
      {
        paragraphs: [
          {
            lines: [
              {
                words: [
                  { text: 'Glucose', bbox: { x0: 20, y0: 100, x1: 80, y1: 120 } },
                  { text: '95', bbox: { x0: 200, y0: 100, x1: 230, y1: 120 } },
                ],
              },
            ],
          },
        ],
      },
    ];
    const words = wordsFromBlocks(blocks);
    expect(words).toHaveLength(2);
    expect(words[0].text).toBe('Glucose');
    expect(words[1].bbox.x0).toBe(200);
  });

  it('is fully defensive against malformed / null shapes (never throws)', () => {
    expect(wordsFromBlocks(null)).toEqual([]);
    expect(wordsFromBlocks(undefined)).toEqual([]);
    expect(wordsFromBlocks('nope')).toEqual([]);
    expect(wordsFromBlocks([{ paragraphs: null }])).toEqual([]);
    expect(wordsFromBlocks([{ paragraphs: [{ lines: [{ words: [{}] }] }] }])).toEqual([]);
    expect(
      // missing bbox coords → dropped
      wordsFromBlocks([
        { paragraphs: [{ lines: [{ words: [{ text: 'x', bbox: { x0: 1 } }] }] }] },
      ]),
    ).toEqual([]);
  });

  it('end-to-end: garbled block tree → clean reconstructed rows', () => {
    // Two lab rows whose words Tesseract emitted interleaved across columns.
    const blocks = [
      {
        paragraphs: [
          {
            lines: [
              {
                words: [
                  { text: 'MCH', bbox: { x0: 20, y0: 100, x1: 60, y1: 118 } },
                  { text: 'MCHC', bbox: { x0: 20, y0: 130, x1: 70, y1: 148 } },
                  { text: '24.8', bbox: { x0: 200, y0: 100, x1: 240, y1: 118 } },
                  { text: '30.5', bbox: { x0: 200, y0: 130, x1: 240, y1: 148 } },
                ],
              },
            ],
          },
        ],
      },
    ];
    expect(reconstructLinesFromWords(wordsFromBlocks(blocks))).toBe(
      'MCH 24.8\nMCHC 30.5',
    );
  });
});
