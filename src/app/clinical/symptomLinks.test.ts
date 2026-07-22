import { describe, it, expect } from 'vitest';
import { symptomLinks, symptomLinkSentence } from './symptomLinks';
import type { Biomarker } from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';

function marker(over: Partial<Biomarker> & Pick<Biomarker, 'id'>): Biomarker {
  return {
    name: over.id,
    value: 1,
    unit: 'x',
    min: 0,
    max: 10,
    status: 'good',
    category: 'metabolic',
    plain: '',
    ...over,
  } as Biomarker;
}

function quiz(symptoms: string[]): QuizAnswers {
  return { symptoms, priorities: [], comorbidities: [] };
}

describe('symptomLinks', () => {
  it('links a reported symptom to its associated FLAGGED markers only', () => {
    const markers = [
      marker({ id: 'vit-d', name: 'Vitamin D (25-OH)', status: 'concern' }),
      marker({ id: 'b12', name: 'Vitamin B12', status: 'attention' }),
      marker({ id: 'hb', name: 'Hemoglobin', status: 'good' }), // in-range → excluded
    ];
    const links = symptomLinks(quiz(['low-energy']), markers);
    expect(links).toHaveLength(1);
    expect(links[0].symptomId).toBe('low-energy');
    expect(links[0].markers.map((m) => m.id).sort()).toEqual(['b12', 'vit-d']);
  });

  it('returns nothing when the associated markers are all in range', () => {
    const markers = [marker({ id: 'vit-d', status: 'good' })];
    expect(symptomLinks(quiz(['low-energy']), markers)).toEqual([]);
  });

  it('returns nothing when the quiz has no symptoms', () => {
    const markers = [marker({ id: 'vit-d', status: 'concern' })];
    expect(symptomLinks(quiz([]), markers)).toEqual([]);
  });

  it('ignores an unrelated symptom / marker pairing', () => {
    // low-libido does not associate with vitamin D
    const markers = [marker({ id: 'vit-d', status: 'concern' })];
    expect(symptomLinks(quiz(['low-libido']), markers)).toEqual([]);
  });

  it('skips the "proactive" (nothing-specific) pseudo-symptom', () => {
    const markers = [marker({ id: 'vit-d', status: 'concern' })];
    expect(symptomLinks(quiz(['proactive']), markers)).toEqual([]);
  });

  it('produces one link per matching symptom', () => {
    const markers = [
      marker({ id: 'testosterone', name: 'Total Testosterone', status: 'concern' }),
    ];
    const links = symptomLinks(quiz(['low-libido', 'difficulty-in-bed']), markers);
    expect(links.map((l) => l.symptomId)).toEqual(['low-libido', 'difficulty-in-bed']);
  });
});

describe('symptomLinkSentence', () => {
  it('is worded as co-occurrence, never causation', () => {
    const link = {
      symptomId: 'low-energy',
      symptomLabel: 'low energy',
      markers: [
        marker({ id: 'vit-d', name: 'Vitamin D (25-OH)', status: 'concern' }),
      ],
    };
    const s = symptomLinkSentence(link);
    expect(s).toContain('showed up alongside');
    expect(s).toContain('not proof one caused the other');
    // Guard against any causal verb sneaking into the phrasing.
    expect(s).not.toMatch(/\bcauses\b|\bcausing\b|\bbecause\b|\bdue to\b/i);
  });
});
