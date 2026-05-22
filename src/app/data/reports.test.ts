/**
 * Tests for mergeHistoryFromPriorReports — the helper that turns the
 * user's prior ready reports into per-biomarker history arrays, so the
 * dashboard's trend section and "down X since March" headlines work
 * with real uploaded data instead of only the curated sample report.
 */

import { describe, it, expect } from 'vitest';
import { mergeHistoryFromPriorReports, type Report } from './reports';
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
