import { describe, it, expect } from 'vitest';
import { reportsToCsv, CSV_HEADERS } from './exportCsv';
import { sampleReports } from '../data/reports';
import type { Report } from '../data/reports';

describe('reportsToCsv', () => {
  it('starts with the header row', () => {
    expect(reportsToCsv([]).split('\r\n')[0]).toBe(CSV_HEADERS.join(','));
  });

  it('emits one row per marker across ready reports', () => {
    const ready = sampleReports.filter((r) => r.status === 'ready');
    const markerCount = ready.reduce((n, r) => n + r.biomarkers.length, 0);
    const lines = reportsToCsv(sampleReports).split('\r\n');
    expect(lines.length).toBe(1 + markerCount); // header + one row per marker
  });

  it('skips non-ready reports', () => {
    const processing: Report = { ...sampleReports[0], status: 'processing' };
    expect(reportsToCsv([processing]).split('\r\n')).toHaveLength(1); // header only
  });

  it('quotes cells containing a comma', () => {
    const r: Report = { ...sampleReports[0], name: 'Panel, v2' };
    const firstRow = reportsToCsv([r]).split('\r\n')[1];
    expect(firstRow.startsWith('"Panel, v2",')).toBe(true);
  });

  it('escapes embedded quotes by doubling them', () => {
    const r: Report = { ...sampleReports[0], name: 'A "special" panel' };
    const firstRow = reportsToCsv([r]).split('\r\n')[1];
    expect(firstRow.startsWith('"A ""special"" panel",')).toBe(true);
  });
});
