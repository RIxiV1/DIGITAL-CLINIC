import { describe, expect, it } from 'vitest';
import {
  REPORT_LIMITATIONS,
  REPORT_LIMITATIONS_SOURCES,
} from './reportLimitations';

describe('reportLimitations', () => {
  it('provides several non-empty caveats with titles + bodies', () => {
    expect(REPORT_LIMITATIONS.length).toBeGreaterThanOrEqual(3);
    for (const l of REPORT_LIMITATIONS) {
      expect(l.title.trim().length).toBeGreaterThan(0);
      expect(l.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the grounded statistical claims it cites for', () => {
    const all = REPORT_LIMITATIONS.map((l) => l.body).join(' ');
    // The two load-bearing, research-backed facts must stay in the copy so
    // it can't be edited down into a vaguer, weaker statement.
    expect(all).toMatch(/95%|1 in 20/);
    expect(all).toMatch(/variation/i);
    expect(all).toMatch(/trend|repeat|serial|two or three/i);
  });

  it('cites a real source for every claim (cite-or-omit)', () => {
    expect(REPORT_LIMITATIONS_SOURCES.length).toBeGreaterThanOrEqual(1);
    for (const s of REPORT_LIMITATIONS_SOURCES) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('does not falsely reassure (no "don\'t worry / it\'s fine")', () => {
    const all = REPORT_LIMITATIONS.map((l) => `${l.title} ${l.body}`).join(' ');
    expect(all).not.toMatch(
      /don.?t worry|nothing to worry|it.?s fine|no cause for concern/i,
    );
  });
});
