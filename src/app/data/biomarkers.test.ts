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
  pickHeadlineMarker,
  statusForValue,
  type Biomarker,
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

/* ------------------------------------------------------------------ */
/* pickHeadlineMarker — clinical-significance sorting across tiers      */
/* ------------------------------------------------------------------ */

describe('pickHeadlineMarker', () => {
  /**
   * Lightweight Biomarker factory for the headline-picker tests. The
   * catalog templates aren't usable as-is because they don't carry a
   * `value` or `history` — both required to compute trend + delta.
   */
  function marker(
    id: string,
    status: Biomarker['status'],
    value: number,
    prev: number,
    direction: Biomarker['direction'] = 'up',
  ): Biomarker {
    return {
      id,
      name: id,
      value,
      unit: '',
      min: 0,
      max: 100,
      status,
      category: 'hormones',
      direction,
      plain: '',
      history: [{ date: '2026-01-01', value: prev }],
    };
  }

  it('returns null when no markers have history', () => {
    const m: Biomarker = {
      id: 'x',
      name: 'x',
      value: 10,
      unit: '',
      min: 0,
      max: 20,
      status: 'good',
      category: 'hormones',
      plain: '',
    };
    expect(pickHeadlineMarker([m])).toBeNull();
  });

  it('declining concerns win over improving markers regardless of magnitude', () => {
    // Even a tiny declining-concern outranks a huge improving marker —
    // because the user needs to know what's getting WORSE first, not
    // what's getting better. With direction='up' (up=better), value
    // < prev = declining.
    const tinyConcern = marker('t-concern', 'concern', 95, 100); // -5 declining
    const bigImproving = marker('big-imp', 'good', 90, 10); // +80 improving
    expect(pickHeadlineMarker([bigImproving, tinyConcern])?.id).toBe(
      't-concern',
    );
  });

  it('picks the largest-magnitude declining concern', () => {
    // up=better direction → "declining" means value DECREASED.
    const small = marker('small', 'concern', 95, 100); // -5
    const large = marker('large', 'concern', 60, 100); // -40
    const medium = marker('medium', 'concern', 80, 100); // -20
    // Order shouldn't matter — the largest delta wins.
    expect(pickHeadlineMarker([small, medium, large])?.id).toBe('large');
    expect(pickHeadlineMarker([large, medium, small])?.id).toBe('large');
  });

  it('picks the largest-magnitude declining attention when no concerns are declining', () => {
    // Real-world: previously the picker took whatever came first in the
    // array. A user whose B12 dropped 200 pg/mL would have the headline
    // call out a 5-point ferritin nudge instead if ferritin appeared first.
    const small = marker('small-att', 'attention', 95, 100, 'up'); // -5
    const large = marker('large-att', 'attention', 60, 100, 'up'); // -40
    expect(pickHeadlineMarker([small, large])?.id).toBe('large-att');
    expect(pickHeadlineMarker([large, small])?.id).toBe('large-att');
  });

  it('picks the largest-magnitude improving marker when nothing is declining', () => {
    const small = marker('small-imp', 'good', 55, 50, 'up'); // +5
    const large = marker('large-imp', 'good', 90, 50, 'up'); // +40
    expect(pickHeadlineMarker([small, large])?.id).toBe('large-imp');
    expect(pickHeadlineMarker([large, small])?.id).toBe('large-imp');
  });

  it('does not mutate the input array order', () => {
    // The sort must be applied to a copy — callers (HomePage, the
    // dashboard headline) pass arrays they iterate over for unrelated
    // surfaces and would render in the wrong order if we sorted in place.
    const a = marker('a', 'concern', 90, 100); // -10
    const b = marker('b', 'concern', 50, 100); // -50
    const input = [a, b];
    const snapshot = [...input];
    pickHeadlineMarker(input);
    expect(input).toEqual(snapshot);
  });
});
