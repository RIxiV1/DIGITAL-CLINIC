/**
 * Tests for the data-layer helpers in biomarkers.ts.
 *
 * Covers:
 *   - statusForValue: in/out of healthy range, with and without an
 *     optimal sub-band, for both 'up' and 'down' direction markers.
 *   - markerFromTemplate: shape correctness — id/name/unit/range
 *     fields copy through, status is derived, optional fields are
 *     preserved.
 *   - biomarkerCatalog integrity: every entry has a valid category
 *     and a non-empty alias list, no duplicate ids.
 */

import { describe, it, expect } from 'vitest';
import {
  biomarkerCatalog,
  categories,
  getTemplateById,
  markerFromTemplate,
  statusForValue,
  type BiomarkerCategoryId,
} from './biomarkers';

const VIT_D = getTemplateById('vit-d');
const LDL = getTemplateById('ldl');
const HBA1C = getTemplateById('hba1c');
const HB = getTemplateById('hb');

if (!VIT_D || !LDL || !HBA1C || !HB) {
  throw new Error(
    'Fixture template missing from catalog — these ids must stay stable: vit-d, ldl, hba1c, hb',
  );
}

/* ------------------------------------------------------------------ */
/* statusForValue                                                       */
/* ------------------------------------------------------------------ */

describe('statusForValue', () => {
  it('returns "concern" for a value below the healthy minimum', () => {
    // Vitamin D: min 30, max 100. 25 < 30 → concern.
    expect(statusForValue(VIT_D, 25)).toBe('concern');
  });

  it('returns "concern" for a value above the healthy maximum', () => {
    // LDL: min 0, max 100. 145 > 100 → concern.
    expect(statusForValue(LDL, 145)).toBe('concern');
  });

  it('returns "good" for a value inside healthy AND inside optimal band', () => {
    // Vitamin D: healthy 30-100, optimal 40-80. 55 is inside both.
    expect(statusForValue(VIT_D, 55)).toBe('good');
  });

  it('returns "attention" when inside healthy but outside optimal', () => {
    // Vitamin D: healthy 30-100, optimal 40-80. 35 is inside healthy
    // but below the optimal floor → attention.
    expect(statusForValue(VIT_D, 35)).toBe('attention');
    // 90 is inside healthy but above the optimal ceiling → attention.
    expect(statusForValue(VIT_D, 90)).toBe('attention');
  });

  it('returns "good" inside healthy when no optimal band is defined', () => {
    // LDL has no optimalMin/Max — anything inside 0-100 is just good.
    expect(statusForValue(LDL, 60)).toBe('good');
  });

  it('treats values exactly on the boundary as inside healthy', () => {
    // HbA1c: min 4, max 5.7. Exactly 4 and exactly 5.7 are healthy.
    expect(statusForValue(HBA1C, 4)).toBe('attention'); // outside optimal 4.5-5.3
    expect(statusForValue(HBA1C, 5.7)).toBe('attention');
  });

  it('respects optimal-band boundaries exactly', () => {
    // HbA1c: optimal 4.5-5.3. Exactly 4.5 is good; 4.49 is attention.
    expect(statusForValue(HBA1C, 4.5)).toBe('good');
    expect(statusForValue(HBA1C, 4.49)).toBe('attention');
    expect(statusForValue(HBA1C, 5.3)).toBe('good');
    expect(statusForValue(HBA1C, 5.31)).toBe('attention');
  });
});

/* ------------------------------------------------------------------ */
/* markerFromTemplate                                                   */
/* ------------------------------------------------------------------ */

describe('markerFromTemplate', () => {
  it('constructs a Biomarker with the value + derived status', () => {
    const m = markerFromTemplate(VIT_D, 55);
    expect(m.id).toBe('vit-d');
    expect(m.value).toBe(55);
    expect(m.status).toBe('good');
    expect(m.category).toBe('vitamins');
  });

  it('copies range, optimal range, and direction through to the Biomarker', () => {
    const m = markerFromTemplate(VIT_D, 50);
    expect(m.min).toBe(30);
    expect(m.max).toBe(100);
    expect(m.optimalMin).toBe(40);
    expect(m.optimalMax).toBe(80);
    expect(m.direction).toBe('up');
    expect(m.unit).toBe('ng/mL');
  });

  it('preserves the plain-English explanation', () => {
    const m = markerFromTemplate(VIT_D, 50);
    expect(m.plain).toMatch(/mood, energy, immunity/i);
  });

  it('passes through problemId when the template has one', () => {
    const m = markerFromTemplate(LDL, 145);
    expect(m.problemId).toBe('high-ldl');
  });

  it('omits problemId when the template doesn’t set one', () => {
    const m = markerFromTemplate(HB, 14);
    expect(m.problemId).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Catalog integrity                                                    */
/* ------------------------------------------------------------------ */

describe('biomarkerCatalog integrity', () => {
  it('has no duplicate ids', () => {
    const ids = biomarkerCatalog.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every entry has a non-empty aliases array', () => {
    const empty = biomarkerCatalog.filter((t) => t.aliases.length === 0);
    expect(empty).toEqual([]);
  });

  it('every entry’s category is a known BiomarkerCategoryId', () => {
    const known = new Set<BiomarkerCategoryId>(categories.map((c) => c.id));
    const unknown = biomarkerCatalog.filter((t) => !known.has(t.category));
    expect(unknown).toEqual([]);
  });

  it('every entry has min < max', () => {
    const bad = biomarkerCatalog.filter((t) => t.min >= t.max);
    expect(bad).toEqual([]);
  });

  it('every entry’s optimal band (when defined) is inside its healthy range', () => {
    const violators = biomarkerCatalog.filter((t) => {
      if (t.optimalMin === undefined || t.optimalMax === undefined) return false;
      return (
        t.optimalMin < t.min ||
        t.optimalMax > t.max ||
        t.optimalMin > t.optimalMax
      );
    });
    expect(violators).toEqual([]);
  });

  it('getTemplateById returns the correct template', () => {
    expect(getTemplateById('vit-d')?.name).toBe('Vitamin D (25-OH)');
  });

  it('getTemplateById returns undefined for unknown ids', () => {
    expect(getTemplateById('nonexistent-marker-id')).toBeUndefined();
  });
});
