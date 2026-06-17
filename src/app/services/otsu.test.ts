import { describe, it, expect } from 'vitest';
import { otsuThreshold } from './pdfParser';

/** Build a 256-bin histogram from (bin, count) pairs. */
function hist(pairs: Array<[number, number]>): number[] {
  const h = new Array(256).fill(0);
  for (const [bin, count] of pairs) h[bin] += count;
  return h;
}

describe('otsuThreshold', () => {
  it('separates a clean bimodal histogram between the two modes', () => {
    // Dark "ink" mode at 40, light "paper" mode at 220. The cut t means
    // "pixels ≤ t are background"; for two deltas that lands on the low
    // mode (40) — anything in [40, 220) cleanly separates them.
    const { threshold, separability } = otsuThreshold(
      hist([
        [40, 3000],
        [220, 7000],
      ]),
    );
    expect(threshold).toBeGreaterThanOrEqual(40);
    expect(threshold).toBeLessThan(220);
    // Two clean modes → near-perfect separability.
    expect(separability).toBeGreaterThan(0.9);
  });

  it('still trusts the split when text is a sparse minority', () => {
    // Mostly white paper (98%) + a thin sliver of dark text (2%) — the
    // typical lab-report photo. Still cleanly bimodal, so η stays high
    // and Otsu is used (NOT the fallback).
    const { threshold, separability } = otsuThreshold(
      hist([
        [30, 200],
        [245, 9800],
      ]),
    );
    expect(threshold).toBeGreaterThanOrEqual(30);
    expect(threshold).toBeLessThan(245);
    expect(separability).toBeGreaterThan(OTSU_TRUST);
  });

  it('reports zero separability for a near-constant (no-split) frame', () => {
    // All pixels effectively one shade → zero total variance, no genuine
    // foreground/background to separate. η collapses below the trust
    // threshold so the caller uses the fixed fallback cutoff instead of a
    // meaningless Otsu cut.
    const { separability } = otsuThreshold(hist([[128, 5000]]));
    expect(separability).toBeLessThan(OTSU_TRUST);
    expect(Number.isNaN(separability)).toBe(false);
  });

  it('returns the fixed fallback threshold for an empty histogram', () => {
    const { threshold, separability } = otsuThreshold(new Array(256).fill(0));
    expect(threshold).toBe(160);
    expect(separability).toBe(0);
  });
});

// Mirror of OTSU_MIN_SEPARABILITY in pdfParser.ts (not exported — kept in
// sync here so the test reads against the same trust threshold the
// preprocessing uses).
const OTSU_TRUST = 0.25;
