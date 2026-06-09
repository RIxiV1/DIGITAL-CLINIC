// @vitest-environment jsdom
/**
 * Tests for the report PDF export. Two pure functions carry the real
 * correctness risk:
 *   - asciize(): the default Helvetica is Latin-1 only, so any character
 *     it can't render becomes a garbled box (or vanishes) in the
 *     downloaded PDF. This is the sanitiser.
 *   - tierForMarker(): the clinical tier label/colour shown on each row.
 * Plus buildReportPdf(), exercised end-to-end (build, not save) to catch
 * layout crashes, the two-pass card measure, and page-break math.
 */

import { describe, it, expect } from 'vitest';
import { asciize, tierForMarker, buildReportPdf } from './reportPdf';
import { sampleReports } from '../data/reports';
import type { Biomarker } from '../data/biomarkers';

describe('asciize', () => {
  it('replaces non-Latin-1 typography with safe ASCII', () => {
    expect(asciize('“quote” ‘x’')).toBe('"quote" \'x\'');
    expect(asciize('a–b—c')).toBe('a-b-c'); // en/em dash
    expect(asciize('5−3')).toBe('5-3'); // minus sign
    expect(asciize('a…b')).toBe('a...b'); // ellipsis
    expect(asciize('x10×6')).toBe('x10x6'); // multiplication sign
    expect(asciize('≥5 ≤10')).toBe('>=5 <=10'); // ≥ ≤
  });

  it('maps Greek mu (U+03BC) to the micro sign (U+00B5) so units render', () => {
    expect(asciize('μIU/mL')).toBe('µIU/mL');
  });

  it('leaves plain ASCII untouched', () => {
    expect(asciize('Hemoglobin 14.8 g/dL')).toBe('Hemoglobin 14.8 g/dL');
  });
});

const mk = (over: Partial<Biomarker>): Biomarker =>
  ({
    id: 'x',
    name: 'X',
    value: 5,
    unit: '',
    min: 0,
    max: 10,
    status: 'good',
    category: 'blood',
    plain: '',
    ...over,
  }) as Biomarker;

describe('tierForMarker', () => {
  it('critical → SEE A DOCTOR', () => {
    expect(tierForMarker(mk({ status: 'critical' })).label).toBe(
      'SEE A DOCTOR',
    );
  });
  it('concern → OUT OF RANGE', () => {
    expect(tierForMarker(mk({ status: 'concern' })).label).toBe('OUT OF RANGE');
  });
  it('attention → BORDERLINE', () => {
    expect(tierForMarker(mk({ status: 'attention' })).label).toBe('BORDERLINE');
  });
  it('good + inside optimal band → OPTIMAL', () => {
    expect(
      tierForMarker(
        mk({ status: 'good', value: 5, optimalMin: 4, optimalMax: 6 }),
      ).label,
    ).toBe('OPTIMAL');
  });
  it('good but outside optimal band → BORDERLINE', () => {
    expect(
      tierForMarker(
        mk({ status: 'good', value: 9, optimalMin: 4, optimalMax: 6 }),
      ).label,
    ).toBe('BORDERLINE');
  });
  it('good with no optimal band → OPTIMAL', () => {
    expect(tierForMarker(mk({ status: 'good' })).label).toBe('OPTIMAL');
  });
});

describe('buildReportPdf', () => {
  it('produces a non-empty PDF document for a real sample report', () => {
    const doc = buildReportPdf(sampleReports[0]);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output('arraybuffer') as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('handles an empty-biomarker report without throwing', () => {
    const empty = { ...sampleReports[0], biomarkers: [] };
    expect(() => buildReportPdf(empty)).not.toThrow();
  });

  it('paginates a large report past a single page', () => {
    const many = {
      ...sampleReports[0],
      biomarkers: Array.from({ length: 40 }, (_, i) =>
        mk({
          id: `m${i}`,
          name: `Marker ${i}`,
          simpleName: 'short description',
          plain: 'An explanation that wraps across a line or two for height.',
          category: 'blood',
        }),
      ),
    };
    expect(buildReportPdf(many).getNumberOfPages()).toBeGreaterThan(1);
  });

  it('renders unicode-laden content (via asciize) without throwing', () => {
    const uni = {
      ...sampleReports[0],
      name: 'Report — μ ≥ test',
      biomarkers: [
        mk({
          name: 'TSH',
          unit: 'μIU/mL',
          plain: 'value ≥ 5 — borderline',
          optimalMin: 1,
          optimalMax: 4,
          value: 6,
          status: 'attention',
        }),
      ],
    };
    expect(() => buildReportPdf(uni)).not.toThrow();
  });
});
