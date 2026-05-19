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
  | 'blood';

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
