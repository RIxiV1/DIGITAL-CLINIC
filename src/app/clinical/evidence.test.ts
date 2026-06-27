import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_TIERS,
  evidenceForRecommendation,
  type EvidenceLevel,
} from './evidence';

describe('evidenceForRecommendation', () => {
  it('grades well-established levers from real recommendation copy', () => {
    // Strings taken verbatim from markerInfo/testInfo improve lists.
    expect(
      evidenceForRecommendation('Walk for 10 minutes after every meal')?.level,
    ).toBe('strong');
    expect(
      evidenceForRecommendation('Omega-3 (1–2g EPA+DHA daily) — strong evidence')
        ?.level,
    ).toBe('strong');
    expect(
      evidenceForRecommendation('Strength training 2× a week')?.level,
    ).toBe('strong');
    expect(
      evidenceForRecommendation('Cut sugary drinks — sweet chai, soda, juice')
        ?.level,
    ).toBe('strong');
  });

  it('grades weaker levers conservatively', () => {
    expect(evidenceForRecommendation('Sleep 7–8 hours')?.level).toBe('moderate');
    expect(
      evidenceForRecommendation('Magnesium glycinate before bed — also helps you sleep')
        ?.level,
    ).toBe('emerging');
  });

  it('returns null when it cannot confidently ground a claim', () => {
    // Conservative: ungraded is the honest default, never a guessed badge.
    expect(
      evidenceForRecommendation('Eat protein first at every meal'),
    ).toBeNull();
    expect(
      evidenceForRecommendation('Reduce refined carbs (white rice, bread)'),
    ).toBeNull();
    expect(
      evidenceForRecommendation('Eat dinner earlier — finishing by 7 PM'),
    ).toBeNull();
    // Mentions "sleep" but isn't a sleep recommendation.
    expect(
      evidenceForRecommendation('Tackle stressors — sleep apnea, money, work'),
    ).toBeNull();
  });

  it('picks the strongest applicable lever when a line mentions several', () => {
    expect(
      evidenceForRecommendation('Cut sugar in drinks and reduce alcohol')?.level,
    ).toBe('strong');
  });

  it('every grade names what it supports and cites an https source', () => {
    const samples = [
      'Walk after meals',
      'Sleep 7–8 hours',
      'Magnesium before bed',
    ];
    for (const s of samples) {
      const m = evidenceForRecommendation(s);
      expect(m).not.toBeNull();
      expect(m!.supports.trim().length).toBeGreaterThan(0);
      expect(m!.source.url).toMatch(/^https:\/\//);
      expect(m!.source.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('defines user-facing meaning for every tier', () => {
    const levels: EvidenceLevel[] = ['strong', 'moderate', 'emerging'];
    for (const l of levels) {
      expect(EVIDENCE_TIERS[l].label.length).toBeGreaterThan(0);
      expect(EVIDENCE_TIERS[l].meaning.length).toBeGreaterThan(0);
    }
  });
});
