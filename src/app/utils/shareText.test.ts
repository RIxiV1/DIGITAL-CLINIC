import { describe, it, expect } from 'vitest';
import { reportShareText, whatsappShareUrl } from './shareText';
import { sampleReports } from '../data/reports';
import type { Report } from '../data/reports';
import type { Biomarker } from '../data/biomarkers';

function marker(over: Partial<Biomarker> & Pick<Biomarker, 'id'>): Biomarker {
  return {
    name: over.id,
    value: 0,
    unit: 'x',
    min: 0,
    max: 100,
    status: 'good',
    category: 'metabolic',
    plain: '',
    ...over,
  } as Biomarker;
}

function report(biomarkers: Biomarker[]): Report {
  return {
    id: 'r',
    name: 'Panel',
    lab: 'Lab',
    uploadedOn: '20 Jul 2026',
    uploadedAt: '2026-07-20',
    status: 'ready',
    biomarkers,
  };
}

describe('reportShareText', () => {
  it('leads with the report name and date', () => {
    const t = reportShareText(report([marker({ id: 'a' })]));
    expect(t.startsWith('My blood test — Panel (20 Jul 2026)')).toBe(true);
  });

  it('states the in-range count', () => {
    const t = reportShareText(
      report([
        marker({ id: 'a', status: 'good' }),
        marker({ id: 'b', status: 'good' }),
        marker({ id: 'c', status: 'concern' }),
      ]),
    );
    expect(t).toContain('2 of 3 markers in range.');
  });

  it('lists flagged markers worst-first with a plain phrase', () => {
    const t = reportShareText(
      report([
        marker({ id: 'attn', name: 'B12', value: 190, status: 'attention' }),
        marker({ id: 'crit', name: 'Glucose', value: 320, unit: 'mg/dL', status: 'critical' }),
        marker({ id: 'conc', name: 'LDL', value: 180, status: 'concern' }),
      ]),
    );
    const flaggedBlock = t.slice(t.indexOf('To look at:'));
    // critical first, then concern, then attention
    expect(flaggedBlock.indexOf('Glucose')).toBeLessThan(flaggedBlock.indexOf('LDL'));
    expect(flaggedBlock.indexOf('LDL')).toBeLessThan(flaggedBlock.indexOf('B12'));
    expect(t).toContain('Glucose: 320 mg/dL (see a doctor soon)');
  });

  it('omits the flagged section when everything is in range', () => {
    const t = reportShareText(report([marker({ id: 'a', status: 'good' })]));
    expect(t).not.toContain('To look at:');
  });

  it('always carries the not-a-diagnosis caveat', () => {
    const t = reportShareText(sampleReports[0]);
    expect(t).toContain('not a diagnosis');
  });
});

describe('whatsappShareUrl', () => {
  it('builds a recipient-less wa.me link with the text URL-encoded', () => {
    const url = whatsappShareUrl('a b\nc');
    expect(url).toBe('https://wa.me/?text=a%20b%0Ac');
  });
});
