/**
 * Tests for calculateRisk — the function that turns a quiz symptom
 * selection into the user-facing "Strong signal" tier emitted
 * by the dashboard. This is a clinical-adjacent output, so the test
 * pins:
 *
 *   - empty / no-signal selections → all systems "low"
 *   - the threshold math (≥15 high, ≥7 moderate, <7 low)
 *   - the actual weights for common symptom combinations the product
 *     surfaces — if anyone retunes weights in a way that flips the tier
 *     of a marketing-page-style combo, the test fails loudly
 *   - 'proactive' (the symptom-free option) contributes zero
 *   - unknown symptom ids don't crash or contribute
 */

import { describe, it, expect } from 'vitest';
import { calculateRisk, SYMPTOM_WEIGHTS } from './QuizContext';

describe('calculateRisk', () => {
  it('returns all-zero scores and low tiers for an empty symptom set', () => {
    const r = calculateRisk([]);
    expect(r.systemScores).toEqual({
      hypogonadism: 0,
      erectileDysfunction: 0,
      cardiovascular: 0,
    });
    expect(r.systemTiers).toEqual({
      hypogonadism: 'low',
      erectileDysfunction: 'low',
      cardiovascular: 'low',
    });
    expect(r.highestTier).toBe('low');
  });

  it('returns all-low when only "proactive" is selected (symptom-free)', () => {
    // 'proactive' is deliberately omitted from SYMPTOM_WEIGHTS — a user
    // checking only this box shouldn't trigger any risk signal.
    const r = calculateRisk(['proactive']);
    expect(r.highestTier).toBe('low');
    expect(r.systemScores.hypogonadism).toBe(0);
  });

  it('ignores unknown symptom ids without crashing or contributing', () => {
    const r = calculateRisk(['low-libido', 'not-a-real-symptom']);
    // low-libido weights: hypogonadism 5, erectileDysfunction 4.
    expect(r.systemScores.hypogonadism).toBe(5);
    expect(r.systemScores.erectileDysfunction).toBe(4);
  });

  it('classifies score thresholds: <7 low, 7–14 moderate, ≥15 high', () => {
    // 'low-libido' alone: hypogonadism = 5 → low.
    expect(calculateRisk(['low-libido']).systemTiers.hypogonadism).toBe('low');
    // 'low-libido' + 'difficulty-in-bed': hypogonadism 5 + 4 = 9 → moderate.
    expect(
      calculateRisk(['low-libido', 'difficulty-in-bed']).systemTiers
        .hypogonadism,
    ).toBe('moderate');
    // 5 + 4 + 3 (belly-fat) + 3 (poor-sleep) = 15 → high.
    expect(
      calculateRisk([
        'low-libido',
        'difficulty-in-bed',
        'belly-fat',
        'poor-sleep',
      ]).systemTiers.hypogonadism,
    ).toBe('high');
  });

  it('orders rankedSystems by score, highest first', () => {
    // Choose symptoms that load CV more than the other two systems.
    const r = calculateRisk(['belly-fat', 'poor-sleep', 'stress']);
    // belly-fat:    hypo 3, ED 2, CV 4
    // poor-sleep:   hypo 3, ED 1, CV 3
    // stress:       hypo 2, ED 2, CV 3
    // Totals:       hypo 8, ED 5, CV 10
    expect(r.rankedSystems[0].id).toBe('cardiovascular');
    expect(r.rankedSystems[0].score).toBe(10);
    expect(r.rankedSystems[1].id).toBe('hypogonadism');
    expect(r.rankedSystems[2].id).toBe('erectileDysfunction');
  });

  it('highestTier is the worst tier across all three systems', () => {
    // fertility-concerns: hypogonadism 5, ED 2, CV 0
    // → all systems land in 'low' (5 < 7, 2 < 7, 0 < 7).
    expect(calculateRisk(['fertility-concerns']).highestTier).toBe('low');

    // Add enough symptoms to push hypogonadism into high.
    // low-libido (5) + difficulty-in-bed (4) + belly-fat (3) + poor-sleep (3) = 15
    // → hypogonadism 'high'; even if other systems are low, highestTier = 'high'.
    expect(
      calculateRisk([
        'low-libido',
        'difficulty-in-bed',
        'belly-fat',
        'poor-sleep',
      ]).highestTier,
    ).toBe('high');
  });

  it('pins the weight table — sanity check on the documented combos', () => {
    // These are not arbitrary spot checks — they correspond to the
    // "difficulty-in-bed is weighted on all three" and
    // "belly-fat + poor-sleep are independent CV multipliers" claims
    // in the comment block. If the table is retuned and these flip,
    // the comment block needs updating too.
    expect(SYMPTOM_WEIGHTS['difficulty-in-bed']).toMatchObject({
      hypogonadism: 4,
      erectileDysfunction: 5,
      cardiovascular: 3,
    });
    expect(SYMPTOM_WEIGHTS['belly-fat']).toMatchObject({
      hypogonadism: 3,
      cardiovascular: 4,
    });
    expect(SYMPTOM_WEIGHTS['poor-sleep']).toMatchObject({
      hypogonadism: 3,
      cardiovascular: 3,
    });
    // 'proactive' must remain absent.
    expect(SYMPTOM_WEIGHTS['proactive']).toBeUndefined();
  });

  it('all weights are in the documented 0–5 range', () => {
    // Guardrail: stop a future "let's bump every weight to 10 so people
    // feel more urgency" edit from passing review silently.
    for (const [, weights] of Object.entries(SYMPTOM_WEIGHTS)) {
      for (const w of Object.values(weights)) {
        if (typeof w === 'number') {
          expect(w).toBeGreaterThanOrEqual(0);
          expect(w).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
