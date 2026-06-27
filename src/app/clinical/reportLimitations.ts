/**
 * "What a single report can't tell you."
 *
 * The clinical reviewer's biggest concern as the product's explanations get
 * better is OVER-TRUST — users treating a translated lab value as a verdict.
 * The strongest mitigation isn't a smaller claim, it's an honest statement
 * of limits. This is that statement, shown once per report as a progressive
 * disclosure (not repeated per card, which would be noise).
 *
 * Every caveat is grounded in published clinical-laboratory science, cited
 * below — same cite-or-omit rule the optimal/action ranges follow. The copy
 * is deliberately reassuring AND limiting at once: it explains why a flag
 * isn't a diagnosis without telling anyone a genuinely concerning value is
 * fine.
 *
 * Sources:
 *  - Reference range = central 95% of a healthy population, so ~1 in 20
 *    healthy results fall outside it by chance (a "false positive"):
 *    Mayo Clinic Press, "Should you worry about abnormal lab results?";
 *    acutecaretesting.org, "Reference intervals and percentiles."
 *  - A single result reflects biological + analytical variation; extreme
 *    values regress to the mean on repeat, and a consistent direction across
 *    serial tests is far more reliable than one reading:
 *    Coskun et al., "Current and emerging concepts in biological and
 *    analytical variation," PMC7694803.
 */

export type Limitation = { title: string; body: string };

export type LimitationsSource = { label: string; url: string };

export const REPORT_LIMITATIONS: Limitation[] = [
  {
    title: '“Normal” is statistical, not personal',
    body:
      'A reference range is just the middle 95% of a healthy population — so ' +
      'about 1 in 20 perfectly healthy results land outside it purely by ' +
      'chance. A single flag is a reason to look closer, not a diagnosis.',
  },
  {
    title: 'One reading isn’t a trend',
    body:
      'Every value carries natural day-to-day biological variation plus the ' +
      'lab’s own measurement variation, so the same blood can read a little ' +
      'differently on a repeat draw — and an unusually high or low value ' +
      'often settles back toward your normal on its own. The same direction ' +
      'across two or three tests means far more than any one number.',
  },
  {
    title: 'Timing and prep move the numbers',
    body:
      'Fasting, time of day, recent exercise, hydration, illness, and some ' +
      'medications all shift results — separately from your underlying ' +
      'health. Results are most comparable when the conditions match.',
  },
  {
    title: 'Each marker measures one thing',
    body:
      'In-range here doesn’t certify your overall health, and out-of-range ' +
      'here doesn’t mean you’re unwell. A doctor reads these together, ' +
      'alongside your symptoms and history — which is what no single report ' +
      'can do on its own.',
  },
];

export const REPORT_LIMITATIONS_SOURCES: LimitationsSource[] = [
  {
    label: 'Mayo Clinic Press — “Should you worry about abnormal lab results?”',
    url: 'https://mcpress.mayoclinic.org/healthy-aging/should-you-worry-about-abnormal-lab-results/',
  },
  {
    label:
      'Coskun et al., biological & analytical variation in clinical practice (PMC7694803)',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7694803/',
  },
];
