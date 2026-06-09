/**
 * Recommendation engine — Part 2 of the ForMen brief.
 *
 * Replaces the old keyword-matching scorer with the explicit rules from the
 * "Quiz → Test Mapping" brief:
 *
 *   1. FOUNDATIONAL panel — every user gets 6 universal markers.
 *   2. SYMPTOMS add specific markers per symptom.
 *   3. PRIORITIES add their own markers (overlap with symptoms naturally dedupes).
 *   4. AGE silently enriches with metabolic / prostate / growth markers.
 *   5. ACTIVITY adds insulin / magnesium / cortisol where the lifestyle implies it.
 *   6. COMBINATIONS of two symptoms unlock targeted extras (the "signature
 *      pattern" rules in the brief).
 *   7. 3+ symptoms → upgrade to Comprehensive (all markers).
 *
 * Output: panels grouped by category (Foundational / Hormonal / Metabolic /
 * Nutritional / Screening / Fertility). The UI (RecommendedTestsPage) consumes
 * the same `RecommendedTest` shape it always did — no rendering changes.
 */

import type { QuizAnswers } from '../AppContext';

/* ------------------------------------------------------------------ */
/* Marker inventory — every marker the system can recommend            */
/* ------------------------------------------------------------------ */

const M = {
  // Foundational
  TOTAL_T: 'Total Testosterone',
  FREE_T: 'Free Testosterone',
  SHBG: 'SHBG',
  VIT_D: 'Vitamin D (25-OH)',
  TSH: 'TSH',
  FASTING_GLUCOSE: 'Fasting Glucose',

  // Hormonal
  LH: 'LH',
  FSH: 'FSH',
  PROLACTIN: 'Prolactin',
  E2: 'Estradiol',
  DHT: 'DHT',
  CORTISOL_AM: 'Cortisol (AM)',
  DHEA_S: 'DHEA-S',

  // Metabolic
  HBA1C: 'HbA1c',
  FASTING_INSULIN: 'Fasting Insulin',
  HOMA_IR: 'HOMA-IR',
  LIPID: 'Lipid Panel',
  IGF1: 'IGF-1',

  // Nutritional
  IRON_FERRITIN: 'Iron / Ferritin',
  B12: 'Vitamin B12',
  ZINC: 'Zinc',
  MAGNESIUM_RBC: 'Magnesium (RBC)',

  // Screening
  T3_T4: 'T3 / T4',
  CBC: 'CBC',
  PSA: 'PSA',

  // Fertility (separate appointment)
  SEMEN: 'Semen Analysis',
} as const;

type Marker = (typeof M)[keyof typeof M];
const ALL_MARKERS: Marker[] = Object.values(M);

/* ------------------------------------------------------------------ */
/* One-liner descriptions for the card UI                              */
/* ------------------------------------------------------------------ */

const ABOUT: Record<Marker, string> = {
  [M.TOTAL_T]: 'Your main male hormone. Drives energy, sex drive, and muscle.',
  [M.FREE_T]: 'The bit of testosterone your body can actually use.',
  [M.SHBG]:
    'A protein that decides how much testosterone gets used vs. wasted.',
  [M.VIT_D]:
    'The sunshine vitamin. Most Indian men are low — affects mood, energy, immunity.',
  [M.TSH]: 'Your brain’s message to the thyroid. Sets your overall pace.',
  [M.FASTING_GLUCOSE]: 'Your blood sugar this morning, before breakfast.',

  [M.LH]: 'A signal from your brain telling your testes to make testosterone.',
  [M.FSH]: 'A signal from your brain telling your testes to make sperm.',
  [M.PROLACTIN]:
    'When too high, it quietly shuts down the testosterone system.',
  [M.E2]:
    'The estrogen your body makes from testosterone. Men need a little, not a lot.',
  [M.DHT]: 'A stronger form of testosterone. Drives male hair loss.',
  [M.CORTISOL_AM]:
    'Your stress hormone. The more stressed you are, the less testosterone gets made.',
  [M.DHEA_S]:
    'A backup hormone that helps you handle stress. Drops when you’re burned out.',

  [M.HBA1C]: 'Your average blood sugar over the last 3 months.',
  [M.FASTING_INSULIN]:
    'How hard your pancreas is working to keep sugar normal.',
  [M.HOMA_IR]: 'A simple score showing how well your body listens to insulin.',
  [M.LIPID]:
    'Cholesterol and fats in your blood. Tells you how clear your arteries are.',
  [M.IGF1]: 'A growth-hormone marker. Naturally drops with age.',

  [M.IRON_FERRITIN]:
    'Your iron stores. Low iron means low energy, slower hair growth.',
  [M.B12]: 'Fuel for your brain and nerves. Often low in vegetarian diets.',
  [M.ZINC]:
    'Mineral needed to make testosterone. Often depleted, easy to top up.',
  [M.MAGNESIUM_RBC]:
    'Sleep, stress, and muscle mineral. Most men don’t get enough.',

  [M.T3_T4]:
    'The full thyroid picture, when the simple thyroid test isn’t enough.',
  [M.CBC]: 'A general blood health check — red cells, white cells, platelets.',
  [M.PSA]: 'A prostate health marker. Worth a baseline reading after 40.',

  [M.SEMEN]: 'How healthy your sperm are. The actual fertility output test.',
};

/* ------------------------------------------------------------------ */
/* Rule sets                                                            */
/* ------------------------------------------------------------------ */

/** Every user gets these — the universal hormonal baseline. */
const FOUNDATIONAL: Marker[] = [
  M.TOTAL_T,
  M.FREE_T,
  M.SHBG,
  M.VIT_D,
  M.TSH,
  M.FASTING_GLUCOSE,
];

/** Per-symptom markers (from PDF pages 2–3). */
const SYMPTOM_ADDS: Record<string, Marker[]> = {
  'low-energy': [M.CBC, M.IRON_FERRITIN, M.HBA1C, M.T3_T4, M.CORTISOL_AM],
  'hair-loss': [M.DHT, M.IRON_FERRITIN, M.T3_T4, M.ZINC],
  'low-libido': [M.PROLACTIN, M.E2, M.LH],
  'belly-fat': [M.E2, M.FASTING_INSULIN, M.HBA1C, M.HOMA_IR, M.LIPID],
  'brain-fog': [M.CORTISOL_AM, M.T3_T4, M.HBA1C, M.IRON_FERRITIN, M.B12],
  'poor-sleep': [M.CORTISOL_AM, M.T3_T4, M.MAGNESIUM_RBC, M.HBA1C],
  'low-mood': [M.CORTISOL_AM, M.T3_T4, M.B12, M.PROLACTIN],
  stress: [M.CORTISOL_AM, M.DHEA_S, M.MAGNESIUM_RBC],
  'difficulty-in-bed': [
    M.PROLACTIN,
    M.E2,
    M.LH,
    M.LIPID,
    M.HBA1C,
    M.FASTING_INSULIN,
  ],
  'fertility-concerns': [M.LH, M.FSH, M.PROLACTIN, M.E2, M.ZINC, M.SEMEN],
  proactive: [M.HBA1C, M.LIPID, M.CBC],
};

/** Per-priority markers (from PDF page 4). */
const PRIORITY_ADDS: Record<string, Marker[]> = {
  sexual: [M.PROLACTIN, M.E2, M.LH],
  'hair-scalp': [M.DHT, M.IRON_FERRITIN, M.ZINC],
  energy: [M.CBC, M.IRON_FERRITIN, M.CORTISOL_AM, M.T3_T4],
  fertility: [M.LH, M.FSH, M.PROLACTIN, M.SEMEN],
  weight: [M.E2, M.FASTING_INSULIN, M.HBA1C, M.HOMA_IR],
  sleep: [M.CORTISOL_AM, M.MAGNESIUM_RBC, M.T3_T4],
  mood: [M.CORTISOL_AM, M.DHEA_S, M.B12, M.PROLACTIN],
  hormonal: [M.LH, M.FSH, M.E2, M.PROLACTIN, M.DHT, M.CORTISOL_AM, M.DHEA_S],
};

/** Age modifiers (from PDF page 5). */
const AGE_ADDS: Record<string, Marker[]> = {
  '18-24': [],
  '25-34': [],
  '35-44': [M.HBA1C, M.LIPID],
  '45-54': [M.PSA, M.HBA1C, M.LIPID],
  '55+': [M.PSA, M.HBA1C, M.LIPID, M.CBC, M.IGF1],
};

/** Activity modifiers (from PDF page 5). */
function activityAdds(
  activity: string | undefined,
  symptoms: string[],
): Marker[] {
  if (!activity) return [];
  if (activity === 'sedentary') return [M.FASTING_INSULIN, M.HOMA_IR];
  if (activity === 'active') {
    return symptoms.includes('poor-sleep') || symptoms.includes('stress')
      ? [M.MAGNESIUM_RBC]
      : [];
  }
  if (activity === 'very-active') return [M.CORTISOL_AM, M.IRON_FERRITIN];
  return [];
}

/** Combination triggers (from PDF page 6). Each fires when BOTH ids are present. */
const COMBO_TRIGGERS: Array<{
  pair: [string, string];
  add: Marker[];
}> = [
  { pair: ['low-energy', 'low-libido'], add: [M.PROLACTIN, M.E2, M.LH] },
  { pair: ['hair-loss', 'low-libido'], add: [M.DHT, M.E2, M.PROLACTIN] },
  {
    pair: ['belly-fat', 'low-energy'],
    add: [M.FASTING_INSULIN, M.HOMA_IR, M.E2],
  },
  {
    pair: ['difficulty-in-bed', 'belly-fat'],
    add: [M.LIPID, M.FASTING_INSULIN, M.HBA1C, M.E2],
  },
  { pair: ['poor-sleep', 'stress'], add: [M.DHEA_S, M.MAGNESIUM_RBC] },
  {
    pair: ['low-libido', 'difficulty-in-bed'],
    add: [
      M.FREE_T,
      M.PROLACTIN,
      M.E2,
      M.LH,
      M.LIPID,
      M.FASTING_INSULIN,
      M.FASTING_GLUCOSE,
    ],
  },
  {
    pair: ['fertility-concerns', 'low-libido'],
    add: [M.PROLACTIN, M.LH, M.FSH, M.SEMEN],
  },
];

/* ------------------------------------------------------------------ */
/* Panel categories — what the user actually sees                       */
/* ------------------------------------------------------------------ */

type PanelCategory = {
  id: string;
  name: string;
  short: string;
  markers: Marker[];
  fasting: boolean;
  turnaround: string;
};

const CATEGORIES: PanelCategory[] = [
  {
    id: 'foundational',
    name: 'The Starter Check',
    short: 'The 6 numbers every man should know',
    markers: [M.TOTAL_T, M.FREE_T, M.SHBG, M.VIT_D, M.TSH, M.FASTING_GLUCOSE],
    fasting: true,
    turnaround: '24 hrs',
  },
  {
    id: 'hormonal',
    name: 'Full Hormone Read',
    short: 'How your hormones talk to each other',
    markers: [M.LH, M.FSH, M.PROLACTIN, M.E2, M.DHT, M.CORTISOL_AM, M.DHEA_S],
    fasting: true,
    turnaround: '24 hrs',
  },
  {
    id: 'metabolic',
    name: 'Sugar & Energy Check',
    short: 'Blood sugar, insulin, cholesterol',
    markers: [M.HBA1C, M.FASTING_INSULIN, M.HOMA_IR, M.LIPID, M.IGF1],
    fasting: true,
    turnaround: '24 hrs',
  },
  {
    id: 'nutritional',
    name: 'Vitamin & Mineral Check',
    short: 'Iron, B12, zinc, magnesium',
    markers: [M.IRON_FERRITIN, M.B12, M.ZINC, M.MAGNESIUM_RBC],
    fasting: false,
    turnaround: '24 hrs',
  },
  {
    id: 'screening',
    name: 'Routine Health Check',
    short: 'Thyroid, blood count, prostate',
    markers: [M.T3_T4, M.CBC, M.PSA],
    fasting: false,
    turnaround: '24 hrs',
  },
  {
    id: 'fertility',
    name: 'Sperm Test',
    short: 'Separate appointment — not a blood draw',
    markers: [M.SEMEN],
    fasting: false,
    turnaround: '3–5 days',
  },
];

/** Which category should jump to position #2 (right after Foundational) given the
 *  user's TOP priority. Foundational always stays first. */
const PRIORITY_TO_LEAD_CATEGORY: Record<string, string> = {
  sexual: 'hormonal',
  'hair-scalp': 'hormonal',
  energy: 'nutritional',
  fertility: 'fertility',
  weight: 'metabolic',
  sleep: 'hormonal',
  mood: 'hormonal',
  hormonal: 'hormonal',
};

/* ------------------------------------------------------------------ */
/* "Why this for you" copy per category                                 */
/* ------------------------------------------------------------------ */

function whyForFoundational(_q: QuizAnswers): string {
  return 'Every man gets this — the hormonal baseline plus the two screens (TSH, fasting glucose) that mimic low-T symptoms most often.';
}

function whyForHormonal(q: QuizAnswers, triggered: Marker[]): string {
  if (q.symptoms.includes('fertility-concerns')) {
    return 'Fertility runs on two tracks — the hormones telling your testes what to do (LH, FSH) and the output itself. This panel covers the signal half.';
  }
  if (
    q.symptoms.includes('low-libido') ||
    q.symptoms.includes('difficulty-in-bed')
  ) {
    return 'Low desire or performance issues usually involve testosterone, prolactin, or estradiol — this panel reads all three.';
  }
  if (q.symptoms.includes('hair-loss') && triggered.includes(M.DHT)) {
    return 'Male hair loss is driven by DHT — the stronger form of testosterone. We measure it directly here.';
  }
  if (
    q.symptoms.includes('stress') ||
    q.symptoms.includes('poor-sleep') ||
    q.symptoms.includes('low-mood')
  ) {
    return 'Cortisol and DHEA-S tell us how hard your stress system is running — and stress directly suppresses testosterone.';
  }
  if (q.priorities.includes('hormonal')) {
    return 'You picked overall hormonal health — this is the complete HPG-axis read in one draw.';
  }
  return 'Pituitary signals + sex hormones tell you where in the HPG axis any imbalance sits.';
}

function whyForMetabolic(q: QuizAnswers): string {
  if (q.symptoms.includes('belly-fat')) {
    return 'Belly weight that won’t budge usually has insulin in the story. Fat tissue also converts testosterone to estrogen — a self-reinforcing cycle.';
  }
  if (q.priorities.includes('weight')) {
    return 'Body composition in men is hormonal — insulin and estrogen levels often explain what diet and exercise don’t.';
  }
  if (q.symptoms.includes('difficulty-in-bed')) {
    return 'Erection quality depends on blood flow. Lipids, insulin, and glucose are the vascular half of the story.';
  }
  if (q.activity === 'sedentary') {
    return 'Sedentary lifestyle is one of the strongest predictors of insulin resistance — and insulin resistance directly suppresses testosterone.';
  }
  if (q.age === '45-54' || q.age === '55+') {
    return 'After 45, metabolic markers shift faster than hormone markers. Annual is the right cadence.';
  }
  return 'Sugar and insulin are the earliest signals of metabolic decline — and they directly suppress testosterone.';
}

function whyForNutritional(q: QuizAnswers): string {
  if (q.symptoms.includes('hair-loss')) {
    return 'Iron and zinc deficiency accelerate male hair loss — cheap to fix once spotted.';
  }
  if (q.symptoms.includes('low-energy') || q.symptoms.includes('brain-fog')) {
    return 'Low energy and brain fog are most often a Vitamin D, B12, or iron deficiency.';
  }
  if (q.symptoms.includes('poor-sleep') || q.symptoms.includes('stress')) {
    return 'Magnesium is the sleep + stress mineral. Most men are short of it without knowing.';
  }
  return 'Cheap to test, easy to fix. Many fatigue and mood complaints have a nutritional cause underneath.';
}

function whyForScreening(_q: QuizAnswers, triggered: Marker[]): string {
  if (triggered.includes(M.PSA)) {
    return 'PSA is a routine prostate check from 40 onward — a simple blood marker, good to have a baseline.';
  }
  if (triggered.includes(M.T3_T4)) {
    return 'When TSH alone isn’t enough — T3 and T4 tell the full thyroid story.';
  }
  if (triggered.includes(M.CBC)) {
    return 'A baseline blood count catches anaemia, inflammation, and immune issues that mimic hormonal symptoms.';
  }
  return 'Routine checks for systems that quietly drift before symptoms appear.';
}

function whyForFertility(_q: QuizAnswers): string {
  return 'Fertility in men runs on two tracks — the hormones telling your testes what to do (LH, FSH) and the output itself. Semen analysis is a separate appointment.';
}

const WHY_FNS: Record<string, (q: QuizAnswers, triggered: Marker[]) => string> =
  {
    foundational: whyForFoundational,
    hormonal: whyForHormonal,
    metabolic: whyForMetabolic,
    nutritional: whyForNutritional,
    screening: whyForScreening,
    fertility: whyForFertility,
  };

/* ------------------------------------------------------------------ */
/* Core engine                                                          */
/* ------------------------------------------------------------------ */

/**
 * Walks the quiz answers and collects every marker that should be ordered.
 * Uses a Set so dedup is implicit — the same marker triggered by multiple
 * paths appears once.
 */
function collectMarkers(q: QuizAnswers): Set<Marker> {
  const markers = new Set<Marker>();

  // 1. Foundational — always
  for (const m of FOUNDATIONAL) markers.add(m);

  // 2. Symptoms
  for (const s of q.symptoms) {
    for (const m of SYMPTOM_ADDS[s] ?? []) markers.add(m);
  }

  // 3. Priorities — additive on top of symptom selections
  for (const p of q.priorities) {
    for (const m of PRIORITY_ADDS[p] ?? []) markers.add(m);
  }

  // 4. Age
  if (q.age) {
    for (const m of AGE_ADDS[q.age] ?? []) markers.add(m);
  }

  // 5. Activity
  for (const m of activityAdds(q.activity, q.symptoms)) markers.add(m);

  // 6. Combinations
  for (const combo of COMBO_TRIGGERS) {
    if (
      q.symptoms.includes(combo.pair[0]) &&
      q.symptoms.includes(combo.pair[1])
    ) {
      for (const m of combo.add) markers.add(m);
    }
  }

  // 7. 3+ symptoms → comprehensive
  if (q.symptoms.length >= 3) {
    for (const m of ALL_MARKERS) markers.add(m);
  }

  return markers;
}

/* ------------------------------------------------------------------ */
/* Public API                                                            */
/* ------------------------------------------------------------------ */

export type RecommendedTest = {
  id: string;
  name: string;
  short: string;
  whyTemplate: (q: QuizAnswers) => string;
  includes: { name: string; about: string }[];
  fasting: boolean;
  turnaround: string;
};

export function recommendTestsFor(q: QuizAnswers): RecommendedTest[] {
  const triggered = collectMarkers(q);
  const triggeredList = Array.from(triggered);

  // Build a panel for every category that has at least one triggered marker.
  const panels: RecommendedTest[] = CATEGORIES.flatMap((cat) => {
    const inCategory = cat.markers.filter((m) => triggered.has(m));
    if (inCategory.length === 0) return [];
    return [
      {
        id: cat.id,
        name: cat.name,
        short: cat.short,
        whyTemplate: (q: QuizAnswers) =>
          (WHY_FNS[cat.id] ?? (() => ''))(q, triggeredList),
        includes: inCategory.map((name) => ({
          name,
          about: ABOUT[name],
        })),
        fasting: cat.fasting,
        turnaround: cat.turnaround,
      },
    ];
  });

  // Ordering: Foundational first, then bump the category mapped from the
  // user's top priority to position #2, then base order for the rest.
  const topPriority = q.priorities[0];
  const leadCategoryId = topPriority
    ? PRIORITY_TO_LEAD_CATEGORY[topPriority]
    : undefined;

  if (leadCategoryId && leadCategoryId !== 'foundational') {
    const leadIdx = panels.findIndex((p) => p.id === leadCategoryId);
    if (leadIdx > 1) {
      const [lead] = panels.splice(leadIdx, 1);
      panels.splice(1, 0, lead);
    }
  }

  return panels;
}
