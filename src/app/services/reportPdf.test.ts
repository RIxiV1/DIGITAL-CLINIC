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
import {
  asciize,
  tierForMarker,
  buildReportPdf,
  buildDoctorBrief,
  doctorQuestionsFor,
} from './reportPdf';
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

describe('buildDoctorBrief', () => {
  it('produces a non-empty PDF for a real sample report', () => {
    const doc = buildDoctorBrief(sampleReports[0]);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect((doc.output('arraybuffer') as ArrayBuffer).byteLength).toBeGreaterThan(0);
  });

  it('stays a single page for a typical report — it is a one-pager', () => {
    // Flagged list is capped at 6, plus fixed question + retest + disclaimer
    // blocks, so a normal report fits one A4 page. This guards the "one-page"
    // promise against future content creep.
    const doc = buildDoctorBrief(sampleReports[0]);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('handles an all-in-range report (no flagged markers) without throwing', () => {
    const clear = {
      ...sampleReports[0],
      biomarkers: sampleReports[0].biomarkers.map((b) => ({
        ...b,
        status: 'good' as const,
      })),
    };
    expect(() => buildDoctorBrief(clear)).not.toThrow();
  });

  it('handles an empty-biomarker report without throwing', () => {
    expect(() =>
      buildDoctorBrief({ ...sampleReports[0], biomarkers: [] }),
    ).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* Doctor-brief questions                                              */
/*                                                                     */
/* This list used to be four fixed lines on every report, which is     */
/* what made a personal document read like a form letter. The point of */
/* these tests is that the page changes with the results — and that it */
/* only ever ASKS about a number, never asserts what the number means  */
/* (an assertion would need a citation the catalog hasn't given us).   */
/* ------------------------------------------------------------------ */

describe('doctorQuestionsFor', () => {
  const reportWith = (biomarkers: Biomarker[]) => ({
    ...sampleReports[0],
    biomarkers,
  });

  it('names the flagged marker and its value', () => {
    const qs = doctorQuestionsFor(
      reportWith([
        mk({ id: 'ferritin', name: 'Ferritin', value: 18, unit: 'ng/mL', status: 'concern' }),
      ]),
    );
    expect(qs[0]).toContain('Ferritin');
    expect(qs[0]).toContain('18');
    expect(qs[0]).toContain('ng/mL');
  });

  it('leads with the most urgent marker, not the first one listed', () => {
    const qs = doctorQuestionsFor(
      reportWith([
        mk({ id: 'a', name: 'Mild Marker', value: 1, status: 'attention' }),
        mk({ id: 'b', name: 'Urgent Marker', value: 2, status: 'critical' }),
      ]),
    );
    expect(qs[0]).toContain('Urgent Marker');
    expect(qs[0]).toContain('today');
  });

  it('produces a different list for a different report', () => {
    const a = doctorQuestionsFor(
      reportWith([mk({ id: 'a', name: 'Ferritin', value: 18, status: 'concern' })]),
    );
    const b = doctorQuestionsFor(
      reportWith([mk({ id: 'b', name: 'Vitamin D', value: 12, status: 'concern' })]),
    );
    expect(a).not.toEqual(b);
  });

  it('only asks for a re-test of the single flagged marker by name', () => {
    const qs = doctorQuestionsFor(
      reportWith([mk({ id: 'a', name: 'Ferritin', value: 18, status: 'concern' })]),
    );
    expect(qs.some((q) => q.includes('Should Ferritin be re-tested'))).toBe(true);
  });

  it('adds a triage question only once there are several flags', () => {
    const two = doctorQuestionsFor(
      reportWith([
        mk({ id: 'a', name: 'A', value: 1, status: 'concern' }),
        mk({ id: 'b', name: 'B', value: 2, status: 'concern' }),
      ]),
    );
    expect(two.some((q) => q.includes('which need action now'))).toBe(false);

    const three = doctorQuestionsFor(
      reportWith([
        mk({ id: 'a', name: 'A', value: 1, status: 'concern' }),
        mk({ id: 'b', name: 'B', value: 2, status: 'concern' }),
        mk({ id: 'c', name: 'C', value: 3, status: 'attention' }),
      ]),
    );
    expect(three.some((q) => q.includes('which need action now'))).toBe(true);
  });

  it('handles an all-clear report without naming a marker', () => {
    const qs = doctorQuestionsFor(
      reportWith([mk({ id: 'a', name: 'A', value: 1, status: 'good' })]),
    );
    expect(qs.length).toBeGreaterThan(0);
    expect(qs[0]).toContain('in range');
  });

  it('never runs longer than the page allows', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      mk({ id: `m${i}`, name: `Marker ${i}`, value: i, status: 'concern' }),
    );
    expect(doctorQuestionsFor(reportWith(many)).length).toBeLessThanOrEqual(5);
  });

  it('asks rather than asserts — no clinical claim in any question', () => {
    const qs = doctorQuestionsFor(
      reportWith([
        mk({ id: 'a', name: 'Ferritin', value: 18, unit: 'ng/mL', status: 'critical' }),
        mk({ id: 'b', name: 'Vitamin D', value: 12, unit: 'ng/mL', status: 'concern' }),
      ]),
    );
    for (const q of qs) {
      expect(q).toContain('?');
      // Words that would turn a prompt into a diagnosis or an instruction.
      expect(q).not.toMatch(/\b(you have|indicates|diagnos|deficien|you should take|start taking)\b/i);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Embedded display font                                               */
/*                                                                     */
/* The PDF is the one artefact a user hands to someone else, so it     */
/* renders headings in the app's display serif rather than Helvetica.  */
/* Registration is best-effort at runtime, which is exactly why it     */
/* needs a test — a silent fallback looks identical to the old output. */
/* ------------------------------------------------------------------ */

describe('embedded display font', () => {
  it('registers Domine in both regular and bold', () => {
    const list = buildDoctorBrief(sampleReports[0]).getFontList();
    expect(list.Domine).toEqual(expect.arrayContaining(['normal', 'bold']));
  });

  it('actually embeds the font programs in the output file', () => {
    // getFontList() only proves it was registered. /FontFile2 proves the
    // TrueType program was written into the PDF, which is what makes the
    // file render correctly on a machine that has never seen Domine.
    const raw = Buffer.from(
      buildDoctorBrief(sampleReports[0]).output('arraybuffer') as ArrayBuffer,
    ).toString('latin1');
    expect(raw).toContain('Domine');
    expect((raw.match(/\/FontFile2/g) ?? []).length).toBe(2);
  });

  it('stays small — jsPDF subsets the embedded faces to glyphs used', () => {
    // Guards against accidentally shipping the full face in every export.
    const bytes = (
      buildDoctorBrief(sampleReports[0]).output('arraybuffer') as ArrayBuffer
    ).byteLength;
    expect(bytes).toBeLessThan(120_000);
  });

  it('still builds the full report with the font active', () => {
    expect(() => buildReportPdf(sampleReports[0])).not.toThrow();
  });
});
