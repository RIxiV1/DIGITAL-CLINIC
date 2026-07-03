import { describe, expect, it } from 'vitest';
import { markerTrendNote } from './markerTrend';
import type { Biomarker } from '../data/biomarkers';

// Minimal marker builder — markerTrendNote only reads value/unit/direction/
// status/history (via the shared trend helpers).
const mk = (
  partial: Partial<Biomarker> & Pick<Biomarker, 'value' | 'direction'>,
): Biomarker =>
  ({
    id: 'x',
    name: 'X',
    unit: 'ng/ml',
    min: 30,
    max: 100,
    status: 'attention',
    category: 'metabolic',
    plain: '',
    ...partial,
  }) as Biomarker;

const hist = (...vals: number[]) =>
  vals.map((value, i) => ({ date: `2026-0${i + 1}-01`, value }));

describe('markerTrendNote', () => {
  it('returns null when there is no history', () => {
    expect(markerTrendNote(mk({ value: 27, direction: 'up' }))).toBeNull();
  });

  it('calls a rising up-is-better marker "improving" and shows the span', () => {
    const note = markerTrendNote(
      mk({ value: 27, direction: 'up', status: 'attention', history: hist(22, 25) }),
    );
    expect(note?.tone).toBe('improving');
    expect(note?.text).toMatch(/Improving/);
    expect(note?.text).toMatch(/25 ng\/ml → 27 ng\/ml/);
  });

  it('calls a FALLING down-is-better marker (LDL) "improving"', () => {
    const note = markerTrendNote(
      mk({ value: 90, direction: 'down', history: hist(120) }),
    );
    expect(note?.tone).toBe('improving');
  });

  it('flags a worsening marker as "worth watching", not alarmist', () => {
    const note = markerTrendNote(
      mk({ value: 160, direction: 'down', history: hist(140) }),
    );
    expect(note?.tone).toBe('declining');
    expect(note?.text).toMatch(/worth watching/i);
    expect(note?.text).not.toMatch(/danger|urgent|emergency/i);
  });

  it('reports a flat marker as holding steady', () => {
    const note = markerTrendNote(
      mk({ value: 100, direction: 'up', history: hist(100) }),
    );
    expect(note?.tone).toBe('stable');
    expect(note?.text).toMatch(/steady/i);
  });

  it('returns null for a both-ends-bad "band" marker (direction unclear)', () => {
    expect(
      markerTrendNote(mk({ value: 50, direction: 'band', history: hist(40) })),
    ).toBeNull();
  });
});
