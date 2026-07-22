import type { Biomarker, BiomarkerStatus } from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';

/**
 * symptomLinks — connect what the user told us in the quiz to what the
 * report actually found.
 *
 * The quiz already knows the symptoms; the report already knows the flagged
 * markers. Nobody had joined the two. This does — but under one hard,
 * non-negotiable rail: it only ever says a symptom and a marker CO-OCCUR
 * ("your low energy showed up alongside low Vitamin D"), NEVER that one
 * caused the other. Two readings and a questionnaire show an association, not
 * a mechanism. The same honesty rail as clinical/explainChange.
 *
 * The symptom→marker relationships are the SAME clinical mapping the app
 * already uses to recommend tests (data/testRecommender.ts `SYMPTOM_ADDS`),
 * re-expressed against real catalog `id`s so matching a report's markers is
 * exact, not fragile name-matching. Markers that map to those associations
 * but aren't in the catalog (DHT, DHEA-S, zinc, PSA, …) are simply omitted —
 * no fabricated marker, no invented link.
 *
 * Pure: quiz + markers in → structured links out. A link is surfaced ONLY
 * when an associated marker is actually flagged in THIS report, so we never
 * dangle a symptom against an all-clear panel.
 */

const FLAGGED: BiomarkerStatus[] = ['attention', 'concern', 'critical'];

/** Plain, lower-case symptom label for mid-sentence use (mirrors the quiz's
 *  option labels in data/quiz.ts). 'proactive' ("Nothing specific") has no
 *  symptom to link and is intentionally absent. */
const SYMPTOM_LABEL: Record<string, string> = {
  'low-energy': 'low energy',
  'brain-fog': 'brain fog',
  'poor-sleep': 'poor sleep',
  'low-libido': 'low libido',
  'difficulty-in-bed': 'difficulty in bed',
  'fertility-concerns': 'fertility concerns',
  'hair-loss': 'hair loss',
  'belly-fat': 'stubborn belly fat',
  'low-mood': 'low mood',
  stress: 'stress',
};

/** Symptom id → catalog marker `id`s clinically associated with it (for
 *  CO-OCCURRENCE display only). Derived from testRecommender's SYMPTOM_ADDS
 *  clinical intent, keyed to the ids that actually exist in the catalog. */
const SYMPTOM_MARKERS: Record<string, string[]> = {
  'low-energy': [
    'hb', 'ferritin', 'vit-d', 'b12', 'tsh', 'free-t4', 't4', 'hba1c',
    'glucose', 'cortisol-am', 'testosterone', 'free-t',
  ],
  'brain-fog': [
    'b12', 'vit-d', 'tsh', 'free-t4', 't4', 'hba1c', 'ferritin', 'cortisol-am',
  ],
  'poor-sleep': ['cortisol-am', 'tsh', 'free-t4', 'magnesium', 'hba1c'],
  'low-libido': [
    'testosterone', 'free-t', 'shbg', 'prolactin', 'estradiol', 'lh', 'tsh',
  ],
  'difficulty-in-bed': [
    'testosterone', 'free-t', 'prolactin', 'estradiol', 'lh', 'ldl', 'hdl',
    'tg', 'total-chol', 'hba1c', 'glucose', 'insulin',
  ],
  'fertility-concerns': [
    'lh', 'fsh', 'prolactin', 'estradiol', 'testosterone', 'free-t',
  ],
  'hair-loss': ['ferritin', 'tsh', 'free-t4', 't4', 'vit-d'],
  'belly-fat': [
    'estradiol', 'insulin', 'homa-ir', 'hba1c', 'glucose', 'ldl', 'hdl',
    'tg', 'total-chol', 'testosterone', 'free-t',
  ],
  'low-mood': [
    'cortisol-am', 'tsh', 'free-t4', 't4', 'b12', 'vit-d', 'prolactin',
    'testosterone', 'free-t',
  ],
  stress: ['cortisol-am', 'magnesium', 'tsh', 'free-t4'],
};

export type SymptomLink = {
  symptomId: string;
  /** Plain, lower-case label for mid-sentence use. */
  symptomLabel: string;
  /** Flagged markers in this report associated with the symptom, in the
   *  order they appear in the report. */
  markers: Biomarker[];
};

/**
 * Build the symptom↔result links for a report. Returns one entry per
 * reported symptom that has at least one associated marker flagged in this
 * report; empty when the quiz has no symptoms, nothing is flagged, or no
 * association lands.
 */
export function symptomLinks(
  quiz: QuizAnswers,
  markers: Biomarker[],
): SymptomLink[] {
  const flagged = markers.filter((m) => FLAGGED.includes(m.status));
  if (flagged.length === 0 || quiz.symptoms.length === 0) return [];

  const links: SymptomLink[] = [];
  for (const symptomId of quiz.symptoms) {
    const symptomLabel = SYMPTOM_LABEL[symptomId];
    const ids = SYMPTOM_MARKERS[symptomId];
    if (!symptomLabel || !ids) continue; // 'proactive' / unknown → skip
    const related = flagged.filter((m) => ids.includes(m.id));
    if (related.length > 0) links.push({ symptomId, symptomLabel, markers: related });
  }
  return links;
}

/** "A and B" / "A, B, and C". */
function listEnglish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * The one-line, co-occurrence-only sentence for a link. Deliberately worded
 * so it can NEVER be read as causal — "showed up alongside", "an association",
 * "not proof one caused the other".
 */
export function symptomLinkSentence(link: SymptomLink): string {
  const names = listEnglish(link.markers.map((m) => m.name));
  return `Your ${link.symptomLabel} showed up alongside ${names} — an association from your answers, not proof one caused the other.`;
}
