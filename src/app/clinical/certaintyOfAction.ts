import type { Biomarker } from '../data/biomarkers';

/**
 * certaintyOfAction — implements §4 of docs/FIRST-IMPRESSION-CONTRACT.md.
 *
 * The insight: users do not need certainty about DISEASES, they need
 * certainty about what to DO. One blood draw rarely diagnoses anything
 * (certainty-of-diagnosis is low — that's what reportLimitations says), but
 * "discuss this with your doctor" / "confirm with a retest" / "watch this
 * trend" are robust recommendations even when the meaning is uncertain
 * (certainty-of-action is high).
 *
 * So this primitive answers the contract's Q4 ("what should I do next?")
 * with confidence, while everything else stays appropriately hedged. "I'm
 * not sure what this means, but I'm sure what you should do" is how the best
 * clinician sounds.
 *
 * It is a mapping over data we already have — not a new collection problem.
 * It NEVER returns a diagnosis; every output is an action.
 */

export type ActionCertainty = 'high' | 'moderate';

export type NextAction = {
  /** Imperative — what to do. Never a diagnosis. */
  action: string;
  /** One line of how/why, in the app's calm voice. */
  detail: string;
  /** How sure we are about the ACTION (not the meaning). */
  certainty: ActionCertainty;
};

/** Minimal input — works from a full Biomarker or just a status (+ optional
 *  OCR confidence), so both the marker card and the panel modal can use it. */
type ActionInput = Pick<Biomarker, 'status'> & { ocrConfidence?: number };

export function certaintyOfAction(m: ActionInput): NextAction {
  // Input-integrity first: if the number itself was read off an unclear
  // photo, the most certain next step is to verify the input — regardless of
  // which tier it landed in (a misread value can land in any tier).
  if (typeof m.ocrConfidence === 'number' && m.ocrConfidence < 65) {
    return {
      action: 'Double-check this number against your report',
      detail:
        'It was read from a photo that came through a little unclear, so confirm the figure before reading anything into it.',
      certainty: 'high',
    };
  }

  switch (m.status) {
    case 'critical':
      return {
        action: 'Speak to a doctor promptly',
        detail:
          'This sits past the same-day-care line — bring the result and don’t wait for a routine appointment.',
        certainty: 'high',
      };
    case 'concern':
      return {
        action: 'Discuss this with your doctor',
        detail:
          'Worth acting on. A recheck in about 12 weeks shows whether it’s moving — what it means can wait for that conversation.',
        certainty: 'high',
      };
    case 'attention':
      return {
        action: 'Keep an eye on it and retest',
        detail:
          'Not urgent. Confirm the direction at your next routine test rather than reading too much into one reading.',
        certainty: 'high',
      };
    default:
      return {
        action: 'Stay on your usual retest schedule',
        detail:
          'On track — nothing to change beyond checking again at your normal cadence.',
        certainty: 'high',
      };
  }
}
