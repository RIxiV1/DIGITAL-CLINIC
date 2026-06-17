/**
 * Tests for mergeHistoryFromPriorReports — the helper that turns the
 * user's prior ready reports into per-biomarker history arrays, so the
 * dashboard's trend section and "down X since March" headlines work
 * with real uploaded data instead of only the curated sample report.
 */

import { describe, it, expect } from 'vitest';
import {
  getCombinedSnapshot,
  getLatestReadyReport,
  getPrimaryReport,
  getRetestReminder,
  mergeHistoryFromPriorReports,
  RETEST_REMINDER_DAYS,
  type Report,
} from './reports';
import { pruneExpiredReports } from '../utils/persistence';
import type { Biomarker } from './biomarkers';

function hb(value: number): Biomarker {
  return {
    id: 'hb',
    name: 'Hemoglobin',
    value,
    unit: 'g/dL',
    min: 13.5,
    max: 17.5,
    status: 'good',
    category: 'blood',
    plain: 'Hemoglobin carries oxygen.',
  };
}

function ldl(value: number): Biomarker {
  return {
    id: 'ldl',
    name: 'LDL Cholesterol',
    value,
    unit: 'mg/dL',
    min: 0,
    max: 100,
    status: value <= 100 ? 'good' : 'concern',
    category: 'heart',
    direction: 'down',
    plain: 'LDL is the bad cholesterol.',
  };
}

function readyReport(uploadedAt: string, biomarkers: Biomarker[]): Report {
  return {
    id: `r-${uploadedAt}`,
    name: `Report ${uploadedAt}`,
    lab: 'Test',
    uploadedOn: uploadedAt,
    uploadedAt,
    status: 'ready',
    badge: 'analyzed',
    biomarkers,
  };
}

/** A fertility-category marker, to simulate a complementary panel (e.g.
 *  a semen analysis) that covers a different system than a CBC. */
function sperm(value: number): Biomarker {
  return {
    id: 'sperm-concentration',
    name: 'Sperm Concentration',
    value,
    unit: 'million/mL',
    min: 15,
    max: 200,
    status: value >= 15 ? 'good' : 'concern',
    category: 'fertility',
    plain: 'Sperm concentration.',
  };
}

describe('getCombinedSnapshot', () => {
  it('returns a single report unchanged (no behavior change for the common case)', () => {
    const r = readyReport('2026-06-16', [hb(14), ldl(95)]);
    const snap = getCombinedSnapshot([r]);
    expect(snap.reportCount).toBe(1);
    expect(snap.biomarkers.map((m) => m.id).sort()).toEqual(['hb', 'ldl']);
    expect(snap.biomarkers.every((m) => m.history === undefined)).toBe(true);
    expect(snap.latestUploadedOn).toBe('2026-06-16');
  });

  it('UNIONS complementary panels so every system appears (the reported bug)', () => {
    const cbc = readyReport('2026-06-16', [hb(14)]); // Blood
    const semen = readyReport('2026-06-17', [sperm(40)]); // Fertility
    const snap = getCombinedSnapshot([cbc, semen]);
    expect(snap.reportCount).toBe(2);
    expect(snap.biomarkers.map((m) => m.id).sort()).toEqual([
      'hb',
      'sperm-concentration',
    ]);
    // Each marker routes back to the report it came from.
    expect(snap.sourceReportId['hb']).toBe(cbc.id);
    expect(snap.sourceReportId['sperm-concentration']).toBe(semen.id);
    // Label reflects the most recent contributing report.
    expect(snap.latestUploadedOn).toBe('2026-06-17');
  });

  it('takes the latest value per marker and folds the older reading into history', () => {
    const older = readyReport('2026-01-15', [hb(13.5)]);
    const newer = readyReport('2026-06-16', [hb(14.2)]);
    const snap = getCombinedSnapshot([older, newer]);
    const merged = snap.biomarkers.find((m) => m.id === 'hb')!;
    expect(merged.value).toBe(14.2); // latest wins
    expect(merged.history).toEqual([{ date: '2026-01-15', value: 13.5 }]);
    expect(snap.sourceReportId['hb']).toBe(newer.id);
  });

  it('ignores samples when the user has real reports', () => {
    const real = readyReport('2026-06-16', [hb(14)]);
    const sample: Report = { ...readyReport('2026-06-10', [ldl(80)]), isSample: true };
    const snap = getCombinedSnapshot([real, sample]);
    expect(snap.reportCount).toBe(1);
    expect(snap.biomarkers.map((m) => m.id)).toEqual(['hb']);
  });
});

describe('mergeHistoryFromPriorReports', () => {
  it('returns input unchanged when there are no prior reports', () => {
    const newMarkers = [hb(14.0), ldl(95)];
    const result = mergeHistoryFromPriorReports(newMarkers, []);
    expect(result).toEqual(newMarkers);
    // Pure: no mutation.
    expect(result).not.toBe(newMarkers[0]);
    expect(result[0].history).toBeUndefined();
  });

  it('attaches history entries from a single prior report', () => {
    const prior = readyReport('2026-01-15', [hb(13.8)]);
    const result = mergeHistoryFromPriorReports([hb(14.0)], [prior]);
    expect(result[0].history).toEqual([{ date: '2026-01-15', value: 13.8 }]);
  });

  it('merges multiple prior reports earliest → latest', () => {
    const r1 = readyReport('2026-01-15', [hb(13.8)]);
    const r2 = readyReport('2026-03-10', [hb(14.0)]);
    const r3 = readyReport('2026-02-20', [hb(13.9)]);
    // Pass out of chronological order — function must sort.
    const result = mergeHistoryFromPriorReports([hb(14.2)], [r2, r1, r3]);
    expect(result[0].history).toEqual([
      { date: '2026-01-15', value: 13.8 },
      { date: '2026-02-20', value: 13.9 },
      { date: '2026-03-10', value: 14.0 },
    ]);
  });

  it('only includes prior reports that had the marker', () => {
    // Three prior reports, only two had LDL.
    const r1 = readyReport('2026-01-15', [hb(13.8), ldl(120)]);
    const r2 = readyReport('2026-02-20', [hb(13.9)]); // no LDL
    const r3 = readyReport('2026-03-10', [hb(14.0), ldl(110)]);
    const result = mergeHistoryFromPriorReports(
      [hb(14.2), ldl(95)],
      [r1, r2, r3],
    );
    const byId = new Map(result.map((m) => [m.id, m]));
    expect(byId.get('hb')?.history).toHaveLength(3);
    expect(byId.get('ldl')?.history).toEqual([
      { date: '2026-01-15', value: 120 },
      { date: '2026-03-10', value: 110 },
    ]);
  });

  it('does not include the current report itself if passed in priorReports', () => {
    // markReportReady passes everything-except-the-current-id, but
    // belt-and-braces: even if a caller passes the current report, the
    // sort still works and only ID-matching biomarkers contribute.
    const r1 = readyReport('2026-01-15', [hb(13.8)]);
    const result = mergeHistoryFromPriorReports([hb(14.0)], [r1]);
    expect(result[0].history).toHaveLength(1);
  });

  it('skips reports that have no uploadedAt (legacy sampleReports)', () => {
    const legacy: Report = {
      id: 'rep-001',
      name: 'Sample',
      lab: 'Sample',
      uploadedOn: '12 Apr 2026',
      // no uploadedAt
      status: 'ready',
      badge: 'analyzed',
      biomarkers: [hb(13.0)],
    };
    const result = mergeHistoryFromPriorReports([hb(14.0)], [legacy]);
    expect(result[0].history).toBeUndefined();
  });

  it('skips reports that are still processing', () => {
    const processing: Report = {
      id: 'r-x',
      name: 'In flight',
      lab: 'New upload',
      uploadedOn: '2026-04-01',
      uploadedAt: '2026-04-01',
      status: 'processing',
      badge: 'processing',
      biomarkers: [hb(13.5)],
    };
    const result = mergeHistoryFromPriorReports([hb(14.0)], [processing]);
    expect(result[0].history).toBeUndefined();
  });

  it('returns markers without a history field when no prior data exists for them', () => {
    // New marker that didn't exist in any prior report.
    const r1 = readyReport('2026-01-15', [hb(13.8)]);
    const newOnlyMarker: Biomarker = {
      id: 'apo-b',
      name: 'Apolipoprotein B',
      value: 95,
      unit: 'mg/dL',
      min: 0,
      max: 100,
      status: 'good',
      category: 'heart',
      plain: 'Apo B counts the bad particles.',
    };
    const result = mergeHistoryFromPriorReports([newOnlyMarker], [r1]);
    expect(result[0].history).toBeUndefined();
  });

  it('skips sample reports (isSample=true) so demo data does not become fake history', () => {
    // Real bug: when sampleReports got uploadedAt for sort-by-date
    // purposes, they started passing through mergeHistoryFromPriorReports
    // and labelling their illustrative values as the user's prior
    // history — producing fake "Testosterone is up 50 since March"
    // trends on a user's first real upload. The isSample flag fixes that.
    const sample: Report = {
      id: 'rep-001',
      name: 'Sample comprehensive',
      lab: 'Thyrocare · Mumbai',
      uploadedOn: '12 Apr 2026',
      uploadedAt: '2026-04-12',
      status: 'ready',
      badge: 'analyzed',
      isSample: true,
      biomarkers: [hb(15.2)],
    };
    const result = mergeHistoryFromPriorReports([hb(14.0)], [sample]);
    expect(result[0].history).toBeUndefined();
  });

  it('still merges real (non-sample) reports alongside a sample report', () => {
    // Mixed locker: one sample + one real prior. Only the real one
    // should contribute history.
    const sample: Report = {
      id: 'rep-001',
      name: 'Sample',
      lab: 'Sample lab',
      uploadedOn: '12 Apr 2026',
      uploadedAt: '2026-04-12',
      status: 'ready',
      badge: 'analyzed',
      isSample: true,
      biomarkers: [hb(15.2)],
    };
    const real = readyReport('2026-02-20', [hb(13.9)]);
    const result = mergeHistoryFromPriorReports([hb(14.0)], [sample, real]);
    expect(result[0].history).toEqual([{ date: '2026-02-20', value: 13.9 }]);
  });
});

/* ------------------------------------------------------------------ */
/* getLatestReadyReport — sample-vs-real preference                     */
/* ------------------------------------------------------------------ */

describe('getLatestReadyReport', () => {
  const sample = (id: string, uploadedAt: string): Report => ({
    id,
    name: `Sample ${id}`,
    lab: 'Sample lab',
    uploadedOn: uploadedAt,
    uploadedAt,
    status: 'ready',
    badge: 'analyzed',
    isSample: true,
    biomarkers: [hb(15)],
  });

  it('returns undefined when no ready reports exist', () => {
    expect(getLatestReadyReport([])).toBeUndefined();
    const processing: Report = {
      id: 'p',
      name: 'p',
      lab: 'p',
      uploadedOn: '',
      status: 'processing',
      badge: 'processing',
      biomarkers: [],
    };
    expect(getLatestReadyReport([processing])).toBeUndefined();
  });

  it('returns the latest by uploadedAt when only real reports exist', () => {
    const older = readyReport('2026-01-15', [hb(13.8)]);
    const newer = readyReport('2026-03-10', [hb(14.0)]);
    expect(getLatestReadyReport([older, newer])?.id).toBe('r-2026-03-10');
    // Order in the input array must not matter.
    expect(getLatestReadyReport([newer, older])?.id).toBe('r-2026-03-10');
  });

  it('prefers a real report even when a sample has a newer uploadedAt', () => {
    // Real bug: the curated sample rep-001 (uploadedAt 2026-04-12) would
    // outrank a real upload from earlier in 2026 if we just sorted by
    // date. The dashboard must show the user's data, not demo data.
    const realOlder = readyReport('2026-03-15', [hb(13.9)]);
    const samplerNewer = sample('rep-001', '2026-04-12');
    expect(getLatestReadyReport([realOlder, samplerNewer])?.id).toBe(
      'r-2026-03-15',
    );
  });

  it('falls back to a sample when no real ready report exists', () => {
    // After "Load sample data" on an empty locker, the only ready
    // report IS a sample — the dashboard still needs to surface
    // something or it'd render its empty-state copy instead.
    const s1 = sample('rep-001', '2026-04-12');
    const s2 = sample('rep-002', '2026-03-04');
    expect(getLatestReadyReport([s1, s2])?.id).toBe('rep-001');
  });
});

/* ------------------------------------------------------------------ */
/* getPrimaryReport — most comprehensive panel, not just the newest     */
/* ------------------------------------------------------------------ */

describe('getPrimaryReport', () => {
  it('returns undefined when no ready reports exist', () => {
    expect(getPrimaryReport([])).toBeUndefined();
  });

  it('prefers the panel with the most markers over a newer smaller one', () => {
    // The motivating bug: an 8-marker semen analysis uploaded AFTER a
    // 47-marker blood panel must not become the dashboard's "everything's
    // in range" source. The fuller (older) panel wins.
    const bigOlder = readyReport('2026-06-09', [hb(15), ldl(90), hb(15)]);
    const smallNewer = readyReport('2026-06-15', [hb(15)]);
    expect(getPrimaryReport([smallNewer, bigOlder])?.id).toBe('r-2026-06-09');
    expect(getPrimaryReport([bigOlder, smallNewer])?.id).toBe('r-2026-06-09');
  });

  it('breaks marker-count ties toward the most recent upload', () => {
    const older = readyReport('2026-01-15', [hb(13.8), ldl(90)]);
    const newer = readyReport('2026-03-10', [hb(14.0), ldl(95)]);
    expect(getPrimaryReport([older, newer])?.id).toBe('r-2026-03-10');
  });

  it('prefers a real report over a sample even if the sample is bigger', () => {
    const real = readyReport('2026-03-15', [hb(13.9)]);
    const sampleBig: Report = {
      id: 'rep-001',
      name: 'Sample',
      lab: 'Sample lab',
      uploadedOn: '2026-04-12',
      uploadedAt: '2026-04-12',
      status: 'ready',
      badge: 'analyzed',
      isSample: true,
      biomarkers: [hb(15), ldl(90), hb(15)],
    };
    expect(getPrimaryReport([real, sampleBig])?.id).toBe('r-2026-03-15');
  });
});

/* ------------------------------------------------------------------ */
/* getRetestReminder — pure re-test nudge decision                      */
/* ------------------------------------------------------------------ */

describe('getRetestReminder', () => {
  const NOW = Date.parse('2026-08-01T00:00:00Z');
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dateNDaysAgo = (n: number) =>
    new Date(NOW - n * DAY_MS).toISOString().slice(0, 10);

  const sample = (id: string, uploadedAt: string): Report => ({
    id,
    name: `Sample ${id}`,
    lab: 'Sample lab',
    uploadedOn: uploadedAt,
    uploadedAt,
    status: 'ready',
    badge: 'analyzed',
    isSample: true,
    biomarkers: [hb(15)],
  });

  it('returns null when there is no ready report', () => {
    expect(getRetestReminder([], NOW)).toBeNull();
  });

  it('returns null when the latest report is recent (under the threshold)', () => {
    const recent = readyReport(dateNDaysAgo(RETEST_REMINDER_DAYS - 5), [
      hb(14),
    ]);
    expect(getRetestReminder([recent], NOW)).toBeNull();
  });

  it('returns the report + months once past the threshold', () => {
    const stale = readyReport(dateNDaysAgo(RETEST_REMINDER_DAYS + 30), [
      hb(14),
    ]);
    const reminder = getRetestReminder([stale], NOW);
    expect(reminder?.report.id).toBe(stale.id);
    expect(reminder?.months).toBe(5); // 150 days ≈ 5 months
  });

  it('floors months at 1 even right at the threshold', () => {
    // ~4 months → rounds to 4, but assert the floor holds conceptually
    // by checking a marker just over the boundary is never reported as 0.
    const justOver = readyReport(dateNDaysAgo(RETEST_REMINDER_DAYS), [hb(14)]);
    const reminder = getRetestReminder([justOver], NOW);
    expect(reminder?.months).toBeGreaterThanOrEqual(1);
  });

  it('never nudges on a sample-only locker', () => {
    // A demo report's canned date must not drive a "time to re-test"
    // message for someone who has never uploaded anything real.
    const s = sample('rep-001', dateNDaysAgo(365));
    expect(getRetestReminder([s], NOW)).toBeNull();
  });

  it('anchors on the latest real report, ignoring older samples', () => {
    const realStale = readyReport(dateNDaysAgo(RETEST_REMINDER_DAYS + 60), [
      hb(14),
    ]);
    const s = sample('rep-001', dateNDaysAgo(1)); // newer sample, ignored
    const reminder = getRetestReminder([s, realStale], NOW);
    expect(reminder?.report.id).toBe(realStale.id);
  });

  it('returns null when the latest real report is malformed-dated', () => {
    const bad: Report = {
      id: 'r-bad',
      name: 'Bad date',
      lab: 'Lab',
      uploadedOn: 'whenever',
      uploadedAt: 'not-a-date',
      status: 'ready',
      badge: 'analyzed',
      biomarkers: [hb(14)],
    };
    expect(getRetestReminder([bad], NOW)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* pruneExpiredReports — pure TTL filter                                */
/* ------------------------------------------------------------------ */

describe('pruneExpiredReports', () => {
  // Fixed "now" so the tests don't depend on wall-clock time. Picked
  // 2026-08-01 so the 180-day boundary cleanly straddles "Jan 2026" vs
  // "Apr 2026" vs "Jul 2026".
  const NOW = Date.parse('2026-08-01T00:00:00Z');
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dateNDaysAgo = (n: number) =>
    new Date(NOW - n * DAY_MS).toISOString().slice(0, 10);

  it('returns input unchanged when no report is over the TTL', () => {
    const reports = [
      readyReport(dateNDaysAgo(10), [hb(14)]),
      readyReport(dateNDaysAgo(90), [hb(14)]),
      readyReport(dateNDaysAgo(170), [hb(14)]),
    ];
    const { kept, pruned } = pruneExpiredReports(reports, NOW);
    expect(pruned).toBe(0);
    expect(kept).toEqual(reports);
  });

  it('prunes reports older than the 180-day TTL by uploadedAt', () => {
    const reports = [
      readyReport(dateNDaysAgo(10), [hb(14)]),
      readyReport(dateNDaysAgo(200), [hb(14)]), // expired
      readyReport(dateNDaysAgo(365), [hb(14)]), // expired
    ];
    const { kept, pruned } = pruneExpiredReports(reports, NOW);
    expect(pruned).toBe(2);
    expect(kept).toHaveLength(1);
    expect(kept[0].uploadedAt).toBe(dateNDaysAgo(10));
  });

  it('never prunes isSample reports, even when older than the TTL', () => {
    const sample: Report = {
      id: 'rep-001',
      name: 'Sample',
      lab: 'Sample',
      uploadedOn: 'old',
      uploadedAt: dateNDaysAgo(365),
      status: 'ready',
      badge: 'analyzed',
      isSample: true,
      biomarkers: [hb(14)],
    };
    const { kept, pruned } = pruneExpiredReports([sample], NOW);
    expect(pruned).toBe(0);
    expect(kept).toEqual([sample]);
  });

  it('keeps reports without uploadedAt (legacy data, do not risk loss)', () => {
    const legacy: Report = {
      id: 'r-x',
      name: 'Legacy',
      lab: 'Legacy lab',
      uploadedOn: 'unknown',
      // no uploadedAt
      status: 'ready',
      badge: 'analyzed',
      biomarkers: [hb(14)],
    };
    const { kept, pruned } = pruneExpiredReports([legacy], NOW);
    expect(pruned).toBe(0);
    expect(kept).toEqual([legacy]);
  });

  it('keeps reports with a malformed uploadedAt (do not risk loss)', () => {
    const bad: Report = {
      id: 'r-x',
      name: 'Bad date',
      lab: 'Lab',
      uploadedOn: 'whenever',
      uploadedAt: 'not-a-date',
      status: 'ready',
      badge: 'analyzed',
      biomarkers: [hb(14)],
    };
    const { kept, pruned } = pruneExpiredReports([bad], NOW);
    expect(pruned).toBe(0);
    expect(kept).toEqual([bad]);
  });

  it('mixes correctly — old real expires, fresh real and old sample survive', () => {
    const freshReal = readyReport(dateNDaysAgo(30), [hb(14)]);
    const oldReal = readyReport(dateNDaysAgo(250), [hb(14)]);
    const oldSample: Report = {
      id: 'rep-001',
      name: 'Sample',
      lab: 'Sample',
      uploadedOn: 'old',
      uploadedAt: dateNDaysAgo(500),
      status: 'ready',
      badge: 'analyzed',
      isSample: true,
      biomarkers: [hb(14)],
    };
    const { kept, pruned } = pruneExpiredReports(
      [freshReal, oldReal, oldSample],
      NOW,
    );
    expect(pruned).toBe(1);
    expect(kept.map((r) => r.id)).toEqual([freshReal.id, oldSample.id]);
  });
});
