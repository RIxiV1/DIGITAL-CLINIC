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
    for (const u of ['thou/cumm', 'thousand/cumm', '10^3/uL', '10³/µL', 'x10^3']) {
      expect(unitMultiplier(u)).toBe(1e3);
    }
  });

  it('resolves lakh-family prefixes to 1e5', () => {
    for (const u of ['lakh/cumm', 'lac/cumm', '2.4 lakhs']) {
      expect(unitMultiplier(u)).toBe(1e5);
    }
  });

  it('resolves million-family prefixes to 1e6', () => {
    for (const u of ['million/cumm', 'mill/cumm', '10^6/uL', '10⁶/µL', 'x10^6']) {
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
      { name: 'totally insane testosterone-like reading', value: 5, unit: 'ng/dL' },
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
