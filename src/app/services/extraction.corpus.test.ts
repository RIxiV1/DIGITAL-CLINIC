/**
 * Real-report extraction corpus.
 *
 * Every entry here is the text of an ACTUAL lab report a user uploaded
 * (the "show what we read from the file" disclosure), paired with the
 * markers we expect the catalog matcher to pull out. Each one was a real
 * bug at some point — VLDL missing, SI units dropped, dotted "W.B.C"
 * unmatched, a phantom sperm count on a CBC, RBC collapsing to 0. These
 * fixtures lock those fixes in so a future catalog/matcher change can't
 * silently regress them.
 *
 * ── To add a report ──────────────────────────────────────────────
 * Paste its "what we read" text into a new FIXTURES entry, list the
 * markers + values you expect (exact number, or [min, max] for unit-
 * converted ones), and add `absent` ids for any false-positive you want
 * guarded against. That's it — the loop below does the rest.
 *
 * NOTE: these are TEXT-layer / clean-OCR fixtures. They exercise the
 * catalog matcher, not OCR fidelity or the Gemini vision path (those are
 * covered in pdfParser.test.ts / aiParser.mapping.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { extractBiomarkersFromText } from './pdfParser';

type Expectation = {
  /** marker id → exact value, or [min, max] band for unit-converted ones */
  values: Record<string, number | [number, number]>;
  /** marker ids that must NOT appear (false-positive guards) */
  absent?: string[];
};

type Fixture = { name: string; note: string; text: string; expect: Expectation };

const FIXTURES: Fixture[] = [
  {
    name: 'Labsmart — lipid profile (India)',
    note: 'surfaced the missing VLDL catalog entry (#67)',
    text: [
      'TOTAL CHOLESTEROL 180 mg/dl 125 - 200',
      'TRIGLYCERIDES 172 mg/dl 25 - 200',
      'HDL CHOLESTEROL 55 mg/dl 35 - 80',
      'LDL CHOLESTEROL 90.60 mg/dl 85 - 130',
      'VLDL CHOLESTEROL 34.40 mg/dl 5 - 40',
    ].join('\n'),
    expect: {
      values: {
        'total-chol': 180,
        ldl: 90.6,
        hdl: 55,
        tg: 172,
        vldl: 34.4,
      },
    },
  },
  {
    name: 'Innoquest — SI-unit screening panel (Malaysia)',
    note: 'surfaced SI-unit support + Chloride (#69)',
    text: [
      'Sodium 141 mmol/L (135-145)',
      'Potassium 4.1 mmol/L (3.5-5.1)',
      'Chloride 99 mmol/L (95-110)',
      'Urea 7.1 mmol/L (3.0-10.0)',
      'Creatinine 88 umol/L (44-110)',
      'Uric Acid 0.21 mmol/L (0.15-0.45)',
      'AST 33 U/L (< 41)',
      'ALT 25 U/L (< 51)',
      'HbA1c 5.2 %',
    ].join('\n'),
    expect: {
      values: {
        sodium: 141,
        potassium: 4.1,
        chloride: 99,
        bun: [42, 43], // 7.1 mmol/L × 6.006
        creatinine: [0.95, 1.05], // 88 µmol/L ÷ 88.42
        'uric-acid': [3.4, 3.6], // 0.21 mmol/L × 16.81
        ast: 33,
        alt: 25,
        hba1c: 5.2,
      },
    },
  },
  {
    name: 'Dr N.M. Kazi — CBC (small-lab template)',
    note: 'surfaced dotted W.B.C, Gms% Hb, and the phantom sperm count (#71)',
    text: [
      'W.B.C Total Count 10900 4000 - 11000 /Cumm',
      'RBC COUNT 5.53 4.2-5.8 Mill/cumm',
      'Haemoglobin % 14.8 12 - 17 Gms%',
      'PCV 43.6 36 - 48 %',
      'Platelet Count 2.63 150000 - 450000 Lakh/cumm',
    ].join('\n'),
    expect: {
      values: {
        wbc: 10900,
        rbc: 5.53,
        hb: 14.8,
        hematocrit: 43.6,
        platelets: 263000, // 2.63 Lakh × 1e5
      },
      absent: ['sperm-total-count'], // "Total Count" must not match a CBC
    },
  },
  {
    name: 'UK thyroid panel — SI units (pmol/L)',
    note: 'Free T3/T4 in pmol/L were dropped entirely until altUnits added',
    text: [
      'TSH 2.10 mIU/L (0.27 - 4.20)',
      'Free T4 15.5 pmol/L (12.0 - 22.0)',
      'Free T3 4.8 pmol/L (3.1 - 6.8)',
    ].join('\n'),
    expect: {
      values: {
        tsh: 2.1,
        'free-t4': [1.15, 1.26], // 15.5 pmol/L × 0.0777 = 1.204 ng/dL
        'free-t3': [3.05, 3.2], // 4.8 pmol/L × 0.651 = 3.125 pg/mL
      },
    },
  },
];

describe('real-report extraction corpus', () => {
  for (const fx of FIXTURES) {
    describe(`${fx.name} — ${fx.note}`, () => {
      const byId = new Map(
        extractBiomarkersFromText(fx.text).map((m) => [m.id, m.value]),
      );

      for (const [id, expected] of Object.entries(fx.expect.values)) {
        it(`extracts ${id}`, () => {
          const v = byId.get(id);
          expect(v, `${id} should be extracted`).toBeDefined();
          if (Array.isArray(expected)) {
            expect(v!).toBeGreaterThanOrEqual(expected[0]);
            expect(v!).toBeLessThanOrEqual(expected[1]);
          } else {
            expect(v!).toBeCloseTo(expected, 1);
          }
        });
      }

      for (const id of fx.expect.absent ?? []) {
        it(`does not falsely surface ${id}`, () => {
          expect(byId.has(id)).toBe(false);
        });
      }
    });
  }
});
