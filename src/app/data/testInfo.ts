/**
 * Panel-category-level educational content for the "Learn More" modal on
 * the Recommended Tests page. Keyed by the panel category id from the
 * recommendation engine in `tests.ts` (foundational / hormonal / metabolic
 * / nutritional / screening / fertility).
 *
 * Old test ids (hormone / lipid / thyroid / vitamins / liver-kidney) are
 * gone — the engine now groups by category, not by named test.
 */

import type { LearnMore } from './markerInfo';

export const testInfo: Record<string, LearnMore> = {
  foundational: {
    measures:
      'The six universal markers every man should run: Total Testosterone, Free Testosterone, SHBG, Vitamin D, TSH (thyroid signal), and fasting glucose. Drawn fasting between 8–10 AM when testosterone peaks naturally.',
    importance:
      'This is the hormonal baseline plus the two screens (TSH and fasting glucose) that mimic low-T symptoms most often. Without these six, you can’t interpret anything else. With them, you have a reference point for the rest of your life.',
    hormonalImpact:
      'Total T + Free T + SHBG form the hormonal triangle — you can’t read any one without the other two. Vitamin D is required for testosterone production. TSH and glucose rule out thyroid + early metabolic causes of low-T symptoms before assuming the problem is hormonal.',
    improve: [
      'Establishing the baseline IS the action — you can’t improve what you haven’t measured',
      'Always test in the morning, fasted — for fair comparison on re-tests',
      'Re-test in 12 weeks if you change something significant (sleep, training, diet, supplement)',
    ],
  },

  hormonal: {
    measures:
      'The pituitary signals (LH, FSH), the secondary hormones (Prolactin, Estradiol, DHT), and the stress axis (Cortisol AM, DHEA-S). Everything downstream and upstream of testosterone that affects how it works.',
    importance:
      'These tell you WHERE in the system any imbalance sits. Low T with high LH = the testes are failing. Low T with low LH = the brain signal is weak. High prolactin = something’s suppressing the whole loop. Cortisol high = stress is the driver. You can’t fix what you haven’t located.',
    hormonalImpact:
      'This panel covers the full HPG axis — hypothalamus → pituitary → gonads — plus the stress axis that constantly modulates it. The fastest way to a precise diagnosis when the foundational panel shows low T but doesn’t explain why.',
    improve: [
      'Sleep 7–8 hours — most hormonal recovery happens in deep sleep',
      'Lift heavy 2–3× a week — moves testosterone, lowers cortisol',
      'Address chronic stressors at the source (sleep apnea, financial, relational)',
      'Lose visceral fat — it suppresses LH and raises estradiol',
      'Treat any underactive thyroid first — it lowers SHBG and free T',
    ],
  },

  metabolic: {
    measures:
      'HbA1c (3-month sugar average), Fasting Insulin, HOMA-IR (insulin resistance score), Lipid Panel, and IGF-1 (growth hormone marker). Catches metabolic decline years before standard tests do.',
    importance:
      'Insulin resistance is one of the strongest drivers of low T in modern men — it suppresses SHBG, increases the conversion of T to estradiol via belly fat, and worsens sleep. Catching it here gives you years of runway before it becomes a diabetes diagnosis.',
    hormonalImpact:
      'Metabolic health and hormonal health are the same project. Fixing insulin resistance often raises T more than any hormone therapy. Lipids respond visibly within 12 weeks. IGF-1 declines steadily after 30 — tracking it gives you the "biological age" trend.',
    improve: [
      'Walk for 10 minutes after every meal — biggest single lever',
      'Strength training 2× a week — adds the muscle that "parks" glucose',
      'Cut sugar in liquid form (chai, soda, juice)',
      'Protein-first meals — protein and veg before carbs at each meal',
      'Earlier dinner — eating before 7 PM lowers fasting glucose noticeably',
    ],
  },

  nutritional: {
    measures:
      'Iron stores (Ferritin), Vitamin B12, Zinc, and intracellular Magnesium (RBC). The four deficiencies that quietly cause "hormonal" symptoms — fatigue, brain fog, hair loss, poor sleep — when the actual fix is a cheap supplement.',
    importance:
      'Cheap to test, easy to fix. Many men get treated for low T or low thyroid when the real culprit is one of these four. Always rule them out before assuming the symptoms are hormonal.',
    hormonalImpact:
      'Vitamin D is required for testosterone production. Zinc supports T synthesis. Iron is required for thyroid hormone conversion. Magnesium regulates cortisol and supports T. Fix these four first — many "hormonal" complaints resolve on their own.',
    improve: [
      'Vitamin D: sunlight + supplement if needed, aim for 40–80 ng/mL',
      'B12: methylcobalamin 500–1000 µg/day if vegetarian or borderline',
      'Iron: pair plant iron with Vitamin C, avoid tea with iron meals',
      'Zinc: 15 mg/day with food if low; oysters, red meat, pumpkin seeds otherwise',
      'Magnesium: glycinate 200–400 mg before bed — also helps sleep',
    ],
  },

  screening: {
    measures:
      'Full thyroid (T3, T4 on top of TSH), Complete Blood Count (CBC), and PSA (prostate marker for men 40+). Routine checks for systems that quietly drift before symptoms appear.',
    importance:
      'These aren’t for symptoms — they’re for catching things before they become symptoms. T3/T4 catches thyroid conversion issues when TSH alone misses them. CBC catches anaemia + inflammation. PSA gives a prostate baseline.',
    hormonalImpact:
      'Thyroid dysfunction mimics low T almost exactly — and standard TSH-only testing misses conversion problems. Anaemia from any cause secondarily suppresses T. PSA tracks loosely with DHT and prostate health.',
    improve: [
      'These are for early detection — the action is the test itself',
      'Annual cadence is right for most men over 40',
      'PSA: avoid sexual activity 48 hours before the draw (raises it transiently)',
      'Thyroid: iodine and selenium adequacy support both production and conversion',
    ],
  },

  fertility: {
    measures:
      'Semen Analysis — a separate appointment, not a blood draw. Measures sperm count, motility, morphology, and volume. Collected after 2–5 days of abstinence.',
    importance:
      'Fertility runs on two tracks — the hormones telling your testes what to do (LH, FSH, in the Hormonal Panel), and the output itself (this test). Both can be normal while the other is off, which is why a real fertility workup needs both.',
    hormonalImpact:
      'Sperm production depends on testosterone inside the testes (much higher than blood T) plus FSH stimulation. Anything suppressing LH/FSH — including exogenous testosterone — suppresses sperm. Men on TRT typically have very low sperm counts; this is reversible.',
    improve: [
      'Avoid heat — saunas, hot tubs, laptop-on-lap sessions, tight underwear',
      'Antioxidants — Vitamin C, E, zinc, selenium, CoQ10 — support sperm quality',
      'Stop smoking and limit alcohol',
      'If on TRT and trying to conceive — switch to hCG or clomiphene to restart sperm production (with a doctor)',
      'Sperm production takes ~74 days; changes today show up in a re-test 3 months later',
    ],
  },
};

export function getTestInfo(id: string): LearnMore | undefined {
  return testInfo[id];
}
