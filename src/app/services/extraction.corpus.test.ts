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
    name: 'Dr Lal PathLabs — SWASTHFIT SUPER 4 (real template)',
    note: 'first fixture from a genuine Indian lab PDF, not a hand-typed one',
    // Lifted verbatim from Lal PathLabs' own published specimen report
    // (cdn1.lalpathlabs.com/live/reports/WM17S.pdf — patient literally named
    // "DUMMY", so no real person's data is in this repo), as our own text
    // reconstruction renders it.
    //
    // Worth its length, because a real template does things a hand-written
    // fixture never thinks of:
    //   - a "(Method)" line after EVERY row, several carrying bare years —
    //     "(CKD EPI Equation 2021)", "(KDIGO Guideline 2012)" — sitting right
    //     where a value would be. Prime false-positive bait.
    //   - section headers ("LIPID SCREEN, SERUM") between rows.
    //   - qualitative rows with no number ("GFR Category G1").
    //   - one-sided reference ranges (<200.00, >40.00) rather than a-b.
    //   - names our aliases have to actually cover: "AST (SGOT)", "GGTP",
    //     "Cholesterol, Total", "LDL Cholesterol, Calculated".
    //   - BOTH "Urea 40.00" and "Urea Nitrogen Blood 18.68" on one report —
    //     the same chemistry on two scales, 2.14x apart (see the bun template
    //     note in the catalog).
    text: [
      'SWASTHFIT SUPER 4',
      'LIVER & KIDNEY PANEL, SERUM',
      'Creatinine 1.00 mg/dL 0.70 - 1.30',
      '(Modified Jaffe,Kinetic)',
      'GFR Estimated 107 mL/min/1.73m2 >59',
      '(CKD EPI Equation 2021)',
      'GFR Category G1',
      '(KDIGO Guideline 2012)',
      'Urea 40.00 mg/dL 13.00 - 43.00',
      '(Urease UV)',
      'Uric Acid 7.00 mg/dL 3.50 - 7.20',
      '(Uricase)',
      'AST (SGOT) 30.0 U/L 15.00 - 40.00',
      '(IFCC without P5P)',
      'ALT (SGPT) 40.0 U/L 10.00 - 49.00',
      '(IFCC without P5P)',
      'GGTP 50.0 U/L 0 - 73',
      '(IFCC)',
      'Alkaline Phosphatase (ALP) 100.00 U/L 30.00 - 120.00',
      '(IFCC-AMP)',
      'Bilirubin Total 1.00 mg/dL 0.30 - 1.20',
      '(Oxidation)',
      'Bilirubin Direct 0.20 mg/dL <0.3',
      '(Oxidation)',
      'Total Protein 8.00 g/dL 5.70 - 8.20',
      '(Biuret)',
      'Albumin 4.00 g/dL 3.20 - 4.80',
      '(BCG)',
      'Calcium, Total 9.00 mg/dL 8.70 - 10.40',
      'LIPID SCREEN, SERUM',
      'Cholesterol, Total 100.00 mg/dL <200.00',
      '(CHO-POD)',
      'Triglycerides 100.00 mg/dL <150.00',
      '(GPO-POD)',
      'HDL Cholesterol 30.00 mg/dL >40.00',
      '(Enz Immunoinhibition)',
      'LDL Cholesterol, Calculated 50.00 mg/dL <100.00',
      '(Calculated)',
      'VLDL Cholesterol,Calculated 20.00 mg/dL <30.00',
      '(Calculated)',
      'Non-HDL Cholesterol 70 mg/dL <130',
      '(Calculated)',
    ].join('\n'),
    expect: {
      values: {
        creatinine: 1.0,
        egfr: 107,
        bun: 40, // "Urea", graded off the lab's printed range — see catalog
        'uric-acid': 7.0,
        ast: 30,
        alt: 40,
        ggt: 50,
        alp: 100,
        'total-bilirubin': 1.0,
        'direct-bilirubin': 0.2,
        'total-protein': 8.0,
        albumin: 4.0,
        calcium: 9.0,
        'total-chol': 100,
        tg: 100,
        hdl: 30,
        ldl: 50,
        vldl: 20,
        'non-hdl': 70,
      },
    },
  },
  {
    name: 'Dr Lal PathLabs — protein electrophoresis (real template)',
    note: "'Protein, Total' (comma form) was unmatched — same lab, other word order",
    // From Lal PathLabs' published specimen E001. Two things worth pinning:
    //   1. 'Protein, Total' matches now. Their SWASTHFIT panel prints 'Total
    //      Protein', this one inverts it — one lab, both forms.
    //   2. The globulin fractions must NOT be invented as markers. They're a
    //      real part of this report and deliberately outside the catalog;
    //      surfacing them would mean showing a number we can't interpret.
    text: [
      'PROTEIN ELECTROPHORESIS, SERUM',
      '(Capillary Electrophoresis)',
      'Protein, Total 7.20 g/dL 6.40 - 8.30',
      'Albumin 4.00 g/dL 3.60 - 5.50',
      'Alpha 1 globulin 0.30 g/dL 0.20 - 0.40',
      'Alpha 2 globulin 0.80 g/dL 0.50 - 1.00',
      'Beta 1 globulin 0.90 g/dL 0.50 - 1.10',
      'Gamma globulin 1.10 g/dL 0.70 - 1.60',
    ].join('\n'),
    expect: {
      values: { 'total-protein': 7.2, albumin: 4.0 },
    },
  },
  {
    name: 'OCR-mangled units — c→e, m→rn',
    note: 'a perfectly-read marker was dropped over one wrong letter in its unit',
    // Straight off the OCR bench: a realistic phone photo produced
    // "WBC COUNT 7800 /eumm 4000 - 11000" — name and value read perfectly,
    // unit misread by a single character — and the marker vanished, because
    // the matcher requires a known unit token as its false-positive guard.
    // c→e and m→rn are the two most common Tesseract confusions there are,
    // so this was silently costing markers on every photo.
    text: [
      'WBC COUNT 7800 /eumm 4000 - 11000',
      'HAEMOGLOBIN 14.2 g/dL 13.0 - 17.0',
      'TRIGLYCERIDES 150 rng/dL 0 - 150',
    ].join('\n'),
    expect: {
      values: { wbc: 7800, hb: 14.2, tg: 150 },
    },
  },
  {
    name: 'Unit gate still guards against a bare number',
    note: 'the tolerance must not become "any number after the name wins"',
    // The counterweight to the fixture above. The unit gate is what stops
    // "WBC COUNT" binding to a page number or a date, so tolerance of a
    // MISREAD unit must not collapse into accepting NO unit.
    text: ['WBC COUNT 7800', 'Page 2 of 3'].join('\n'),
    expect: {
      values: {},
      absent: ['wbc'],
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
