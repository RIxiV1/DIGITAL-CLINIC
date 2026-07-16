import { describe, it, expect } from 'vitest';
import { extractBiomarkersFromText } from '../services/pdfParser';
import { certaintyOfAction } from './certaintyOfAction';

/**
 * Emergency escalation — the one test where a failure could hurt someone.
 *
 * Everything else in this suite guards correctness. This guards the property
 * that a value a doctor would act on TODAY is never handed to a man as
 * "not urgent" — and, more insidiously, is never silently DROPPED.
 *
 * WHY IT EXISTS
 * -------------
 * Both failures were live. The parser rejects values it judges physically
 * impossible, which is right — it's what stops a page number becoming a
 * reading, and it correctly refuses a 23 g/dL total protein. But the default
 * ceiling is a heuristic: healthy-band max + 5x the band's span. For a marker
 * whose healthy band is narrow and whose pathological range is enormous, that
 * ceiling lands *inside* the range where the reading matters:
 *
 *     ALT       band   7-56    -> ceiling ~301   (acute hepatitis runs 1000-5000)
 *     ALP       band  44-147   -> ceiling ~662   (cholestasis runs to 2000)
 *     GGT       band   9-48    -> ceiling ~243   (alcoholic hepatitis to 1500)
 *     Prolactin band   4-15.2  -> ceiling ~71    (macroprolactinoma 200-2000+)
 *
 * The pattern is perverse: the more urgent the reading, the more likely it was
 * deleted. A man in liver failure saw no ALT at all. A man whose low
 * testosterone was CAUSED by a prolactinoma saw the low testosterone and no
 * prolactin beside it — the one treatable answer this app exists to surface.
 *
 * It is invisible without a test like this: nothing throws, nothing logs, the
 * confirm screen just quietly has one fewer row and every other test passes.
 *
 * Adding a marker with a narrow healthy band? Give it an explicit
 * physicalMax, or it inherits a ceiling that may sit below the values that
 * matter most.
 */

/** Values a clinician would act on the same day, as a real lab prints them. */
const EMERGENCIES: {
  label: string;
  row: string;
  /** Must at minimum reach this tier. 'critical' => same-day language. */
  atLeast: 'critical' | 'concern';
}[] = [
  { label: 'hyperkalaemia (arrhythmia risk)', row: 'Potassium 7.20 mmol/L 3.50 - 5.10', atLeast: 'critical' },
  { label: 'severe hypokalaemia', row: 'Potassium 2.10 mmol/L 3.50 - 5.10', atLeast: 'critical' },
  { label: 'severe anaemia', row: 'HAEMOGLOBIN 4.50 g/dL 13.0 - 17.0', atLeast: 'critical' },
  { label: 'severe hyponatraemia', row: 'Sodium 115.00 mmol/L 136.00 - 145.00', atLeast: 'critical' },
  { label: 'renal failure', row: 'Creatinine 8.50 mg/dL 0.70 - 1.30', atLeast: 'critical' },
  { label: 'hyperglycaemic emergency', row: 'GLUCOSE FASTING 450 mg/dL 70 - 100', atLeast: 'critical' },
  { label: 'bleeding-risk thrombocytopenia', row: 'Platelet Count 9000 /cumm 150000 - 450000', atLeast: 'critical' },
  { label: 'severe neutropenia', row: 'WBC COUNT 800 /cumm 4000 - 11000', atLeast: 'critical' },
  { label: 'hypercalcaemia', row: 'Calcium, Total 15.00 mg/dL 8.70 - 10.40', atLeast: 'critical' },
  { label: 'acute hepatocellular injury (ALT)', row: 'ALT (SGPT) 1200 U/L 10.00 - 49.00', atLeast: 'critical' },
  { label: 'acute hepatocellular injury (AST)', row: 'AST (SGOT) 900 U/L 15.00 - 40.00', atLeast: 'critical' },
];

/** Not same-day, but must still SURVIVE extraction and read as abnormal —
 *  these are the ones the physical ceiling used to delete outright. */
const MUST_NOT_VANISH: { label: string; row: string; id: string }[] = [
  { label: 'macroprolactinoma', row: 'Prolactin 1500 ng/mL 4.0 - 15.2', id: 'prolactin' },
  { label: 'cholestasis (ALP)', row: 'Alkaline Phosphatase (ALP) 1800 U/L 30.00 - 120.00', id: 'alp' },
  { label: 'alcoholic hepatitis (GGT)', row: 'GGTP 1200 U/L 0 - 73', id: 'ggt' },
  { label: 'acute hepatitis (ALT)', row: 'ALT (SGPT) 3000 U/L 10.00 - 49.00', id: 'alt' },
];

const SAME_DAY = /promptly|same-day|don.t wait|urgent/i;

describe('a value that needs same-day care is never called routine', () => {
  for (const { label, row, atLeast } of EMERGENCIES) {
    it(`${label} escalates`, () => {
      const m = extractBiomarkersFromText(row)[0];
      // Step one: it must exist at all. The physical-bounds heuristic used to
      // bin the most extreme readings, which is a silent, total failure.
      expect(m, `${label}: the value was DROPPED, not just under-graded`).toBeDefined();

      const tiers = ['good', 'attention', 'concern', 'critical'];
      expect(
        tiers.indexOf(m.status),
        `${label}: graded '${m.status}', needs at least '${atLeast}'`,
      ).toBeGreaterThanOrEqual(tiers.indexOf(atLeast));

      const action = certaintyOfAction(m);
      if (atLeast === 'critical') {
        expect(
          SAME_DAY.test(`${action.action} ${action.detail}`),
          `${label}: advice was "${action.action}" — must convey same-day urgency`,
        ).toBe(true);
      }
    });
  }
});

describe('extreme-but-real values survive the physical-bounds filter', () => {
  for (const { label, row, id } of MUST_NOT_VANISH) {
    it(`${label} is not silently dropped`, () => {
      const found = extractBiomarkersFromText(row).find((m) => m.id === id);
      expect(
        found,
        `${label}: '${id}' vanished. Its physicalMax is probably below the ` +
          `values that matter — see the note at the top of this file.`,
      ).toBeDefined();
      expect(found!.status).not.toBe('good');
    });
  }
});
