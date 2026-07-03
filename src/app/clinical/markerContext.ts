import type { Biomarker } from '../data/biomarkers';
import type { QuizAnswers } from '../contexts/types';

/**
 * Context-aware marker notes.
 *
 * Ties a single biomarker to something the user ACTUALLY told us in the
 * intake quiz, so a flagged value reads against the person's own picture
 * rather than as a context-free alarm. This is the honest, data-backed
 * version of the audit's "you do creatine, so high creatinine may be
 * expected" idea.
 *
 * Two hard rules keep it safe and truthful:
 *
 *  1. We only reference facts we genuinely collect — `comorbidities`
 *     (diabetes / high BP / heart condition) and `activity` level. We do
 *     NOT ask about supplements, protein, or medication doses, so we
 *     never claim the user "mentioned creatine" or anything we didn't
 *     actually capture. Fabricating the user's own words would be the
 *     worst kind of false personalization.
 *
 *  2. A context note ADDS information; it never SUBTRACTS urgency. None of
 *     this copy says "so don't worry about this number." The one note
 *     with a benign-explanation flavour — training nudging creatinine —
 *     is suppressed on `critical` markers, where the same-day-care
 *     message must stand on its own. A high reading still gets confirmed
 *     with a doctor; we only add why it's worth discussing in context.
 *
 * Returns at most one note (the highest-priority match) or null. Pure —
 * depends only on its inputs — so it's unit-tested in isolation and the
 * BiomarkerBar that renders it stays presentational.
 */

/** Markers that the metabolic conditions (diabetes) are tracked by. */
const METABOLIC_IDS = new Set(['glucose', 'hba1c']);

/** Lipid panel — the cardiovascular-risk markers a BP / heart history
 *  is worth reviewing alongside. */
const LIPID_IDS = new Set([
  'ldl',
  'hdl',
  'vldl',
  'non-hdl',
  'total-chol',
  'triglycerides',
]);

/** Kidney-function markers that skeletal-muscle load and hard training
 *  can move WITHOUT kidney function itself changing. eGFR is calculated
 *  from creatinine, so it shifts with it. */
const TRAINING_RENAL_IDS = new Set(['creatinine', 'egfr', 'bun']);

function has(list: readonly string[] | undefined, id: string): boolean {
  return Array.isArray(list) && list.includes(id);
}

export function markerContextNote(
  marker: Pick<Biomarker, 'id' | 'status'>,
  quiz: QuizAnswers,
): string | null {
  const { comorbidities, activity } = quiz;

  // Condition-based notes first — a disclosed diagnosis is the strongest
  // reason a given marker matters to THIS person, and these notes carry
  // no benign-explanation risk (they point toward the doctor, never away).
  if (has(comorbidities, 'diabetes') && METABOLIC_IDS.has(marker.id)) {
    return (
      'You told us you’re managing diabetes — this is one of the markers ' +
      'it’s defined and tracked by, so your care team is likely already ' +
      'watching it. Worth bringing this reading to them.'
    );
  }

  if (LIPID_IDS.has(marker.id)) {
    if (has(comorbidities, 'heart-condition')) {
      return (
        'You mentioned a heart condition — cholesterol feeds into the same ' +
        'cardiovascular picture, so this one is worth reviewing together ' +
        'with your doctor rather than on its own.'
      );
    }
    if (has(comorbidities, 'high-bp')) {
      return (
        'You mentioned high blood pressure — cholesterol and blood pressure ' +
        'add up in the same cardiovascular picture, so this one is worth ' +
        'reviewing alongside it with your doctor.'
      );
    }
  }

  // Activity-based note. Has a benign-explanation flavour, so it's gated
  // OUT of critical readings — there, the same-day-care message stands
  // alone and we never hand the user a reason to wait.
  if (
    activity === 'very-active' &&
    TRAINING_RENAL_IDS.has(marker.id) &&
    marker.status !== 'critical'
  ) {
    return (
      'You told us you train hard. Heavier muscle mass and intense exercise ' +
      'can raise creatinine on their own — and since eGFR is calculated from ' +
      'creatinine, both can shift without kidney function actually changing. ' +
      'A trend over time (or a cystatin-C test) tells you more than a single ' +
      'reading — confirm with a doctor.'
    );
  }

  return null;
}
