/**
 * Test-panel-level educational content for the "Learn More" modal on the
 * Recommended Tests page. Keyed by `RecommendedTest.id` from `tests.ts`.
 */

import type { LearnMore } from './markerInfo';

export const testInfo: Record<string, LearnMore> = {
  hormone: {
    measures:
      'A bundle of the five key male hormonal markers: Total Testosterone, Free Testosterone, SHBG, LH/FSH, and Estradiol. Drawn fasted, between 8–10 AM, when testosterone peaks naturally.',
    importance:
      'The single most useful test for any man from his 30s onward. One blood draw tells you your hormonal baseline — production, availability, conversion, signal — in a single picture.',
    hormonalImpact:
      'This panel covers the entire HPG axis in five markers. Each one tells a different part of the story; together they distinguish primary from secondary causes of low T, identify high estradiol, and tell you whether SHBG is the bottleneck.',
    improve: [
      'Establishing the baseline IS the action — you can’t improve what you haven’t measured',
      'Test at the same time of day for fair comparison on re-tests',
      'Re-test in 12 weeks if you change something (sleep, training, diet, supplement) to measure the actual impact',
    ],
  },

  metabolic: {
    measures:
      'HbA1c (3-month sugar average), fasting glucose, fasting insulin, and HOMA-IR. Drawn fasting in the morning. The complete early-warning metabolic picture.',
    importance:
      'Catches insulin resistance years before diabetes shows up on a standard test. For men, this panel is also a hormonal panel in disguise — every marker here suppresses or raises testosterone.',
    hormonalImpact:
      'Insulin resistance is one of the strongest drivers of low T in modern men. It suppresses SHBG, increases the conversion of T to estradiol via belly fat, and worsens sleep. Fixing the metabolic picture often fixes the hormonal one with no T therapy needed.',
    improve: [
      'Walk for 10 minutes after every meal — biggest single lever',
      'Strength training 2× a week — adds the muscle that "parks" glucose',
      'Cut sugar in liquid form (chai, soda, juice)',
      'Protein-first meals — eat protein and vegetables before carbs',
      'Earlier dinner — eating before 7 PM lowers fasting glucose noticeably',
    ],
  },

  lipid: {
    measures:
      'Total cholesterol, LDL, HDL, triglycerides, and Apo-B. The complete cardiovascular risk picture. Drawn fasting.',
    importance:
      'Heart disease is India’s leading cause of death. The lipid panel is the most actionable single piece of cardiac-risk information — every number on it responds to lifestyle within 8–12 weeks.',
    hormonalImpact:
      'Lipid health and hormonal health are linked. The same lifestyle that improves lipids (movement, sleep, less alcohol, less refined carbs) improves testosterone. Statins, when used, do not lower testosterone — that’s a common myth.',
    improve: [
      'Soluble fibre (oats, beans, psyllium) drops LDL fastest',
      'Walk after dinner specifically — lowers triglycerides',
      'Two fistfuls of nuts daily for the long game',
      'Strength training raises HDL',
      'Re-test in 12 weeks if making changes — lipids respond visibly faster than weight does',
    ],
  },

  thyroid: {
    measures:
      'TSH, free T3, free T4 — the three numbers that together tell the full thyroid story. No fasting needed; morning preferred for consistency on re-tests.',
    importance:
      'Thyroid dysfunction mimics low testosterone almost perfectly: fatigue, weight gain, low mood, brain fog, cold hands, hair changes. Many men get treated for low T without ever ruling thyroid out first.',
    hormonalImpact:
      'The thyroid axis runs parallel to the HPG axis with regulatory crosstalk. Low thyroid lowers free T and SHBG. High thyroid raises SHBG. Either direction shifts your testosterone availability.',
    improve: [
      'Iodine adequacy from iodised salt, dairy, seafood',
      'Selenium (200 µg/day from brazil nuts) supports T4 → T3 conversion',
      'Manage stress — cortisol blunts thyroid output',
      'Don’t crash diet — calorie restriction tanks T3 quickly',
      'Eat enough carbs — extreme low-carb diets lower T3',
    ],
  },

  vitamins: {
    measures:
      'Vitamin D (25-OH), Vitamin B12, and Ferritin (iron stores). The three deficiencies that show up most often in Indian men — and most often look like low T or low thyroid.',
    importance:
      'Cheap to test, easy to fix. Most fatigue, mood, and brain-fog complaints have one of these three behind them. Often the first thing to fix before assuming the symptoms are hormonal.',
    hormonalImpact:
      'Vitamin D is required for testosterone production. B12 deficiency mimics low T symptoms exactly. Low iron impairs thyroid hormone conversion. Fix these three first — many "hormonal" complaints resolve on their own.',
    improve: [
      'Vitamin D: sunlight + supplement if needed, aim for 40–80 ng/mL',
      'B12: methylcobalamin 500–1000 µg/day if vegetarian or borderline',
      'Ferritin: pair plant iron with Vitamin C, avoid tea with iron-rich meals, treat any gut absorption issues',
      'Re-test in 8–12 weeks after starting supplements',
    ],
  },

  'liver-kidney': {
    measures:
      'Liver enzymes (ALT, AST, GGT) plus kidney filters (creatinine, eGFR, urea). The "silent organs" check — neither liver nor kidney problems usually have symptoms until they’re advanced.',
    importance:
      'Fatty liver is extremely common in men, mostly silent, and a leading hidden driver of insulin resistance and low T. Kidney decline from diabetes and hypertension is similarly silent for years. An annual baseline catches both before they’re irreversible.',
    hormonalImpact:
      'The liver clears hormones (especially estrogens) and makes SHBG — its health directly shapes your hormonal availability. Stressed kidneys lower testosterone and raise prolactin.',
    improve: [
      'Lose visceral fat — reverses fatty liver faster than anything else',
      'Limit alcohol — the main driver of elevated GGT and ALT',
      'Control blood pressure under 130/80',
      'Stay hydrated — 2–3L daily',
      'Avoid chronic NSAID use — kidney damage is dose-dependent',
    ],
  },
};

export function getTestInfo(id: string): LearnMore | undefined {
  return testInfo[id];
}
