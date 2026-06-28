import {
  pickHeadlineMarker,
  summarizeStatuses,
  type Biomarker,
} from '../data/biomarkers';
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
  const summary = summarizeStatuses(markers);
  const lead =
    pickHeadlineMarker(markers) ??
    markers.find((m) => m.status !== 'good') ??
    null;

  // ── All clear ──────────────────────────────────────────────────────
  if (!lead || (summary.needCare === 0 && summary.attention === 0)) {
    return {
      tone: 'clear',
      opener:
        'If I were sitting next to you with this report, here’s what I’d say. Honestly? It’s a good one.',
      beats: [
        {
          q: 'The short version',
          body: 'Across everything we looked at, nothing is asking for attention right now. That’s a genuinely good place to be.',
        },
        {
          q: 'What this doesn’t tell us',
          body: 'A blood test is a snapshot, not the whole story — it can’t see how you sleep, train, or feel. So this is reassuring, not a guarantee.',
        },
        {
          q: 'What I’d do next',
          body: 'Keep doing what you’re doing, and re-test in 6–12 months so you can watch your own trend.',
        },
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
  const q1 = reported.length
    ? `You told us you’ve been dealing with ${listEnglish(reported)}. That’s the place to start — not the lab sheet.`
    : `Low energy, low drive, slower recovery — the kind of thing men usually feel before they ever see a number like this. Your lived experience is where we start, not the lab sheet.`;

  // Q2 — the finding, woven with the honest same-system related markers.
  const relNames = related.map((m) => m.name);
  const q2 = related.length
    ? `${lead.plain} And it rarely travels alone — ${listEnglish(relNames)} ${
        related.length > 1 ? 'are' : 'is'
      } pointing the same way. ${
        related.length > 1 ? 'They’re' : 'It’s'
      } usually part of one story, not separate problems.`
    : lead.plain;

  // Q4 — one confident next step.
  const next = certaintyOfAction(lead);

  return {
    tone: critical ? 'urgent' : 'calm',
    opener: critical
      ? 'If I were sitting next to you with this report, I’d want you to act on this today. It’s not a reason to spiral — it’s a reason not to wait.'
      : 'If I were sitting next to you with this report, here’s what I’d say. Nothing here is a reason to panic — there are a couple of things worth following up on, and a clear first step.',
    beats: [
      { q: 'What you’re probably experiencing', body: q1 },
      { q: 'What your blood test suggests', body: q2 },
      {
        q: 'What this doesn’t tell us',
        body: critical
          ? 'It can’t tell us the cause — but a result this far out of range is itself the reason to be seen quickly, before reading anything more into it.'
          : 'One blood draw can’t tell us why, and a single reading isn’t a verdict — levels like this naturally vary and often look different on a re-test. That’s exactly why a doctor confirms before any long-term decision.',
      },
      { q: 'What I’d do next', body: `${next.action}. ${next.detail}` },
    ],
  };
}
