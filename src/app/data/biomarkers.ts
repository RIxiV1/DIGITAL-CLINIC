export type BiomarkerStatus = 'good' | 'attention' | 'concern';
export type GradientDirection = 'band' | 'up' | 'down';

/** A single prior reading for a marker — ordered earliest → latest, NOT
 *  including the current `value`. Lets the dashboard render trends and
 *  compute deltas without needing multi-report joins. */
export type BiomarkerReading = {
  date: string; // ISO yyyy-mm-dd
  value: number;
};

export type Biomarker = {
  id: string;
  /** The clinical name as it prints on lab reports (e.g. "HbA1c"). */
  name: string;
  /** Plain-English nickname shown under the clinical name on cards
   *  (e.g. "3-month sugar average"). The clinical name stays so users
   *  can match it to what their lab gave them; the nickname is the
   *  on-ramp for people who aren't doctors. */
  simpleName?: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  optimalMin?: number;
  optimalMax?: number;
  status: BiomarkerStatus;
  category: BiomarkerCategoryId;
  /**
   * 'band'  — both ends are bad, middle is healthy (most markers)
   * 'up'    — higher is better (Vit D, HDL, Testosterone)
   * 'down'  — lower is better (LDL, Triglycerides, Glucose)
   */
  direction?: GradientDirection;
  plain: string;
  problemId?: string;
  /** Earlier readings (earliest → latest, exclusive of `value`). */
  history?: BiomarkerReading[];
};

export type BiomarkerCategoryId =
  | 'hormones'
  | 'metabolic'
  | 'heart'
  | 'thyroid'
  | 'vitamins'
  | 'liver'
  | 'kidney'
  | 'blood'
  | 'fertility';

export type BiomarkerCategory = {
  id: BiomarkerCategoryId;
  name: string;
  description: string;
  icon: string;
};

export const categories: BiomarkerCategory[] = [
  {
    id: 'hormones',
    name: 'Hormones',
    description: 'The drivers of energy, drive, muscle.',
    icon: '🔥',
  },
  {
    id: 'metabolic',
    name: 'Metabolic Health',
    description: 'How your body handles sugar and energy.',
    icon: '⚡',
  },
  {
    id: 'heart',
    name: 'Heart Health',
    description: 'Cholesterol and how clear your arteries stay.',
    icon: '❤️',
  },
  {
    id: 'thyroid',
    name: 'Thyroid',
    description: 'Your metabolic thermostat.',
    icon: '🦋',
  },
  {
    id: 'vitamins',
    name: 'Vitamins & Minerals',
    description: 'The little things that quietly run the show.',
    icon: '☀️',
  },
  {
    id: 'liver',
    name: 'Liver',
    description: 'Your main detox organ.',
    icon: '🧪',
  },
  {
    id: 'kidney',
    name: 'Kidney',
    description: 'Your filter — quiet but critical.',
    icon: '💧',
  },
  {
    id: 'blood',
    name: 'Blood',
    description: 'Red cells, oxygen, and immunity basics.',
    icon: '🩸',
  },
  {
    id: 'fertility',
    name: 'Fertility & Andrology',
    description: 'Sperm production, motility, and shape.',
    icon: '🧬',
  },
];

export const sampleBiomarkers: Biomarker[] = [
  {
    id: 'testosterone',
    name: 'Total Testosterone',
    simpleName: 'Your main male hormone',
    value: 280,
    unit: 'ng/dL',
    min: 300,
    max: 1000,
    optimalMin: 600,
    optimalMax: 900,
    status: 'concern',
    category: 'hormones',
    direction: 'up',
    plain:
      'Just below the healthy range. Often felt as low drive, less stamina, harder workouts, slower recovery. The good news: very responsive to sleep, training, and Vitamin D.',
    problemId: 'low-testosterone',
    history: [
      { date: '2026-01-15', value: 302 },
      { date: '2026-03-04', value: 295 },
    ],
  },
  {
    id: 'free-t',
    name: 'Free Testosterone',
    simpleName: 'Testosterone your body can actually use',
    value: 8.4,
    unit: 'pg/mL',
    min: 8.7,
    max: 25.1,
    status: 'attention',
    category: 'hormones',
    direction: 'up',
    plain:
      'This is the testosterone your body can actually use. Yours is just under the line — a small lift here makes a big day-to-day difference.',
    history: [
      { date: '2026-01-15', value: 9.1 },
      { date: '2026-03-04', value: 8.7 },
    ],
  },
  {
    id: 'estradiol',
    name: 'Estradiol',
    simpleName: 'Estrogen (yes, men have it too)',
    value: 28,
    unit: 'pg/mL',
    min: 11,
    max: 44,
    status: 'good',
    category: 'hormones',
    direction: 'band',
    plain: 'A healthy amount of estrogen for a man — keeps mood and joints steady.',
  },
  {
    id: 'hba1c',
    name: 'HbA1c',
    simpleName: '3-month sugar average',
    value: 5.4,
    unit: '%',
    min: 4,
    max: 5.7,
    optimalMin: 4.5,
    optimalMax: 5.3,
    status: 'good',
    category: 'metabolic',
    direction: 'down',
    plain: 'Your average blood sugar over 3 months. Looks great — keep going.',
    history: [
      { date: '2026-01-15', value: 5.4 },
      { date: '2026-03-04', value: 5.4 },
    ],
  },
  {
    id: 'glucose',
    name: 'Fasting Glucose',
    simpleName: 'Blood sugar this morning',
    value: 98,
    unit: 'mg/dL',
    min: 70,
    max: 99,
    optimalMin: 75,
    optimalMax: 90,
    status: 'attention',
    category: 'metabolic',
    direction: 'down',
    plain:
      'Right at the upper edge of normal. A walk after every meal will pull this comfortably down.',
    history: [
      { date: '2026-01-15', value: 95 },
      { date: '2026-03-04', value: 97 },
    ],
  },
  {
    id: 'insulin',
    name: 'Fasting Insulin',
    simpleName: 'How hard your pancreas is working',
    value: 12,
    unit: 'µIU/mL',
    min: 2,
    max: 25,
    optimalMin: 2,
    optimalMax: 8,
    status: 'attention',
    category: 'metabolic',
    direction: 'down',
    plain:
      'Higher than ideal — your pancreas is working overtime. Early sign worth addressing now, while it’s easy.',
    problemId: 'insulin-resistance',
    history: [
      { date: '2026-01-15', value: 11 },
      { date: '2026-03-04', value: 12 },
    ],
  },
  {
    id: 'total-chol',
    name: 'Total Cholesterol',
    simpleName: 'All your cholesterol added together',
    value: 212,
    unit: 'mg/dL',
    min: 0,
    max: 200,
    status: 'attention',
    category: 'heart',
    direction: 'down',
    plain: 'A touch above the line. The LDL number below is the one to focus on.',
  },
  {
    id: 'ldl',
    name: 'LDL Cholesterol',
    simpleName: 'The bad cholesterol',
    value: 145,
    unit: 'mg/dL',
    min: 0,
    max: 100,
    status: 'concern',
    category: 'heart',
    direction: 'down',
    plain:
      'The cholesterol that builds up in artery walls. Yours is meaningfully above ideal — worth bringing down with a 12-week plan.',
    problemId: 'high-ldl',
    history: [
      { date: '2026-01-15', value: 128 },
      { date: '2026-03-04', value: 138 },
    ],
  },
  {
    id: 'hdl',
    name: 'HDL Cholesterol',
    simpleName: 'The good cholesterol',
    value: 48,
    unit: 'mg/dL',
    min: 40,
    max: 100,
    optimalMin: 50,
    optimalMax: 80,
    status: 'good',
    category: 'heart',
    direction: 'up',
    plain: 'Your “good” cholesterol — clears the bad kind. You’re in healthy territory.',
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    simpleName: 'Fat in your blood',
    value: 168,
    unit: 'mg/dL',
    min: 0,
    max: 150,
    status: 'attention',
    category: 'heart',
    direction: 'down',
    plain:
      'Slightly raised. Usually tied to sugar, refined carbs, or alcohol — and very responsive to small changes.',
  },
  {
    id: 'tsh',
    name: 'TSH',
    simpleName: 'Thyroid signal from your brain',
    value: 2.1,
    unit: 'µIU/mL',
    min: 0.4,
    max: 4.5,
    status: 'good',
    category: 'thyroid',
    direction: 'band',
    plain: 'Thyroid signal is in a healthy spot. No concerns here.',
  },
  {
    id: 'vit-d',
    name: 'Vitamin D (25-OH)',
    simpleName: 'Vitamin D',
    value: 26,
    unit: 'ng/mL',
    min: 30,
    max: 100,
    optimalMin: 40,
    optimalMax: 80,
    status: 'concern',
    category: 'vitamins',
    direction: 'up',
    plain:
      'Low. Affects mood, energy, immunity, bone health — and is the single easiest thing to fix on this report.',
    problemId: 'low-vit-d',
    history: [
      { date: '2026-01-15', value: 14 },
      { date: '2026-03-04', value: 18 },
    ],
  },
  {
    id: 'b12',
    name: 'Vitamin B12',
    simpleName: 'Brain and nerve fuel',
    value: 285,
    unit: 'pg/mL',
    min: 200,
    max: 900,
    optimalMin: 500,
    optimalMax: 900,
    status: 'attention',
    category: 'vitamins',
    direction: 'up',
    plain:
      'Technically in range, but lower than what we’d want for sharp thinking and steady energy.',
    history: [
      { date: '2026-01-15', value: 270 },
      { date: '2026-03-04', value: 280 },
    ],
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    simpleName: 'Your iron stores',
    value: 95,
    unit: 'ng/mL',
    min: 30,
    max: 400,
    status: 'good',
    category: 'vitamins',
    direction: 'band',
    plain: 'Iron stores look great. No worries on this front.',
  },
  {
    id: 'alt',
    name: 'ALT',
    simpleName: 'A liver enzyme',
    value: 32,
    unit: 'U/L',
    min: 7,
    max: 56,
    status: 'good',
    category: 'liver',
    direction: 'down',
    plain: 'Liver enzyme in normal range. Liver looks happy.',
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    simpleName: 'How well your kidneys are filtering',
    value: 0.95,
    unit: 'mg/dL',
    min: 0.7,
    max: 1.3,
    status: 'good',
    category: 'kidney',
    direction: 'band',
    plain: 'Kidney filtering measure — comfortably in range.',
  },
  {
    id: 'hb',
    name: 'Hemoglobin',
    simpleName: 'Your blood’s oxygen carrier',
    value: 14.8,
    unit: 'g/dL',
    min: 13.5,
    max: 17.5,
    status: 'good',
    category: 'blood',
    direction: 'band',
    plain: 'Your oxygen-carrying capacity. All good.',
  },
];

export function statusColor(s: BiomarkerStatus) {
  switch (s) {
    case 'good':
      return {
        text: 'text-good',
        bg: 'bg-good-soft',
        dot: 'bg-good',
        label: 'ON TRACK',
      };
    case 'attention':
      return {
        text: 'text-attention',
        bg: 'bg-attention-soft',
        dot: 'bg-attention',
        label: 'NEEDS ATTENTION',
      };
    case 'concern':
      return {
        text: 'text-concern',
        bg: 'bg-concern-soft',
        dot: 'bg-concern',
        label: 'NEEDS CARE',
      };
  }
}

export function biomarkersByCategory(markers: Biomarker[] = sampleBiomarkers) {
  return categories
    .map((c) => ({
      category: c,
      markers: markers.filter((m) => m.category === c.id),
    }))
    .filter((g) => g.markers.length > 0);
}

export function summarizeStatuses(markers: Biomarker[] = sampleBiomarkers) {
  let good = 0;
  let attention = 0;
  let concern = 0;
  for (const m of markers) {
    if (m.status === 'good') good++;
    else if (m.status === 'attention') attention++;
    else concern++;
  }
  return { good, attention, concern, total: markers.length };
}

export function bottomLineFor(markers: Biomarker[] = sampleBiomarkers) {
  const summary = summarizeStatuses(markers);
  const concerns = markers
    .filter((m) => m.status === 'concern')
    .map((m) => m.name);

  let line = '';
  if (summary.concern === 0 && summary.attention === 0) {
    line =
      'Across the board — you’re in great shape. Keep the basics dialled in and re-test in 6 months.';
  } else if (summary.concern === 0) {
    line = `Mostly excellent — ${summary.good} markers on track. The ${summary.attention} flagged as “needs attention” are simple lifestyle nudges, not red flags.`;
  } else if (summary.concern === 1) {
    line = `One thing to act on: ${concerns[0]}. Everything else is on track or close to it — a clean, focused plan is enough to fix it.`;
  } else {
    line = `Two things to focus on: ${concerns.slice(0, 2).join(' and ')}. Both are reversible with the same set of habits — sleep, movement, and a couple of nutrient swaps.`;
  }
  return line;
}

/* ------------------------------------------------------------------ */
/* Trend helpers — power the dashboard's headline + sparklines         */
/* ------------------------------------------------------------------ */

export type TrendDirection = 'up' | 'down' | 'stable';

/** Returns the trend of `value` vs the most recent historical reading,
 *  or null if there's no history. Threshold below is intentionally
 *  small (1% of current value) so jitter doesn't read as "rising". */
export function getTrend(marker: Biomarker): TrendDirection | null {
  if (!marker.history || marker.history.length === 0) return null;
  const prev = marker.history[marker.history.length - 1].value;
  const delta = marker.value - prev;
  const threshold = Math.max(0.5, Math.abs(prev) * 0.01);
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'stable';
}

/** Most recent prior reading, or undefined if no history. */
export function getPreviousValue(marker: Biomarker): number | undefined {
  if (!marker.history || marker.history.length === 0) return undefined;
  return marker.history[marker.history.length - 1].value;
}

/**
 * "Improving" or "declining" judgment that respects the marker's direction:
 * for an "up-is-better" marker (Vit D, Testosterone), going up = improving;
 * for a "down-is-better" marker (LDL, Glucose), going down = improving.
 * For a "band" marker we don't make a value judgment — return 'neutral'.
 */
export type TrendTone = 'improving' | 'declining' | 'stable' | 'neutral';

export function getTrendTone(marker: Biomarker): TrendTone {
  const trend = getTrend(marker);
  if (trend === null) return 'neutral';
  if (trend === 'stable') return 'stable';
  const dir = marker.direction ?? 'band';
  if (dir === 'band') return 'neutral';
  const isUpBetter = dir === 'up';
  if (trend === 'up') return isUpBetter ? 'improving' : 'declining';
  return isUpBetter ? 'declining' : 'improving';
}

/** Picks the marker whose trend is most newsworthy for the headline —
 *  largest declining concern wins, else largest declining attention,
 *  else largest improving marker, else null. */
export function pickHeadlineMarker(
  markers: Biomarker[],
): Biomarker | null {
  const withHistory = markers.filter((m) => getTrend(m) !== null);
  if (withHistory.length === 0) return null;

  const decliningConcerns = withHistory.filter(
    (m) => m.status === 'concern' && getTrendTone(m) === 'declining',
  );
  if (decliningConcerns.length > 0) {
    return decliningConcerns.sort(
      (a, b) =>
        Math.abs(b.value - (getPreviousValue(b) ?? 0)) -
        Math.abs(a.value - (getPreviousValue(a) ?? 0)),
    )[0];
  }
  const decliningAttention = withHistory.filter(
    (m) => m.status === 'attention' && getTrendTone(m) === 'declining',
  );
  if (decliningAttention.length > 0) return decliningAttention[0];

  const improving = withHistory.filter(
    (m) => getTrendTone(m) === 'improving',
  );
  if (improving.length > 0) return improving[0];

  return null;
}

/** "+22" / "-12" / "0" formatted for display. */
export function formatDelta(marker: Biomarker): string | null {
  const prev = getPreviousValue(marker);
  if (prev === undefined) return null;
  const delta = marker.value - prev;
  const rounded = Math.abs(delta) < 1 ? delta.toFixed(1) : Math.round(delta).toString();
  if (delta > 0) return `+${rounded}`;
  return rounded;
}

/* ================================================================== */
/* Biomarker catalog — reference shapes the parser extracts INTO        */
/*                                                                      */
/* `sampleBiomarkers` above is for the demo. This catalog is the list   */
/* of biomarker SHAPES the upload parser knows about. Each entry holds  */
/* the clinical metadata (unit, healthy range, optimal sub-band,        */
/* direction, plain-English explanation) plus an `aliases` array of     */
/* lab-report strings the parser will match against extracted text.     */
/*                                                                      */
/* When the parser finds a match in a PDF, it calls                     */
/* `markerFromTemplate(template, extractedValue)` to construct a fully- */
/* typed Biomarker (with computed status) for the results screen.       */
/* ================================================================== */

export type BiomarkerTemplate = {
  id: string;
  /** Canonical name shown in the UI. */
  name: string;
  /** Lab-report strings the parser will match against extracted text.
   *  Include every spelling/casing variant likely to appear in real
   *  reports — the parser does a case-insensitive contains() over each. */
  aliases: readonly string[];
  unit: string;
  /** Optional unit-spelling variants (e.g. 'mg/dl', 'mg/dL', 'MG/DL').
   *  Useful for confirming a numeric match isn't from an unrelated
   *  line — the parser cross-checks the unit token near the value. */
  unitAliases?: readonly string[];
  min: number;
  max: number;
  optimalMin?: number;
  optimalMax?: number;
  category: BiomarkerCategoryId;
  direction?: GradientDirection;
  simpleName?: string;
  plain: string;
  problemId?: string;
};

/**
 * Derive a status from a measured value against a template's healthy
 * range + optional optimal sub-band.
 *
 *   value outside [min, max]          → 'concern'
 *   value inside [min, max] but
 *     outside [optimalMin, optimalMax] → 'attention'
 *   value inside the optimal band     → 'good'
 *
 * For templates without an optimal sub-band, anything inside the
 * healthy range is 'good'.
 */
export function statusForValue(
  template: BiomarkerTemplate,
  value: number,
): BiomarkerStatus {
  if (value < template.min || value > template.max) return 'concern';
  if (
    typeof template.optimalMin === 'number' &&
    typeof template.optimalMax === 'number' &&
    (value < template.optimalMin || value > template.optimalMax)
  ) {
    return 'attention';
  }
  return 'good';
}

/**
 * Construct a fully-typed Biomarker from a catalog template plus a
 * measured value. Used by the parser when it pulls a value out of an
 * uploaded report.
 */
export function markerFromTemplate(
  template: BiomarkerTemplate,
  value: number,
): Biomarker {
  return {
    id: template.id,
    name: template.name,
    simpleName: template.simpleName,
    value,
    unit: template.unit,
    min: template.min,
    max: template.max,
    optimalMin: template.optimalMin,
    optimalMax: template.optimalMax,
    status: statusForValue(template, value),
    category: template.category,
    direction: template.direction,
    plain: template.plain,
    problemId: template.problemId,
  };
}

/**
 * The catalog itself. Order matters only for tie-breaking: when a PDF
 * line could match multiple templates (e.g. "Testosterone" matches both
 * Total T and Free T), the parser picks the first hit. List the more-
 * specific aliases ("Total Testosterone") before the broader ones
 * inside each template, AND order the templates so the more-specific
 * marker appears first.
 */
export const biomarkerCatalog: readonly BiomarkerTemplate[] = [
  /* ---- Hormones ------------------------------------------------- */
  {
    id: 'testosterone',
    name: 'Total Testosterone',
    aliases: ['Total Testosterone', 'Testosterone Total', 'Testosterone, Total', 'Testosterone'],
    unit: 'ng/dL',
    unitAliases: ['ng/dl', 'ng / dL'],
    min: 300, max: 1000, optimalMin: 600, optimalMax: 900,
    category: 'hormones', direction: 'up',
    simpleName: 'Your main male hormone',
    plain: 'Below the healthy range often shows up as low drive, less stamina, and slower recovery. Very responsive to sleep, training, and Vitamin D.',
    problemId: 'low-testosterone',
  },
  {
    id: 'free-t',
    name: 'Free Testosterone',
    aliases: ['Free Testosterone', 'Testosterone Free', 'Free T'],
    unit: 'pg/mL',
    unitAliases: ['pg/ml'],
    min: 8.7, max: 25.1,
    category: 'hormones', direction: 'up',
    simpleName: 'Testosterone your body can actually use',
    plain: 'The testosterone your body can actually use. Even a small lift here makes a noticeable daily difference.',
  },
  {
    id: 'estradiol',
    name: 'Estradiol',
    aliases: ['Estradiol', 'E2', 'Estradiol (E2)'],
    unit: 'pg/mL', unitAliases: ['pg/ml'],
    min: 11, max: 44,
    category: 'hormones', direction: 'band',
    simpleName: 'Estrogen (yes, men have it too)',
    plain: 'A healthy amount of estrogen for a man keeps mood and joints steady.',
  },

  /* ---- Metabolic ----------------------------------------------- */
  {
    id: 'hba1c',
    name: 'HbA1c',
    aliases: ['HbA1c', 'A1c', 'Hemoglobin A1c', 'Glycated Hemoglobin', 'Glycohemoglobin'],
    unit: '%',
    min: 4, max: 5.7, optimalMin: 4.5, optimalMax: 5.3,
    category: 'metabolic', direction: 'down',
    simpleName: '3-month sugar average',
    plain: 'Your average blood sugar over 3 months. Below 5.7% is healthy; the optimal band is tighter still.',
  },
  {
    id: 'glucose',
    name: 'Fasting Glucose',
    aliases: ['Fasting Glucose', 'Glucose Fasting', 'Glucose, Fasting', 'Fasting Blood Sugar', 'FBS'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 70, max: 99, optimalMin: 75, optimalMax: 90,
    category: 'metabolic', direction: 'down',
    simpleName: 'Blood sugar this morning',
    plain: 'A walk after every meal pulls a borderline reading comfortably back down.',
  },
  {
    id: 'insulin',
    name: 'Fasting Insulin',
    aliases: ['Fasting Insulin', 'Insulin Fasting', 'Insulin, Fasting'],
    unit: 'µIU/mL', unitAliases: ['uIU/mL', 'mIU/L', 'µIU/ml'],
    min: 2, max: 25, optimalMin: 2, optimalMax: 8,
    category: 'metabolic', direction: 'down',
    simpleName: 'How hard your pancreas is working',
    plain: 'Higher than ideal means the pancreas is working overtime — an early sign worth addressing while it’s still easy.',
    problemId: 'insulin-resistance',
  },

  /* ---- Heart --------------------------------------------------- */
  {
    id: 'total-chol',
    name: 'Total Cholesterol',
    aliases: ['Total Cholesterol', 'Cholesterol Total', 'Cholesterol, Total', 'Cholesterol'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 200,
    category: 'heart', direction: 'down',
    simpleName: 'All your cholesterol added together',
    plain: 'The number to focus on inside total cholesterol is LDL below.',
  },
  {
    id: 'ldl',
    name: 'LDL Cholesterol',
    aliases: ['LDL Cholesterol', 'LDL-C', 'LDL', 'Cholesterol LDL'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 100,
    category: 'heart', direction: 'down',
    simpleName: 'The bad cholesterol',
    plain: 'The cholesterol that builds up in artery walls. Meaningfully above ideal is worth a 12-week plan.',
    problemId: 'high-ldl',
  },
  {
    id: 'hdl',
    name: 'HDL Cholesterol',
    aliases: ['HDL Cholesterol', 'HDL-C', 'HDL', 'Cholesterol HDL'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 40, max: 100, optimalMin: 50, optimalMax: 80,
    category: 'heart', direction: 'up',
    simpleName: 'The good cholesterol',
    plain: 'Your “good” cholesterol — clears the bad kind.',
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    aliases: ['Triglycerides', 'TG'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 150,
    category: 'heart', direction: 'down',
    simpleName: 'Fat in your blood',
    plain: 'Usually tied to sugar, refined carbs, or alcohol — very responsive to small changes.',
  },

  /* ---- Thyroid ------------------------------------------------- */
  {
    id: 'tsh',
    name: 'TSH',
    aliases: ['TSH', 'Thyroid Stimulating Hormone', 'Thyrotropin'],
    unit: 'µIU/mL', unitAliases: ['uIU/mL', 'mIU/L'],
    min: 0.4, max: 4.5,
    category: 'thyroid', direction: 'band',
    simpleName: 'Thyroid signal from your brain',
    plain: 'Thyroid signal — both ends carry meaning, so the band shape matters here.',
  },

  /* ---- Vitamins & Minerals ------------------------------------- */
  {
    id: 'vit-d',
    name: 'Vitamin D (25-OH)',
    aliases: ['Vitamin D', '25-OH Vitamin D', '25-Hydroxyvitamin D', 'Vitamin D 25-OH', 'Vitamin D, 25-OH', '25(OH)D'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 30, max: 100, optimalMin: 40, optimalMax: 80,
    category: 'vitamins', direction: 'up',
    simpleName: 'Vitamin D',
    plain: 'Affects mood, energy, immunity, bone health — and is the single easiest thing to fix on most reports.',
    problemId: 'low-vit-d',
  },
  {
    id: 'b12',
    name: 'Vitamin B12',
    aliases: ['Vitamin B12', 'B12', 'Cobalamin'],
    unit: 'pg/mL', unitAliases: ['pg/ml'],
    min: 200, max: 900, optimalMin: 500, optimalMax: 900,
    category: 'vitamins', direction: 'up',
    simpleName: 'Brain and nerve fuel',
    plain: 'Technically in range below the optimum, but lower than ideal for sharp thinking and steady energy.',
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    aliases: ['Ferritin'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 30, max: 400,
    category: 'vitamins', direction: 'band',
    simpleName: 'Your iron stores',
    plain: 'Iron stores — band-shaped because both deficiency and overload carry risk.',
  },

  /* ---- Liver / Kidney / Blood ---------------------------------- */
  {
    id: 'alt',
    name: 'ALT',
    aliases: ['ALT', 'SGPT', 'Alanine Aminotransferase'],
    unit: 'U/L', unitAliases: ['u/l', 'IU/L'],
    min: 7, max: 56,
    category: 'liver', direction: 'down',
    simpleName: 'A liver enzyme',
    plain: 'Elevated ALT usually means the liver is stressed — sometimes by alcohol, sometimes by metabolic load.',
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    aliases: ['Creatinine', 'Serum Creatinine'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0.7, max: 1.3,
    category: 'kidney', direction: 'band',
    simpleName: 'How well your kidneys are filtering',
    plain: 'Kidney filtering measure — both extremes carry meaning.',
  },
  {
    id: 'hb',
    name: 'Hemoglobin',
    aliases: ['Hemoglobin', 'Haemoglobin', 'Hb'],
    unit: 'g/dL', unitAliases: ['g/dl', 'gm/dL', 'gm/dl'],
    min: 13.5, max: 17.5,
    category: 'blood', direction: 'band',
    simpleName: 'Your blood’s oxygen carrier',
    plain: 'Oxygen-carrying capacity. Both anaemia and very high counts matter clinically.',
  },

  /* ---- Fertility & Andrology (semen analysis) ------------------
   * Reference values updated to the WHO Laboratory Manual for the
   * Examination of Human Semen, 6th edition (2021). Differences from
   * the older WHO 2010 reference, which many older lab reports still
   * cite:
   *
   *   Marker                  WHO 2010   WHO 2021
   *   Sample volume (ml)      ≥1.5       ≥1.4
   *   Sperm density (M/ml)    ≥15        ≥16
   *   Total motility (%)      ≥40        ≥42
   *   Progressive (%)         ≥32        ≥30  (LOWERED)
   *   Morphology (%)          ≥4         ≥4   (unchanged)
   *   Total count (M)         ≥39        ≥39  (unchanged)
   *
   * If a user uploads an older report graded against WHO 2010, the
   * lab's "borderline / low" verdicts may disagree with ours — that's
   * a real interpretive difference, not a bug. The plain-English copy
   * notes the standard so users can reconcile.
   */
  {
    id: 'semen-volume',
    name: 'Semen volume',
    aliases: ['Sample volume', 'Semen volume', 'Volume', 'Ejaculate volume'],
    unit: 'ml', unitAliases: ['mL', 'ML'],
    min: 1.4, max: 6,
    category: 'fertility', direction: 'up',
    simpleName: 'How much semen per sample',
    plain: 'WHO 2021 reference is ≥1.4 ml. Below that may suggest a blockage or hormonal issue; most samples land between 2–5 ml.',
  },
  {
    id: 'semen-ph',
    name: 'pH',
    aliases: ['pH', 'Semen pH', 'pH value'],
    unit: '',
    min: 7.2, max: 8.0,
    category: 'fertility', direction: 'band',
    simpleName: 'How acidic/alkaline the sample is',
    plain: 'Healthy semen is slightly alkaline (7.2–8.0). Values outside the band can suggest infection or blocked ducts.',
  },
  {
    id: 'sperm-density',
    name: 'Sperm density',
    aliases: ['Density (million per ml)', 'Sperm concentration', 'Sperm density', 'Concentration'],
    unit: 'million/ml', unitAliases: ['M/ml', 'million per ml', '10^6/ml', 'x10^6/mL'],
    min: 16, max: 200,
    category: 'fertility', direction: 'up',
    simpleName: 'Sperm per milliliter of semen',
    plain: 'WHO 2021 reference is ≥16 million/ml. Below that is oligospermia; most fertile men show 40–200 million/ml.',
  },
  {
    id: 'sperm-total-count',
    name: 'Total sperm count',
    aliases: ['Total count (million)', 'Total sperm count', 'Total count'],
    unit: 'million', unitAliases: ['M', '10^6'],
    min: 39, max: 500,
    category: 'fertility', direction: 'up',
    simpleName: 'Total sperm in the whole sample',
    plain: 'WHO 2021 reference is ≥39 million. Higher counts give more swimmers per shot.',
  },
  {
    id: 'sperm-motility-total',
    name: 'Total motility',
    aliases: ['Total motility %', 'Total motility', 'Motility'],
    unit: '%',
    min: 42, max: 100,
    category: 'fertility', direction: 'up',
    simpleName: '% of sperm that move at all',
    plain: 'WHO 2021 reference is ≥42%. Below that is asthenospermia — sperm need to move enough to reach an egg.',
  },
  {
    id: 'sperm-motility-progressive',
    name: 'Progressive motility',
    aliases: ['Progressive', 'Progressive motility', 'Forward motility'],
    unit: '%',
    min: 30, max: 100,
    category: 'fertility', direction: 'up',
    simpleName: '% of sperm swimming forward',
    plain: 'WHO 2021 reference is ≥30% (down from 32% in WHO 2010). Sperm need to swim forward, not in circles.',
  },
  {
    id: 'sperm-immotile',
    name: 'Immotile',
    aliases: ['Immotile', 'Immotile %', 'Non-motile'],
    unit: '%',
    min: 0, max: 60,
    category: 'fertility', direction: 'down',
    simpleName: '% of sperm not moving at all',
    plain: 'Up to 60% can be immotile in a healthy sample. Above that suggests motility problems.',
  },
  {
    id: 'sperm-morphology',
    name: 'Morphology',
    aliases: ['Morphology %', 'Morphology', 'Normal forms', 'Normal morphology'],
    unit: '%',
    min: 4, max: 100,
    category: 'fertility', direction: 'up',
    simpleName: '% of sperm with normal shape',
    plain: 'WHO 2021 reference is ≥4% normal forms (unchanged from WHO 2010). Sperm shape matters for successful fertilization.',
  },
];

/**
 * Find a template by id. Used by tests, the parser fallback, and any
 * surface that wants to render a known marker shape without a value
 * (e.g. "here's what we'd test").
 */
export function getTemplateById(id: string): BiomarkerTemplate | undefined {
  return biomarkerCatalog.find((t) => t.id === id);
}
