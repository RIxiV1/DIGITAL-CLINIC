import { describe, expect, it } from 'vitest';
import { reportProvenanceNote } from './reportProvenance';

const m = (ocrConfidence?: number) => ({ ocrConfidence });

describe('reportProvenanceNote', () => {
  it('returns null for an empty report (nothing to vouch for)', () => {
    expect(reportProvenanceNote([])).toBeNull();
  });

  it('affirms a clean read when no value is low-confidence', () => {
    // Digital-text reads carry no ocrConfidence at all.
    const note = reportProvenanceNote([m(), m(), m()]);
    expect(note?.tone).toBe('clean');
    expect(note?.text).toMatch(/directly from your report/i);
  });

  it('treats confident photo scans (>= 65) as clean', () => {
    const note = reportProvenanceNote([m(92), m(78)]);
    expect(note?.tone).toBe('clean');
  });

  it('counts only the unclear scans and pluralizes correctly', () => {
    const one = reportProvenanceNote([m(), m(40), m(90)]);
    expect(one?.tone).toBe('flagged');
    expect(one?.text).toMatch(/^1 value /);
    expect(one?.text).toMatch(/flagged it below/);

    const many = reportProvenanceNote([m(40), m(50), m(90)]);
    expect(many?.text).toMatch(/^2 values /);
    expect(many?.text).toMatch(/flagged them below/);
  });
});
