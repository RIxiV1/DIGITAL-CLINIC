import { describe, it, expect } from 'vitest';
import type { Biomarker, BiomarkerStatus } from '../../data/biomarkers';
import type { Report } from '../../data/reports';
import { PATHWAYS } from './pathways';
import {
  filterAndSortReports,
  selectVisibleMarkers,
  rankFlaggedMarkers,
  selectDisclosedMarkers,
  groupTrendsByPathway,
  computePathwayVitals,
} from './dashboardModel';

/* These are the dashboard's churny business rules — the logic that used to
 * live inside HomePage's useMemos and changed every time clinical/UX moved.
 * Now they're pure functions, so they get real unit coverage. */

function marker(p: Partial<Biomarker> & { status: BiomarkerStatus }): Biomarker {
  return {
    name: 'Marker',
    value: 1,
    unit: '',
    min: 0,
    max: 10,
    plain: '',
    category: 'hormones',
    ...p,
    id: p.id ?? p.name ?? 'm',
  } as Biomarker;
}

function report(p: Partial<Report> & { id: string }): Report {
  return {
    name: 'Report',
    lab: 'Lab',
    uploadedOn: '',
    status: 'ready',
    biomarkers: [],
    ...p,
  } as Report;
}

describe('filterAndSortReports', () => {
  const reps = [
    report({ id: 'a', name: 'CBC', lab: 'Thyrocare', uploadedAt: '2026-01-01' }),
    report({ id: 'b', name: 'Lipid', lab: 'Apollo', uploadedAt: '2026-03-01' }),
    report({ id: 'c', name: 'Hormone', lab: 'SRL', uploadedAt: '2026-02-01' }),
  ];

  it('newest sorts by uploadedAt descending', () => {
    expect(filterAndSortReports(reps, '', 'newest').map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('oldest reverses that order', () => {
    expect(filterAndSortReports(reps, '', 'oldest').map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('lab sorts alphabetically by lab', () => {
    expect(filterAndSortReports(reps, '', 'lab').map((r) => r.lab)).toEqual([
      'Apollo',
      'SRL',
      'Thyrocare',
    ]);
  });

  it('token-filters across name AND lab (every token must hit)', () => {
    expect(filterAndSortReports(reps, 'apollo', 'newest').map((r) => r.id)).toEqual(
      ['b'],
    );
    expect(filterAndSortReports(reps, 'cbc thyrocare', 'newest').map((r) => r.id)).toEqual(
      ['a'],
    );
    expect(filterAndSortReports(reps, 'cbc apollo', 'newest')).toHaveLength(0);
  });
});

describe('selectVisibleMarkers', () => {
  const markers = [
    marker({ id: 't', name: 'Testosterone', category: 'hormones', status: 'concern', plain: 'drive' }),
    marker({ id: 'g', name: 'Glucose', category: 'metabolic', status: 'good', plain: 'sugar' }),
    marker({ id: 'l', name: 'LDL', category: 'heart', status: 'attention', plain: 'cholesterol' }),
  ];

  it('no filters returns everything', () => {
    expect(selectVisibleMarkers(markers, '', 'all', null)).toHaveLength(3);
  });

  it('status filter narrows to that tier', () => {
    expect(
      selectVisibleMarkers(markers, '', 'good', null).map((m) => m.id),
    ).toEqual(['g']);
  });

  it('query matches name, plain, and category', () => {
    expect(selectVisibleMarkers(markers, 'sugar', 'all', null).map((m) => m.id)).toEqual(['g']);
    expect(selectVisibleMarkers(markers, 'heart', 'all', null).map((m) => m.id)).toEqual(['l']);
  });

  it('scope categories gate by category, composing with status', () => {
    expect(
      selectVisibleMarkers(markers, '', 'all', ['hormones', 'heart']).map((m) => m.id),
    ).toEqual(['t', 'l']);
    expect(
      selectVisibleMarkers(markers, '', 'attention', ['hormones', 'heart']).map((m) => m.id),
    ).toEqual(['l']);
  });
});

describe('rankFlaggedMarkers', () => {
  it('keeps only flagged and sorts critical → concern → attention', () => {
    const markers = [
      marker({ id: 'a', status: 'attention' }),
      marker({ id: 'g', status: 'good' }),
      marker({ id: 'c', status: 'critical' }),
      marker({ id: 'n', status: 'concern' }),
    ];
    expect(rankFlaggedMarkers(markers).map((m) => m.id)).toEqual(['c', 'n', 'a']);
  });
});

describe('selectDisclosedMarkers', () => {
  const flagged = [
    marker({ id: 'f0', status: 'critical' }),
    marker({ id: 'f1', status: 'concern' }),
    marker({ id: 'f2', status: 'concern' }),
    marker({ id: 'f3', status: 'attention' }),
  ];
  const goods = [marker({ id: 'g0', status: 'good' }), marker({ id: 'g1', status: 'good' })];
  const all = [...flagged, ...goods];

  it('when filtering, returns the visible set (capped 12)', () => {
    const visible = [marker({ id: 'v', status: 'good' })];
    expect(
      selectDisclosedMarkers({
        isFiltering: true,
        visibleMarkers: visible,
        flaggedMarkersAll: flagged,
        biomarkers: all,
        heroFlagCount: 3,
      }).map((m) => m.id),
    ).toEqual(['v']);
  });

  it('idle leads with flagged BEYOND the hero count (no hero duplication)', () => {
    expect(
      selectDisclosedMarkers({
        isFiltering: false,
        visibleMarkers: [],
        flaggedMarkersAll: flagged,
        biomarkers: all,
        heroFlagCount: 3,
      }).map((m) => m.id),
    ).toEqual(['f3']);
  });

  it('idle with no overflow flagged falls back to on-track markers', () => {
    expect(
      selectDisclosedMarkers({
        isFiltering: false,
        visibleMarkers: [],
        flaggedMarkersAll: flagged.slice(0, 2),
        biomarkers: all,
        heroFlagCount: 3,
      }).map((m) => m.id),
    ).toEqual(['g0', 'g1']);
  });
});

describe('groupTrendsByPathway', () => {
  it('keeps only markers with a trend, grouped into non-empty pathways', () => {
    const withHist = marker({
      id: 'th',
      category: 'hormones',
      status: 'good',
      history: [{ date: '2026-01-01', value: 1 }],
      value: 2,
    });
    const noHist = marker({ id: 'nh', category: 'metabolic', status: 'good' });
    const groups = groupTrendsByPathway([withHist, noHist], PATHWAYS);
    expect(groups.map((g) => g.id)).toEqual(['hormonal']);
    expect(groups[0].markers.map((m) => m.id)).toEqual(['th']);
  });
});

describe('computePathwayVitals', () => {
  it('collapses critical+concern, keeps critical separately, drops empty pathways', () => {
    const markers = [
      marker({ id: 'a', category: 'hormones', status: 'critical' }),
      marker({ id: 'b', category: 'hormones', status: 'concern' }),
      marker({ id: 'c', category: 'hormones', status: 'attention' }),
      marker({ id: 'd', category: 'metabolic', status: 'good' }),
    ];
    const vitals = computePathwayVitals(markers, PATHWAYS);
    const hormonal = vitals.find((v) => v.id === 'hormonal')!;
    expect(hormonal.critical).toBe(1);
    expect(hormonal.concern).toBe(2); // critical + concern
    expect(hormonal.attention).toBe(1);
    expect(hormonal.total).toBe(3);
    // thyroid etc. have no markers → dropped
    expect(vitals.some((v) => v.id === 'thyroid')).toBe(false);
  });
});
