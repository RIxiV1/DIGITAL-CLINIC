import { describe, it, expect } from 'vitest';
import { PATHWAYS } from './HomePage';
import { categories } from '../data/biomarkers';

/**
 * The dashboard Vitals Strip groups every marker into a PATHWAY tile and
 * shows each tile's "needs care" count. Those counts are supposed to sum
 * to the hero's flagged total. That only holds if PATHWAYS partitions the
 * FULL set of biomarker categories — every category in exactly one
 * pathway, none missing.
 *
 * Regression guard for the real bug this fixes: six categories (liver,
 * kidney, blood, fertility, electrolytes, inflammation) were unmapped, so
 * their flagged markers were counted by the hero but dropped from every
 * tile — a report reading "12 need care" showed tiles summing to 7.
 */
describe('PATHWAYS partition', () => {
  const covered = PATHWAYS.flatMap((p) => p.categories);

  it('maps each category at most once (disjoint)', () => {
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('covers every catalog category (complete)', () => {
    const catalogIds = categories.map((c) => c.id).sort();
    expect([...covered].sort()).toEqual(catalogIds);
  });
});
