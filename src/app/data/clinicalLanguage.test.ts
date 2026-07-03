import { describe, expect, it } from 'vitest';
import { bottomLineFor, type Biomarker } from './biomarkers';

/**
 * Clinical-language guard.
 *
 * `bottomLineFor` generates the single most-read clinical sentence in the
 * product — the report hero. A manual copy sweep (commit 682eee7) replaced
 * over-confident "fix / cure" phrasing with hedged language, but a later
 * edit silently reintroduced "enough to fix it" and "are reversible" here —
 * exactly the drift a 100k-user product can't afford in its headline
 * clinical claim. This test exercises every branch of bottomLineFor and
 * fails if any banned overclaim phrase comes back, so the sweep stays swept.
 *
 * Scope is deliberately narrow: the dynamically-generated hero copy, where
 * the regression actually happened. Whole-corpus static copy is a broader
 * follow-up better paired with the clinical-knowledge file split.
 */

// Unambiguous overclaim phrasing for a screening tool that diagnoses
// nothing. "reverse"/"reversible" are intentionally NOT banned wholesale —
// "reverse T3" is a real analyte and lifestyle-driven reversal of
// prediabetes is evidence-backed — so we ban the specific absolute framings
// instead.
const BANNED = [
  /\bfix(es|ed|ing)?\b/i,
  /\bcure[sd]?\b/i,
  /\bguarantee[sd]?\b/i,
  /\bdetox\b/i,
  /\bare reversible\b/i,
  /\b100%\b/,
  /\bcompletely safe\b/i,
];

/** Minimal biomarker stub — bottomLineFor only reads name + status. */
const mk = (name: string, status: Biomarker['status']): Biomarker =>
  ({ name, status }) as Biomarker;

// One representative set per branch of bottomLineFor.
const SCENARIOS: Record<string, Biomarker[]> = {
  'all good': [mk('LDL', 'good'), mk('HDL', 'good')],
  'attention only': [mk('LDL', 'good'), mk('Vitamin D', 'attention')],
  'one concern': [mk('Glucose', 'concern'), mk('HDL', 'good')],
  'two concerns': [
    mk('Glucose', 'concern'),
    mk('LDL', 'concern'),
    mk('HDL', 'good'),
  ],
  'one critical': [mk('Potassium', 'critical'), mk('HDL', 'good')],
  'two criticals': [
    mk('Potassium', 'critical'),
    mk('Glucose', 'critical'),
    mk('LDL', 'concern'),
  ],
};

describe('bottomLineFor — clinical language guard', () => {
  for (const [label, markers] of Object.entries(SCENARIOS)) {
    it(`uses no overclaim phrasing: ${label}`, () => {
      const line = bottomLineFor(markers);
      expect(line.length).toBeGreaterThan(0);
      for (const pattern of BANNED) {
        expect(
          pattern.test(line),
          `"${line}" should not match ${pattern}`,
        ).toBe(false);
      }
    });
  }
});
