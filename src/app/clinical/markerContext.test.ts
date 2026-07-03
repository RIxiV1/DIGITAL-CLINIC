import { describe, expect, it } from 'vitest';
import { markerContextNote } from './markerContext';
import type { QuizAnswers } from '../contexts/types';

const baseQuiz: QuizAnswers = {
  priorities: [],
  symptoms: [],
  comorbidities: [],
};

const marker = (id: string, status: 'good' | 'concern' | 'critical' = 'concern') =>
  ({ id, status }) as const;

describe('markerContextNote', () => {
  it('returns null when the user disclosed nothing relevant', () => {
    expect(markerContextNote(marker('glucose'), baseQuiz)).toBeNull();
    expect(markerContextNote(marker('creatinine'), baseQuiz)).toBeNull();
  });

  it('ties metabolic markers to a disclosed diabetes diagnosis', () => {
    const quiz = { ...baseQuiz, comorbidities: ['diabetes'] };
    expect(markerContextNote(marker('glucose'), quiz)).toMatch(/diabetes/i);
    expect(markerContextNote(marker('hba1c'), quiz)).toMatch(/diabetes/i);
    // ...but not unrelated markers.
    expect(markerContextNote(marker('ldl'), quiz)).toBeNull();
  });

  it('ties lipid markers to a disclosed BP / heart history', () => {
    const bp = { ...baseQuiz, comorbidities: ['high-bp'] };
    expect(markerContextNote(marker('ldl'), bp)).toMatch(/blood pressure/i);
    const heart = { ...baseQuiz, comorbidities: ['heart-condition'] };
    expect(markerContextNote(marker('total-chol'), heart)).toMatch(/heart/i);
  });

  it('explains training load on kidney markers for very-active users', () => {
    const quiz = { ...baseQuiz, activity: 'very-active' };
    expect(markerContextNote(marker('creatinine'), quiz)).toMatch(/train/i);
    expect(markerContextNote(marker('egfr'), quiz)).toMatch(/creatinine/i);
  });

  it('does not fabricate context for lighter activity levels', () => {
    const quiz = { ...baseQuiz, activity: 'light' };
    expect(markerContextNote(marker('creatinine'), quiz)).toBeNull();
  });

  it('SAFETY: never downplays a critical reading with the training note', () => {
    const quiz = { ...baseQuiz, activity: 'very-active' };
    expect(markerContextNote(marker('creatinine', 'critical'), quiz)).toBeNull();
  });

  it('SAFETY: every note it returns points the user toward a doctor / care team', () => {
    const notes = [
      markerContextNote(marker('glucose'), {
        ...baseQuiz,
        comorbidities: ['diabetes'],
      }),
      markerContextNote(marker('ldl'), { ...baseQuiz, comorbidities: ['high-bp'] }),
      markerContextNote(marker('creatinine'), {
        ...baseQuiz,
        activity: 'very-active',
      }),
    ].filter((n): n is string => n !== null);
    expect(notes).toHaveLength(3);
    for (const note of notes) {
      expect(note).toMatch(/doctor|care team/i);
      // Must never tell the user a flagged value is fine.
      expect(note).not.toMatch(/don.?t worry|nothing to worry|it.?s fine|no cause for concern/i);
    }
  });
});
