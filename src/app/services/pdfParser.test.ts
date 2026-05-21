/**
 * Tests for the catalog-matching path of pdfParser.ts.
 *
 * Coverage:
 *   - normalize() artefacts: decimal repair, comma stripping (US +
 *     Indian formats), whitespace collapse, %-spacing
 *   - extractBiomarkersFromText() end-to-end:
 *     * Plain "Name Value Unit" extraction
 *     * Unit-in-alias case (the "Density (million per ml) 103" bug
 *       that prompted the unit-gate carve-out)
 *     * Alias precedence (longer / more-specific aliases win)
 *     * Sanity-bound rejection (>5x outside the healthy span)
 *     * Dedup (same marker not extracted twice)
 *     * Empty unit (pH) skips the unit gate
 *
 * Tests run against pure text fixtures — pdfjs and tesseract are not
 * touched, so they don't pull in any browser-only deps.
 */

import { describe, it, expect } from 'vitest';
import { extractBiomarkersFromText } from './pdfParser';

/* ------------------------------------------------------------------ */
/* Basic extraction                                                    */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — basic extraction', () => {
  it('returns empty array on empty input', () => {
    expect(extractBiomarkersFromText('')).toEqual([]);
  });

  it('returns empty array on text with no recognised markers', () => {
    const text = 'This is a random document with no lab values at all.';
    expect(extractBiomarkersFromText(text)).toEqual([]);
  });

  it('extracts a single marker from a plain "Name Value Unit" line', () => {
    const text = 'Fasting Glucose 92 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('glucose');
    expect(result[0].value).toBe(92);
  });

  it('extracts markers from a multi-line text block', () => {
    const text = `
      Total Cholesterol 185 mg/dL
      LDL Cholesterol 95 mg/dL
      HDL Cholesterol 55 mg/dL
      Triglycerides 110 mg/dL
    `;
    const ids = extractBiomarkersFromText(text).map((m) => m.id).sort();
    expect(ids).toEqual(['hdl', 'ldl', 'tg', 'total-chol']);
  });

  it('extracts pH despite the template having no unit', () => {
    const text = 'pH 7.4';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('semen-ph');
    expect(result[0].value).toBe(7.4);
  });
});

/* ------------------------------------------------------------------ */
/* Status derivation                                                   */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — status derivation', () => {
  it('marks an in-range, in-optimal value as "good"', () => {
    // HbA1c: healthy 4-5.7, optimal 4.5-5.3
    const text = 'HbA1c 5.0 %';
    const result = extractBiomarkersFromText(text);
    expect(result[0].status).toBe('good');
  });

  it('marks an in-range but out-of-optimal value as "attention"', () => {
    // HbA1c: 5.5 is in healthy range (≤5.7) but outside optimal (4.5-5.3)
    const text = 'HbA1c 5.5 %';
    const result = extractBiomarkersFromText(text);
    expect(result[0].status).toBe('attention');
  });

  it('marks an out-of-range value as "concern"', () => {
    // LDL: max 100, value 145 is concern
    const text = 'LDL Cholesterol 145 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result[0].status).toBe('concern');
  });

  it('respects direction for "down is better" markers', () => {
    // LDL 80 is within 0-100 healthy range AND has no optimal band,
    // so it should be 'good'.
    const text = 'LDL Cholesterol 80 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result[0].status).toBe('good');
  });
});

/* ------------------------------------------------------------------ */
/* Unit-in-alias carve-out                                             */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — unit-in-alias matching', () => {
  it('matches "Density (million per ml) 103" without a trailing unit', () => {
    // This was the real-world bug from the CREATE Fertility PDF: the
    // unit lives in the alias label ("Density (million per ml)") and
    // doesn't repeat after the value ("103"). The strict unit gate
    // failed; the per-alias carve-out fixes it.
    const text = 'Density (million per ml) 103';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'sperm-density')?.value).toBe(103);
  });

  it('matches "Total count (million) 287"', () => {
    const text = 'Total count (million) 287';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'sperm-total-count')?.value).toBe(287);
  });

  it('matches "Total motility % 43" — % in the alias label', () => {
    const text = 'Total motility % 43';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'sperm-motility-total')?.value).toBe(43);
  });
});

/* ------------------------------------------------------------------ */
/* Decimal repair + comma stripping (normalize)                        */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — normalize artefacts', () => {
  it('repairs "5 ." OCR spacing in decimals', () => {
    // pdfjs sometimes splits decimal points across text items.
    // "5.4" becomes "5 .4" or "5 . 4" — normalize collapses these.
    const text = 'HbA1c 5 .4 %';
    const result = extractBiomarkersFromText(text);
    expect(result[0]?.value).toBe(5.4);
  });

  it('repairs ". 5" OCR spacing in decimals', () => {
    const text = 'Fasting Glucose 95 .0 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result[0]?.value).toBe(95);
  });

  it('strips US-format commas in large numbers', () => {
    // "240,000 /cumm" would parse as 240 without comma stripping.
    const text = 'Platelet Count 240,000 /cumm';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'platelets')?.value).toBe(240000);
  });

  it('strips Indian-format commas in lakh-style numbers', () => {
    // "2,40,000" → 2 (no stripping), 240000 (after stripping). Indian
    // labs commonly use 2,40,000-style grouping for platelet counts.
    const text = 'Platelet Count 2,40,000 /cumm';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'platelets')?.value).toBe(240000);
  });
});

/* ------------------------------------------------------------------ */
/* Sanity bound                                                        */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — sanity bound', () => {
  it('rejects values >5x outside the healthy span', () => {
    // Glucose healthy 70-99 (span = 29). 5x span = 145.
    // value < min - 5*span = 70 - 145 = -75
    // value > max + 5*span = 99 + 145 = 244
    // So glucose=300 should be rejected.
    const text = 'Fasting Glucose 300 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'glucose')).toBeUndefined();
  });

  it('accepts values within 5x of healthy span (concerning but plausible)', () => {
    // Glucose=200 is concerning but within 5x span of max (244).
    const text = 'Fasting Glucose 200 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'glucose')?.value).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* Dedup                                                                */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — dedup', () => {
  it('only extracts each template once even if alias appears twice', () => {
    const text = `
      Fasting Glucose 95 mg/dL
      Note: Fasting Glucose was re-tested at 92 mg/dL on a follow-up visit.
    `;
    const glucoseHits = extractBiomarkersFromText(text).filter((m) => m.id === 'glucose');
    expect(glucoseHits).toHaveLength(1);
    // First match wins — 95, not 92.
    expect(glucoseHits[0].value).toBe(95);
  });
});

/* ------------------------------------------------------------------ */
/* Realistic lab report fixture                                         */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — realistic lab fixture', () => {
  // Synthetic text mimicking what pdfjs would emit from a typical
  // Indian Comprehensive Health Check PDF. Drawn from the structure of
  // a Thyrocare-style report plus the CREATE Fertility semen analysis.
  const sampleText = `
    COMPLETE BLOOD COUNT
    Hemoglobin           14.5    g/dL
    Total WBC Count      7,200   /cumm
    Total RBC Count      5.2     million/cumm
    Platelet Count       2,80,000 /cumm
    Hematocrit           44      %

    LIPID PROFILE
    Total Cholesterol    195     mg/dL
    LDL Cholesterol      120     mg/dL
    HDL Cholesterol      48      mg/dL
    Triglycerides        145     mg/dL

    DIABETES SCREEN
    Fasting Glucose      92      mg/dL
    HbA1c                5.2     %

    THYROID FUNCTION
    TSH                  2.1     µIU/mL

    VITAMIN D (25-OH)    28      ng/mL
  `;

  it('extracts the expected markers from a multi-panel report', () => {
    const ids = extractBiomarkersFromText(sampleText).map((m) => m.id).sort();
    expect(ids).toEqual(
      [
        'glucose',
        'hb',
        'hba1c',
        'hdl',
        'hematocrit',
        'ldl',
        'platelets',
        'rbc',
        'tg',
        'total-chol',
        'tsh',
        'vit-d',
        'wbc',
      ].sort(),
    );
  });

  it('preserves the original numeric values through normalize', () => {
    const result = extractBiomarkersFromText(sampleText);
    const byId = new Map(result.map((m) => [m.id, m]));
    expect(byId.get('hb')?.value).toBe(14.5);
    expect(byId.get('wbc')?.value).toBe(7200);
    expect(byId.get('platelets')?.value).toBe(280000);
    expect(byId.get('ldl')?.value).toBe(120);
    expect(byId.get('hba1c')?.value).toBe(5.2);
    expect(byId.get('vit-d')?.value).toBe(28);
  });

  it('flags out-of-range markers correctly in the realistic fixture', () => {
    const result = extractBiomarkersFromText(sampleText);
    const byId = new Map(result.map((m) => [m.id, m]));
    // LDL 120 > healthy max of 100 → concern
    expect(byId.get('ldl')?.status).toBe('concern');
    // Vitamin D 28 < healthy min of 30 → concern
    expect(byId.get('vit-d')?.status).toBe('concern');
    // HbA1c 5.2 in optimal band 4.5-5.3 → good
    expect(byId.get('hba1c')?.status).toBe('good');
    // Triglycerides 145 < max of 150 → good
    expect(byId.get('tg')?.status).toBe('good');
  });
});
