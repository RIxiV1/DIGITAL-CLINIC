/**
 * White-box tests for the AI parser's pure reconciliation logic:
 * unit-multiplier resolution and the catalog mapper that scales, sanity-
 * bounds, dedupes, and routes unmapped markers. These are the algorithmic
 * core where a real bug means a healthy reading rendered as critical (bad
 * scaling) or a hallucinated marker reaching the dashboard (loose match).
 *
 * The end-to-end parseWithAi (downscale canvas + fetch) is plumbing and
 * needs a real browser; it's covered by the Playwright pass, not here.
 */

import { describe, it, expect } from 'vitest';
import { unitMultiplier, mapGeminiResultsToCatalog } from './aiParser';
import { extractBiomarkersFromText } from './pdfParser';

describe('unitMultiplier — Indian count-prefix reconciliation', () => {
  it('returns 1 for plain mass/concentration units and empties', () => {
    for (const u of ['mg/dL', 'ng/mL', 'g/dL', '%', '/cumm', '', '   ']) {
      expect(unitMultiplier(u)).toBe(1);
    }
    expect(unitMultiplier(null)).toBe(1);
    expect(unitMultiplier(undefined)).toBe(1);
  });

  it('resolves thousand-family prefixes to 1e3', () => {
    for (const u of [
      'thou/cumm',
      'thousand/cumm',
      'thousands/cumm', // plural
      '10^3/uL',
      '10³/µL',
      'x10^3',
    ]) {
      expect(unitMultiplier(u)).toBe(1e3);
    }
  });

  it('resolves lakh-family prefixes to 1e5', () => {
    for (const u of ['lakh/cumm', 'lac/cumm', '2.4 lakhs']) {
      expect(unitMultiplier(u)).toBe(1e5);
    }
  });

  it('resolves million-family prefixes to 1e6', () => {
    for (const u of [
      'million/cumm',
      'millions/cumm', // plural — real Hindlabs "Millions/Cumm" RBC unit
      'Millions/Cumm', // exact casing from the report
      'mill/cumm',
      '10^6/uL',
      '10⁶/µL',
      'x10^6',
    ]) {
      expect(unitMultiplier(u)).toBe(1e6);
    }
  });

  it('does not false-positive on a plain unit that merely embeds letters', () => {
    // No standalone count token → no scaling.
    expect(unitMultiplier('mg/dL')).toBe(1);
    expect(unitMultiplier('IU/mL')).toBe(1);
  });
});

describe('mapGeminiResultsToCatalog — match, scale, bound, dedupe, route', () => {
  it('maps a known marker in its canonical unit unchanged', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 14.8, unit: 'g/dL' },
    ]);
    expect(out.biomarkers).toHaveLength(1);
    expect(out.biomarkers[0].value).toBeCloseTo(14.8, 5);
    expect(out.unmapped).toHaveLength(0);
  });

  it('maps RBC in the plural "Millions/Cumm" unit without collapsing to zero', () => {
    // Real Hindlabs CBC bug: Gemini returned RBC 5.05 "Millions/Cumm".
    // The plural "Millions" missed the million-prefix regex, so the
    // printed unit got multiplier 1 while the catalog's million/cumm got
    // 1e6 — the value was scaled by 1/1e6 and rendered as an impossible
    // RBC of 0.000 (5.05 → 0.00000505).
    const out = mapGeminiResultsToCatalog([
      { name: 'Total RBC Count', value: 5.05, unit: 'Millions/Cumm' },
    ]);
    expect(out.biomarkers.find((m) => m.id === 'rbc')?.value).toBeCloseTo(
      5.05,
      2,
    );
  });

  // altUnits SI conversion on the AI path — previously the AI parser only did
  // count-prefix scaling and skipped altUnits entirely, so SI units and the
  // troponin/D-dimer scale-safety fixes silently didn't apply when a report
  // went through Gemini. These keep it in lockstep with the text parser.
  it('troponin pg/mL ÷1000 via AI path (no false MI)', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Troponin I', value: 14, unit: 'pg/mL' },
    ]);
    expect(out.biomarkers.find((m) => m.id === 'troponin-i')?.value).toBeCloseTo(
      0.014,
      4,
    );
  });
  it('D-Dimer mg/L ×1000 via AI path (no missed PE)', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'D-Dimer', value: 2.5, unit: 'mg/L' },
    ]);
    expect(out.biomarkers.find((m) => m.id === 'd-dimer')?.value).toBeCloseTo(
      2500,
      1,
    );
  });
  it('glucose mmol/L → mg/dL via AI path', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Fasting Glucose', value: 5, unit: 'mmol/L' },
    ]);
    expect(out.biomarkers.find((m) => m.id === 'glucose')?.value).toBeCloseTo(
      90.08,
      1,
    );
  });
  it('platelets x10^9/L ×1000 via AI path', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Platelet Count', value: 82, unit: 'x10^9/L' },
    ]);
    expect(out.biomarkers.find((m) => m.id === 'platelets')?.value).toBeCloseTo(
      82000,
      0,
    );
  });

  it('routes an unrecognised marker name to unmapped, not the dashboard', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Zorblaxium Level', value: 5, unit: 'mg/dL' },
    ]);
    expect(out.biomarkers).toHaveLength(0);
    expect(out.unmapped.map((u) => u.name)).toContain('Zorblaxium Level');
  });

  it('rejects non-finite and negative values (sign-flip / hallucination)', () => {
    const nan = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: Number.NaN, unit: 'g/dL' },
    ]);
    expect(nan.biomarkers).toHaveLength(0);
    expect(nan.unmapped).toHaveLength(1);

    const neg = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: -3, unit: 'g/dL' },
    ]);
    expect(neg.biomarkers).toHaveLength(0);
    expect(neg.unmapped).toHaveLength(1);
  });

  it('rejects physically impossible values via the sanity bound', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 5000, unit: 'g/dL' },
    ]);
    expect(out.biomarkers).toHaveLength(0);
    expect(out.unmapped).toHaveLength(1);
  });

  it('dedupes repeat readings of the same template (keeps the first)', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 14.8, unit: 'g/dL' },
      { name: 'Haemoglobin (Hb)', value: 9.1, unit: 'g/dL' },
    ]);
    expect(out.biomarkers).toHaveLength(1);
    expect(out.biomarkers[0].value).toBeCloseTo(14.8, 5);
  });

  it('does not match on a substring/loose name (catalog trust boundary)', () => {
    // The hardened matcher must NOT resolve "total testosterone" out of an
    // arbitrary phrase — that was a real loose-match hallucination vector.
    const out = mapGeminiResultsToCatalog([
      {
        name: 'totally insane testosterone-like reading',
        value: 5,
        unit: 'ng/dL',
      },
    ]);
    expect(out.biomarkers).toHaveLength(0);
  });

  it('partitions a mixed batch into mapped + unmapped', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 14.8, unit: 'g/dL' },
      { name: 'Zorblaxium', value: 1, unit: 'mg/dL' },
    ]);
    expect(out.biomarkers).toHaveLength(1);
    expect(out.unmapped.map((u) => u.name)).toContain('Zorblaxium');
  });
});

/**
 * The AI path and the text path are two readings of the SAME report, so
 * anything they disagree about is a bug in one of them by definition. Every
 * case below was a real divergence: the AI path silently produced a different
 * number, a different marker, or a different grade than the deterministic
 * path would have for identical input.
 */
describe('AI path ≡ text path — divergences that produced false results', () => {
  const viaAi = (name: string, value: number, unit: string) =>
    mapGeminiResultsToCatalog([{ name, value, unit }]);
  const viaText = (name: string, value: number, unit: string) =>
    extractBiomarkersFromText(`${name} ${value} ${unit}\n`);

  it.each([
    // Unit spellings the AI path's own copy of unitMultiplier had never
    // learned — each one left the value unscaled and graded it as critical.
    ['Platelet Count', 2.4, 'lacs/cumm'],
    ['Total Leucocyte Count', 7.2, '10E3/uL'],
    ['Total Leucocyte Count', 11.25, 'x10^9/L'],
    // Conversions both paths already shared — guarding the parity itself.
    ['Creatinine', 88, 'umol/L'],
    ['Glucose', 5.5, 'mmol/L'],
    ['Hemoglobin', 13.2, 'g/dL'],
  ])('reads "%s %s %s" identically on both paths', (name, value, unit) => {
    const ai = viaAi(name as string, value as number, unit as string);
    const text = viaText(name as string, value as number, unit as string);
    expect(text).toHaveLength(1);
    expect(ai.biomarkers).toHaveLength(1);
    expect(ai.biomarkers[0].id).toBe(text[0].id);
    expect(ai.biomarkers[0].value).toBe(text[0].value);
    expect(ai.biomarkers[0].status).toBe(text[0].status);
  });

  it('resolves "Free T4" to free T4, not to total T4', () => {
    // "Free T4" contains the token "T4", so first-match-in-catalog-order
    // resolved it to the TOTAL T4 template (µg/dL) and reported a free T4 of
    // 1.13 ng/dL as a total T4 of 14.5 µg/dL, graded 'concern' not 'good'.
    const out = viaAi('Free T4', 14.5, 'pmol/L');
    expect(out.biomarkers[0]?.id).toBe('free-t4');
    expect(out.biomarkers[0]?.id).toBe(viaText('Free T4', 14.5, 'pmol/L')[0].id);
  });

  it('resolves "Free T3" to free T3, not to total T3', () => {
    const out = viaAi('Free T3', 4.8, 'pmol/L');
    expect(out.biomarkers[0]?.id).toBe('free-t3');
  });

  it.each([
    ['Total Cholesterol', 5.2],
    ['Triglycerides', 1.7],
    ['HDL Cholesterol', 1.3],
  ])(
    'refuses to read "%s" in mmol/L as though it were mg/dL',
    (name, value) => {
      // The lipid templates declare no mmol/L conversion, and the AI path had
      // no unit gate — so a routine UK/EU lipid panel mapped 5.2 mmol/L onto
      // the mg/dL template as "5.2 mg/dL" (really ~201) and rendered normal.
      // The text path's unit gate already refused this; now both do.
      const out = viaAi(name as string, value as number, 'mmol/L');
      expect(out.biomarkers).toHaveLength(0);
      expect(out.unmapped.map((u) => u.name)).toContain(name);
      expect(viaText(name as string, value as number, 'mmol/L')).toHaveLength(0);
    },
  );

  it('leaves a natively-molar marker alone', () => {
    // SHBG's own canonical unit is nmol/L — molar against molar is the
    // normal case and must not be caught by the guard above.
    const out = viaAi('SHBG', 30, 'nmol/L');
    expect(out.biomarkers[0]?.value).toBe(30);
  });
});

describe("AI path — the lab's own printed reference range", () => {
  it('carries a sane printed range through to the marker', () => {
    // refMin/refMax were validated by the response schema and then dropped:
    // markerFromTemplate was called without them, so "trust the signing
    // pathologist" never applied to anything read off a photo.
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 13.2, unit: 'g/dL', refMin: 12, refMax: 16 },
    ]);
    expect(out.biomarkers[0].labRefMin).toBe(12);
    expect(out.biomarkers[0].labRefMax).toBe(16);
  });

  it('rejects an inverted range', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 13.2, unit: 'g/dL', refMin: 16, refMax: 12 },
    ]);
    expect(out.biomarkers[0].labRefMin).toBeUndefined();
  });

  it('rejects a range the value could not plausibly belong to', () => {
    // A misread range is at least as likely from a vision model as from OCR,
    // and an unchecked one invents flags rather than fixing them.
    const out = mapGeminiResultsToCatalog([
      {
        name: 'Hemoglobin',
        value: 13.2,
        unit: 'g/dL',
        refMin: 1200,
        refMax: 1600,
      },
    ]);
    expect(out.biomarkers[0].labRefMin).toBeUndefined();
  });

  it('omits the range when the model reported none', () => {
    const out = mapGeminiResultsToCatalog([
      { name: 'Hemoglobin', value: 13.2, unit: 'g/dL' },
    ]);
    expect(out.biomarkers[0].labRefMin).toBeUndefined();
  });
});
