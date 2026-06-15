import { describe, it, expect } from 'vitest';
import { editStateOf, regradeMarker } from './confirmEdits';
import {
  getTemplateById,
  markerFromTemplate,
  type Biomarker,
} from '../data/biomarkers';

/**
 * Covers the editable confirm gate's re-grade logic — the safety-critical
 * decision of what value commits after a user corrects an OCR misread.
 * Mirrors the audit's recommended manual checklist as deterministic tests:
 *   1. Fast-backspacing → safe fallback, never a NaN
 *   2. Drastic value change → live re-grade
 *   3. Boundary transitions → status flips at the threshold
 */

const HBA1C = getTemplateById('hba1c');
if (!HBA1C) throw new Error('fixture template missing: hba1c');

// Baseline: 5.0% sits inside the optimal band (4.5–5.3) → 'good'.
const base = markerFromTemplate(HBA1C, 5.0);

describe('editStateOf', () => {
  it('is "unedited" when the field was never touched', () => {
    expect(editStateOf(base, undefined)).toBe('unedited');
  });

  it('is "empty" for blank, whitespace, or a partial keystroke', () => {
    expect(editStateOf(base, '')).toBe('empty');
    expect(editStateOf(base, '   ')).toBe('empty');
    expect(editStateOf(base, '.')).toBe('empty'); // parseFloat('.') is NaN
  });

  it('is "out-of-range" for a double-strike typo beyond 5x span', () => {
    // HbA1c span = 1.7; ceiling = 5.7 + 5*1.7 = 14.2. 440 is far past it.
    expect(editStateOf(base, '440')).toBe('out-of-range');
  });

  it('is "ok" for a plausible in-bounds correction', () => {
    expect(editStateOf(base, '7.2')).toBe('ok');
  });
});

describe('regradeMarker', () => {
  it('Check 1 — falls back to the original on empty/partial input (no NaN)', () => {
    const r = regradeMarker(base, '');
    expect(r).toEqual(base); // unchanged
    expect(Number.isNaN(r.value)).toBe(false);
    expect(regradeMarker(base, '.')).toEqual(base);
  });

  it('Check 1 — falls back on an out-of-range typo (440 instead of 4.0)', () => {
    expect(regradeMarker(base, '440')).toEqual(base);
  });

  it('Check 2 — a valid correction re-grades value + status live', () => {
    const r = regradeMarker(base, '7.2'); // above healthy 5.7 → concern
    expect(r.value).toBe(7.2);
    expect(r.status).toBe('concern');
  });

  it('Check 3 — status flips across the optimal/healthy boundaries', () => {
    expect(regradeMarker(base, '5.3').status).toBe('good'); // optimal edge
    expect(regradeMarker(base, '5.4').status).toBe('attention'); // just past optimal
    expect(regradeMarker(base, '5.7').status).toBe('attention'); // healthy edge
    expect(regradeMarker(base, '5.8').status).toBe('concern'); // out of healthy
  });

  it('preserves history, lab range, and other fields — only value+status change', () => {
    const enriched: Biomarker = {
      ...base,
      history: [{ date: '2026-01-01', value: 5.1 }],
      labRefMin: 4,
      labRefMax: 6,
    };
    // Graded against the lab's printed range (4–6) per statusForValue priority.
    const r = regradeMarker(enriched, '6.5');
    expect(r.value).toBe(6.5);
    expect(r.status).toBe('concern'); // 6.5 > labRef max 6
    expect(r.history).toEqual(enriched.history);
    expect(r.labRefMin).toBe(4);
    expect(r.labRefMax).toBe(6);
    expect(r.plain).toBe(enriched.plain);
  });
});
