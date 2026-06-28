import { describe, expect, it } from 'vitest';
import { explainFinding } from './explainFinding';
import type { Biomarker, BiomarkerCategoryId, BiomarkerStatus } from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';

const baseQuiz: QuizAnswers = { priorities: [], symptoms: [], comorbidities: [] };

const mk = (
  id: string,
  status: BiomarkerStatus,
  category: BiomarkerCategoryId,
  extra: Partial<Biomarker> = {},
): Biomarker =>
  ({
    id,
    name: id,
    value: 1,
    unit: '',
    min: 0,
    max: 10,
    status,
    category,
    plain: 'plain copy.',
    ...extra,
  }) as Biomarker;

describe('explainFinding', () => {
  it('always answers the four questions in order, for a flagged report', () => {
    const e = explainFinding([mk('testosterone', 'concern', 'hormones')], baseQuiz);
    expect(e?.tone).toBe('calm');
    expect(e?.beats.map((b) => b.q)).toEqual([
      'What you’re probably experiencing',
      'What your blood test suggests',
      'What this doesn’t tell us',
      'What I’d do next',
    ]);
  });

  it('Q1 uses the user’s OWN reported symptoms when present', () => {
    const e = explainFinding(
      [mk('testosterone', 'concern', 'hormones')],
      { ...baseQuiz, symptoms: ['low-energy', 'low-libido'] },
    );
    expect(e?.beats[0].body).toMatch(/you told us/i);
    expect(e?.beats[0].body).toMatch(/low energy and low sex drive/);
  });

  it('Q1 never invents symptoms when we have none (general framing)', () => {
    const e = explainFinding([mk('testosterone', 'concern', 'hormones')], baseQuiz);
    expect(e?.beats[0].body).not.toMatch(/you told us/i);
    expect(e?.beats[0].body).toMatch(/lived experience/i);
  });

  it('weaves same-system related findings as "one story", not separate problems', () => {
    const e = explainFinding(
      [
        mk('testosterone', 'concern', 'hormones', { name: 'Total Testosterone' }),
        mk('free-t', 'attention', 'hormones', { name: 'Free Testosterone' }),
        mk('ldl', 'good', 'heart', { name: 'LDL' }), // good + other system → excluded
      ],
      baseQuiz,
    );
    expect(e?.beats[1].body).toMatch(/Free Testosterone/);
    expect(e?.beats[1].body).toMatch(/one story/i);
    expect(e?.beats[1].body).not.toMatch(/LDL/);
  });

  it('SAFETY: a critical finding flips to urgency — never soothed', () => {
    const e = explainFinding([mk('potassium', 'critical', 'electrolytes')], baseQuiz);
    expect(e?.tone).toBe('urgent');
    expect(e?.opener).toMatch(/today|not to wait/i);
    expect(e?.opener).not.toMatch(/no reason to panic|nothing here/i);
    expect(e?.beats[3].body).toMatch(/doctor|promptly|today/i);
  });

  it('an all-clear report is reassuring but honest (not a guarantee)', () => {
    const e = explainFinding([mk('hdl', 'good', 'heart')], baseQuiz);
    expect(e?.tone).toBe('clear');
    expect(e?.beats.some((b) => /not a guarantee|snapshot/i.test(b.body))).toBe(true);
  });
});
