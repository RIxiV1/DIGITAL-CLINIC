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
  getTrajectory,
  markerFromTemplate,
  MAX_PROJECTION_MONTHS,
  pickHeadlineMarker,
  statusForValue,
  summarizeStatuses,
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

const UREA = getTemplateById('bun');
if (!UREA) {
  throw new Error('Fixture template missing from catalog: bun');
}

/* ------------------------------------------------------------------ */
/* Blood Urea (bun) — India-first urea-scale grading, no false critical */
/* ------------------------------------------------------------------ */

describe('Blood Urea (bun) — urea-scale grading', () => {
  it('grades a normal Indian urea value as good (was concern on the old 7–20 BUN band)', () => {
    expect(statusForValue(UREA, 30)).toBe('good'); // inside 15–40
  });

  it('does NOT fire a false critical for an elevated-but-not-panic urea value', () => {
    // 55 mg/dL: criticalHigh used to be 47 (the BUN scale), so a normal
    // urea reading tripped a 'critical' same-day-care alarm. Now 'concern'.
    expect(statusForValue(UREA, 55)).toBe('concern');
  });

  it('still escalates a genuinely high urea value to critical', () => {
    expect(statusForValue(UREA, 110)).toBe('critical'); // ≥100 ≈ BUN ≥47
  });

  it("respects the lab's printed range over the catalog band", () => {
    // A BUN-scale report printing its own range grades off that range,
    // not the urea-scale catalog band.
    expect(statusForValue(UREA, 15, { min: 7, max: 20 })).toBe('good');
  });
});

const SHBG = getTemplateById('shbg');
if (!SHBG) {
  throw new Error('Fixture template missing from catalog: shbg');
}

describe('SHBG — adult-male ceiling raised to 57 nmol/L', () => {
  it('grades a healthy older-male value of 55 as good (was concern at the old max of 50)', () => {
    expect(statusForValue(SHBG, 55)).toBe('good'); // inside 10–57
  });

  it('still flags a genuinely high SHBG above the ceiling', () => {
    expect(statusForValue(SHBG, 60)).toBe('concern'); // above 57
  });

  it('still flags low SHBG (the metabolically relevant direction, unchanged)', () => {
    expect(statusForValue(SHBG, 8)).toBe('concern'); // below 10
  });
});

const EGFR = getTemplateById('egfr');
if (!EGFR) {
  throw new Error('Fixture template missing from catalog: egfr');
}

describe('eGFR — KDIGO stages mapped onto the four tiers', () => {
  it('grades a normal eGFR (G1, ≥90) as good', () => {
    expect(statusForValue(EGFR, 100)).toBe('good');
  });

  it('grades a mildly-reduced eGFR (G2, 60–89) as attention, not a false out-of-range', () => {
    // 75 used to read 'concern' (healthy floor was 90); G2 isn't CKD on
    // its own, so it should read borderline, not alarming.
    expect(statusForValue(EGFR, 75)).toBe('attention');
  });

  it('surfaces CKD (G3, <60) as concern — the clinically meaningful cutoff', () => {
    expect(statusForValue(EGFR, 50)).toBe('concern');
  });

  it('escalates advanced CKD (G4/G5, <30) to critical', () => {
    expect(statusForValue(EGFR, 25)).toBe('critical');
  });
});

/* ------------------------------------------------------------------ */
/* statusForValue                                                       */
/* ------------------------------------------------------------------ */

describe('statusForValue', () => {
  it('returns "concern" for a value below the healthy minimum', () => {
    // Vitamin D: floor is now 20 ng/mL (IOM/India). 15 < 20 → concern.
    expect(statusForValue(VIT_D, 15)).toBe('concern');
  });

  it('treats the India 20–30 ng/mL Vitamin D band as in-range, not concern', () => {
    // The 30→20 floor change: 25 ng/mL is "sufficient, below optimal" →
    // attention, NOT the old "concern". This is the anti-over-flag fix.
    expect(statusForValue(VIT_D, 25)).toBe('attention');
  });

  it('returns "concern" for a value above the healthy maximum', () => {
    // LDL: min 0, max 100. 145 > 100 → concern.
    expect(statusForValue(LDL, 145)).toBe('concern');
  });

  it('returns "good" for a value inside healthy AND inside optimal band', () => {
    // Vitamin D: healthy 20-100, optimal 40-80. 55 is inside both.
    expect(statusForValue(VIT_D, 55)).toBe('good');
  });

  it('returns "attention" when inside healthy but outside optimal', () => {
    // Vitamin D: healthy 20-100, optimal 40-80. 35 is inside healthy
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
    expect(m.min).toBe(20);
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

  it('propagates clinical-critical bounds so the bar can scale against them', () => {
    // HbA1c has an explicit 10% critical cliff; a 7.2% reading is
    // diabetic (concern) but well below it, so the bar must place the
    // dot against the real 10% ceiling — not peg it to the track wall.
    const m = markerFromTemplate(HBA1C, 7.2);
    expect(m.criticalHigh).toBe(HBA1C.criticalHigh);
    expect(m.criticalHigh).toBe(10);
    expect(m.criticalLow).toBe(HBA1C.criticalLow); // undefined here
    expect(m.status).toBe('concern');
  });
});

/* ------------------------------------------------------------------ */
/* summarizeStatuses — single-source counts                             */
/* ------------------------------------------------------------------ */

describe('summarizeStatuses', () => {
  it('folds critical into needCare so every surface reconciles', () => {
    const mk = (status: Biomarker['status']): Biomarker => ({
      ...markerFromTemplate(HBA1C, 5),
      status,
    });
    const s = summarizeStatuses([
      mk('good'),
      mk('attention'),
      mk('concern'),
      mk('critical'),
      mk('critical'),
    ]);
    expect(s.good).toBe(1);
    expect(s.attention).toBe(1);
    expect(s.concern).toBe(1); // concern-only, unchanged
    expect(s.critical).toBe(2);
    // needCare = concern + critical — the count shown app-wide.
    expect(s.needCare).toBe(3);
    expect(s.total).toBe(5);
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
      if (t.optimalMin === undefined || t.optimalMax === undefined)
        return false;
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

/* ------------------------------------------------------------------ */
/* Harm-anchor action thresholds — cited, propagated, never fabricated  */
/* ------------------------------------------------------------------ */

describe('action thresholds (harm-anchor)', () => {
  it('glucose + HbA1c carry cited ADA action thresholds', () => {
    const glu = getTemplateById('glucose');
    const a1c = getTemplateById('hba1c');
    // India-first: diagnostic cutoffs follow WHO/ICMR (same numbers as
    // ADA, but cited to the Indian authority for this audience).
    expect(glu?.actionMax).toBe(126);
    expect(glu?.actionSource?.label).toContain('ICMR');
    expect(glu?.actionSource?.url).toMatch(/icmr/i);
    expect(a1c?.actionMax).toBe(6.5);
    expect(a1c?.actionSource?.label).toContain('ICMR');
    expect(a1c?.actionSource?.url).toMatch(/icmr/i);
    // HbA1c carries the India-specific anaemia caveat.
    expect(a1c?.actionSource?.label.toLowerCase()).toContain('anaemia');
  });

  it('markerFromTemplate propagates the action threshold + its citation', () => {
    const m = markerFromTemplate(getTemplateById('glucose')!, 110);
    expect(m.actionMax).toBe(126);
    expect(m.actionSource?.label).toContain('ICMR');
  });

  it('markers without an action threshold leave it undefined (no fabrication)', () => {
    // Hemoglobin has no action threshold defined — must stay undefined,
    // never a synthesized value.
    const m = markerFromTemplate(getTemplateById('hb')!, 14);
    expect(m.actionMax).toBeUndefined();
    expect(m.actionMin).toBeUndefined();
    expect(m.actionSource).toBeUndefined();
  });

  it('every template that sets an action threshold also cites a source', () => {
    for (const t of biomarkerCatalog) {
      const hasThreshold =
        typeof t.actionMin === 'number' || typeof t.actionMax === 'number';
      if (hasThreshold) {
        expect(
          t.actionSource,
          `${t.id} sets an action threshold without a source`,
        ).toBeTruthy();
      }
    }
  });

  it('every template with an optimal band also cites a source', () => {
    // Cite-or-omit, the symmetric half of the action-source rule above:
    // an optimal sub-band with no citation reads as an invented "ideal
    // range" and erodes trust (the catalog comments warn against exactly
    // this). The action side was pinned; this locks the optimal side so a
    // future un-sourced optimal band fails CI instead of shipping quietly.
    for (const t of biomarkerCatalog) {
      const hasOptimal =
        typeof t.optimalMin === 'number' || typeof t.optimalMax === 'number';
      if (hasOptimal) {
        expect(
          t.optimalSource,
          `${t.id} sets an optimal band without a source`,
        ).toBeTruthy();
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* statusForValue — non-finite guard                                    */
/* ------------------------------------------------------------------ */

describe('statusForValue — non-finite guard', () => {
  // A failed / garbage parse must never read as the most reassuring tier.
  // Comparisons against NaN are all false, so without the guard NaN would
  // fall through to 'good'. Pin that non-finite input never grades 'good'.
  it('NaN never grades as good', () => {
    expect(statusForValue(VIT_D, NaN)).not.toBe('good');
    expect(statusForValue(LDL, NaN)).not.toBe('good');
    expect(statusForValue(HBA1C, NaN)).not.toBe('good');
  });

  it('Infinity and -Infinity never grade as good', () => {
    expect(statusForValue(VIT_D, Infinity)).not.toBe('good');
    expect(statusForValue(VIT_D, -Infinity)).not.toBe('good');
  });
});

/* ------------------------------------------------------------------ */
/* getTrajectory — forward projection from reading history             */
/* ------------------------------------------------------------------ */

describe('getTrajectory', () => {
  const trajMarker = (over: Partial<Biomarker>): Biomarker => ({
    id: 'tm',
    name: 'TM',
    value: 0,
    unit: 'u',
    min: 0,
    max: 100,
    status: 'good',
    category: 'heart',
    plain: '.',
    ...over,
  });

  it('returns null without enough readings', () => {
    expect(getTrajectory(trajMarker({ value: 50 }), '2026-03-02')).toBeNull();
  });

  it('returns null when asOf is missing or invalid', () => {
    const m = trajMarker({
      value: 130,
      history: [{ date: '2026-01-01', value: 160 }],
    });
    expect(getTrajectory(m, undefined)).toBeNull();
    expect(getTrajectory(m, 'not-a-date')).toBeNull();
  });

  it('returns null when every reading falls on the same day', () => {
    const m = trajMarker({
      value: 130,
      history: [{ date: '2026-03-02', value: 150 }],
    });
    expect(getTrajectory(m, '2026-03-02')).toBeNull();
  });

  it('projects months-to-target when closing on the band', () => {
    // optimal ≤ 100; value 130, dropping 0.5/day over 60 days → reaches
    // 100 in 60 more days ≈ 2 months.
    const m = trajMarker({
      value: 130,
      min: 0,
      max: 200,
      optimalMin: 0,
      optimalMax: 100,
      history: [{ date: '2026-01-01', value: 160 }],
    });
    const t = getTrajectory(m, '2026-03-02');
    expect(t?.movement).toBe('toward');
    expect(t?.monthsToTarget).toBe(2);
    expect(t?.ratePerMonth).toBeCloseTo(-15, 0);
  });

  it('flags drift away from the band (no ETA)', () => {
    const m = trajMarker({
      value: 130,
      min: 0,
      max: 200,
      optimalMin: 0,
      optimalMax: 100,
      history: [{ date: '2026-01-01', value: 110 }],
    });
    const t = getTrajectory(m, '2026-03-02');
    expect(t?.movement).toBe('away');
    expect(t?.monthsToTarget).toBeNull();
  });

  it('reports "within" when the current value already sits in the band', () => {
    const m = trajMarker({
      value: 80,
      min: 0,
      max: 200,
      optimalMin: 0,
      optimalMax: 100,
      history: [{ date: '2026-01-01', value: 90 }],
    });
    const t = getTrajectory(m, '2026-03-02');
    expect(t?.movement).toBe('within');
    expect(t?.monthsToTarget).toBeNull();
  });

  it('reports "holding" when out of band but the slope is below the noise floor', () => {
    const m = trajMarker({
      value: 130,
      min: 0,
      max: 200,
      optimalMin: 0,
      optimalMax: 100,
      history: [{ date: '2026-01-01', value: 131 }],
    });
    const t = getTrajectory(m, '2026-03-02');
    expect(t?.movement).toBe('holding');
    expect(t?.monthsToTarget).toBeNull();
  });

  it('withholds the ETA when the projection runs past the horizon', () => {
    // value 700, target ≤ 100 (distance 600), dropping only 0.5/day →
    // ~40 months out, well beyond MAX_PROJECTION_MONTHS.
    const m = trajMarker({
      value: 700,
      min: 0,
      max: 1000,
      optimalMin: 0,
      optimalMax: 100,
      history: [{ date: '2026-01-01', value: 730 }],
    });
    const t = getTrajectory(m, '2026-03-02');
    expect(t?.movement).toBe('toward');
    expect(t?.monthsToTarget).toBeNull();
    expect(MAX_PROJECTION_MONTHS).toBe(24);
  });
});
