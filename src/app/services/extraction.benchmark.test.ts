/**
 * Extraction-accuracy benchmark (golden corpus).
 *
 * Unit tests in pdfParser.test.ts pin individual behaviours; this is the
 * complementary *quality* gate, modelled on the OmniAI OCR-benchmark
 * methodology: run the catalog extractor over a corpus of realistic,
 * fully-synthetic Indian lab-report text blocks (NO patient PII) and
 * measure field-level accuracy = correctly-extracted fields / total
 * expected fields. A regression that drops real-world extraction quality
 * fails here even if every narrow unit test still passes.
 *
 * The corpus deliberately includes the hard paths: count-prefix unit
 * reconciliation (lakh/thou/million), tabular reference-range columns,
 * and OCR decimal/spacing artefacts. Values reflect post-reconciliation
 * expectations (e.g. platelets printed as "2.5 lakh/cumm" → 250000).
 *
 * Keep the threshold honest: set it just under observed accuracy so it
 * gates regressions without rewarding fixture-fudging.
 */

import { describe, it, expect } from 'vitest';
import { extractBiomarkersFromText } from './pdfParser';

type GoldenCase = {
  name: string;
  text: string;
  /** catalog id → expected post-reconciliation value */
  expected: Record<string, number>;
};

const CORPUS: GoldenCase[] = [
  {
    name: 'Lipid profile (plain mg/dL)',
    text: `LIPID PROFILE
      Total Cholesterol 185 mg/dL
      LDL Cholesterol 110 mg/dL
      HDL Cholesterol 48 mg/dL
      Triglycerides 130 mg/dL`,
    expected: { 'total-chol': 185, ldl: 110, hdl: 48, tg: 130 },
  },
  {
    name: 'Metabolic panel',
    text: `Fasting Glucose 96 mg/dL
      HbA1c 5.6 %`,
    expected: { glucose: 96, hba1c: 5.6 },
  },
  {
    name: 'Thyroid + vitamins',
    text: `TSH 2.4 uIU/mL
      Vitamin D 25 ng/mL
      Vitamin B12 410 pg/mL`,
    expected: { tsh: 2.4, 'vit-d': 25, b12: 410 },
  },
  {
    name: 'Hormones + liver + kidney',
    text: `Total Testosterone 480 ng/dL
      ALT 32 U/L
      Creatinine 0.9 mg/dL`,
    expected: { testosterone: 480, alt: 32, creatinine: 0.9 },
  },
  {
    name: 'CBC with Indian count-prefix units',
    text: `COMPLETE BLOOD COUNT
      Hemoglobin 14.2 g/dL
      Platelet Count 2.5 lakh/cumm
      RBC Count 5.1 million/cumm`,
    expected: { hb: 14.2, platelets: 250000, rbc: 5.1 },
  },
  {
    name: 'Tabular reference-range column (value, not range bound)',
    text: `Test            Result    Unit      Bio. Ref. Interval
      Hemoglobin      13.5      g/dL      13.0 - 17.0
      Fasting Glucose 92        mg/dL     70 - 100`,
    expected: { hb: 13.5, glucose: 92 },
  },
  {
    name: 'OCR decimal/spacing artefacts',
    text: `Creatinine 0 . 9 mg/dL
      HDL Cholesterol 5 5 mg/dL`,
    expected: { creatinine: 0.9 },
  },
];

function scoreCase(c: GoldenCase) {
  const got = extractBiomarkersFromText(c.text);
  const byId = new Map(got.map((m) => [m.id, m.value]));
  const ids = Object.keys(c.expected);
  const misses: string[] = [];
  let correct = 0;
  for (const id of ids) {
    const exp = c.expected[id];
    const actual = byId.get(id);
    const ok =
      actual !== undefined &&
      Math.abs(actual - exp) <= Math.max(0.01, Math.abs(exp) * 1e-6);
    if (ok) correct += 1;
    else misses.push(`${id}(exp ${exp}, got ${actual ?? 'none'})`);
  }
  return { correct, total: ids.length, misses };
}

describe('extraction accuracy benchmark', () => {
  it('extracts the golden corpus at high field-level accuracy', () => {
    let totalCorrect = 0;
    let totalFields = 0;
    const lines: string[] = [];
    for (const c of CORPUS) {
      const { correct, total, misses } = scoreCase(c);
      totalCorrect += correct;
      totalFields += total;
      lines.push(
        `  ${c.name}: ${correct}/${total}` +
          (misses.length ? ` — miss: ${misses.join('; ')}` : ''),
      );
    }
    const accuracy = totalCorrect / totalFields;
    // eslint-disable-next-line no-console
    console.log(
      `\nExtraction accuracy: ${(accuracy * 100).toFixed(1)}% ` +
        `(${totalCorrect}/${totalFields})\n${lines.join('\n')}\n`,
    );
    // Calibrated to observed accuracy; gates regressions.
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
