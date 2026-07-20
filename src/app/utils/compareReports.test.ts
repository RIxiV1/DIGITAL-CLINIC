import { describe, it, expect } from 'vitest';
import { compareReports } from './compareReports';
import type { Biomarker } from '../data/biomarkers';
import type { Report } from '../data/reports';

/** Minimal biomarker factory — only the fields the comparator reads. */
function marker(over: Partial<Biomarker> & Pick<Biomarker, 'id'>): Biomarker {
  return {
    name: over.id,
    value: 0,
    unit: 'x',
    min: 0,
    max: 100,
    status: 'good',
    category: 'metabolic',
    direction: 'band',
    plain: '',
    ...over,
  } as Biomarker;
}

function report(id: string, uploadedAt: string, biomarkers: Biomarker[]): Report {
  return {
    id,
    name: id,
    lab: 'Lab',
    uploadedOn: uploadedAt,
    uploadedAt,
    status: 'ready',
    biomarkers,
  };
}

describe('compareReports', () => {
  it('orders older report as before regardless of argument order', () => {
    const older = report('old', '2026-01-01', [marker({ id: 'a' })]);
    const newer = report('new', '2026-06-01', [marker({ id: 'a' })]);
    expect(compareReports(newer, older).before.id).toBe('old');
    expect(compareReports(older, newer).before.id).toBe('old');
    expect(compareReports(newer, older).after.id).toBe('new');
  });

  it('classifies a status improvement as improved', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'ldl', value: 180, status: 'concern', direction: 'down' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'ldl', value: 95, status: 'good', direction: 'down' }),
    ]);
    const row = compareReports(a, b).rows[0];
    expect(row.change).toBe('improved');
    expect(row.statusChanged).toBe(true);
    expect(row.deltaAbs).toBe(-85);
  });

  it('classifies a status decline as worsened', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'glu', value: 92, status: 'good', direction: 'down' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'glu', value: 140, status: 'concern', direction: 'down' }),
    ]);
    expect(compareReports(a, b).rows[0].change).toBe('worsened');
  });

  it('uses direction when the status tier holds (up-is-good)', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'tst', value: 300, status: 'attention', direction: 'up' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'tst', value: 360, status: 'attention', direction: 'up' }),
    ]);
    expect(compareReports(a, b).rows[0].change).toBe('improved');
    expect(compareReports(a, b).rows[0].statusChanged).toBe(false);
  });

  it('treats a sub-1% move within the same tier as steady', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'na', value: 140, status: 'good', direction: 'band' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'na', value: 140.5, status: 'good', direction: 'band' }),
    ]);
    expect(compareReports(a, b).rows[0].change).toBe('steady');
  });

  it('uses distance to the band midpoint for band markers at the same tier', () => {
    // Healthy 70–100 → midpoint 85. 96 → 88 moves toward the middle.
    const a = report('a', '2026-01-01', [
      marker({ id: 'x', value: 96, min: 70, max: 100, status: 'good' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'x', value: 88, min: 70, max: 100, status: 'good' }),
    ]);
    expect(compareReports(a, b).rows[0].change).toBe('improved');
  });

  it('marks markers present on only one side', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'shared' }),
      marker({ id: 'dropped' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'shared' }),
      marker({ id: 'added' }),
    ]);
    const cmp = compareReports(a, b);
    const byId = Object.fromEntries(cmp.rows.map((r) => [r.id, r.presence]));
    expect(byId.dropped).toBe('onlyBefore');
    expect(byId.added).toBe('onlyAfter');
    expect(byId.shared).toBe('both');
    expect(cmp.onlyBefore).toBe(1);
    expect(cmp.onlyAfter).toBe(1);
    expect(cmp.shared).toBe(1);
  });

  it('sorts worsened first, then improved, steady, added, dropped', () => {
    const a = report('a', '2026-01-01', [
      marker({ id: 'worse', value: 90, status: 'good', direction: 'down' }),
      marker({ id: 'better', value: 180, status: 'concern', direction: 'down' }),
      marker({ id: 'same', value: 50, status: 'good' }),
      marker({ id: 'gone' }),
    ]);
    const b = report('b', '2026-06-01', [
      marker({ id: 'worse', value: 150, status: 'concern', direction: 'down' }),
      marker({ id: 'better', value: 95, status: 'good', direction: 'down' }),
      marker({ id: 'same', value: 50, status: 'good' }),
      marker({ id: 'fresh' }),
    ]);
    const order = compareReports(a, b).rows.map((r) => r.id);
    expect(order).toEqual(['worse', 'better', 'same', 'fresh', 'gone']);
  });

  it('computes signed percentage change', () => {
    const a = report('a', '2026-01-01', [marker({ id: 'v', value: 100 })]);
    const b = report('b', '2026-06-01', [marker({ id: 'v', value: 125 })]);
    expect(compareReports(a, b).rows[0].deltaPct).toBeCloseTo(25);
  });
});
