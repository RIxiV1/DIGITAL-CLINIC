import { type Biomarker } from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';
import { certaintyOfAction } from './certaintyOfAction';
import { buildBodySystems } from './bodySystems';

/**
 * explainFinding — the product's core experience, as a function.
 *
 * It does NOT explain a blood test. It explains the PERSON, then uses the
 * blood test as evidence. Every explanation answers the same four human
 * questions, in the same order, so users learn the framework and start
 * thinking this way themselves:
 *
 *   1. What you're probably experiencing   (from what THEY told us)
 *   2. What your blood test suggests        (the finding + honest related markers)
 *   3. What this doesn't tell us            (earned uncertainty — the trust core)
 *   4. What I'd do next                      (one confident, sensible step)
 *
 * The governing rule: understanding should reduce anxiety WHERE THE TRUTH
 * ALLOWS, and create the right urgency where it doesn't. So a critical
 * result keeps the four questions but flips the tone to "today, not someday"
 * — it is never soothed.
 *
 * Honesty rails: Q1 uses the user's OWN reported symptoms, never invented
 * ones (general framing when we have none). Q2's "related" markers are
 * same-system findings that genuinely co-occur — relationships, never
 * fabricated causation. Pure + composed from existing tested primitives.
 */

// Symptom id → in-sentence phrase (mirrors data/quiz.ts).
const SYMPTOM_PHRASES: Record<string, string> = {
  'low-energy': 'low energy',
  'brain-fog': 'brain fog',
  'poor-sleep': 'poor sleep',
  'low-libido': 'low sex drive',
  'difficulty-in-bed': 'difficulty in bed',
  'fertility-concerns': 'fertility worries',
  'hair-loss': 'hair loss',
  'belly-fat': 'stubborn belly fat',
  'low-mood': 'low mood',
  stress: 'stress',
};

export type ExplanationBeat = { q: string; body: string };
export type FindingExplanation = {
  tone: 'clear' | 'calm' | 'urgent';
  opener: string;
  beats: ExplanationBeat[];
};

function listEnglish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function explainFinding(
  markers: Biomarker[],
  quiz: QuizAnswers,
): FindingExplanation | null {
  if (markers.length === 0) return null;
  // Lead with the most-pressing FLAGGED marker (worst status). "Needs a look"
  // must describe something genuinely flagged — never the most trend-
  // newsworthy marker, which can be perfectly healthy.
  const STATUS_RANK: Record<string, number> = {
    critical: 3,
    concern: 2,
    attention: 1,
  };
  const flagged = markers.filter((m) => m.status !== 'good');
  const lead = flagged.length
    ? flagged.reduce((worst, m) =>
        (STATUS_RANK[m.status] ?? 0) > (STATUS_RANK[worst.status] ?? 0)
          ? m
          : worst,
      )
    : null;

  // ── All clear ──────────────────────────────────────────────────────
  if (!lead) {
    return {
      tone: 'clear',
      opener: 'This is a reassuring one — nothing needs attention right now.',
      beats: [
        { q: 'Overall', body: 'Nothing here is asking for attention.' },
        {
          q: 'What it can’t tell us',
          body: 'A test is a snapshot — reassuring, not a guarantee.',
        },
        { q: 'What to do', body: 'Keep it up; re-test in 6–12 months.' },
      ],
    };
  }

  const critical = lead.status === 'critical';
  const systems = buildBodySystems(markers);
  const leadSystem = systems.find((s) => s.categories.includes(lead.category));
  // Honest "related" = other flagged/attention findings in the SAME system —
  // they genuinely co-occur. Never a cross-organ causal claim.
  const related = markers.filter(
    (m) =>
      m.id !== lead.id &&
      m.status !== 'good' &&
      !!leadSystem?.categories.includes(m.category),
  );

  // Q1 — from what THEY told us; general (never invented) when we have none.
  const reported = (quiz.symptoms ?? [])
    .map((id) => SYMPTOM_PHRASES[id])
    .filter(Boolean);
  const relNames = related.map((m) => m.name);
  const q1 = reported.length
    ? `You mentioned ${listEnglish(reported)}.`
    : 'Often felt as low energy, drive, or slower recovery.';
  const q2 = related.length
    ? `${lead.name} needs a look — and ${listEnglish(relNames)} too. Likely one story.`
    : `${lead.name} needs a look.`;
  const next = certaintyOfAction(lead);

  // One short line per question. The four-question framework, terse — a
  // worried person doesn't read paragraphs.
  return {
    tone: critical ? 'urgent' : 'calm',
    opener: critical
      ? 'One result here needs a doctor today.'
      : 'Nothing here is an emergency — here’s what’s worth your attention.',
    beats: [
      { q: 'What you’re feeling', body: q1 },
      { q: 'What it suggests', body: q2 },
      {
        q: 'What it can’t tell us',
        body: critical
          ? 'Not the cause — but reason enough to be seen quickly.'
          : 'One test can’t say why; a re-test confirms the trend.',
      },
      { q: 'What to do', body: `${next.action}.` },
    ],
  };
}
