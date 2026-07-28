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
