/**
 * Tests for the AI-parser cross-category hallucination guard.
 *
 * Regression context: on a Redcliffe Labs CBC, Gemini returned
 * `{ name: "pH", value: 4.2 }` with no pH row anywhere in the source
 * report. Our catalog has "pH" as a Semen pH (Fertility) marker with
 * reference 7.2-8, so a successful name-match meant a hallucinated 4.2
 * landed in the user's dashboard as "severely low semen pH" on a blood
 * report. The prompt now forbids this; this guard is the second line
 * of defence at the catalog boundary.
 *
 * The check: a fertility marker with a short canonical name (≤3 chars
 * after stripping non-alphanumerics) requires ≥1 OTHER fertility-axis
 * marker in the response. The textbook hallucination pattern (a lone
 * "pH" inside an otherwise-non-fertility extraction) is dropped;
 * legitimate multi-marker semen analyses (which always print volume,
 * motility, morphology alongside pH) pass through.
 */

import { describe, it, expect } from 'vitest';
import { pruneSuspectShortNameMarkers } from './aiParser';
import type { Biomarker } from '../data/biomarkers';

function fakeMarker(overrides: Partial<Biomarker>): Biomarker {
  return {
    id: 'fake',
    name: 'Fake',
    value: 1,
    unit: '',
    min: 0,
    max: 10,
    status: 'good',
    category: 'blood',
    plain: '',
    ...overrides,
  };
}

const phMarker = fakeMarker({
  id: 'semen-ph',
  name: 'pH',
  value: 4.2,
  unit: '',
  min: 7.2,
  max: 8,
  category: 'fertility',
  status: 'critical',
});

const volumeMarker = fakeMarker({
  id: 'semen-volume',
  name: 'Volume',
  value: 2.5,
  unit: 'mL',
  min: 1.4,
  max: 5,
  category: 'fertility',
});

const motilityMarker = fakeMarker({
  id: 'semen-motility',
  name: 'Motility',
  value: 60,
  unit: '%',
  min: 42,
  max: 100,
  category: 'fertility',
});

const cbcMarkers: Biomarker[] = [
  fakeMarker({
    id: 'hematocrit',
    name: 'Hematocrit (PCV)',
    category: 'blood',
    value: 34.7,
  }),
  fakeMarker({ id: 'mchc', name: 'MCHC', category: 'blood', value: 32.8 }),
  fakeMarker({ id: 'rdw', name: 'RDW', category: 'blood', value: 13.4 }),
];

describe('pruneSuspectShortNameMarkers', () => {
  it('drops a lone short-name fertility marker mixed in with CBC markers', () => {
    const result = pruneSuspectShortNameMarkers({
      biomarkers: [...cbcMarkers, phMarker],
      unmapped: [],
    });
    expect(result.biomarkers).toHaveLength(3);
    expect(result.biomarkers.find((b) => b.name === 'pH')).toBeUndefined();
    expect(result.unmapped).toEqual([{ name: 'pH', value: 4.2, unit: '' }]);
  });

  it('keeps pH when at least one other fertility marker is present', () => {
    const result = pruneSuspectShortNameMarkers({
      biomarkers: [phMarker, volumeMarker],
      unmapped: [],
    });
    expect(result.biomarkers).toHaveLength(2);
    expect(result.biomarkers.map((b) => b.name).sort()).toEqual([
      'Volume',
      'pH',
    ]);
    expect(result.unmapped).toEqual([]);
  });

  it('keeps pH in a full semen panel (pH + volume + motility)', () => {
    const result = pruneSuspectShortNameMarkers({
      biomarkers: [phMarker, volumeMarker, motilityMarker],
      unmapped: [],
    });
    expect(result.biomarkers).toHaveLength(3);
  });

  it('is a no-op when no fertility markers are present', () => {
    const result = pruneSuspectShortNameMarkers({
      biomarkers: cbcMarkers,
      unmapped: [],
    });
    expect(result.biomarkers).toHaveLength(3);
    expect(result.unmapped).toEqual([]);
  });

  it('preserves existing unmapped entries when pruning', () => {
    const result = pruneSuspectShortNameMarkers({
      biomarkers: [...cbcMarkers, phMarker],
      unmapped: [{ name: 'pre-existing', value: 1, unit: '' }],
    });
    expect(result.unmapped).toEqual([
      { name: 'pre-existing', value: 1, unit: '' },
      { name: 'pH', value: 4.2, unit: '' },
    ]);
  });

  it('does not drop long-name fertility markers even when isolated', () => {
    // "Motility" is 8 chars — not a short ambiguous abbreviation, so
    // the guard leaves it alone even if it's the only fertility marker
    // in the response. The textbook hallucination pattern is short
    // names like "pH"; longer marker names are unambiguous enough that
    // a name-match is high-confidence.
    const result = pruneSuspectShortNameMarkers({
      biomarkers: [...cbcMarkers, motilityMarker],
      unmapped: [],
    });
    expect(result.biomarkers).toHaveLength(4);
  });
});
