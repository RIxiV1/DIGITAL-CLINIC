import { describe, expect, it } from 'vitest';
import { HOW_WE_READ, DECISION_PRINCIPLE } from './methodology';

describe('HOW_WE_READ', () => {
  it('lays out the pipeline as non-empty ordered steps', () => {
    expect(HOW_WE_READ.length).toBeGreaterThanOrEqual(3);
    for (const s of HOW_WE_READ) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the load-bearing trust claims (on-device, lab range, never diagnose)', () => {
    const all = HOW_WE_READ.map((s) => s.body).join(' ');
    expect(all).toMatch(/device|uploaded/i);
    expect(all).toMatch(/your lab|reference range/i);
    expect(all).toMatch(/never diagnose/i);
  });
});

describe('DECISION_PRINCIPLE', () => {
  it('points to a doctor + the trend, never marker-specific instructions', () => {
    expect(DECISION_PRINCIPLE).toMatch(/doctor/i);
    expect(DECISION_PRINCIPLE).toMatch(/trend|full picture/i);
    // Must not hand out a specific action (the unsafe thing).
    expect(DECISION_PRINCIPLE).not.toMatch(
      /you should (stop|start|take|increase|reduce)/i,
    );
  });
});
