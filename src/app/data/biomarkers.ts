/**
 * Four-tier clinical status:
 *
 *   'good'      — inside the optimal sub-band (or healthy range when no
 *                  optimal is set). Re-test on schedule.
 *   'attention' — inside healthy but outside optimal. Informational; not
 *                  a clinical concern. UI tones this down vs 'concern'.
 *   'concern'   — outside healthy but within a clinically-reasonable
 *                  abnormal range. Worth a follow-up; not urgent.
 *   'critical'  — far enough outside healthy that the value's magnitude
 *                  is itself a clinical signal (e.g. glucose >250 mg/dL,
 *                  platelets <50,000, potassium >6.5 mEq/L). UI surfaces
 *                  a same-day-care prompt rather than the 12-week plan
 *                  copy used for 'concern'. Triggered when the value
 *                  falls outside [min - 2*span, max + 2*span] OR outside
 *                  the explicit `criticalLow`/`criticalHigh` band on the
 *                  template, whichever is tighter.
 *
 * The fourth tier was added in response to a clinical-trust audit: the
 * old three-tier system collapsed `platelet 149k` (mild thrombocytopenia,
 * no action) and `platelet 30k` (immediate bleeding risk) into the same
 * 'concern' bucket with identical copy.
 */
export type BiomarkerStatus = 'good' | 'attention' | 'concern' | 'critical';
type GradientDirection = 'band' | 'up' | 'down';

/** A single prior reading for a marker — ordered earliest → latest, NOT
 *  including the current `value`. Lets the dashboard render trends and
 *  compute deltas without needing multi-report joins. */
export type BiomarkerReading = {
  date: string; // ISO yyyy-mm-dd
  value: number;
};

/**
 * Where an optimal sub-range comes from. Required (by convention) on
 * any template that sets `optimalMin`/`optimalMax` — un-cited optimal
 * ranges read as a synthetic score and erode trust in everything else
 * on the report. The label is short enough to render inline; the URL
 * is optional but strongly preferred so users can verify.
 *
 * Audience: when an optimal range only applies to a subset (e.g. adult
 * men, age 18-65), specify it here so the UI can disclose the scope of
 * the claim. Undefined audience defaults to "adults" in the render.
 */
export type OptimalSource = {
  label: string;
  url?: string;
  audience?: string;
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
  /** Citation for the optimal range, propagated from the catalog
   *  template. Rendered as a small footnote under "What this means"
   *  on the BiomarkerBar's expanded view. Undefined when the marker
   *  has no optimal sub-range (no claim to source). */
  optimalSource?: OptimalSource;
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
  /** Catalog version this reading was stamped with at write time.
   *  `mergeHistoryFromPriorReports` uses it to refuse to merge readings
   *  written against an old catalog version into a new template — see
   *  CATALOG_VERSION + reports.ts:mergeHistoryFromPriorReports. Optional
   *  for backward compat with reports persisted before the field
   *  existed. */
  catalogVersion?: number;
  /** The reference range the LAB itself printed next to this value, if
   *  the parser was able to read it. Surfaced in the UI alongside the
   *  catalog's healthy/optimal bands so a user uploading an older
   *  report (e.g. WHO 2010 semen criteria, pre-ADA-2024 A1c thresholds)
   *  sees BOTH the lab's interpretive context AND ours — preventing
   *  the "lab said normal, app says concern" trust break. The catalog
   *  is still the source of truth for the status tier; this is a
   *  display-only field that anchors the user back to the document. */
  labRefMin?: number;
  labRefMax?: number;
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
  | 'fertility'
  | 'electrolytes'
  | 'inflammation';

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
  {
    id: 'electrolytes',
    name: 'Electrolytes',
    description: 'Salts that keep your nerves, heart, and fluid balance running.',
    icon: '⚖️',
  },
  {
    id: 'inflammation',
    name: 'Inflammation',
    description: 'How calm — or not — your immune system is.',
    icon: '🔥',
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
    optimalSource: {
      label: 'Endocrine Society 2018 hypogonadism guideline + Travison 2017 quartile data',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men 18–65',
    },
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
    optimalSource: {
      label: 'ARIC cohort all-cause mortality data; ADA prediabetes threshold is 5.7%',
      url: 'https://diabetesjournals.org/care/article/33/4/834',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Tirosh et al., NEJM 2005 — lowest CVD risk in the 81–87 mg/dL band',
      url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa050080',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Kraft fasting-insulin work; <8 µIU/mL strongly associated with insulin sensitivity',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Framingham Heart Study cardioprotective range; very-high HDL >80 shows U-shaped mortality (Madsen et al., EHJ 2017)',
      url: 'https://academic.oup.com/eurheartj/article/38/32/2478/3920193',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Endocrine Society 2011 clinical practice guideline (Holick et al.)',
      url: 'https://academic.oup.com/jcem/article/96/7/1911/2833671',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Tucker et al., AJCN 2000 — neurological correlates emerge below 350 pg/mL',
      url: 'https://academic.oup.com/ajcn/article/71/2/514/4729084',
      audience: 'adults',
    },
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
        // "BORDERLINE" replaces the older "NEEDS ATTENTION". Same data
        // class, shorter glyph (BORDERLINE = 10 chars vs NEEDS ATTENTION
        // = 15) so it fits better in compact card badges, and softer
        // for an anxious health-data context — describes the value's
        // position relative to the range instead of issuing a triage
        // verb. The filter-pill label uses the same "Borderline" in
        // title case (see STATUS_FILTER_OPTIONS).
        label: 'BORDERLINE',
      };
    case 'concern':
      return {
        text: 'text-concern',
        bg: 'bg-concern-soft',
        dot: 'bg-concern',
        // Badge keeps "NEEDS CARE" — compact (10 chars) and clinically
        // honest about urgency. The corresponding filter-pill label
        // softens to "Worth a check-in" because the chooser surface
        // has room for a verbose action-oriented phrase.
        label: 'NEEDS CARE',
      };
    case 'critical':
      return {
        // Inverted treatment vs concern: solid fill, white text,
        // alert-icon adjacent. This is the only tier where same-day
        // action is the right user reading, so we deliberately break
        // visual parity with the other tiers — the user should NOT
        // experience "critical" as a louder version of "concern".
        text: 'text-white',
        bg: 'bg-concern',
        dot: 'bg-concern',
        label: 'SEE A DOCTOR',
      };
  }
}

/** ID type for filter chooser surfaces (status filter pills + sidebars).
 *  Includes the 'all' bucket alongside the three real statuses. */
export type StatusFilterId = 'all' | BiomarkerStatus;

/** Single source of truth for the status-filter chooser pills.
 *
 *  Consumed by HomePage's "See all markers" disclosure and
 *  ReportResultsPage's mobile + desktop filter surfaces — three call
 *  sites that used to maintain three identical inline arrays, with
 *  predictable drift when one was updated and the others weren't.
 *
 *  Vocabulary is deliberately softer than the badge labels above. A
 *  filter pill is a chooser, not a diagnostic — "Worth a check-in" /
 *  "Borderline" frame the same statuses as action categories instead
 *  of triage tags, which read better to anxious users browsing their
 *  own data. The badge labels (`statusColor().label`) keep their
 *  clinical caps treatment because that's where the brain expects a
 *  compact status signal. */
export const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  id: StatusFilterId;
  label: string;
}> = [
  { id: 'all', label: 'All markers' },
  { id: 'critical', label: 'See a doctor' },
  { id: 'concern', label: 'Worth a check-in' },
  { id: 'attention', label: 'Borderline' },
  { id: 'good', label: 'On track' },
];

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
  let critical = 0;
  for (const m of markers) {
    if (m.status === 'good') good++;
    else if (m.status === 'attention') attention++;
    else if (m.status === 'critical') critical++;
    else concern++;
  }
  return { good, attention, concern, critical, total: markers.length };
}

export function bottomLineFor(markers: Biomarker[] = sampleBiomarkers) {
  const summary = summarizeStatuses(markers);
  const criticals = markers
    .filter((m) => m.status === 'critical')
    .map((m) => m.name);
  const concerns = markers
    .filter((m) => m.status === 'concern')
    .map((m) => m.name);

  // Critical takes precedence over every other framing — same-day
  // action copy supersedes the 12-week-plan tone we use for 'concern'.
  if (summary.critical > 0) {
    if (summary.critical === 1) {
      return `${criticals[0]} is in a range where same-day medical attention is appropriate. Don't wait for the follow-up — call a doctor today.`;
    }
    return `${summary.critical} markers (${criticals.slice(0, 2).join(', ')}${summary.critical > 2 ? ', …' : ''}) are in ranges where same-day medical attention is appropriate. Don't wait — call a doctor today.`;
  }

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
/* Cleared-status helper — celebrates the "fixed" case in the UI       */
/* ------------------------------------------------------------------ */

/**
 * `true` when the marker's most recent prior reading was 'attention',
 * 'concern' or 'critical' AND the current reading is 'good'. Used by
 * the dashboard to surface "you fixed it!" copy on markers that have
 * crossed back into the optimal band — without this, an improvement
 * gets visually indistinguishable from a marker that's always been
 * fine.
 *
 * Does NOT mutate status. This is a transient UI-only derivation;
 * persistence treats the current reading as 'good' like any other.
 */
export function isClearedSinceLast(marker: Biomarker): boolean {
  if (marker.status !== 'good') return false;
  if (!marker.history || marker.history.length === 0) return false;
  // We don't store prior status; re-derive it by running statusForValue
  // against the catalog template that produced this marker. Walk the
  // catalog for the template — at this layer we have a Biomarker, not
  // its template, but we can rebuild a synthetic template from the
  // current marker's bounds (which were copied from the template at
  // markerFromTemplate time).
  const lastReading = marker.history[marker.history.length - 1];
  const synthetic: BiomarkerTemplate = {
    id: marker.id,
    name: marker.name,
    aliases: [],
    unit: marker.unit,
    min: marker.min,
    max: marker.max,
    optimalMin: marker.optimalMin,
    optimalMax: marker.optimalMax,
    category: marker.category,
    plain: '',
  };
  const priorStatus = statusForValue(synthetic, lastReading.value);
  return priorStatus !== 'good';
}

/* ------------------------------------------------------------------ */
/* Trend helpers — power the dashboard's headline + sparklines         */
/* ------------------------------------------------------------------ */

type TrendDirection = 'up' | 'down' | 'stable';

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
type TrendTone = 'improving' | 'declining' | 'stable' | 'neutral';

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

  // Largest-magnitude change wins inside each tier — previously only
  // decliningConcerns was sorted, while the attention + improving
  // fallbacks used raw array order. That made the headline pick depend
  // on biomarker-catalog ordering rather than clinical significance.
  const byAbsDelta = (a: Biomarker, b: Biomarker): number =>
    Math.abs(b.value - (getPreviousValue(b) ?? 0)) -
    Math.abs(a.value - (getPreviousValue(a) ?? 0));

  // Critical takes priority: a same-day-care reading must headline,
  // regardless of trend direction. Even a `critical` value with no
  // history points to the headline so the dashboard surfaces the
  // most-urgent reading first.
  const criticals = withHistory.filter((m) => m.status === 'critical');
  if (criticals.length > 0) {
    return criticals.slice().sort(byAbsDelta)[0];
  }
  // No-history fallback: prefer any critical marker even when it
  // doesn't have prior readings to trend against.
  // (Caller has filtered to withHistory; this is documented intent for
  // future expansion if we ever surface no-history criticals here.)

  const decliningConcerns = withHistory.filter(
    (m) => m.status === 'concern' && getTrendTone(m) === 'declining',
  );
  if (decliningConcerns.length > 0) {
    return decliningConcerns.slice().sort(byAbsDelta)[0];
  }
  const decliningAttention = withHistory.filter(
    (m) => m.status === 'attention' && getTrendTone(m) === 'declining',
  );
  if (decliningAttention.length > 0) {
    return decliningAttention.slice().sort(byAbsDelta)[0];
  }

  const improving = withHistory.filter(
    (m) => getTrendTone(m) === 'improving',
  );
  if (improving.length > 0) {
    return improving.slice().sort(byAbsDelta)[0];
  }

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
  /** Explicit clinical-critical bounds. When set, values outside
   *  `[criticalLow, criticalHigh]` are flagged as 'critical' regardless
   *  of how the 2×-span heuristic would score them. Use when the
   *  cliff between "abnormal" and "emergency" is asymmetric or doesn't
   *  match 2×span (e.g. potassium: >6.0 is a cardiac risk regardless
   *  of healthy span; platelet count <50,000 is bleeding-risk
   *  regardless of margin). Leave undefined to use the 2×span heuristic. */
  criticalLow?: number;
  criticalHigh?: number;
  /** Physically/clinically possible bounds. The parser uses these in
   *  preference to the 5×-span sanity heuristic — set them when you
   *  know the real ceiling (e.g. testosterone never exceeds ~2500 ng/dL
   *  in a measurable sample; glucose <40 mg/dL is incompatible with
   *  consciousness, >700 is rare even in DKA). Defaults: parser falls
   *  back to `[min - 5*span, max + 5*span]` when unset. The point is to
   *  admit clinical extremes (severe diabetes, hypogonadism) without
   *  admitting hallucinated values from OCR misreads. */
  physicalMin?: number;
  physicalMax?: number;
  /** Source for the optimal sub-range. Required by convention whenever
   *  `optimalMin`/`optimalMax` are set — without a citation the
   *  numbers look invented and the brand's clinical-honest stance
   *  collapses. Catalog templates without optimal ranges leave this
   *  undefined; templates that DO set optimal ranges should always
   *  attach a source. */
  optimalSource?: OptimalSource;
  category: BiomarkerCategoryId;
  direction?: GradientDirection;
  simpleName?: string;
  plain: string;
  problemId?: string;
};

/**
 * Derive a status from a measured value against a template's healthy
 * range + optional optimal sub-band + optional critical-cliff bounds.
 *
 *   value outside critical band       → 'critical'
 *   value outside [min, max]          → 'concern'
 *   value inside [min, max] but
 *     outside [optimalMin, optimalMax] → 'attention'
 *   value inside the optimal band     → 'good'
 *
 * Critical-band derivation: a marker is 'critical' ONLY when explicit
 * `criticalLow` / `criticalHigh` are set on the template. There is
 * deliberately no heuristic fallback (e.g. 2×span) — clinical critical
 * thresholds are too marker-specific for a one-size formula. TSH 13 is
 * hypothyroidism (concern, not panic); glucose 250 is uncontrolled
 * diabetes (real same-day-care call). Without per-marker auditing,
 * a 2×span rule mis-classifies both directions.
 *
 * Markers without explicit critical bounds top out at 'concern'. Add
 * `criticalLow`/`criticalHigh` to a template when you've validated the
 * cliff-edge against published panic-value guidelines.
 */
export function statusForValue(
  template: BiomarkerTemplate,
  value: number,
): BiomarkerStatus {
  if (
    (typeof template.criticalLow === 'number' && value < template.criticalLow) ||
    (typeof template.criticalHigh === 'number' && value > template.criticalHigh)
  ) {
    return 'critical';
  }
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
 * Schema version stamped onto every Biomarker we construct from a
 * template. Bump this whenever a future catalog refactor renames an
 * id, retires a marker, or changes a unit — the trend-history merger
 * uses this version to refuse to fuse old-schema readings into a new-
 * schema template, which would otherwise silently corrupt the user's
 * trendlines after a release.
 *
 * Backward compat: Biomarkers persisted before this field existed have
 * `catalogVersion: undefined`. The merger admits those into history
 * (they were authored against the same catalog they're now being
 * merged with — by definition). Only on a future bump does the gate
 * activate.
 */
export const CATALOG_VERSION = 2;

/**
 * Construct a fully-typed Biomarker from a catalog template plus a
 * measured value. Used by the parser when it pulls a value out of an
 * uploaded report.
 *
 * `labRef` is the lab's printed reference range when the parser was
 * able to capture it from the row's `tail`. Threaded through unchanged
 * — the catalog's `min`/`max` still drive status; `labRefMin`/`labRefMax`
 * are display-only context surfaced alongside.
 */
export function markerFromTemplate(
  template: BiomarkerTemplate,
  value: number,
  labRef?: { min?: number; max?: number },
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
    optimalSource: template.optimalSource,
    status: statusForValue(template, value),
    category: template.category,
    direction: template.direction,
    plain: template.plain,
    problemId: template.problemId,
    catalogVersion: CATALOG_VERSION,
    labRefMin: labRef?.min,
    labRefMax: labRef?.max,
  };
}

/**
 * The catalog itself. Order matters only for tie-breaking: when a PDF
 * line could match multiple templates (e.g. "Testosterone" matches both
 * Total T and Free T), the parser picks the first hit.
 *
 * AUTHORING CONVENTIONS — follow these when adding new entries:
 *
 *   1. Aliases inside one template: list MORE-SPECIFIC strings before
 *      broader substrings. The matcher first-match-wins inside the
 *      alias array, so `['Total Testosterone', 'Testosterone']` wins
 *      correctly on "Total Testosterone" while still falling back to
 *      "Testosterone" alone when the lab abbreviates.
 *
 *   2. Templates within the catalog: place the MORE-SPECIFIC marker
 *      first. `total-chol` deliberately appears AFTER `ldl`/`hdl`
 *      because a bare 'Cholesterol' inside `total-chol.aliases` would
 *      otherwise match an LDL line first.
 *
 *   3. Excluded bare substrings: when a common short alias would
 *      collide with another template (e.g. bare 'Cholesterol' would
 *      catch LDL/HDL rows), DO NOT list it. Document the exclusion as
 *      a per-template comment so future editors don't add it back.
 *
 *   4. Unit + unitAliases: list every glyph/punctuation variant seen
 *      across Thyrocare/Lal/Metropolis/SRL/Apollo/Healthians. The
 *      `unitMultiplier()` helper handles count-prefixes (lakh / thou /
 *      million) at extract time — list ONLY the bare-magnitude unit
 *      forms here, not every prefix×base combo (those multiply
 *      combinatorially).
 *
 *   5. Physical + critical bounds: set `physicalMin/Max` for any
 *      marker where you know the real ceiling (admits clinical
 *      extremes, rejects OCR garbage). Set `criticalLow/High` when
 *      there's a documented same-day-care threshold (DKA glucose,
 *      hyperkalemia, severe thrombocytopenia, etc.).
 *
 *   6. Optimal source: required by convention whenever
 *      `optimalMin/Max` are set. Cite a peer-reviewed paper or society
 *      guideline; unsourced optimal ranges look invented and erode
 *      brand trust.
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
    optimalSource: {
      label: 'Endocrine Society 2018 hypogonadism guideline + Travison 2017 quartile data',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men 18–65',
    },
    // Critical floor: severe hypogonadism (<150 ng/dL) warrants prompt
    // endocrinology referral. Critical ceiling: >2000 ng/dL in a man
    // not on TRT is anabolic-use or assay error — either way, a
    // physician should see it.
    criticalLow: 150, criticalHigh: 2000,
    // Physical bounds: 0 floor (negative impossible); 2500 ceiling
    // (highest plausible TRT supraphysiological measurement).
    physicalMin: 0, physicalMax: 2500,
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
    // No optimal sub-band yet — Bhasin et al. didn't issue a single
    // optimal threshold; the cited value below is the diagnostic floor
    // for hypogonadism, not an "optimal" anchor.
    optimalSource: {
      label: 'Endocrine Society 2018 (Bhasin et al.) — diagnostic free-T floor ~9 pg/mL by equilibrium dialysis; assay-dependent',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men',
    },
    physicalMin: 0, physicalMax: 60,
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
    optimalSource: {
      label: 'ARIC cohort all-cause mortality data; ADA prediabetes threshold is 5.7%',
      url: 'https://diabetesjournals.org/care/article/33/4/834',
      audience: 'adults',
    },
    // Critical ceiling: ≥10% indicates severely uncontrolled diabetes
    // with elevated micro/macrovascular event risk; needs prompt
    // endocrinology engagement, not a 12-week home plan.
    criticalHigh: 10,
    physicalMin: 3, physicalMax: 18,
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
    optimalSource: {
      label: 'Tirosh et al., NEJM 2005 — lowest CVD risk in the 81–87 mg/dL band',
      url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa050080',
      audience: 'adults',
    },
    // Critical floor: <50 mg/dL is symptomatic hypoglycemia (confusion,
    // seizure risk). Critical ceiling: ≥250 mg/dL fasting suggests
    // uncontrolled diabetes / DKA risk and is same-day-care territory.
    criticalLow: 50, criticalHigh: 250,
    // Physical bounds: 30 floor (incompatible with consciousness below);
    // 800 ceiling (reported extreme in DKA case literature).
    physicalMin: 30, physicalMax: 800,
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
    optimalSource: {
      label: 'Kraft fasting-insulin work; <8 µIU/mL strongly associated with insulin sensitivity',
      audience: 'adults',
    },
    category: 'metabolic', direction: 'down',
    simpleName: 'How hard your pancreas is working',
    plain: 'Higher than ideal means the pancreas is working overtime — an early sign worth addressing while it’s still easy.',
    problemId: 'insulin-resistance',
  },

  /* ---- Heart --------------------------------------------------- */
  {
    id: 'total-chol',
    name: 'Total Cholesterol',
    // Note: bare 'Cholesterol' is intentionally NOT in this list —
    // it's a substring of 'LDL Cholesterol' and 'HDL Cholesterol',
    // and the matcher's first-match-wins logic would otherwise
    // capture LDL's value as the total-cholesterol value.
    aliases: ['Total Cholesterol', 'Cholesterol Total', 'Cholesterol, Total', 'Cholesterol - Total'],
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
    min: 0, max: 100, optimalMin: 0, optimalMax: 70,
    optimalSource: {
      label: 'ACC/AHA 2018 Cholesterol Clinical Practice Guideline (Grundy et al.) — <70 mg/dL recommended for ASCVD risk reduction',
      url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000625',
      audience: 'adults',
    },
    // Critical ceiling: ≥190 mg/dL is the ACC/AHA "severe
    // hypercholesterolemia" threshold — statin therapy is recommended
    // regardless of other risk factors, and familial
    // hypercholesterolemia screening is warranted.
    criticalHigh: 190,
    physicalMin: 0, physicalMax: 600,
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
    optimalSource: {
      label: 'Framingham Heart Study cardioprotective range; very-high HDL >80 shows U-shaped mortality (Madsen et al., EHJ 2017)',
      url: 'https://academic.oup.com/eurheartj/article/38/32/2478/3920193',
      audience: 'adults',
    },
    category: 'heart', direction: 'up',
    simpleName: 'The good cholesterol',
    plain: 'Your “good” cholesterol — clears the bad kind.',
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    aliases: ['Triglycerides', 'TG'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 150, optimalMin: 0, optimalMax: 100,
    optimalSource: {
      label: 'AHA Scientific Statement on Triglycerides (Miller et al., Circulation 2011) — <100 mg/dL is the optimal threshold',
      url: 'https://www.ahajournals.org/doi/10.1161/CIR.0b013e3182160726',
      audience: 'adults',
    },
    // Critical ceiling: ≥500 mg/dL is the threshold for acute
    // pancreatitis risk per the AHA/NLA — clinical attention warranted
    // regardless of other risk factors.
    criticalHigh: 500,
    physicalMin: 0, physicalMax: 5000,
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
    // Critical: <0.01 = thyroid storm / Graves' crisis risk; >50 =
    // myxedema-coma adjacent. Most hypothyroidism (5-20) is 'concern',
    // not panic — that's exactly where the audit said the old 2×span
    // heuristic was over-flagging.
    criticalLow: 0.01, criticalHigh: 50,
    physicalMin: 0, physicalMax: 500,
    category: 'thyroid', direction: 'band',
    simpleName: 'Thyroid signal from your brain',
    plain: 'Thyroid signal — both ends carry meaning, so the band shape matters here.',
  },

  /* ---- Vitamins & Minerals ------------------------------------- */
  {
    id: 'vit-d',
    name: 'Vitamin D (25-OH)',
    // More-specific aliases listed first so the matcher prefers them.
    // Bare 'Vitamin D' is kept last and intentionally — most lab
    // reports include the "25-OH" qualifier, so the parenthesised
    // forms should win. Tightened the unit gate (disallowing digits
    // between value and unit) prevents 'Vitamin D' from capturing
    // the '25' inside '(25-OH)' as the value.
    aliases: ['Vitamin D (25-OH)', 'Vitamin D, 25-OH', 'Vitamin D 25-OH', '25-OH Vitamin D', '25-Hydroxyvitamin D', '25(OH)D', 'Vitamin D'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 30, max: 100, optimalMin: 40, optimalMax: 80,
    optimalSource: {
      label: 'Endocrine Society 2011 clinical practice guideline (Holick et al.)',
      url: 'https://academic.oup.com/jcem/article/96/7/1911/2833671',
      audience: 'adults',
    },
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
    optimalSource: {
      label: 'Tucker et al., AJCN 2000 — neurological correlates emerge below 350 pg/mL',
      url: 'https://academic.oup.com/ajcn/article/71/2/514/4729084',
      audience: 'adults',
    },
    min: 200, max: 900, optimalMin: 500, optimalMax: 900,
    // Methylcobalamin/cyanocobalamin supplementation routinely pushes
    // B12 into the 1,500–5,000 pg/mL range. The 5×-span fallback
    // (cap ≈ 4,400) was clipping these as "OCR errors" when they're
    // actually legitimate supplemented readings.
    physicalMin: 0, physicalMax: 10000,
    category: 'vitamins', direction: 'up',
    simpleName: 'Brain and nerve fuel',
    plain: 'Technically in range below the optimum, but lower than ideal for sharp thinking and steady energy.',
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    aliases: ['Ferritin'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 30, max: 400, optimalMin: 50, optimalMax: 150,
    optimalSource: {
      label: 'WHO 2020 serum-ferritin thresholds (deficiency) + hemochromatosis iron-overload literature (upper bound)',
      url: 'https://www.who.int/publications/i/item/9789240008526',
      audience: 'adult men',
    },
    // Acute-phase reactant: COVID-19 cytokine storm, HLH, adult Still's
    // disease, hemochromatosis crisis can legitimately push ferritin
    // to 10,000–100,000 ng/mL. The 5×-span fallback (cap ≈ 2,250) was
    // SILENTLY DELETING these readings as "OCR errors" — a real
    // patient-safety bug: ferritin >10,000 is itself a diagnostic
    // signal for HLH that we were swallowing. Bumped physicalMax to
    // 200,000 (well above any documented case).
    // Critical: >1,000 = inflammatory cascade / HLH workup; samaller
    // band than max prevents the "concern" tier from absorbing
    // genuinely emergent readings.
    criticalHigh: 1000,
    physicalMin: 0, physicalMax: 200000,
    category: 'vitamins', direction: 'band',
    simpleName: 'Your iron stores',
    plain: 'Iron stores — band-shaped because both deficiency and overload carry risk.',
  },

  /* ---- Electrolytes (extended) ---------------------------------- */
  {
    id: 'magnesium',
    name: 'Magnesium',
    aliases: ['Magnesium', 'Serum Magnesium', 'Mg'],
    unit: 'mg/dL', unitAliases: ['mg/dl', 'mEq/L', 'mmol/L'],
    min: 1.7, max: 2.4,
    // Critical: <1.0 = severe hypomagnesemia (arrhythmia, seizure,
    // tetany risk); >5 = symptomatic hypermagnesemia (renal failure
    // context, IV-mag overdose).
    criticalLow: 1, criticalHigh: 5,
    physicalMin: 0.3, physicalMax: 15,
    category: 'electrolytes', direction: 'band',
    simpleName: 'Often-overlooked muscle + nerve electrolyte',
    plain: 'Low magnesium is common and contributes to fatigue, cramps, and arrhythmia risk. Frequently silently low on Indian diets.',
  },
  {
    id: 'alt',
    name: 'ALT',
    aliases: ['ALT', 'SGPT', 'Alanine Aminotransferase'],
    unit: 'U/L', unitAliases: ['u/l', 'IU/L'],
    min: 7, max: 56, optimalMin: 7, optimalMax: 30,
    optimalSource: {
      label: 'Prati et al., Annals of Internal Medicine 2002 — updated healthy ALT ceiling (≤30 U/L men, ≤19 women)',
      url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-137-1-200207020-00006',
      audience: 'adult men',
    },
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
    // Critical ceiling: ≥3.0 mg/dL suggests acute kidney injury or
    // advanced CKD — same-day nephrology engagement is appropriate.
    // No critical floor: very low creatinine usually means low muscle
    // mass (vegan, elderly) — not a medical emergency.
    criticalHigh: 3,
    physicalMin: 0.1, physicalMax: 25,
    category: 'kidney', direction: 'band',
    simpleName: 'How well your kidneys are filtering',
    plain: 'Kidney filtering measure — both extremes carry meaning.',
  },
  {
    id: 'hb',
    name: 'Hemoglobin',
    aliases: ['Hemoglobin', 'Haemoglobin', 'Hb'],
    // g% is older Indian/British notation for "grams per 100 mL" =
    // g/dL — identical units, different glyph. Adding it as an alias
    // (along with the spaced "g %" variant) so reports from labs that
    // never updated their templates still parse correctly.
    unit: 'g/dL', unitAliases: ['g/dl', 'gm/dL', 'gm/dl', 'g%', 'g %', 'gm%', 'gm %', 'grams%', 'grams %'],
    min: 13.5, max: 17.5,
    // Critical: <7 g/dL is the transfusion-recommendation threshold
    // for chronic anemia (NIH/AABB); >20 g/dL suggests
    // polycythemia / dehydration / EPO use — needs investigation.
    criticalLow: 7, criticalHigh: 20,
    physicalMin: 2, physicalMax: 26,
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

  /* ---- Additional Hormones ------------------------------------- */
  {
    id: 'shbg',
    name: 'SHBG',
    aliases: ['SHBG', 'Sex Hormone Binding Globulin', 'Sex Hormone-Binding Globulin'],
    unit: 'nmol/L', unitAliases: ['nmol/l'],
    min: 10, max: 50,
    category: 'hormones', direction: 'band',
    simpleName: 'How much testosterone is biologically locked up',
    plain: 'SHBG binds testosterone, making it inactive. Too high reduces usable testosterone; too low can mean metabolic issues.',
  },
  {
    id: 'lh',
    name: 'LH',
    aliases: ['LH', 'Luteinizing Hormone', 'Luteinising Hormone'],
    unit: 'mIU/mL', unitAliases: ['mIU/ml', 'IU/L'],
    min: 1.7, max: 8.6,
    category: 'hormones', direction: 'band',
    simpleName: 'Testes-stimulating signal from the pituitary',
    plain: 'High LH with low testosterone suggests testicular issues; low LH points to a pituitary or hypothalamic problem.',
  },
  {
    id: 'fsh',
    name: 'FSH',
    aliases: ['FSH', 'Follicle Stimulating Hormone', 'Follicle-Stimulating Hormone'],
    unit: 'mIU/mL', unitAliases: ['mIU/ml', 'IU/L'],
    min: 1.5, max: 12.4,
    category: 'hormones', direction: 'band',
    simpleName: 'Sperm-production signal from the pituitary',
    plain: 'Elevated FSH often signals reduced testicular function; low FSH points to a pituitary issue.',
  },
  {
    id: 'prolactin',
    name: 'Prolactin',
    aliases: ['Prolactin', 'PRL', 'Serum Prolactin'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 4, max: 15.2,
    category: 'hormones', direction: 'down',
    simpleName: 'When high in men, suppresses testosterone',
    plain: 'Elevated prolactin in men can lower libido and testosterone — often worth investigating if persistently high.',
  },
  {
    id: 'cortisol-am',
    name: 'Cortisol (AM)',
    aliases: ['Cortisol AM', 'Cortisol (AM)', 'Cortisol — morning', 'Morning Cortisol', 'Cortisol'],
    unit: 'µg/dL', unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 6.2, max: 19.4,
    category: 'hormones', direction: 'band',
    simpleName: 'Your stress hormone, measured in the morning',
    plain: 'Cortisol naturally peaks in the morning. Persistently high or low values disrupt sleep, energy, and metabolism.',
  },

  /* ---- Additional Heart ---------------------------------------- */
  {
    id: 'non-hdl',
    name: 'Non-HDL Cholesterol',
    aliases: ['Non-HDL Cholesterol', 'Non HDL Cholesterol', 'Non-HDL-C'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 130,
    category: 'heart', direction: 'down',
    simpleName: 'All your bad cholesterol added up',
    plain: 'Total cholesterol minus HDL — a more comprehensive bad-cholesterol number than LDL alone.',
  },

  /* ---- Additional Thyroid -------------------------------------- */
  {
    id: 't3',
    name: 'T3 (Total)',
    aliases: ['T3 Total', 'Total T3', 'T3', 'Triiodothyronine'],
    unit: 'ng/dL', unitAliases: ['ng/dl'],
    min: 80, max: 200,
    category: 'thyroid', direction: 'band',
    simpleName: 'Active thyroid hormone (total)',
    plain: 'Total T3 includes bound and free forms. Both ends of out-of-range point to thyroid dysfunction.',
  },
  {
    id: 't4',
    name: 'T4 (Total)',
    aliases: ['T4 Total', 'Total T4', 'T4', 'Thyroxine'],
    unit: 'µg/dL', unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 4.5, max: 12,
    category: 'thyroid', direction: 'band',
    simpleName: 'Thyroid storage hormone (total)',
    plain: 'T4 is the storage form your body converts to active T3. Pair with TSH to confirm hypo- or hyper-thyroidism.',
  },
  {
    id: 'free-t3',
    name: 'Free T3',
    aliases: ['Free T3', 'FT3', 'Free Triiodothyronine'],
    unit: 'pg/mL', unitAliases: ['pg/ml'],
    min: 2.3, max: 4.2,
    category: 'thyroid', direction: 'band',
    simpleName: 'Biologically active T3',
    plain: 'Free T3 is the part of total T3 your tissues can actually use. Often the most clinically relevant thyroid number.',
  },
  {
    id: 'free-t4',
    name: 'Free T4',
    aliases: ['Free T4', 'FT4', 'Free Thyroxine'],
    unit: 'ng/dL', unitAliases: ['ng/dl'],
    min: 0.8, max: 1.8,
    category: 'thyroid', direction: 'band',
    simpleName: 'Biologically active T4',
    plain: 'Free T4 is the unbound, usable portion. Often paired with TSH for primary thyroid screening.',
  },

  /* ---- Additional Vitamins & Minerals -------------------------- */
  {
    id: 'folate',
    name: 'Folate',
    aliases: ['Folate', 'Folic Acid', 'Serum Folate', 'Vitamin B9'],
    unit: 'ng/mL', unitAliases: ['ng/ml'],
    min: 3, max: 17,
    category: 'vitamins', direction: 'up',
    simpleName: 'B-vitamin for cell division and brain',
    plain: 'Folate works with B12 — low folate looks like B12 deficiency on a CBC. Important for nerve function.',
  },
  {
    id: 'iron',
    name: 'Serum Iron',
    aliases: ['Serum Iron', 'Iron'],
    unit: 'µg/dL', unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 65, max: 175,
    category: 'vitamins', direction: 'band',
    simpleName: 'Iron level in your blood right now',
    plain: 'A single snapshot — varies through the day. Pair with ferritin (your iron stores) for the real picture.',
  },
  {
    id: 'tibc',
    name: 'TIBC',
    aliases: ['TIBC', 'Total Iron Binding Capacity', 'Total Iron-Binding Capacity'],
    unit: 'µg/dL', unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 250, max: 450,
    category: 'vitamins', direction: 'band',
    simpleName: 'How much iron your blood can carry',
    plain: 'High TIBC often signals iron deficiency; low TIBC can point to inflammation or chronic disease.',
  },

  /* ---- Additional Liver ---------------------------------------- */
  {
    id: 'ast',
    name: 'AST (SGOT)',
    aliases: ['AST (SGOT)', 'AST', 'SGOT', 'Aspartate Aminotransferase', 'Aspartate Transaminase'],
    unit: 'U/L', unitAliases: ['u/L', 'IU/L'],
    min: 8, max: 40, optimalMin: 8, optimalMax: 30,
    optimalSource: {
      label: 'Prati et al., Annals of Internal Medicine 2002 — updated healthy AST/ALT ceilings (men ≤30 U/L)',
      url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-137-1-200207020-00006',
      audience: 'adult men',
    },
    // Critical: ≥300 suggests acute hepatocellular injury (viral
    // hepatitis flare, drug toxicity, ischemic hepatitis). Pair with
    // ALT for confirmation but the magnitude itself is the signal.
    criticalHigh: 300,
    physicalMin: 0, physicalMax: 10000,
    category: 'liver', direction: 'down',
    simpleName: 'A liver enzyme (also in muscle)',
    plain: 'AST rises with liver stress but also after intense exercise or muscle damage. Pair with ALT for liver-specific reading.',
  },
  {
    id: 'alp',
    name: 'ALP',
    aliases: ['Alkaline Phosphatase', 'ALP', 'Alk Phos', 'SAP'],
    unit: 'U/L', unitAliases: ['u/L', 'IU/L'],
    min: 44, max: 147,
    category: 'liver', direction: 'band',
    simpleName: 'A liver/bone enzyme',
    plain: 'ALP is elevated in liver-bile duct issues and bone disorders. Context matters — pair with GGT to isolate liver vs bone.',
  },
  {
    id: 'ggt',
    name: 'GGT',
    aliases: ['GGT', 'Gamma GT', 'Gamma-Glutamyl Transferase', 'GGTP'],
    unit: 'U/L', unitAliases: ['u/L', 'IU/L'],
    min: 9, max: 48,
    category: 'liver', direction: 'down',
    simpleName: 'A liver enzyme sensitive to alcohol',
    plain: 'GGT is the most sensitive liver enzyme — often elevated with alcohol use, fatty liver, or bile duct issues.',
  },
  {
    id: 'total-bilirubin',
    name: 'Total Bilirubin',
    aliases: ['Total Bilirubin', 'Bilirubin Total', 'Bilirubin - Total', 'Bilirubin (Total)', 'Bilirubin, Total', 'T. Bilirubin', 'TBIL'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0.1, max: 1.2,
    // Critical: ≥10 mg/dL = severe hyperbilirubinemia (acute liver
    // failure, fulminant hepatitis, massive hemolysis, complete biliary
    // obstruction). Urgent hepatology workup is the expected next step.
    criticalHigh: 10,
    physicalMin: 0, physicalMax: 60,
    category: 'liver', direction: 'band',
    simpleName: 'A breakdown product processed by your liver',
    plain: 'Mildly elevated bilirubin is often benign (Gilbert syndrome). Substantially high needs investigation.',
  },
  {
    id: 'direct-bilirubin',
    name: 'Direct Bilirubin',
    aliases: ['Direct Bilirubin', 'Bilirubin Direct', 'Bilirubin - Direct', 'Bilirubin (Direct)', 'Bilirubin, Direct', 'Conjugated Bilirubin', 'D. Bilirubin'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 0, max: 0.3,
    physicalMin: 0, physicalMax: 30,
    category: 'liver', direction: 'down',
    simpleName: 'Processed bilirubin — points to bile/liver issues',
    plain: 'Elevated direct bilirubin (out of proportion to total) points to biliary obstruction or intrahepatic cholestasis — needs medical attention.',
  },
  {
    id: 'total-protein',
    name: 'Total Protein',
    aliases: ['Total Protein', 'Protein Total', 'Total Serum Protein'],
    unit: 'g/dL', unitAliases: ['g/dl', 'gm/dL'],
    min: 6, max: 8.3,
    category: 'liver', direction: 'band',
    simpleName: 'All proteins in your blood combined',
    plain: 'Includes albumin and globulins. Low total protein suggests malnutrition or liver issues.',
  },
  {
    id: 'albumin',
    name: 'Albumin',
    aliases: ['Albumin', 'Serum Albumin'],
    unit: 'g/dL', unitAliases: ['g/dl', 'gm/dL'],
    min: 3.5, max: 5,
    category: 'liver', direction: 'up',
    simpleName: 'The main blood protein your liver makes',
    plain: 'Low albumin can mean liver dysfunction, malnutrition, or chronic disease. A solid health-status indicator.',
  },

  /* ---- Additional Kidney --------------------------------------- */
  {
    id: 'bun',
    // Renders as "BUN (Urea)" because Indian labs print either or both
    // — same chemistry, different convention. The alias array catches
    // every variant.
    name: 'BUN (Urea)',
    aliases: ['BUN', 'Blood Urea Nitrogen', 'Blood Urea', 'Urea', 'Urea Nitrogen', 'Serum Urea'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 7, max: 20,
    // Critical: ≥47 mg/dL ≈ Urea ≥100 mg/dL — dialysis-consideration
    // territory; same-day nephrology engagement expected.
    criticalHigh: 47,
    physicalMin: 1, physicalMax: 200,
    category: 'kidney', direction: 'band',
    simpleName: 'A waste product filtered by your kidneys',
    plain: 'High BUN can mean kidney issues, dehydration, or high-protein diet. Pair with creatinine for kidney-specific reading.',
  },
  {
    id: 'egfr',
    name: 'eGFR',
    aliases: ['eGFR', 'Estimated GFR', 'Estimated Glomerular Filtration Rate', 'GFR'],
    unit: 'mL/min', unitAliases: ['ml/min', 'mL/min/1.73m²', 'mL/min/1.73m2', 'ml/min/1.73m²', 'ml/min/1.73m2'],
    min: 90, max: 150,
    // Critical floor: <30 = CKD stage 4 (advanced kidney disease,
    // nephrology referral expected). <15 = end-stage, dialysis
    // territory.
    criticalLow: 30,
    physicalMin: 0, physicalMax: 200,
    category: 'kidney', direction: 'up',
    simpleName: 'How fast your kidneys filter blood',
    plain: 'The most direct kidney function number. ≥90 is normal; persistent <60 indicates chronic kidney disease.',
  },
  {
    id: 'uric-acid',
    name: 'Uric Acid',
    aliases: ['Uric Acid', 'Serum Uric Acid', 'UA'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 3.5, max: 7.2,
    // Critical: ≥10 = severe hyperuricemia, acute-gout-flare and
    // uric-acid nephrolithiasis risk; tumor-lysis-syndrome workup.
    criticalHigh: 10,
    physicalMin: 0, physicalMax: 30,
    category: 'kidney', direction: 'down',
    simpleName: 'Waste product that can crystallise — causes gout',
    plain: 'Elevated uric acid risks gout flares and kidney stones. Common drivers: red meat, alcohol, fructose.',
  },

  /* ---- Additional Blood (CBC) ----------------------------------
   *
   * Count-prefix unit handling: Indian labs print platelets/WBC in
   * three magnitudes depending on the report era + template:
   *
   *   - Raw count          /cumm, /cu.mm, /μL                   → 1×
   *   - Thou (thousand)    thou/cumm, thou/mm3, 10^3/μL         → 1e3
   *   - Lakh (100,000)     lakh/cumm, lac/cumm                  → 1e5
   *   - Million            million/cumm, mill/mm3, 10^6/μL      → 1e6
   *
   * `unitMultiplier()` in pdfParser.ts + aiParser.ts reconciles the
   * lab's printed unit against this template's canonical unit. ONE
   * template per marker — the previous `platelets_lakh` duplicate is
   * gone (catalog version 1 → 2 migration). All three magnitudes for
   * a single marker route into the same template via the multiplier
   * ratio at extract time.
   */
  {
    id: 'wbc',
    name: 'WBC (Total Count)',
    aliases: ['Total Leucocyte Count', 'Total Leukocyte Count', 'White Blood Cells', 'White Blood Cell Count', 'Total WBC Count', 'WBC Count', 'TLC', 'WBC'],
    // Canonical /cumm with every glyph/punctuation variant seen across
    // Thyrocare/Lal/Metropolis/SRL/Apollo/Healthians. Thou/lakh
    // prefixes are scaled by unitMultiplier — only the bare-unit
    // glyphs need to be listed here.
    unit: '/cumm',
    unitAliases: [
      'cells/cumm', 'cells/μL', '/μL', 'thousand/μL', '/cu.mm', 'cu.mm',
      '/cu mm', 'cu mm', 'cumm', 'cells/cu.mm', 'cells/cu mm',
      'thou/mm3', 'thou/mm³', 'thousand/mm3', 'thousand/mm³',
      'thou/cumm', 'thousand/cumm', 'thou/cu.mm', 'thou/cu mm',
      '10^3/μL', '10^3/uL', 'x10^3/μL', 'x10³/μL',
    ],
    min: 4000, max: 11000,
    // Critical: <2000 = severe neutropenia + infection risk;
    // >30,000 = leukemoid reaction or marrow disorder warrants urgent
    // hematology eval.
    criticalLow: 2000, criticalHigh: 30000,
    physicalMin: 0, physicalMax: 500000,
    category: 'blood', direction: 'band',
    simpleName: 'Your infection-fighting cells',
    plain: 'High WBC often signals infection or inflammation. Low WBC can mean viral illness or bone-marrow issues.',
  },
  {
    id: 'rbc',
    name: 'RBC (Total Count)',
    aliases: ['Total Red Cell Count', 'Red Blood Cells', 'RBC Count', 'Total RBC Count', 'Erythrocyte Count', 'RBC'],
    unit: 'million/cumm',
    unitAliases: [
      'mill/cumm', 'million/μL', 'M/μL', 'mill/mm3', 'mill/mm³',
      'million/mm3', 'million/mm³', 'mil/cu mm', 'mill/cu mm',
      '10^6/μL', '10^6/uL', 'x10^6/μL', 'x10⁶/μL',
    ],
    min: 4.5, max: 5.9,
    category: 'blood', direction: 'band',
    simpleName: 'Your oxygen-carrying cells',
    plain: 'Low RBC is anaemia; high can mean dehydration or, rarely, blood disorders.',
  },
  {
    id: 'platelets',
    name: 'Platelet Count',
    aliases: ['Platelet Count', 'Platelets', 'Thrombocyte Count', 'PLT'],
    // Canonical /cumm (raw count). The prefixed forms (thou/cumm,
    // lakh/cumm) reach this template via unitMultiplier scaling:
    // "245 thou/cumm" → 245,000; "2.45 lakh/cumm" → 245,000.
    unit: '/cumm',
    unitAliases: [
      'cells/cumm', 'cells/μL', '/μL', '/cu.mm', 'cu.mm', '/cu mm',
      'cu mm', 'cumm', 'cells/cu.mm', 'cells/cu mm',
      'thou/mm3', 'thou/mm³', 'thousand/mm3', 'thousand/mm³',
      'thou/cumm', 'thousand/cumm', 'thou/cu.mm', 'thou/cu mm',
      'lakh/cumm', 'lakhs/cumm', 'lac/cumm', 'lakh/cu mm',
      'lakh/μL', 'lakhs/μL',
      '10^3/μL', '10^3/uL', 'x10^3/μL', 'x10³/μL',
    ],
    min: 150000, max: 450000,
    // Critical: <50,000 = bleeding risk (CBC-emergency threshold);
    // >1,000,000 = essential thrombocythemia / reactive thrombocytosis
    // warranting hematology workup.
    criticalLow: 50000, criticalHigh: 1000000,
    physicalMin: 0, physicalMax: 5000000,
    category: 'blood', direction: 'band',
    simpleName: 'Your clotting cells',
    plain: 'Low platelets risk bleeding; high platelets risk clotting. Both ends warrant medical follow-up.',
  },
  {
    id: 'hematocrit',
    name: 'Hematocrit (PCV)',
    aliases: ['Hematocrit', 'Haematocrit', 'Haemoticrit', 'Haemoticrit (PCV)', 'Packed Cell Volume', 'PCV', 'HCT'],
    unit: '%', unitAliases: ['vol%'],
    min: 41, max: 50,
    category: 'blood', direction: 'band',
    simpleName: '% of your blood that is red cells',
    plain: 'A direct measure of red-cell volume. Pairs with hemoglobin for anaemia diagnosis.',
  },
  {
    id: 'mcv',
    name: 'MCV',
    aliases: ['MCV', 'Mean Corpuscular Volume', 'Mean Cell Volume'],
    unit: 'fL', unitAliases: ['fl', 'femtolitre'],
    min: 80, max: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Average size of your red cells',
    plain: 'Small RBCs (low MCV) suggest iron deficiency. Large RBCs (high MCV) suggest B12 / folate deficiency or liver issues.',
  },
  {
    id: 'mch',
    name: 'MCH',
    aliases: ['MCH', 'Mean Corpuscular Hemoglobin', 'Mean Corpuscular Haemoglobin', 'Mean Cell Hemoglobin'],
    unit: 'pg', unitAliases: ['picogram'],
    min: 27, max: 32,
    category: 'blood', direction: 'band',
    simpleName: 'Average hemoglobin per red cell',
    plain: 'Low MCH often signals iron deficiency; high MCH suggests B12 / folate issues.',
  },
  {
    id: 'mchc',
    name: 'MCHC',
    aliases: ['MCHC', 'Mean Corpuscular Hemoglobin Concentration', 'Mean Corpuscular Haemoglobin Concentration'],
    // MCHC is dimensionally g/dL (mass per volume), but many Indian
    // and older Commonwealth labs report it as % — both notations are
    // numerically interchangeable (g/dL × 1 = g/100mL → expressed as %).
    // Adding "%" so those reports parse without changing the canonical
    // unit used for display.
    unit: 'g/dL', unitAliases: ['g/dl', 'gm/dL', '%', 'gms/dl'],
    min: 32, max: 36,
    category: 'blood', direction: 'band',
    simpleName: 'Hemoglobin density per red cell',
    plain: 'Together with MCV and MCH, MCHC helps classify the type of anaemia.',
  },
  {
    id: 'rdw',
    name: 'RDW',
    aliases: ['RDW-CV', 'RDW-SD', 'RDW', 'Red Cell Distribution Width', 'Red cell distribution width'],
    unit: '%',
    min: 11.5, max: 14.5,
    category: 'blood', direction: 'down',
    simpleName: 'How variable your red-cell sizes are',
    plain: 'High RDW means your red cells vary in size — an early sign of nutritional deficiency or marrow stress.',
  },

  /* ---- Electrolytes -------------------------------------------- */
  {
    id: 'sodium',
    name: 'Sodium',
    aliases: ['Sodium', 'Serum Sodium'],
    unit: 'mmol/L', unitAliases: ['mEq/L', 'mmol/l'],
    min: 135, max: 145,
    // Critical: <125 = severe hyponatremia (seizure risk, cerebral
    // edema); >155 = severe hypernatremia (CNS dysfunction, brain
    // dehydration). Both are same-day-care.
    criticalLow: 125, criticalHigh: 155,
    physicalMin: 90, physicalMax: 200,
    category: 'electrolytes', direction: 'band',
    simpleName: 'Salt — fluid balance',
    plain: 'Sodium controls your blood volume. Both ends are clinically significant; context matters.',
  },
  {
    id: 'potassium',
    name: 'Potassium',
    aliases: ['Potassium', 'Serum Potassium'],
    unit: 'mmol/L', unitAliases: ['mEq/L', 'mmol/l'],
    min: 3.5, max: 5,
    // Critical: ≤2.5 or ≥6.0 are arrhythmia / cardiac arrest thresholds.
    // This is the marker where "critical" tier is least negotiable —
    // a value of 6.5 mEq/L is a same-hour emergency regardless of
    // patient context.
    criticalLow: 2.5, criticalHigh: 6,
    physicalMin: 1, physicalMax: 10,
    category: 'electrolytes', direction: 'band',
    simpleName: 'Heart-rhythm electrolyte',
    plain: 'Potassium runs your nerves and heart rhythm. Out-of-range values need immediate medical attention.',
  },
  {
    id: 'calcium',
    name: 'Calcium',
    aliases: ['Calcium', 'Total Calcium', 'Serum Calcium'],
    unit: 'mg/dL', unitAliases: ['mg/dl'],
    min: 8.5, max: 10.2,
    // Critical: <7 = severe hypocalcemia (tetany, seizure, prolonged
    // QT); >12 = hypercalcemia crisis (renal failure, coma risk).
    criticalLow: 7, criticalHigh: 12,
    physicalMin: 4, physicalMax: 20,
    category: 'electrolytes', direction: 'band',
    simpleName: 'Bones, muscles, nerves',
    plain: 'Calcium is regulated by parathyroid hormone and Vitamin D. Persistent abnormalities need investigation.',
  },

  /* ---- Inflammation -------------------------------------------- */
  {
    id: 'crp',
    name: 'CRP',
    aliases: ['hs-CRP', 'High Sensitivity CRP', 'High-Sensitivity CRP', 'C-Reactive Protein', 'C Reactive Protein', 'CRP'],
    unit: 'mg/L', unitAliases: ['mg/l'],
    min: 0, max: 3, optimalMin: 0, optimalMax: 1,
    optimalSource: {
      label: 'AHA/CDC 2003 Scientific Statement on Inflammation (Pearson et al.) — <1 mg/L = low CVD risk band',
      url: 'https://www.ahajournals.org/doi/10.1161/01.CIR.0000052939.59093.45',
      audience: 'adults',
    },
    // Acute-phase reactant. The 5×-span fallback (cap ≈ 18) was
    // silently deleting COVID-19 / sepsis / acute pancreatitis
    // readings that legitimately spike to 100–500 mg/L. Bumped to
    // 1000 (covers documented sepsis maxima). Critical: ≥100 mg/L is
    // the clinical inflection — same-day evaluation is appropriate.
    criticalHigh: 100,
    physicalMin: 0, physicalMax: 1000,
    category: 'inflammation', direction: 'down',
    simpleName: 'A general inflammation signal',
    plain: 'Persistently elevated CRP suggests low-grade inflammation — linked to heart disease and metabolic issues.',
  },
  {
    id: 'esr',
    name: 'ESR',
    aliases: ['ESR', 'Erythrocyte Sedimentation Rate', 'Sed Rate'],
    unit: 'mm/hr', unitAliases: ['mm/h', 'mm/1hr'],
    min: 0, max: 15,
    physicalMin: 0, physicalMax: 200,
    category: 'inflammation', direction: 'down',
    simpleName: 'Old-school inflammation marker',
    plain: 'ESR is a non-specific inflammation gauge. Less precise than CRP but still useful in context.',
  },
  {
    id: 'd-dimer',
    name: 'D-Dimer',
    aliases: ['D-Dimer', 'D Dimer', 'D-dimer', 'DDimer', 'Fibrin Degradation Product'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml', 'µg/mL', 'mg/L', 'FEU ng/mL', 'DDU ng/mL'],
    min: 0, max: 500,
    // Acute-phase reactant — pulmonary embolism, DVT, DIC, COVID-19
    // cytokine storm, post-surgical states all legitimately push
    // D-Dimer into 1,000–50,000+ ng/mL territory. The 5×-span fallback
    // (cap ≈ 3,000) was actively unsafe — D-Dimer >1,000 ng/mL is the
    // VTE-workup threshold; silently rejecting >3,000 ng/mL would
    // strip a real PE alert. Bumped to 100,000.
    // Critical: ≥1000 ng/mL = VTE / PE risk warranting urgent
    // imaging; this is one of the clearest critical-tier markers in
    // the catalog.
    criticalHigh: 1000,
    physicalMin: 0, physicalMax: 100000,
    category: 'inflammation', direction: 'down',
    simpleName: 'Clotting-breakdown signal',
    plain: 'Elevated D-Dimer suggests active clot formation — pulmonary embolism, DVT, or systemic inflammatory states like COVID-19.',
  },

  /* ---- HOMA-IR (derived) ---------------------------------------
   * Insulin-resistance index derived as (fasting glucose mg/dL ×
   * fasting insulin µIU/mL) / 405. Many Indian Advanced Wellness
   * panels (Thyrocare, Healthians, Apollo HealthCheck) now print
   * HOMA-IR directly. When a lab prints both glucose + insulin but
   * NOT HOMA-IR, the dashboard could compute it — that's a
   * follow-up enhancement; the catalog entry below is for direct
   * extraction.
   *
   * Reference: <2.5 (insulin-sensitive), 2.5–3.8 (borderline),
   * >3.8 (insulin-resistant) per Wallace et al., Diabetes Care 2004.
   */
  {
    id: 'homa-ir',
    name: 'HOMA-IR',
    aliases: ['HOMA-IR', 'HOMA IR', 'HOMA Index', 'Insulin Resistance Index'],
    unit: '',
    min: 0, max: 2.5, optimalMin: 0, optimalMax: 1.5,
    optimalSource: {
      label: 'Wallace et al., Diabetes Care 2004 — insulin-sensitive band <1.5; resistance ≥2.5',
      url: 'https://diabetesjournals.org/care/article/27/6/1487/22845',
      audience: 'adults',
    },
    physicalMin: 0, physicalMax: 50,
    category: 'metabolic', direction: 'down',
    simpleName: 'How insulin-resistant you are',
    plain: 'Combines fasting glucose + fasting insulin into one insulin-resistance number. Higher = your pancreas is working harder for the same blood sugar.',
    problemId: 'insulin-resistance',
  },

  /* ---- CBC differentials ---------------------------------------
   * Standard CBC subrows. Indian labs print these on every panel —
   * absence from the catalog was reading to users as "the parser
   * missed something" when in fact the parser was working as
   * intended but the catalog didn't cover differentials.
   *
   * The differential percentages must sum to ~100. We don't
   * cross-validate that — labs round individual values so the sum
   * often lands at 99 or 101.
   */
  {
    id: 'neutrophils',
    name: 'Neutrophils',
    aliases: ['Neutrophils', 'Neutrophil', 'Neutrophils %', 'Polymorphs', 'Polymorphonuclear', 'PMN', 'Segmented Neutrophils'],
    unit: '%',
    min: 40, max: 75,
    physicalMin: 0, physicalMax: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Front-line bacterial fighters',
    plain: 'High % often signals bacterial infection or stress. Very low % can mean viral illness or marrow suppression.',
  },
  {
    id: 'lymphocytes',
    name: 'Lymphocytes',
    aliases: ['Lymphocytes', 'Lymphocyte', 'Lymphocytes %', 'Lymphs'],
    unit: '%',
    min: 20, max: 45,
    physicalMin: 0, physicalMax: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Viral / antibody-immunity cells',
    plain: 'High % often suggests viral infection or chronic immune activation. Low % can point to acute stress, steroids, or HIV.',
  },
  {
    id: 'monocytes',
    name: 'Monocytes',
    aliases: ['Monocytes', 'Monocyte', 'Monocytes %', 'Monos'],
    unit: '%',
    min: 2, max: 10,
    physicalMin: 0, physicalMax: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Tissue cleanup + chronic-immunity cells',
    plain: 'Elevated monocytes can signal chronic inflammation, certain infections, or recovery from acute illness.',
  },
  {
    id: 'eosinophils',
    name: 'Eosinophils',
    aliases: ['Eosinophils', 'Eosinophil', 'Eosinophils %', 'Eos'],
    unit: '%',
    min: 0, max: 6,
    physicalMin: 0, physicalMax: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Allergy + parasite cells',
    plain: 'Elevated eosinophils usually suggest allergy, asthma, or parasitic infection. Common in Indian populations from intestinal parasites.',
  },
  {
    id: 'basophils',
    name: 'Basophils',
    aliases: ['Basophils', 'Basophil', 'Basophils %', 'Basos'],
    unit: '%',
    min: 0, max: 2,
    physicalMin: 0, physicalMax: 100,
    category: 'blood', direction: 'band',
    simpleName: 'Rare allergic-response cells',
    plain: 'Usually <2% in a healthy sample. Persistent elevation can suggest allergic disorders or certain chronic conditions.',
  },
  {
    id: 'anc',
    name: 'Absolute Neutrophil Count',
    aliases: ['Absolute Neutrophil Count', 'ANC', 'Absolute Neutrophils', 'Neutrophils Absolute'],
    unit: '/cumm',
    unitAliases: [
      'cells/cumm', '/μL', '/cu.mm', 'cu.mm', '/cu mm', 'cumm',
      'thou/mm3', 'thou/μL', 'thousand/μL', 'thou/cumm',
      '10^3/μL', '10^3/uL',
    ],
    min: 1500, max: 8000,
    // Critical floor: <500 = severe neutropenia (sepsis risk;
    // hospitalisation is standard); <1000 = febrile-neutropenia
    // threshold. Hospital labs panic-call ANC <500 universally.
    criticalLow: 500,
    physicalMin: 0, physicalMax: 50000,
    category: 'blood', direction: 'band',
    simpleName: 'Frontline infection-defence count',
    plain: 'ANC < 1,500 is neutropenia; < 500 is severe and an immediate medical concern. Common in chemo patients, autoimmune disease, and severe viral illness.',
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
