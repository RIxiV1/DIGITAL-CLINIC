import { describe, expect, it } from 'vitest';
import { biomarkerCatalog } from './biomarkerCatalog';
import { statusForValue, type BiomarkerStatus } from './biomarkers';

/**
 * Property tests over the WHOLE catalog — invariants that must hold for every
 * template, not example-by-example. These are the mathematical guarantees the
 * rest of the app relies on; a single violation here is a data bug that would
 * ripple into status classification and the narrative.
 */
const STATUSES: readonly BiomarkerStatus[] = [
  'good',
  'attention',
  'concern',
  'critical',
];

describe('biomarkerCatalog — invariants', () => {
  it('every template has a non-empty, UNIQUE canonical id', () => {
    const ids = biomarkerCatalog.map((t) => t.id);
    for (const id of ids) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a name, a string unit, and a category', () => {
    for (const t of biomarkerCatalog) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.unit).toBe('string');
      expect(t.category.length).toBeGreaterThan(0);
    }
  });

  it('every healthy range is finite and satisfies min < max', () => {
    for (const t of biomarkerCatalog) {
      expect(Number.isFinite(t.min), `${t.id} min`).toBe(true);
      expect(Number.isFinite(t.max), `${t.id} max`).toBe(true);
      expect(t.min, `${t.id} min<max`).toBeLessThan(t.max);
    }
  });

  it('optimal sub-band, when present, is ordered and inside the healthy band', () => {
    for (const t of biomarkerCatalog) {
      if (typeof t.optimalMin === 'number' && typeof t.optimalMax === 'number') {
        expect(t.optimalMin, `${t.id} optimal`).toBeLessThanOrEqual(
          t.optimalMax,
        );
        expect(t.optimalMin, `${t.id} optimalMin>=min`).toBeGreaterThanOrEqual(
          t.min,
        );
        expect(t.optimalMax, `${t.id} optimalMax<=max`).toBeLessThanOrEqual(
          t.max,
        );
      }
    }
  });

  it('physical bounds, when present, are ordered and contain the healthy band', () => {
    for (const t of biomarkerCatalog) {
      if (typeof t.physicalMin === 'number') {
        expect(t.physicalMin, `${t.id} physMin<=min`).toBeLessThanOrEqual(
          t.min,
        );
      }
      if (typeof t.physicalMax === 'number') {
        expect(t.physicalMax, `${t.id} physMax>=max`).toBeGreaterThanOrEqual(
          t.max,
        );
      }
    }
  });

  it('statusForValue returns a valid enum for every template across a full sweep', () => {
    for (const t of biomarkerCatalog) {
      const span = t.max - t.min || 1;
      const samples = [
        t.min - 5 * span,
        t.min,
        (t.min + t.max) / 2,
        t.max,
        t.max + 5 * span,
        0,
      ];
      for (const v of samples) {
        expect(STATUSES, `${t.id} @ ${v}`).toContain(statusForValue(t, v));
      }
    }
  });
});
