/**
 * End-to-end proof that bbox reconstruction RECOVERS markers a column-
 * interleaved OCR blob loses — the whole point of Phase 2. Uses the real
 * matcher on both the garbled flat text and the reconstructed text.
 */
import { describe, it, expect } from 'vitest';
import { reconstructLinesFromWords, wordsFromBlocks } from './parser/ocrLayout';
import { extractBiomarkersFromText } from './pdfParser';

describe('OCR bbox reconstruction — recovers interleaved-table markers', () => {
  it('un-interleaves two fused rows so both markers extract correctly', () => {
    // What Tesseract can emit when it reads a 2-marker table ACROSS columns:
    // the label / range / value / unit columns interleaved, fusing the rows.
    const garbled = 'Hemoglobin MCHC 13-17 32-36 14.2 30.5 g/dL g/dL';
    const garbledMarkers = extractBiomarkersFromText(garbled);

    // The same page's word boxes — correctly positioned in two rows.
    const blocks = [
      {
        paragraphs: [
          {
            lines: [
              {
                words: [
                  { text: 'Hemoglobin', bbox: { x0: 20, y0: 100, x1: 90, y1: 118 } },
                  { text: '13-17', bbox: { x0: 150, y0: 100, x1: 190, y1: 118 } },
                  { text: '14.2', bbox: { x0: 250, y0: 100, x1: 290, y1: 118 } },
                  { text: 'g/dL', bbox: { x0: 350, y0: 100, x1: 390, y1: 118 } },
                  { text: 'MCHC', bbox: { x0: 20, y0: 130, x1: 70, y1: 148 } },
                  { text: '32-36', bbox: { x0: 150, y0: 130, x1: 190, y1: 148 } },
                  { text: '30.5', bbox: { x0: 250, y0: 130, x1: 290, y1: 148 } },
                  { text: 'g/dL', bbox: { x0: 350, y0: 130, x1: 390, y1: 148 } },
                ],
              },
            ],
          },
        ],
      },
    ];
    const reconstructed = reconstructLinesFromWords(wordsFromBlocks(blocks));
    expect(reconstructed).toBe(
      'Hemoglobin 13-17 14.2 g/dL\nMCHC 32-36 30.5 g/dL',
    );

    const reMarkers = extractBiomarkersFromText(reconstructed);
    const byId = new Map(reMarkers.map((m) => [m.id, m.value]));
    expect(byId.get('hb')).toBe(14.2);
    expect(byId.get('mchc')).toBe(30.5);
    // Reconstruction does at least as well as the garbled blob — the best-of
    // candidate selection guarantees it can only add recoveries.
    expect(reMarkers.length).toBeGreaterThanOrEqual(garbledMarkers.length);
  });
});
