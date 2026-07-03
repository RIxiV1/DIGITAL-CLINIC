import { describe, expect, it } from 'vitest';
import { explainChange } from './explainChange';
import type {
  Biomarker,
  BiomarkerCategoryId,
  BiomarkerStatus,
} from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';

const quiz: QuizAnswers = { priorities: [], symptoms: [], comorbidities: [] };

const hist = (...v: number[]) =>
  v.map((value, i) => ({ date: `2026-0${i + 1}-01`, value }));

const mk = (
  name: string,
  value: number,
  direction: 'up' | 'down' | 'band',
  status: BiomarkerStatus,
  history?: { date: string; value: number }[],
  category: BiomarkerCategoryId = 'hormones',
): Biomarker =>
  ({
    id: name,
    name,
    value,
    unit: '',
    min: 0,
    max: 100,
    status,
    category,
    direction,
    plain: '',
    history,
  }) as Biomarker;

describe('explainChange', () => {
  it('returns null when there is no prior reading (no journey yet)', () => {
    expect(explainChange([mk('T', 5, 'up', 'concern')], quiz)).toBeNull();
  });

  it('answers the four longitudinal questions when history exists', () => {
    const e = explainChange(
      [mk('Testosterone', 27, 'up', 'attention', hist(22, 25))],
      quiz,
    );
    expect(e?.beats.map((b) => b.q)).toEqual([
      'What improved',
      'Still watching',
      'What it can’t tell us',
      'What to do',
    ]);
    expect(e?.beats[0].body).toMatch(/moved the right way/i);
  });

  it('SAFETY: states co-occurrence, never causation', () => {
    const e = explainChange(
      [
        mk('Vitamin D', 40, 'up', 'good', hist(20, 30), 'vitamins'),
        mk('Testosterone', 420, 'up', 'attention', hist(280, 350)),
      ],
      quiz,
    );
    const q3 = e!.beats[2].body;
    expect(q3).toMatch(/moved together|move together|same window/i);
    // Never a positive causal claim.
    expect(q3).not.toMatch(/because (you|your|it)|caused by|raised your|led to/i);
    expect(q3).toMatch(/can’t tell us|question for your doctor/i);
  });

  it('SAFETY: a current critical result is urgent regardless of a good trend', () => {
    const e = explainChange(
      [mk('Potassium', 6.5, 'down', 'critical', hist(7.0), 'electrolytes')],
      quiz,
    );
    expect(e?.tone).toBe('urgent');
    expect(e?.opener).toMatch(/today/i);
  });
});
