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
import {
  classifyOutOfScope,
  extractBiomarkersFromText,
  findUnrecognizedRows,
} from './pdfParser';

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

/* ------------------------------------------------------------------ */
/* µ vs μ — Micro Sign (U+00B5) and Greek mu (U+03BC) normalization    */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — mu normalization', () => {
  // The catalog uses Greek mu (U+03BC) in template units like 'µIU/mL'.
  // Real lab PDFs use both code points inconsistently. Without
  // normalizeMu both sides of the unit gate, units that differ only in
  // code point silently fail to match — silent missing extractions.

  it('extracts TSH whether the input uses U+00B5 (Micro Sign)', () => {
    // µ is the Micro Sign (most common in Windows-encoded PDFs).
    const text = 'TSH 2.1 µIU/mL';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'tsh')?.value).toBe(2.1);
  });

  it('extracts TSH whether the input uses U+03BC (Greek mu)', () => {
    // μ is the Greek small letter mu (common in OCR output).
    const text = 'TSH 2.1 μIU/mL';
    const result = extractBiomarkersFromText(text);
    expect(result.find((m) => m.id === 'tsh')?.value).toBe(2.1);
  });

  it('handles a mixed mu in the same document', () => {
    // Stress-test the normalization: two markers, two different code
    // points for µ in the input. Both should match.
    const text = `
      TSH 2.1 µIU/mL
      Fasting Insulin 8 μIU/mL
    `;
    const ids = extractBiomarkersFromText(text).map((m) => m.id);
    expect(ids).toContain('tsh');
    expect(ids).toContain('insulin');
  });
});

/* ------------------------------------------------------------------ */
/* Vitamin D (25-OH) — the regex+alias-ordering trap                   */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — Vitamin D (25-OH) value capture', () => {
  // The classic Indian-lab format prints "VITAMIN D (25-OH)    28      ng/mL".
  // Two distinct mechanisms protect against the value being parsed as 25:
  //
  //   1. Regex tightening — the tail between value and unit disallows
  //      digits (`tail = [^\d\n]{0,30}?`). So once a candidate alias
  //      binds, "25" can't be followed by anything until ng/mL appears.
  //   2. Alias ordering — the catalog lists the specific
  //      "Vitamin D (25-OH)" alias BEFORE the bare "Vitamin D" alias.
  //      The specific alias matches first against the literal label and
  //      captures "28" cleanly.
  //
  // This test pins both — if anyone removes the digit prohibition AND
  // reorders aliases (or removes the specific one), the value drifts
  // back to 25 silently.

  it('captures 28 (not 25) for the real "Vitamin D (25-OH) 28 ng/mL" format', () => {
    const text = 'VITAMIN D (25-OH)    28      ng/mL';
    const result = extractBiomarkersFromText(text);
    const vitD = result.find((m) => m.id === 'vit-d');
    expect(vitD?.value).toBe(28);
  });

  it('captures the value even when the label uses different separators', () => {
    // Variations seen in real reports — same payload, different glue.
    const variants = [
      'Vitamin D (25-OH): 28 ng/mL',
      'Vitamin D, 25-Hydroxy   28   ng/mL',
      '25-OH Vitamin D    28    ng/mL',
    ];
    for (const text of variants) {
      const result = extractBiomarkersFromText(text);
      const vitD = result.find((m) => m.id === 'vit-d');
      expect(vitD?.value).toBe(28);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Indian-format "Marker Value RefMin - RefMax Unit"                   */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — value/ref-range/unit order', () => {
  // Many Indian and older British/Commonwealth lab templates print
  // each row as `Marker  Value  RefMin - RefMax  Unit` — the reference
  // range sits BETWEEN the value and the unit, not after them. The
  // tail regex had to be loosened to allow an optional ref-range-shaped
  // span between value and unit, OR every CBC report from a Crystal
  // Data / Thyrocare / Dr. Lal era template would silently fail to
  // parse. These tests pin the fix.

  it('extracts Hemoglobin with the value-then-range-then-unit layout', () => {
    // Mirrors the row format on a real Crystal Data Inc. CBC report:
    //   "Haemoglobin    15    male : 14 - 16 g%"
    // - "g%" is the Indian notation for g/dL (same magnitude)
    // - The ref range "14 - 16" sits between the value and the unit
    const text = 'Haemoglobin    15    male : 14 - 16 g%';
    const result = extractBiomarkersFromText(text);
    const hb = result.find((m) => m.id === 'hb');
    expect(hb?.value).toBe(15);
  });

  it('extracts Platelet Count with /cu.mm Indian notation + ref range between', () => {
    const text = 'Platelet Count    1550000    150000 - 450000 / cu.mm';
    const result = extractBiomarkersFromText(text);
    const plt = result.find((m) => m.id === 'platelets');
    expect(plt?.value).toBe(1550000);
  });

  it('extracts MCV when fl is separated from value by the ref range', () => {
    const text = 'MCV    72.00    80 - 99 fl';
    const result = extractBiomarkersFromText(text);
    const mcv = result.find((m) => m.id === 'mcv');
    expect(mcv?.value).toBe(72);
  });

  it('extracts WBC with /cu.mm and ref-range-between', () => {
    const text = 'Total WBC Count    5500    4000 - 11000 / cu.mm';
    const result = extractBiomarkersFromText(text);
    const wbc = result.find((m) => m.id === 'wbc');
    expect(wbc?.value).toBe(5500);
  });

  it('still captures Vitamin D as 28 (not the parenthesized 25 or any ref-range bound)', () => {
    // The relaxed tail mustn't break the pre-existing Vitamin D
    // protection. The "(25-OH)" pattern is NOT a ref-range shape
    // (no `digit sep digit`), so the engine can't absorb it as ref
    // range and capture 25 — it backtracks to 28 as before.
    const text = 'Vitamin D (25-OH)    28    25 - 75 ng/mL';
    const result = extractBiomarkersFromText(text);
    const vitD = result.find((m) => m.id === 'vit-d');
    expect(vitD?.value).toBe(28);
  });
});

/* ------------------------------------------------------------------ */
/* findUnrecognizedRows                                                */
/* ------------------------------------------------------------------ */

describe('findUnrecognizedRows', () => {
  it('returns empty when the text has no value-like rows', () => {
    expect(findUnrecognizedRows('This is just narrative text.', [])).toEqual([]);
  });

  it('surfaces a value-like row with a known unit but no catalog match', () => {
    // Apolipoprotein B isn't in the catalog, but the unit mg/dL is.
    // The row should surface as unrecognized.
    const text = 'Apolipoprotein B 95 mg/dL';
    const rows = findUnrecognizedRows(text, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Apolipoprotein B');
    expect(rows[0]).toContain('95');
    expect(rows[0]).toContain('mg/dL');
  });

  it('surfaces value-like rows when separated by punctuation (colons, hyphens, en-dashes, equals)', () => {
    const text = `
      Apolipoprotein B: 95 mg/dL
      Lipoprotein(a) - 32 mg/dL
      Lipoprotein B = 45 mg/dL
      HDL-Ratio – 5.2 %
    `;
    const rows = findUnrecognizedRows(text, []);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('Apolipoprotein B');
    expect(rows[0]).toContain('95');
    expect(rows[1]).toContain('Lipoprotein(a)');
    expect(rows[1]).toContain('32');
    expect(rows[2]).toContain('Lipoprotein B');
    expect(rows[2]).toContain('45');
    expect(rows[3]).toContain('HDL-Ratio');
    expect(rows[3]).toContain('5.2');
  });

  it('does not surface a row whose (value, unit) pair was extracted', () => {
    // We extracted Hemoglobin 14.5 g/dL. The text contains the same
    // value+unit pair, so it should not appear as unrecognized.
    const text = 'Hemoglobin 14.5 g/dL';
    const extracted = extractBiomarkersFromText(text);
    expect(extracted).toHaveLength(1);
    expect(findUnrecognizedRows(text, extracted)).toEqual([]);
  });

  it('ignores rows without a known unit (typical metadata)', () => {
    const text = `
      Patient ID: 12345
      Age: 35 yrs
      Page 2 of 5
      Sample collected on 12 Apr 2026
    `;
    expect(findUnrecognizedRows(text, [])).toEqual([]);
  });

  it('surfaces unmatched rows alongside matched ones', () => {
    // Mixed report: we catch Hemoglobin + LDL; Apolipoprotein B and
    // Lipoprotein(a) should surface as unrecognized.
    const text = `
      Hemoglobin 14.5 g/dL
      LDL Cholesterol 120 mg/dL
      Apolipoprotein B 95 mg/dL
      Lipoprotein(a) 32 mg/dL
    `;
    const extracted = extractBiomarkersFromText(text);
    const rows = findUnrecognizedRows(text, extracted);
    const joined = rows.join('\n');
    expect(joined).toContain('Apolipoprotein B');
    expect(joined).toContain('Lipoprotein');
    expect(joined).not.toMatch(/Hemoglobin/);
    expect(joined).not.toMatch(/LDL/);
  });

  it('dedupes when the same label-value-unit appears twice', () => {
    const text = `
      Apolipoprotein B 95 mg/dL
      Apolipoprotein B 95 mg/dL
    `;
    const rows = findUnrecognizedRows(text, []);
    expect(rows).toHaveLength(1);
  });

  it('caps output at 10 rows', () => {
    const text = Array.from({ length: 25 }, (_, i) => `Marker${i} ${10 + i} mg/dL`).join('\n');
    const rows = findUnrecognizedRows(text, []);
    expect(rows.length).toBeLessThanOrEqual(10);
  });

  it('skips reference-range printout rows (not real markers)', () => {
    // Real-world false positive: Indian labs sometimes print rows like
    // "Normal Range 200 mg/dL" or "Biological Reference 100 mg/dL"
    // next to each marker. These match the label+number+unit regex
    // shape, so without the keyword filter they'd surface in the
    // confirm panel as noise — even though they're printed metadata,
    // not measurements. Each fixture line here DOES match the regex
    // (single number + recognised unit, no colon, no dash range); the
    // filter is what suppresses them.
    const text = `
      Reference 13.5 g/dL
      Normal Range 200 mg/dL
      Biological Reference 100 mg/dL
      Apolipoprotein B 95 mg/dL
    `;
    const rows = findUnrecognizedRows(text, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Apolipoprotein B');
    const joined = rows.join('\n');
    expect(joined).not.toMatch(/Reference/i);
    expect(joined).not.toMatch(/Normal Range/i);
    expect(joined).not.toMatch(/Biological/i);
  });
});

/* ------------------------------------------------------------------ */
/* classifyOutOfScope                                                  */
/* ------------------------------------------------------------------ */

describe('classifyOutOfScope', () => {
  it('returns null for empty or whitespace-only text', () => {
    expect(classifyOutOfScope('')).toBeNull();
    expect(classifyOutOfScope('   \n  ')).toBeNull();
  });

  it('returns null for a normal lab panel with no out-of-scope signals', () => {
    const text = `
      LIPID PROFILE
      Total Cholesterol  185  mg/dL
      LDL Cholesterol    95   mg/dL
      HDL Cholesterol    55   mg/dL
      Triglycerides      110  mg/dL
    `;
    expect(classifyOutOfScope(text)).toBeNull();
  });

  it('does NOT flag a comprehensive panel that mentions HIV once (single hit)', () => {
    // Real scenario: a marriage / pre-employment panel that bundles
    // metabolic markers + a single HIV antibody result. One mention
    // shouldn't override the rest of the document.
    const text = `
      Comprehensive Health Check
      HbA1c            5.4  %
      LDL Cholesterol  95   mg/dL
      HIV antibody     Non-reactive
    `;
    expect(classifyOutOfScope(text)).toBeNull();
  });

  it('flags a viral panel with multiple distinct keyword hits', () => {
    // Two distinct viral-category keywords ("dengue ns1" + "dengue igm")
    // should clear the 2-hit threshold.
    const text = `
      DENGUE PROFILE
      Dengue NS1 antigen: Positive
      Dengue IgM antibody: Reactive
      Dengue IgG antibody: Non-reactive
    `;
    expect(classifyOutOfScope(text)).toBe('viral');
  });

  it('flags an X-ray narrative report (imaging category)', () => {
    const text = `
      X-RAY CHEST PA VIEW
      No focal opacity in either lung field.
      Cardiac silhouette is normal.
      Impression: Normal study.
    `;
    expect(classifyOutOfScope(text)).toBe('imaging');
  });

  it('flags an ECG/EKG tracing report (imaging category)', () => {
    // ECG isn't strictly "imaging" but is a tracing, not a lab. Lives
    // under the imaging set so the category list stays at three.
    const text = `
      ECG REPORT
      Sinus rhythm at 72 bpm.
      QRS complex within normal limits.
      No ST elevation or ST depression observed.
    `;
    expect(classifyOutOfScope(text)).toBe('imaging');
  });

  it('flags a dental / oral exam record (physical-exam category)', () => {
    const text = `
      DENTAL EXAMINATION
      Periodontal pocket depth: 3mm
      Gingival recession: mild
      Caries: 16, 17 distal surface
      Occlusion: Class I
    `;
    expect(classifyOutOfScope(text)).toBe('physical-exam');
  });

  it('flags an optometry / eye exam (physical-exam category)', () => {
    const text = `
      OPTOMETRY ASSESSMENT
      Visual acuity (Snellen): 6/9 OD, 6/6 OS
      Refraction: -1.50 sph
      Fundus examination: Normal
      Intraocular pressure: 14 mmHg OD
    `;
    expect(classifyOutOfScope(text)).toBe('physical-exam');
  });

  it('is case-insensitive on the keyword match', () => {
    const text = `
      MRI BRAIN
      Computed tomography correlation recommended.
      No significant abnormality detected.
    `;
    expect(classifyOutOfScope(text)).toBe('imaging');
  });

  it('avoids substring traps — "ent" inside "patient" must not trigger', () => {
    // The 'ent' / 'ear' / 'nose' single words are NOT in the keyword
    // set (only multi-word headers + diagnostic terms are), but this
    // test pins the broader invariant that single-word matches use
    // word-boundary checks.
    const text = `
      Patient: John Doe
      Specimen: Serum
      Glucose 92 mg/dL
    `;
    expect(classifyOutOfScope(text)).toBeNull();
  });

  it('does NOT trigger out-of-scope when there is only one match in a category', () => {
    // 1 hit for 'viral' category (e.g. malaria) should not trigger out-of-scope.
    const text = `
      Routine Blood Check
      Fasting Glucose 92 mg/dL
      Note: patient has history of malaria in childhood.
    `;
    expect(classifyOutOfScope(text)).toBeNull();
  });

  it('triggers out-of-scope when there are exactly two matches in a category', () => {
    // 2 hits for 'viral' category (e.g. malaria, dengue) should trigger.
    const text = `
      Patient report
      Malaria check: negative
      Dengue antibody: not found
    `;
    expect(classifyOutOfScope(text)).toBe('viral');
  });

  it('breaks ties towards the category with the most hits', () => {
    // 2 hits for 'viral' ('dengue', 'syphilis') and 3 hits for 'imaging' ('x-ray', 'ct scan', 'mri brain')
    // Should return 'imaging' since it has more hits (3 vs 2).
    const text = `
      Report of the patient:
      Had dengue in past, syphilis negative.
      We took x-ray, ct scan, and mri brain.
    `;
    expect(classifyOutOfScope(text)).toBe('imaging');
  });

  it('does NOT trigger when each category has only one hit (per-category threshold)', () => {
    // The 2-hit threshold is per-category, not total. A document with
    // ONE viral mention + ONE imaging mention + ONE physical-exam
    // mention should NOT trigger — each category sits at hits=1.
    // Without the per-category gate, a future refactor could
    // accidentally sum hits across categories and start rejecting
    // routine reports that happen to mention multiple ad-hoc things.
    const text = `
      Annual Physical
      Notes: malaria history negative.
      Recommend chest x-ray follow-up if symptoms persist.
      Patient reports vision changes; refer for visual acuity check.
      Glucose 92 mg/dL
    `;
    expect(classifyOutOfScope(text)).toBeNull();
  });

  it('flags a single-row dengue combo panel via the definitive-term path', () => {
    // Previously this single-line dengue header would only count as 1
    // hit (multi-word "dengue ns1" might miss with non-space separators)
    // and fall through to the generic "no values found" failure. The
    // definitive-term path now lifts it to a viral classification.
    const text = `
      Dengue Combo NS1+IgM+IgG: All negative
      Patient ID: 12345
    `;
    expect(classifyOutOfScope(text)).toBe('viral');
  });

  it('flags a hepatitis-B surface antigen report from a single definitive hit', () => {
    const text = `
      Specimen: Serum
      HBsAg ELISA: Non-reactive
    `;
    expect(classifyOutOfScope(text)).toBe('viral');
  });

  it('strict mode does NOT flag on a single definitive hit (success-path guard)', () => {
    // The success-path call site uses strict mode so a boilerplate
    // "Dengue Antibody: Not tested" row in an otherwise-metabolic
    // panel doesn't trip the "we ignored some sections" banner.
    // Relaxed mode would flag this; strict requires 2+ distinct hits.
    const text = `
      Annual comprehensive panel
      Fasting Glucose 92 mg/dL
      Dengue Antibody: Not tested
    `;
    expect(classifyOutOfScope(text, 'strict')).toBeNull();
    expect(classifyOutOfScope(text, 'relaxed')).toBe('viral');
  });

  it('strict mode STILL flags a 2+ keyword document', () => {
    // Strict only filters the single-hit shortcut; the 2+ path is
    // unchanged and continues to catch dominantly out-of-scope files.
    const text = `
      HIV antibody: Non-reactive
      HBsAg: Non-reactive
      VDRL: Non-reactive
    `;
    expect(classifyOutOfScope(text, 'strict')).toBe('viral');
  });
});

/* ------------------------------------------------------------------ */
/* Vigorous Edge Cases for Value Parsing                              */
/* ------------------------------------------------------------------ */

describe('extractBiomarkersFromText — vigorous edge cases', () => {
  it('handles immediate attached units without space like "92mg/dL"', () => {
    const text = 'Fasting Glucose 92mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('glucose');
    expect(result[0].value).toBe(92);
  });

  it('handles attached % units with spacing in template', () => {
    // Template might have ' %' or '%'. Normalization collapses spaces before '%'
    const text = 'HbA1c 5.4%';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5.4);
  });

  it('ignores invalid numbers like multiple decimal points when they violate sanity limits', () => {
    const text = 'Fasting Glucose 999.999.999 mg/dL';
    const result = extractBiomarkersFromText(text);
    // The parser might match a substring like 999.999 which violates the Fasting Glucose sanity bounds (max 99 + 5*29 = 244)
    expect(result.find(m => m.id === 'glucose')).toBeUndefined();
  });

  it('rejects values exactly at the negative sanity boundary limit', () => {
    // Glucose healthy range 70-99 (span = 29).
    // Min sanity bound = 70 - (5 * 29) = -75.
    // Let's test a value below -75 (e.g. -76), it should be rejected.
    const text = 'Fasting Glucose -76 mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result.find(m => m.id === 'glucose')).toBeUndefined();
  });

  it('handles extremely long spaces, tabs, and carriage returns in text', () => {
    const text = 'Fasting\t\t\tGlucose\r\r\n\n\n\n   92   \t\t   mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(92);
  });

  it('handles trailing punctuation attached to numbers', () => {
    // Fasting Glucose 92. mg/dL -> should still extract 92
    const text = 'Fasting Glucose 92. mg/dL';
    const result = extractBiomarkersFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(92);
  });
});

