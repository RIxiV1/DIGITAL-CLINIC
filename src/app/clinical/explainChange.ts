import {
  getPreviousValue,
  getTrendTone,
  type Biomarker,
} from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';
import { certaintyOfAction } from './certaintyOfAction';
import type { FindingExplanation } from './explainFinding';

/**
 * explainChange — the longitudinal twin of explainFinding.
 *
 * The product's real leap: it doesn't just explain a report, it remembers
 * the story. When markers carry history (a prior report merged in), this
 * tells "what changed since last time" in the same four-beat voice:
 *
 *   1. What's moved since last time   (good news first)
 *   2. What's still worth watching
 *   3. What this doesn't tell us      (CO-OCCURRENCE, never causation)
 *   4. What I'd do next
 *
 * The non-negotiable rail (the user's biggest fear): two readings show a
 * DIRECTION, never a CAUSE. "Vitamin D and testosterone rose in the same
 * window" is honest; "your testosterone rose BECAUSE your Vitamin D did" is
 * an invented narrative. We only ever say things moved together, and that we
 * can't say why. Returns null when there's no prior reading to compare —
 * there's no journey yet. Pure; reuses the FindingExplanation shape so it
 * renders in the exact same calm voice as the single-report read.
 */

function listEnglish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function explainChange(
  markers: Biomarker[],
  _quiz: QuizAnswers,
): FindingExplanation | null {
  const tracked = markers.filter((m) => getPreviousValue(m) !== undefined);
  if (tracked.length === 0) return null; // no prior reading → no journey yet

  const improved = tracked.filter((m) => getTrendTone(m) === 'improving');
  const declined = tracked.filter((m) => getTrendTone(m) === 'declining');
  const stillFlagged = markers.filter(
    (m) => m.status === 'concern' || m.status === 'critical',
  );
  const critical = markers.some((m) => m.status === 'critical');

  // "watch" = declined or still-flagged, de-duped.
  const seen = new Set<string>();
  const watch: Biomarker[] = [];
  for (const m of [...declined, ...stillFlagged]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      watch.push(m);
    }
  }

  const moved = improved.length
    ? `Since your last test, ${listEnglish(improved.map((m) => m.name))} ${
        improved.length > 1 ? 'have' : 'has'
      } moved the right way.`
    : `Since your last test, the overall picture is holding steady.`;

  const watching = watch.length
    ? `Still worth keeping an eye on: ${listEnglish(watch.map((m) => m.name))}.`
    : `Nothing has slipped since last time.`;

  // Q3 — co-occurrence, NEVER causation.
  const doesntTell =
    improved.length >= 2
      ? `${listEnglish(improved.slice(0, 2).map((m) => m.name))} improved in the same window. Markers like these sometimes move together — but this can’t tell us that one caused the other, or what changed either. The direction is encouraging; the cause is a question for your doctor.`
      : `Two readings show a direction, not a reason — they still can’t tell us why something moved, only that it did.`;

  const lead = stillFlagged[0] ?? declined[0] ?? null;
  const action = lead ? certaintyOfAction(lead) : null;
  const next =
    critical && action
      ? `${action.action}. ${action.detail}`
      : action
        ? `Keep doing what’s working, and ${action.action.toLowerCase()} — a third reading will confirm whether the trend holds.`
        : `Keep doing what’s working, and re-test on your usual schedule to confirm the trend holds.`;

  return {
    tone: critical ? 'urgent' : 'calm',
    opener: critical
      ? 'Here’s what changed since your last test — and one result now needs attention today, regardless of the trend.'
      : 'Here’s what changed since your last test. The trend matters more than any single number.',
    beats: [
      { q: 'What’s moved since last time', body: moved },
      { q: 'What’s still worth watching', body: watching },
      { q: 'What this doesn’t tell us', body: doesntTell },
      { q: 'What I’d do next', body: next },
    ],
  };
}
