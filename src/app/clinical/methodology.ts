/**
 * "How we read your report" + the decision principle.
 *
 * Two trust gaps from the 100-user failure audit:
 *
 *  - Persona 9 (skeptic) / 8 (doctor): the app explains WHAT a value means
 *    but not HOW it decided — so "why should I trust this?" goes unanswered
 *    and an exported PDF gives a doctor no provenance. HOW_WE_READ states
 *    the actual pipeline, in order. Every line is literally true of the
 *    code (on-device parse, lab-range priority, quiz context, cited
 *    evidence, never diagnoses) — no aspirational claims.
 *
 *  - Persona 1 (the core gym user) / 2 (anxiety): explanations answer
 *    information but not the DECISION the user actually has ("should I stop
 *    creatine?"). The only safe, universally-correct answer is the
 *    principle a clinician would give — don't act on a single marker — so
 *    that's what we surface, rather than fabricating marker-specific advice.
 */

export type MethodStep = { title: string; body: string };

export const HOW_WE_READ: MethodStep[] = [
  {
    title: 'We read your values',
    body:
      'Your report is parsed on your device — the numbers and units straight ' +
      'from the PDF’s text, or by on-device OCR for a photo. Nothing is ' +
      'uploaded to read it.',
  },
  {
    title: 'We compare against your lab’s range',
    body:
      'Where your lab printed its own reference range, we grade against that ' +
      '— trusting the pathologist who signed your report over our defaults. ' +
      'Our catalog range fills in only when your lab didn’t print one.',
  },
  {
    title: 'We factor in what you told us',
    body:
      'Your quiz answers — age, activity, conditions — add context to a ' +
      'result (hard training can raise creatinine, for instance) without ' +
      'ever overriding a concerning value.',
  },
  {
    title: 'We highlight patterns, and show our sources',
    body:
      'We flag what’s outside range, grade the evidence behind any ' +
      'suggestion, and link the guideline behind it. We translate your ' +
      'report — we never diagnose.',
  },
];

/**
 * The decision aid. Surfaced on flagged markers, where the user's real
 * question is "so what do I DO?" — answered with the safe, correct
 * principle instead of marker-specific instructions we can't responsibly
 * give.
 */
export const DECISION_PRINCIPLE =
  'Deciding what to do? One marker on its own isn’t enough to start, stop, ' +
  'or change a medication, supplement, or training plan — that’s a ' +
  'conversation for a doctor, who’ll look at the trend and your full ' +
  'picture, not a single reading.';
