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
type OptimalSource = {
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
  /** Clinical "action" threshold — the value past which clinicians
   *  typically diagnose/treat, DISTINCT from the healthy-range edge.
   *  Rendered as a harm-anchor tick so an out-of-range value sitting
   *  BELOW it reads as "elevated, not yet at the action line" — the
   *  over-triage-reducing pattern from Zikmund-Fisher et al., JMIR 2018.
   *  Set actionMax for down-is-bad markers (glucose, HbA1c); actionMin
   *  for up-is-good. Requires actionSource — same cite-or-omit rule as
   *  optimalSource. Never render a fabricated clinical line. */
  actionMin?: number;
  actionMax?: number;
  actionSource?: OptimalSource;
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
  /** Unit-reconciliation receipt. Set ONLY when the parser rescaled the
   *  lab's printed number into canonical units (Indian count prefixes:
   *  lakh / thousand / million per cumm, or an SI altUnit). Holds what the
   *  lab actually PRINTED so the UI can reassure the user we didn't invent
   *  a different value — e.g. printed "2.4 lakh/cumm", shown "2,40,000 /µL".
   *  Both undefined when the printed number was already in canonical units. */
  originalValue?: number;
  originalUnit?: string;
  /** OCR confidence (0–100) of the read this value came from. Set ONLY on
   *  markers extracted via OCR (a photo or scanned PDF); undefined for
   *  digital text-layer reads (which are exact). The UI flags individual
   *  values below the low-confidence threshold so the user double-checks
   *  the specific ones a photo read poorly — not a blanket "check all". */
  ocrConfidence?: number;
  /** Clinical-critical cliff bounds, propagated from the catalog
   *  template. Distinct from [min,max] (healthy) — these are the
   *  same-day-care thresholds (e.g. glucose >250, HbA1c >10). The bar
   *  uses them to scale its high/low zones so a value lands at the
   *  spot reflecting how far it is from the *emergency* line, not from
   *  the healthy edge — preventing a moderately-out-of-range value from
   *  pegging to the very end of the track. Undefined for markers with no
   *  documented panic value (those top out at 'concern'); the bar then
   *  falls back to a 2×-span visual heuristic. */
  criticalLow?: number;
  criticalHigh?: number;
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
    description:
      'Salts that keep your nerves, heart, and fluid balance running.',
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
      label:
        '<300 ng/dL low cutoff per AUA 2018 and the Indian male-hypogonadism consensus (Kalra et al., 2023); the Endocrine Society 2018 harmonized limit is slightly lower at 264 ng/dL. Optimal band from Travison 2017 quartile data',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men 18–65 · India-consistent',
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
    plain:
      'A healthy amount of estrogen for a man — keeps mood and joints steady.',
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
      label:
        'ARIC cohort all-cause mortality data; ADA prediabetes threshold is 5.7%',
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
      label:
        'Tirosh et al., NEJM 2005 — lowest CVD risk in the 81–87 mg/dL band',
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
      label:
        'Kraft fasting-insulin work; <8 µIU/mL strongly associated with insulin sensitivity',
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
    plain:
      'A touch above the line. The LDL number below is the one to focus on.',
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
      label:
        'Framingham Heart Study cardioprotective range; very-high HDL >80 shows U-shaped mortality (Madsen et al., EHJ 2017)',
      url: 'https://academic.oup.com/eurheartj/article/38/32/2478/3920193',
      audience: 'adults',
    },
    status: 'good',
    category: 'heart',
    direction: 'up',
    plain:
      'Your “good” cholesterol — clears the bad kind. You’re in healthy territory.',
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
    min: 20,
    max: 100,
    optimalMin: 40,
    optimalMax: 80,
    optimalSource: {
      label:
        'Optimal 40–80 ng/mL per Endocrine Society 2011 (Holick et al.); sufficiency floor ≥20 ng/mL per IOM / Indian Academy of Pediatrics 2021',
      url: 'https://pubmed.ncbi.nlm.nih.gov/34969941/',
      audience: 'adults · India (IOM/IAP sufficiency)',
    },
    status: 'attention',
    category: 'vitamins',
    direction: 'up',
    plain:
      'Sufficient by the Indian ≥20 ng/mL cutoff, but below the 40–80 optimal band. Affects mood, energy, immunity, and bone health.',
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
      label:
        'Tucker et al., AJCN 2000 — neurological correlates emerge below 350 pg/mL',
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
    min: 13.0,
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
        // text-{status}-ink, NOT text-{status}. The vivid status hues
        // measure ~3:1 on the matching *-soft background — below the
        // WCAG AA 4.5:1 floor. The *-ink variants are tuned for AA on
        // light theme (darker stop) and re-bind to readable pastels
        // on dark theme via the dark-mode CSS overrides.
        text: 'text-good-ink',
        // Readable color for the label rendered as bare text on a plain
        // surface (no status fill behind it). Identical to `text` for
        // every tier EXCEPT critical, whose `text` is `text-on-status`
        // — correct on the solid `bg-concern` fill, but invisible on a
        // surface. Always use this field when the label sits on a card/
        // canvas; use `text` only when paired with `bg`.
        textOnSurface: 'text-good-ink',
        bg: 'bg-good-soft',
        dot: 'bg-good',
        label: 'HEALTHY',
      };
    case 'attention':
      return {
        text: 'text-attention-ink',
        textOnSurface: 'text-attention-ink',
        bg: 'bg-attention-soft',
        dot: 'bg-attention',
        // "BORDERLINE" replaces the older "NEEDS ATTENTION". Same data
        // class, shorter glyph (BORDERLINE = 10 chars vs NEEDS ATTENTION
        // = 15) so it fits better in compact card badges, and softer
        // for an anxious health-data context — describes the value's
        // position relative to the range instead of issuing a triage
        // verb. The filter-pill label uses the same "Borderline" in
        // title case (see STATUS_FILTER_OPTIONS).
        label: 'KEEP AN EYE',
      };
    case 'concern':
      return {
        text: 'text-concern-ink',
        textOnSurface: 'text-concern-ink',
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
        // Inverted treatment vs concern: solid fill, on-status text,
        // alert-icon adjacent. This is the only tier where same-day
        // action is the right user reading, so we deliberately break
        // visual parity with the other tiers — the user should NOT
        // experience "critical" as a louder version of "concern".
        // text-on-status pairs with bg-concern: white text on vivid
        // red in light theme, deep-navy text on pastel rose in dark.
        // Pure `text-white` would fail WCAG on the dark-mode pastel.
        text: 'text-on-status',
        // On a plain surface (no fill), text-on-status is invisible in
        // both themes. Critical has no surface-ink token of its own, so
        // it borrows concern's readable red — same family, correct
        // contrast. This is the fix for the "SEE A DOCTOR" label going
        // dark-on-dark in the deep-dives card.
        textOnSurface: 'text-concern-ink',
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
 *  Vocabulary is unified with the status badges (`statusColor().label`)
 *  and the StatusKey legend — one set of words per status across the
 *  whole app (Healthy / Keep an eye / Needs care / See a doctor), so a
 *  reader never has to map two phrases ("On track" vs "In a healthy
 *  range") onto the same colour. Pills are sentence-case; badges are the
 *  same words in compact caps. */
export const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  id: StatusFilterId;
  label: string;
}> = [
  { id: 'all', label: 'All markers' },
  { id: 'critical', label: 'See a doctor' },
  { id: 'concern', label: 'Needs care' },
  { id: 'attention', label: 'Keep an eye' },
  { id: 'good', label: 'Healthy' },
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
  // `needCare` is the single source of truth for the "needs care" count
  // shown across every surface (dashboard hero, report Bottom Line,
  // Vitals Strip, category accordions). It folds `critical` into
  // `concern` deliberately: a critical marker still "needs care" — its
  // extra same-day urgency is carried by per-marker copy/CTA, not by a
  // separate aggregate bucket. Surfaces previously diverged (some showed
  // concern-only, some concern+critical), which made the counts fail to
  // reconcile whenever a critical marker existed. Always display
  // `needCare`, never bare `concern`, for the flagged count.
  const needCare = concern + critical;
  return { good, attention, concern, critical, needCare, total: markers.length };
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
export function pickHeadlineMarker(markers: Biomarker[]): Biomarker | null {
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

  const improving = withHistory.filter((m) => getTrendTone(m) === 'improving');
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
  const rounded =
    Math.abs(delta) < 1 ? delta.toFixed(1) : Math.round(delta).toString();
  if (delta > 0) return `+${rounded}`;
  return rounded;
}

/* ------------------------------------------------------------------ */
/* Trajectory — forward projection from a marker's reading history      */
/* ------------------------------------------------------------------ */

export type Trajectory = {
  /** Least-squares slope expressed in marker units per 30 days. */
  ratePerMonth: number;
  /** Movement relative to the marker's target band (its optimal
   *  sub-range when set, else the healthy min/max):
   *    'toward'  — currently outside the band, closing on it
   *    'away'    — currently outside the band, drifting further out
   *    'holding' — change is below the noise floor
   *    'within'  — current value already sits inside the band */
  movement: 'toward' | 'away' | 'holding' | 'within';
  /** Whole months until the linear fit reaches the target band. Set only
   *  when movement === 'toward' AND the estimate lands inside a sane
   *  window (≤ MAX_PROJECTION_MONTHS); null otherwise. A slope that
   *  implies "in range next week" or "in 90 years" is noise, not a
   *  forecast, so we withhold the number rather than print fiction. */
  monthsToTarget: number | null;
};

/** Beyond this horizon a linear extrapolation is fiction, not a forecast. */
export const MAX_PROJECTION_MONTHS = 24;

/**
 * Project where a marker is heading from its own reading history.
 *
 * Fits a least-squares line to (day-offset, value) across every prior
 * reading plus the current value — dated `asOf`, the upload date of the
 * report this marker came from — then classifies the movement relative
 * to the marker's target band and, only when the marker is outside that
 * band and closing on it, estimates the months until it arrives.
 *
 * This is a transparent "if this pace held" extrapolation, NOT a
 * clinical prediction; the UI frames it that way. Returns null when
 * there isn't enough signal to say anything honest: fewer than two
 * readings, a missing/invalid `asOf`, or readings that don't span any
 * time. Pure — no clock access; `asOf` is supplied by the caller.
 */
export function getTrajectory(
  marker: Biomarker,
  asOf: string | undefined,
): Trajectory | null {
  if (!asOf) return null;
  const asOfTs = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(asOfTs)) return null;
  const history = marker.history ?? [];
  if (history.length < 1) return null; // need ≥2 points total

  const DAY = 24 * 60 * 60 * 1000;
  const raw: Array<{ t: number; v: number }> = [];
  for (const h of history) {
    const ts = Date.parse(`${h.date}T00:00:00Z`);
    if (Number.isNaN(ts)) continue;
    raw.push({ t: ts, v: h.value });
  }
  raw.push({ t: asOfTs, v: marker.value });
  if (raw.length < 2) return null;

  const minT = Math.min(...raw.map((p) => p.t));
  const pts = raw.map((p) => ({ t: (p.t - minT) / DAY, v: p.v }));
  const spanDays = Math.max(...pts.map((p) => p.t));
  if (spanDays <= 0) return null; // all readings on the same day → no slope

  // Least-squares slope in value-units per day.
  const n = pts.length;
  const sumT = pts.reduce((s, p) => s + p.t, 0);
  const sumV = pts.reduce((s, p) => s + p.v, 0);
  const sumTT = pts.reduce((s, p) => s + p.t * p.t, 0);
  const sumTV = pts.reduce((s, p) => s + p.t * p.v, 0);
  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) return null;
  const slopePerDay = (n * sumTV - sumT * sumV) / denom;
  const ratePerMonth = slopePerDay * 30;

  // Target band: optimal sub-range when present, else the healthy range.
  const lo =
    typeof marker.optimalMin === 'number' ? marker.optimalMin : marker.min;
  const hi =
    typeof marker.optimalMax === 'number' ? marker.optimalMax : marker.max;
  const value = marker.value;
  const inBand = value >= lo && value <= hi;

  // Noise floor mirrors getTrend's "1% of value" idea, per month.
  const noise = Math.max(0.5, Math.abs(value) * 0.01);
  if (Math.abs(ratePerMonth) < noise) {
    return {
      ratePerMonth,
      movement: inBand ? 'within' : 'holding',
      monthsToTarget: null,
    };
  }
  if (inBand) {
    return { ratePerMonth, movement: 'within', monthsToTarget: null };
  }

  // Outside the band — closing on it or drifting away?
  const below = value < lo;
  const closing = below ? slopePerDay > 0 : slopePerDay < 0;
  if (!closing) {
    return { ratePerMonth, movement: 'away', monthsToTarget: null };
  }
  const distance = below ? lo - value : value - hi;
  const months = distance / Math.abs(slopePerDay) / 30;
  const monthsToTarget =
    months <= MAX_PROJECTION_MONTHS ? Math.max(1, Math.round(months)) : null;
  return { ratePerMonth, movement: 'toward', monthsToTarget };
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
  /** Alternative units this marker is reported in outside the
   *  conventional-unit world — chiefly SI (mmol/L, µmol/L), standard in
   *  Malaysia, the UK, Europe, Australia and Canada. Each entry pairs the
   *  unit spelling(s) with the multiplier that converts a value in that
   *  unit to the template's canonical `unit`. The matcher accepts these
   *  units AND scales the captured value (and any captured lab range) to
   *  canonical before grading, so a Malaysian glucose printed in mmol/L
   *  grades against the same mg/dL band as an Indian one. The factor is
   *  marker-specific (it depends on molar mass) so it can't be derived
   *  from the unit strings alone. */
  altUnits?: readonly { units: readonly string[]; toCanonical: number }[];
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
  /** Harm-anchor clinical action threshold + its citation. See the
   *  Biomarker type for semantics. Cite actionSource whenever set —
   *  an uncited action line is a fabricated clinical claim. */
  actionMin?: number;
  actionMax?: number;
  actionSource?: OptimalSource;
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
  /** The lab's printed reference range, captured at extract time. When
   *  set, this takes PRIORITY over the catalog's `min`/`max` for the
   *  healthy-band classification — the audit's "trust the diagnosing
   *  pathologist's range over our hardcoded standard" directive. The
   *  catalog still drives:
   *    - critical-tier thresholds (criticalLow/High are absolute
   *      panic-value cliffs, not range-relative)
   *    - the optimal sub-band (long-term-outcome target; labs don't
   *      print this)
   *  When labRef is absent (older format, OCR couldn't capture it),
   *  the catalog's healthy band remains the source of truth. */
  labRef?: { min?: number; max?: number },
): BiomarkerStatus {
  // Safety boundary: a non-finite value means we never got a real reading
  // (a failed / garbage parse). Every comparison below against NaN is
  // false, so without this guard a NaN would fall straight through to
  // 'good' — the exact false-assurance failure the four-tier system
  // exists to prevent. Grade it 'concern' so a broken value can never
  // read as reassuring. The parser already rejects NaN upstream
  // (pdfParser drops it before markerFromTemplate); this is defence in
  // depth at the grading boundary itself.
  if (!Number.isFinite(value)) return 'concern';
  if (
    (typeof template.criticalLow === 'number' &&
      value < template.criticalLow) ||
    (typeof template.criticalHigh === 'number' && value > template.criticalHigh)
  ) {
    return 'critical';
  }
  // Pick the healthy band: the lab's printed range wins when both
  // bounds are present and form a valid interval. Otherwise fall back
  // to the catalog's range.
  const useLab =
    typeof labRef?.min === 'number' &&
    typeof labRef?.max === 'number' &&
    labRef.min <= labRef.max;
  const healthyMin = useLab ? (labRef!.min as number) : template.min;
  const healthyMax = useLab ? (labRef!.max as number) : template.max;
  if (value < healthyMin || value > healthyMax) return 'concern';
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
    actionMin: template.actionMin,
    actionMax: template.actionMax,
    actionSource: template.actionSource,
    status: statusForValue(template, value, labRef),
    category: template.category,
    direction: template.direction,
    plain: template.plain,
    problemId: template.problemId,
    catalogVersion: CATALOG_VERSION,
    labRefMin: labRef?.min,
    labRefMax: labRef?.max,
    // Propagate the clinical-critical cliff bounds so the BiomarkerBar can
    // scale its zones against the real emergency thresholds (e.g. glucose
    // 250, HbA1c 10) instead of a span heuristic — otherwise a value like
    // 150 mg/dL pegs to the end of the track even though it's nowhere near
    // the DKA line. Display-only; grading already consumed them above.
    criticalLow: template.criticalLow,
    criticalHigh: template.criticalHigh,
  };
}

/* ================================================================== */
/* Vermeulen calculated free testosterone (derived marker)            */
/* ================================================================== */

/**
 * Calculated free testosterone via the Vermeulen (1999) equilibrium
 * equation — the Endocrine Society's preferred free-T estimate when
 * direct equilibrium dialysis isn't available, and substantially more
 * reliable than the analog "direct free T" immunoassay many Indian labs
 * run (Vermeulen et al., JCEM 1999; Bhasin et al., Endocrine Society
 * 2018).
 *
 * Solves the law-of-mass-action equilibrium between testosterone, SHBG,
 * and albumin for the free fraction:
 *
 *     N·Kt·[FT]² + (N + Kt·(SHBG − T))·[FT] − T = 0,   N = 1 + Ka·[Alb]
 *
 * taking the positive root. Constants are Vermeulen's originals:
 *   Kt (SHBG–T assoc.)     = 1.0×10⁹ L/mol
 *   Ka (albumin–T assoc.)  = 3.6×10⁴ L/mol
 *   MW testosterone        = 288.4 g/mol
 *   MW albumin             = 66 500 g/mol
 *
 * Inputs use the exact units our catalog extracts:
 *   totalTng    Total testosterone, ng/dL  (catalog id 'testosterone')
 *   shbgNmol    SHBG, nmol/L               (catalog id 'shbg')
 *   albuminGdl  Albumin, g/dL              (catalog id 'albumin');
 *               defaults to Vermeulen's reference 4.3 g/dL when the
 *               report omits it — albumin varies little in healthy men
 *               and the result is only weakly sensitive to it.
 *
 * Returns calculated free T in ng/dL (4 sig figs), or null for
 * non-physical inputs. Validated against published reference vectors and
 * the Endocrine Society free-T low cutoff — see biomarkers.test.ts.
 */
export function vermeulenFreeTestosterone(
  totalTng: number,
  shbgNmol: number,
  albuminGdl = 4.3,
): number | null {
  if (!(totalTng > 0) || !(shbgNmol > 0) || !(albuminGdl > 0)) return null;

  const KT = 1.0e9; // SHBG–testosterone association constant (L/mol)
  const KA = 3.6e4; // albumin–testosterone association constant (L/mol)
  const MW_T = 288.4; // testosterone molar mass (g/mol)
  const MW_ALB = 66_500; // albumin molar mass (g/mol)

  // Everything to mol/L before applying the equilibrium constants:
  //   ng/dL → mol/L: 1 ng/dL = 1e-9 g / 1e-1 L = 1e-8 g/L; ÷ MW.
  //   nmol/L → mol/L: × 1e-9.
  //   g/dL → mol/L: × 10 (→ g/L) ÷ MW.
  const totalMol = (totalTng * 1e-8) / MW_T;
  const shbgMol = shbgNmol * 1e-9;
  const albMol = (albuminGdl * 10) / MW_ALB;

  const N = 1 + KA * albMol;
  const a = N * KT;
  const b = N + KT * (shbgMol - totalMol);
  const c = -totalMol;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const freeMol = (-b + Math.sqrt(discriminant)) / (2 * a);
  if (!(freeMol > 0)) return null;

  // mol/L → ng/dL: × MW (→ g/L) × 1e8.
  const freeNgDl = freeMol * MW_T * 1e8;
  return parseFloat(freeNgDl.toPrecision(4));
}

/**
 * Derived-only template for the calculated free-T marker. Deliberately
 * NOT a member of `biomarkerCatalog`: it carries no aliases because no
 * lab prints "calculated free T", so the text matcher must never try to
 * extract it. It is computed in the parser's derive step from Total T +
 * SHBG (+ albumin) — see deriveComputedMarkers in pdfParser.ts.
 *
 * Why a SEPARATE marker from the direct `free-t` template: the two are
 * different methods reported on different numeric scales (direct analog
 * immunoassay ~8.7–25.1 pg/mL vs. calculated ~65–300 pg/mL), and the
 * direct template's own comment warns that grading one against the
 * other's band gives false assurance. Keeping them distinct (and in
 * different units — ng/dL here) is what keeps that honest.
 *
 * Band rationale (no invented optimal sub-band — same restraint as the
 * SHBG entry): 6.4 ng/dL is the Endocrine Society / Vermeulen lower
 * limit of normal (≈64 pg/mL by dialysis); 25 ng/dL is a conservative
 * upper-normal across published calculated-free-T ranges. No critical
 * cliff — a *derived* estimate shouldn't trip the same-day-care tier;
 * the underlying Total T carries its own critical bounds.
 */
export const FREE_T_CALC_TEMPLATE: BiomarkerTemplate = {
  id: 'free-t-calc',
  name: 'Free Testosterone (calculated)',
  aliases: [],
  unit: 'ng/dL',
  min: 6.4,
  max: 25,
  physicalMin: 0,
  physicalMax: 60,
  category: 'hormones',
  direction: 'up',
  simpleName: 'Usable testosterone, estimated',
  plain:
    'Estimated from your Total Testosterone and SHBG using the Vermeulen formula — the active testosterone your body can actually use. This is a calculation, not a direct measurement: if your report prints a measured free testosterone, trust that, and discuss any concern with a clinician.',
  problemId: 'low-testosterone',
};

/**
 * Append computed markers derived from extracted ones, when the inputs
 * are present and the derived marker wasn't directly reported:
 *
 *   - HOMA-IR = (fasting glucose mg/dL × fasting insulin µIU/mL) / 405.
 *     Many Indian Wellness panels print both glucose + insulin but stop
 *     short of computing HOMA-IR.
 *   - Free Testosterone (calculated) via the Vermeulen equation from
 *     Total T + SHBG (+ albumin, defaulted when absent) — the Endocrine
 *     Society's preferred free-T estimate.
 *
 * Each derivation is independent and best-effort: a missing input or a
 * non-physical result skips that one marker, never the other and never
 * the input set. Pure — doesn't mutate the input; returns it with any
 * derived markers appended.
 *
 * Single source of truth for derivation: ALL ingestion paths (PDF text,
 * Tesseract OCR, Gemini vision, and manual entry) run their final marker
 * list through this, so the dashboard is consistent regardless of how the
 * values arrived.
 */
export function deriveComputedMarkers(extracted: Biomarker[]): Biomarker[] {
  const derived: Biomarker[] = [];

  // HOMA-IR — only when the lab didn't already print it.
  if (!extracted.some((m) => m.id === 'homa-ir')) {
    const glucose = extracted.find((m) => m.id === 'glucose');
    const insulin = extracted.find((m) => m.id === 'insulin');
    const homaTemplate = biomarkerCatalog.find((t) => t.id === 'homa-ir');
    // Defensive zero-guard: a 0 value (mis-extraction) yields 0/NaN —
    // skip rather than surface a spurious "perfect insulin sensitivity".
    if (
      glucose &&
      insulin &&
      homaTemplate &&
      glucose.value > 0 &&
      insulin.value > 0
    ) {
      const homaIr = parseFloat(
        ((glucose.value * insulin.value) / 405).toPrecision(4),
      );
      if (Number.isFinite(homaIr)) {
        derived.push(markerFromTemplate(homaTemplate, homaIr));
      }
    }
  }

  // Free Testosterone (calculated) — Vermeulen, from Total T + SHBG.
  // Albumin is optional: vermeulenFreeTestosterone() falls back to the
  // 4.3 g/dL reference when the report doesn't include it.
  if (!extracted.some((m) => m.id === FREE_T_CALC_TEMPLATE.id)) {
    const totalT = extracted.find((m) => m.id === 'testosterone');
    const shbg = extracted.find((m) => m.id === 'shbg');
    if (totalT && shbg) {
      const albumin = extracted.find((m) => m.id === 'albumin');
      const freeT = vermeulenFreeTestosterone(
        totalT.value,
        shbg.value,
        albumin && albumin.value > 0 ? albumin.value : undefined,
      );
      if (freeT !== null) {
        derived.push(markerFromTemplate(FREE_T_CALC_TEMPLATE, freeT));
      }
    }
  }

  return derived.length ? [...extracted, ...derived] : extracted;
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
    aliases: [
      'Total Testosterone',
      'Testosterone Total',
      'Testosterone, Total',
      'Testosterone',
    ],
    unit: 'ng/dL',
    unitAliases: ['ng/dl', 'ng / dL'],
    // SI conversion: many non-US labs (Europe + a large share of Indian
    // labs) report testosterone in nmol/L. 1 nmol/L = 28.842 ng/dL
    // (MW 288.42). Without this a perfectly healthy ~20 nmol/L either reads
    // as ~21 ng/dL — severe-hypogonadism-looking — or gets dropped on the
    // unmatched unit. Factor lives here so the unit-reconciliation receipt
    // shows "lab printed 20.8 nmol/L → converted".
    altUnits: [{ units: ['nmol/L', 'nmol/l'], toCanonical: 28.842 }],
    min: 300,
    max: 1000,
    optimalMin: 600,
    optimalMax: 900,
    optimalSource: {
      label:
        '<300 ng/dL low cutoff per AUA 2018 and the Indian male-hypogonadism consensus (Kalra et al., 2023); the Endocrine Society 2018 harmonized limit is slightly lower at 264 ng/dL. Optimal band from Travison 2017 quartile data',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men 18–65 · India-consistent',
    },
    // Critical floor: severe hypogonadism (<150 ng/dL) warrants prompt
    // endocrinology referral. Critical ceiling: >2000 ng/dL in a man
    // not on TRT is anabolic-use or assay error — either way, a
    // physician should see it.
    criticalLow: 150,
    criticalHigh: 2000,
    // Physical bounds: 0 floor (negative impossible); 2500 ceiling
    // (highest plausible TRT supraphysiological measurement).
    physicalMin: 0,
    physicalMax: 2500,
    category: 'hormones',
    direction: 'up',
    simpleName: 'Your main male hormone',
    plain:
      'Below the healthy range often shows up as low drive, less stamina, and slower recovery. Very responsive to sleep, training, and Vitamin D.',
    problemId: 'low-testosterone',
  },
  {
    id: 'free-t',
    name: 'Free Testosterone',
    // Bare 'Free T' is intentionally EXCLUDED: its right-boundary allows
    // a trailing digit, so it matched "Free T3" / "Free T4" on every
    // thyroid panel and surfaced the thyroid value as a (low) free
    // testosterone — a cross-axis clinical mislabel. Reports spell it out
    // as "Free Testosterone" / "Testosterone Free".
    aliases: ['Free Testosterone', 'Testosterone Free'],
    unit: 'pg/mL',
    unitAliases: ['pg/ml'],
    // SI conversion ONLY (not a band/method switch): pmol/L → pg/mL at
    // 0.28842 (MW 288.42). This converts the unit; the assay-method
    // ambiguity documented below is a separate, deliberately-unsolved issue.
    altUnits: [{ units: ['pmol/L', 'pmol/l'], toCanonical: 0.28842 }],
    // Method-dependent marker. This 8.7–25.1 pg/mL band is the DIRECT
    // (analog immunoassay) male range — the method most Indian labs run.
    // Calculated free-T and equilibrium-dialysis assays read on a wholly
    // different scale (~120–368 pg/mL) yet report in the same pg/mL unit,
    // so one band can't serve both AND the two can't be told apart from
    // the number alone (a high direct value ~55 and a low calculated
    // value ~55 mean opposite things). We deliberately do NOT auto-switch
    // the band by magnitude — that would misread a pathologically high
    // direct value as a low calculated one (false assurance). Instead:
    //   - the plain copy tells the user the band assumes a direct assay
    //     and to defer to their report's printed range (which
    //     statusForValue already prioritises when captured), and
    //   - the extraction physicalMax (60) drops calculated-scale values
    //     to the "couldn't map" list rather than grading them here.
    // Full method-aware grading is deferred. See docs/CLINICAL-ACCURACY.md.
    min: 8.7,
    max: 25.1,
    // No optimal sub-band yet — Bhasin et al. didn't issue a single
    // optimal threshold; the cited value below is the diagnostic floor
    // for hypogonadism, not an "optimal" anchor.
    optimalSource: {
      label:
        'Endocrine Society 2018 (Bhasin et al.) — diagnostic free-T floor ~9 pg/mL by equilibrium dialysis; assay-dependent',
      url: 'https://academic.oup.com/jcem/article/103/5/1715/4939465',
      audience: 'adult men',
    },
    physicalMin: 0,
    physicalMax: 60,
    category: 'hormones',
    direction: 'up',
    simpleName: 'Testosterone your body can actually use',
    plain:
      'The testosterone your body can actually use. When it’s low, even a small lift makes a noticeable daily difference. This range assumes the direct (immunoassay) method most labs use — calculated or equilibrium-dialysis free-T reads on a much higher scale, so go by your report’s own reference range.',
  },
  {
    id: 'estradiol',
    name: 'Estradiol',
    aliases: ['Estradiol', 'E2', 'Estradiol (E2)'],
    unit: 'pg/mL',
    unitAliases: ['pg/ml'],
    // SI conversion: pmol/L → pg/mL at 0.27238 (MW 272.38). Estradiol is
    // very commonly reported in pmol/L outside the US.
    altUnits: [{ units: ['pmol/L', 'pmol/l'], toCanonical: 0.27238 }],
    min: 11,
    max: 44,
    category: 'hormones',
    direction: 'band',
    simpleName: 'Estrogen (yes, men have it too)',
    plain:
      'A healthy amount of estrogen for a man keeps mood and joints steady.',
  },

  /* ---- Metabolic ----------------------------------------------- */
  {
    id: 'hba1c',
    name: 'HbA1c',
    aliases: [
      'HbA1c',
      'A1c',
      'Hemoglobin A1c',
      'Glycated Hemoglobin',
      'Glycohemoglobin',
    ],
    unit: '%',
    min: 4,
    max: 5.7,
    optimalMin: 4.5,
    optimalMax: 5.3,
    optimalSource: {
      label:
        'ARIC cohort all-cause mortality data; ADA prediabetes threshold is 5.7%',
      url: 'https://diabetesjournals.org/care/article/33/4/834',
      audience: 'adults',
    },
    // Critical ceiling: ≥10% indicates severely uncontrolled diabetes
    // with elevated micro/macrovascular event risk; needs prompt
    // endocrinology engagement, not a 12-week home plan.
    criticalHigh: 10,
    physicalMin: 3,
    physicalMax: 18,
    // Harm-anchor: India's WHO/ICMR diabetes diagnostic line. A reading
    // above the 5.7% prediabetes ceiling but below 6.5% is "prediabetic,
    // not diabetic" — the tick shows that gap so it doesn't read as
    // alarming. India caveat: ICMR does NOT treat HbA1c as a sole
    // diagnostic test — iron-deficiency anaemia (very common in India)
    // skews HbA1c — so the label tells users to confirm with glucose.
    actionMax: 6.5,
    actionSource: {
      label:
        'the WHO/ICMR diabetes diagnostic line (HbA1c ≥6.5%) — in India, confirm with a fasting glucose test, as common iron-deficiency anaemia can skew HbA1c',
      url: 'https://main.icmr.nic.in/sites/default/files/guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf',
      audience: 'adults · India (ICMR/WHO criteria)',
    },
    category: 'metabolic',
    direction: 'down',
    simpleName: '3-month sugar average',
    // Plain copy carries the India reliability caveat at every tier (not
    // just the harm-anchor tick, which only shows at concern/critical):
    // iron-deficiency anaemia — very common in India — can skew HbA1c, so
    // a borderline/raised value should be confirmed with fasting glucose.
    plain:
      'Your average blood sugar over 3 months. Below 5.7% is healthy; the optimal band is tighter still. In India, anaemia (very common) can skew this number — confirm a borderline or raised result with a fasting glucose test.',
  },
  {
    id: 'glucose',
    name: 'Fasting Glucose',
    aliases: [
      'Fasting Glucose',
      'Glucose Fasting',
      'Glucose, Fasting',
      'Fasting Blood Sugar',
      'FBS',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    // SI: glucose 1 mmol/L = 18.0156 mg/dL (MW 180.16). Malaysian/UK/EU
    // reports print mmol/L; converting lets them grade on the mg/dL band.
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 18.0156 }],
    min: 70,
    max: 99,
    optimalMin: 75,
    optimalMax: 90,
    optimalSource: {
      label:
        'Tirosh et al., NEJM 2005 — lowest CVD risk in the 81–87 mg/dL band',
      url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa050080',
      audience: 'adults',
    },
    // Critical floor: <50 mg/dL is symptomatic hypoglycemia (confusion,
    // seizure risk). Critical ceiling: ≥250 mg/dL fasting suggests
    // uncontrolled diabetes / DKA risk and is same-day-care territory.
    criticalLow: 50,
    criticalHigh: 250,
    // Physical bounds: 30 floor (incompatible with consciousness below);
    // 800 ceiling (reported extreme in DKA case literature).
    physicalMin: 30,
    physicalMax: 800,
    // Harm-anchor: India's WHO/ICMR diabetes diagnostic line. 100–125
    // mg/dL is prediabetic (impaired fasting glucose); ≥126 is
    // diagnostic. The tick separates "borderline" from "diagnostic" so
    // the former reads calmly. India uses WHO criteria (ICMR 2018).
    actionMax: 126,
    actionSource: {
      label:
        'the WHO/ICMR diabetes diagnostic line (fasting glucose ≥126 mg/dL)',
      url: 'https://main.icmr.nic.in/sites/default/files/guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf',
      audience: 'adults · India (ICMR/WHO criteria)',
    },
    category: 'metabolic',
    direction: 'down',
    simpleName: 'Blood sugar this morning',
    plain:
      'A walk after every meal pulls a borderline reading comfortably back down.',
  },
  {
    id: 'insulin',
    name: 'Fasting Insulin',
    aliases: ['Fasting Insulin', 'Insulin Fasting', 'Insulin, Fasting'],
    unit: 'µIU/mL',
    unitAliases: ['uIU/mL', 'mIU/L', 'µIU/ml'],
    min: 2,
    max: 25,
    optimalMin: 2,
    optimalMax: 8,
    optimalSource: {
      label:
        'Kraft fasting-insulin work; <8 µIU/mL strongly associated with insulin sensitivity',
      audience: 'adults',
    },
    category: 'metabolic',
    direction: 'down',
    simpleName: 'How hard your pancreas is working',
    plain:
      'Higher than ideal means the pancreas is working overtime — an early sign worth addressing while it’s still easy.',
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
    aliases: [
      'Total Cholesterol',
      'Cholesterol Total',
      'Cholesterol, Total',
      'Cholesterol - Total',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 200,
    category: 'heart',
    direction: 'down',
    simpleName: 'All your cholesterol added together',
    plain: 'The number to focus on inside total cholesterol is LDL below.',
  },
  {
    id: 'ldl',
    name: 'LDL Cholesterol',
    aliases: ['LDL Cholesterol', 'LDL-C', 'LDL', 'Cholesterol LDL'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 100,
    optimalMin: 0,
    optimalMax: 70,
    optimalSource: {
      label:
        'Lipid Association of India 2023 (Consensus IV): South Asians are higher-risk — LDL <70 mg/dL (high risk), <50 (very-high, e.g. diabetes/ASCVD), ≤30 (extreme)',
      url: 'https://www.lipidjournal.com/article/S1933-2874(24)00006-0/fulltext',
      audience: 'adults · India (LAI)',
    },
    // Critical ceiling: ≥190 mg/dL is the ACC/AHA "severe
    // hypercholesterolemia" threshold — statin therapy is recommended
    // regardless of other risk factors, and familial
    // hypercholesterolemia screening is warranted.
    criticalHigh: 190,
    physicalMin: 0,
    physicalMax: 600,
    category: 'heart',
    direction: 'down',
    simpleName: 'The bad cholesterol',
    plain:
      'The cholesterol that builds up in artery walls — lower is better here. When it’s above the ideal range, a focused 12-week plan can bring it down.',
    problemId: 'high-ldl',
  },
  {
    id: 'hdl',
    name: 'HDL Cholesterol',
    aliases: ['HDL Cholesterol', 'HDL-C', 'HDL', 'Cholesterol HDL'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 40,
    max: 100,
    optimalMin: 50,
    optimalMax: 80,
    optimalSource: {
      label:
        'Framingham Heart Study cardioprotective range; very-high HDL >80 shows U-shaped mortality (Madsen et al., EHJ 2017)',
      url: 'https://academic.oup.com/eurheartj/article/38/32/2478/3920193',
      audience: 'adults',
    },
    category: 'heart',
    direction: 'up',
    simpleName: 'The good cholesterol',
    plain: 'Your “good” cholesterol — clears the bad kind.',
  },
  {
    id: 'tg',
    name: 'Triglycerides',
    aliases: ['Triglycerides', 'TG'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 150,
    optimalMin: 0,
    optimalMax: 100,
    optimalSource: {
      label:
        'AHA Scientific Statement on Triglycerides (Miller et al., Circulation 2011) — <100 mg/dL is the optimal threshold',
      url: 'https://www.ahajournals.org/doi/10.1161/CIR.0b013e3182160726',
      audience: 'adults',
    },
    // Critical ceiling: ≥500 mg/dL is the threshold for acute
    // pancreatitis risk per the AHA/NLA — clinical attention warranted
    // regardless of other risk factors.
    criticalHigh: 500,
    physicalMin: 0,
    physicalMax: 5000,
    category: 'heart',
    direction: 'down',
    simpleName: 'Fat in your blood',
    plain:
      'Usually tied to sugar, refined carbs, or alcohol — very responsive to small changes.',
  },
  {
    // VLDL appears on essentially every Indian lipid panel (Thyrocare,
    // Lal, SRL, Metropolis) but was missing from the catalog, so a full
    // lipid profile silently dropped this row. 'VLDL' can't be captured
    // by the 'LDL' alias — the matcher's letter-boundary guard
    // ((?<![A-Za-z])) rejects the 'LDL' inside 'VLDL' — so no collision.
    // Reference 5–40 mg/dL is the standard adult range labs print; VLDL
    // ≈ triglycerides ÷ 5, so it tracks TG and rarely drives a decision
    // on its own — no optimal sub-band (mirrors total-chol's restraint).
    id: 'vldl',
    name: 'VLDL Cholesterol',
    aliases: ['VLDL Cholesterol', 'VLDL-C', 'VLDL', 'Cholesterol VLDL'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 40,
    physicalMin: 0,
    physicalMax: 200,
    category: 'heart',
    direction: 'down',
    simpleName: 'A triglyceride-carrying cholesterol',
    plain:
      'Mostly carries triglycerides. It rises and falls with them, so the fix is the same: less sugar, refined carbs, and alcohol.',
  },

  /* ---- Thyroid ------------------------------------------------- */
  {
    id: 'tsh',
    name: 'TSH',
    aliases: ['TSH', 'Thyroid Stimulating Hormone', 'Thyrotropin'],
    unit: 'µIU/mL',
    unitAliases: ['uIU/mL', 'mIU/L'],
    min: 0.4,
    max: 4.5,
    // Critical: <0.01 = thyroid storm / Graves' crisis risk; >50 =
    // myxedema-coma adjacent. Most hypothyroidism (5-20) is 'concern',
    // not panic — that's exactly where the audit said the old 2×span
    // heuristic was over-flagging.
    criticalLow: 0.01,
    criticalHigh: 50,
    physicalMin: 0,
    physicalMax: 500,
    category: 'thyroid',
    direction: 'band',
    simpleName: 'Thyroid signal from your brain',
    plain:
      'Thyroid signal — both ends carry meaning, so the band shape matters here.',
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
    aliases: [
      'Vitamin D (25-OH)',
      'Vitamin D, 25-OH',
      'Vitamin D 25-OH',
      '25-OH Vitamin D',
      '25-Hydroxyvitamin D',
      '25(OH)D',
      'Vitamin D',
    ],
    unit: 'ng/mL',
    unitAliases: ['ng/ml'],
    // Healthy floor 20 ng/mL — the IOM / Indian sufficiency cutoff (IAP
    // 2021: deficiency <12, insufficiency 12–20, sufficiency >20). The US
    // Endocrine Society's 30 ng/mL over-flags the very common 20–30 band
    // as "deficient" for an India-first audience; with the floor at 20,
    // 20–40 reads as "sufficient, below optimal" rather than "concern".
    min: 20,
    max: 100,
    optimalMin: 40,
    optimalMax: 80,
    optimalSource: {
      label:
        'Optimal 40–80 ng/mL per Endocrine Society 2011 (Holick et al.); sufficiency floor ≥20 ng/mL per IOM / Indian Academy of Pediatrics 2021',
      url: 'https://pubmed.ncbi.nlm.nih.gov/34969941/',
      audience: 'adults · India (IOM/IAP sufficiency)',
    },
    category: 'vitamins',
    direction: 'up',
    simpleName: 'Vitamin D',
    plain:
      'Affects mood, energy, immunity, and bone health. In India ≥20 ng/mL is considered sufficient; 40–80 is the optimal band.',
    problemId: 'low-vit-d',
  },
  {
    id: 'b12',
    name: 'Vitamin B12',
    aliases: ['Vitamin B12', 'B12', 'Cobalamin'],
    unit: 'pg/mL',
    unitAliases: ['pg/ml'],
    optimalSource: {
      label:
        'Tucker et al., AJCN 2000 — neurological correlates emerge below 350 pg/mL; deficiency <200 pg/mL is universal and endemic in India, especially among vegetarians',
      url: 'https://academic.oup.com/ajcn/article/71/2/514/4729084',
      audience: 'adults · India context',
    },
    min: 200,
    max: 900,
    optimalMin: 500,
    optimalMax: 900,
    // Methylcobalamin/cyanocobalamin supplementation routinely pushes
    // B12 into the 1,500–5,000 pg/mL range. The 5×-span fallback
    // (cap ≈ 4,400) was clipping these as "OCR errors" when they're
    // actually legitimate supplemented readings.
    physicalMin: 0,
    physicalMax: 10000,
    category: 'vitamins',
    direction: 'up',
    simpleName: 'Brain and nerve fuel',
    plain:
      'Technically in range below the optimum, but lower than ideal for sharp thinking and steady energy.',
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    aliases: ['Ferritin'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml'],
    min: 30,
    max: 400,
    optimalMin: 50,
    optimalMax: 150,
    optimalSource: {
      label:
        'WHO 2020 serum-ferritin thresholds (deficiency) + hemochromatosis iron-overload literature (upper bound)',
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
    physicalMin: 0,
    physicalMax: 200000,
    category: 'vitamins',
    direction: 'band',
    simpleName: 'Your iron stores',
    plain:
      'Iron stores — band-shaped because both deficiency and overload carry risk.',
  },

  /* ---- Electrolytes (extended) ---------------------------------- */
  {
    id: 'magnesium',
    name: 'Magnesium',
    aliases: ['Magnesium', 'Serum Magnesium', 'Mg'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl', 'mEq/L', 'mmol/L'],
    min: 1.7,
    max: 2.4,
    // Critical: <1.0 = severe hypomagnesemia (arrhythmia, seizure,
    // tetany risk); >5 = symptomatic hypermagnesemia (renal failure
    // context, IV-mag overdose).
    criticalLow: 1,
    criticalHigh: 5,
    physicalMin: 0.3,
    physicalMax: 15,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Often-overlooked muscle + nerve electrolyte',
    plain:
      'Low magnesium is common and contributes to fatigue, cramps, and arrhythmia risk. Frequently silently low on Indian diets.',
  },
  {
    id: 'alt',
    name: 'ALT',
    aliases: ['ALT', 'SGPT', 'Alanine Aminotransferase'],
    unit: 'U/L',
    unitAliases: ['u/l', 'IU/L'],
    min: 7,
    max: 56,
    optimalMin: 7,
    optimalMax: 30,
    optimalSource: {
      label:
        'Prati et al., Annals of Internal Medicine 2002 — updated healthy ALT ceiling (≤30 U/L men, ≤19 women)',
      url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-137-1-200207020-00006',
      audience: 'adult men',
    },
    category: 'liver',
    direction: 'down',
    simpleName: 'A liver enzyme',
    plain:
      'Elevated ALT usually means the liver is stressed — sometimes by alcohol, sometimes by metabolic load.',
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    aliases: ['Creatinine', 'Serum Creatinine'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    // SI: creatinine 1 µmol/L = 1/88.42 mg/dL (MW 113.12). Standard in
    // Malaysia/UK/EU. 'umol/L' (Latin u) is the common OCR/keyboard form;
    // 'µmol/L' (micro sign) and 'μmol/L' (Greek mu) also occur.
    altUnits: [
      { units: ['µmol/L', 'umol/L', 'μmol/L'], toCanonical: 1 / 88.42 },
    ],
    min: 0.7,
    max: 1.3,
    // Critical ceiling: ≥3.0 mg/dL suggests acute kidney injury or
    // advanced CKD — same-day nephrology engagement is appropriate.
    // No critical floor: very low creatinine usually means low muscle
    // mass (vegan, elderly) — not a medical emergency.
    criticalHigh: 3,
    physicalMin: 0.1,
    physicalMax: 25,
    category: 'kidney',
    direction: 'band',
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
    unit: 'g/dL',
    unitAliases: [
      'g/dl',
      'gm/dL',
      'gm/dl',
      'g%',
      'g %',
      'gm%',
      'gm %',
      // "Gms%" is the spelling Dr N.M. Kazi and similar small-lab
      // templates print — same unit (grams per 100 mL), another glyph.
      'Gms%',
      'Gms %',
      'gms%',
      'gms %',
      'grams%',
      'grams %',
    ],
    // Male anaemia floor 13.0 g/dL per WHO / Indian usage (men); the prior
    // 13.5 over-flagged the 13.0–13.4 band. This catalog is tuned for the
    // app's adult-male audience (the female cutoff, <12, differs).
    min: 13.0,
    max: 17.5,
    // Critical: <7 g/dL is the transfusion-recommendation threshold
    // for chronic anemia (NIH/AABB); >20 g/dL suggests
    // polycythemia / dehydration / EPO use — needs investigation.
    criticalLow: 7,
    criticalHigh: 20,
    physicalMin: 2,
    physicalMax: 26,
    category: 'blood',
    direction: 'band',
    simpleName: 'Your blood’s oxygen carrier',
    plain:
      'Oxygen-carrying capacity. Both anaemia and very high counts matter clinically.',
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
    unit: 'ml',
    unitAliases: ['mL', 'ML'],
    min: 1.4,
    max: 6,
    category: 'fertility',
    direction: 'up',
    simpleName: 'How much semen per sample',
    plain:
      'WHO 2021 reference is ≥1.4 ml. Below that may suggest a blockage or hormonal issue; most samples land between 2–5 ml.',
  },
  {
    id: 'semen-ph',
    name: 'pH',
    aliases: ['pH', 'Semen pH', 'pH value'],
    unit: '',
    min: 7.2,
    max: 8.0,
    category: 'fertility',
    direction: 'band',
    simpleName: 'How acidic/alkaline the sample is',
    plain:
      'Healthy semen is slightly alkaline (7.2–8.0). Values outside the band can suggest infection or blocked ducts.',
  },
  {
    id: 'sperm-density',
    name: 'Sperm density',
    aliases: [
      'Density (million per ml)',
      'Sperm concentration',
      'Sperm density',
      'Concentration',
    ],
    unit: 'million/ml',
    unitAliases: ['M/ml', 'million per ml', '10^6/ml', 'x10^6/mL'],
    min: 16,
    max: 200,
    category: 'fertility',
    direction: 'up',
    simpleName: 'Sperm per milliliter of semen',
    plain:
      'WHO 2021 reference is ≥16 million/ml. Below that is oligospermia; most fertile men show 40–200 million/ml.',
  },
  {
    id: 'sperm-total-count',
    name: 'Total sperm count',
    // Bare 'Total count' is intentionally EXCLUDED: it substring-matches
    // "W.B.C Total Count" / "WBC Total Count" on every CBC, surfacing a
    // phantom semen "sperm count" on a blood report (a real trust-killer
    // seen on the Dr N.M. Kazi CBC). The remaining aliases name sperm or
    // the million unit explicitly, so they can't collide with a CBC row.
    aliases: ['Total sperm count', 'Total count (million)', 'Total Sperm Count'],
    unit: 'million',
    unitAliases: ['M', '10^6'],
    min: 39,
    max: 500,
    category: 'fertility',
    direction: 'up',
    simpleName: 'Total sperm in the whole sample',
    plain:
      'WHO 2021 reference is ≥39 million. Higher counts give more swimmers per shot.',
  },
  {
    id: 'sperm-motility-total',
    name: 'Total motility',
    // "Total motile (a+b+c)" is the WHO grading wording many Indian labs
    // print (Dr Lal PathLabs etc.) — the same quantity as total motility.
    // Bare 'Motility' is intentionally EXCLUDED: it substring-matched
    // "Progressive motility" / "Forward motility" / "Non-progressive
    // motility" and mislabeled those grades as TOTAL motility. The
    // remaining aliases all name the total explicitly.
    aliases: [
      'Total motility %',
      'Total motility',
      'Total motile (a+b+c)',
      'Total motile',
    ],
    unit: '%',
    min: 42,
    max: 100,
    category: 'fertility',
    direction: 'up',
    simpleName: '% of sperm that move at all',
    plain:
      'WHO 2021 reference is ≥42%. Below that is asthenospermia — sperm need to move enough to reach an egg.',
  },
  {
    id: 'sperm-motility-progressive',
    name: 'Progressive motility',
    aliases: ['Progressive', 'Progressive motility', 'Forward motility'],
    unit: '%',
    min: 30,
    max: 100,
    category: 'fertility',
    direction: 'up',
    simpleName: '% of sperm swimming forward',
    plain:
      'WHO 2021 reference is ≥30% (down from 32% in WHO 2010). Sperm need to swim forward, not in circles.',
  },
  {
    id: 'sperm-immotile',
    name: 'Immotile',
    aliases: ['Immotile', 'Immotile %', 'Non-motile'],
    unit: '%',
    min: 0,
    max: 60,
    category: 'fertility',
    direction: 'down',
    simpleName: '% of sperm not moving at all',
    plain:
      'Up to 60% can be immotile in a healthy sample. Above that suggests motility problems.',
  },
  {
    id: 'sperm-morphology',
    name: 'Morphology',
    aliases: [
      'Morphology %',
      'Morphology',
      'Normal forms',
      'Normal morphology',
    ],
    unit: '%',
    min: 4,
    max: 100,
    category: 'fertility',
    direction: 'up',
    simpleName: '% of sperm with normal shape',
    plain:
      'WHO 2021 reference is ≥4% normal forms (unchanged from WHO 2010). Sperm shape matters for successful fertilization.',
  },

  /* ---- Additional Hormones ------------------------------------- */
  {
    id: 'shbg',
    name: 'SHBG',
    aliases: [
      'SHBG',
      'Sex Hormone Binding Globulin',
      'Sex Hormone-Binding Globulin',
    ],
    unit: 'nmol/L',
    unitAliases: ['nmol/l'],
    min: 10,
    // Adult-male consensus is ~10–57 nmol/L (Mayo, LabCorp 16.5–55.9 for
    // 20–49y, rising to 76.4 for >49y). The old ceiling of 50 sat below
    // even the young-adult upper limit, so healthy older men — whose SHBG
    // physiologically rises with age — read as falsely "high". 57 is the
    // consensus ceiling; a lab printing its own range overrides this band
    // anyway. The low end (10) is correct and unchanged.
    max: 57,
    category: 'hormones',
    direction: 'band',
    simpleName: 'How much testosterone is biologically locked up',
    plain:
      'SHBG binds testosterone, making it inactive. Too high reduces usable testosterone; too low can mean metabolic issues.',
  },
  {
    id: 'lh',
    name: 'LH',
    aliases: ['LH', 'Luteinizing Hormone', 'Luteinising Hormone'],
    unit: 'mIU/mL',
    unitAliases: ['mIU/ml', 'IU/L'],
    min: 1.7,
    max: 8.6,
    category: 'hormones',
    direction: 'band',
    simpleName: 'Testes-stimulating signal from the pituitary',
    plain:
      'High LH with low testosterone suggests testicular issues; low LH points to a pituitary or hypothalamic problem.',
  },
  {
    id: 'fsh',
    name: 'FSH',
    aliases: [
      'FSH',
      'Follicle Stimulating Hormone',
      'Follicle-Stimulating Hormone',
    ],
    unit: 'mIU/mL',
    unitAliases: ['mIU/ml', 'IU/L'],
    min: 1.5,
    max: 12.4,
    category: 'hormones',
    direction: 'band',
    simpleName: 'Sperm-production signal from the pituitary',
    plain:
      'Elevated FSH often signals reduced testicular function; low FSH points to a pituitary issue.',
  },
  {
    id: 'prolactin',
    name: 'Prolactin',
    aliases: ['Prolactin', 'PRL', 'Serum Prolactin'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml'],
    min: 4,
    max: 15.2,
    category: 'hormones',
    direction: 'down',
    simpleName: 'When high in men, suppresses testosterone',
    plain:
      'Elevated prolactin in men can lower libido and testosterone — often worth investigating if persistently high.',
  },
  {
    id: 'cortisol-am',
    name: 'Cortisol (AM)',
    aliases: [
      'Cortisol AM',
      'Cortisol (AM)',
      'Cortisol — morning',
      'Morning Cortisol',
      'Cortisol',
    ],
    unit: 'µg/dL',
    unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 6.2,
    max: 19.4,
    category: 'hormones',
    direction: 'band',
    simpleName: 'Your stress hormone, measured in the morning',
    plain:
      'Cortisol naturally peaks in the morning. Persistently high or low values disrupt sleep, energy, and metabolism.',
  },

  /* ---- Additional Heart ---------------------------------------- */
  {
    id: 'non-hdl',
    name: 'Non-HDL Cholesterol',
    aliases: ['Non-HDL Cholesterol', 'Non HDL Cholesterol', 'Non-HDL-C'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 130,
    category: 'heart',
    direction: 'down',
    simpleName: 'All your bad cholesterol added up',
    plain:
      'Total cholesterol minus HDL — a more comprehensive bad-cholesterol number than LDL alone.',
  },

  /* ---- Additional Thyroid -------------------------------------- */
  {
    id: 't3',
    name: 'T3 (Total)',
    aliases: ['T3 Total', 'Total T3', 'T3', 'Triiodothyronine'],
    unit: 'ng/dL',
    unitAliases: ['ng/dl'],
    min: 80,
    max: 200,
    category: 'thyroid',
    direction: 'band',
    simpleName: 'Active thyroid hormone (total)',
    plain:
      'Total T3 includes bound and free forms. Both ends of out-of-range point to thyroid dysfunction.',
  },
  {
    id: 't4',
    name: 'T4 (Total)',
    aliases: ['T4 Total', 'Total T4', 'T4', 'Thyroxine'],
    unit: 'µg/dL',
    unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 4.5,
    max: 12,
    category: 'thyroid',
    direction: 'band',
    simpleName: 'Thyroid storage hormone (total)',
    plain:
      'T4 is the storage form your body converts to active T3. Pair with TSH to confirm hypo- or hyper-thyroidism.',
  },
  {
    id: 'free-t3',
    name: 'Free T3',
    aliases: ['Free T3', 'FT3', 'Free Triiodothyronine'],
    unit: 'pg/mL',
    unitAliases: ['pg/ml'],
    min: 2.3,
    max: 4.2,
    category: 'thyroid',
    direction: 'band',
    simpleName: 'Biologically active T3',
    plain:
      'Free T3 is the part of total T3 your tissues can actually use. Often the most clinically relevant thyroid number.',
  },
  {
    id: 'free-t4',
    name: 'Free T4',
    aliases: ['Free T4', 'FT4', 'Free Thyroxine'],
    unit: 'ng/dL',
    unitAliases: ['ng/dl'],
    min: 0.8,
    max: 1.8,
    category: 'thyroid',
    direction: 'band',
    simpleName: 'Biologically active T4',
    plain:
      'Free T4 is the unbound, usable portion. Often paired with TSH for primary thyroid screening.',
  },

  /* ---- Additional Vitamins & Minerals -------------------------- */
  {
    id: 'folate',
    name: 'Folate',
    aliases: ['Folate', 'Folic Acid', 'Serum Folate', 'Vitamin B9'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml'],
    min: 3,
    max: 17,
    category: 'vitamins',
    direction: 'up',
    simpleName: 'B-vitamin for cell division and brain',
    plain:
      'Folate works with B12 — low folate looks like B12 deficiency on a CBC. Important for nerve function.',
  },
  {
    id: 'iron',
    name: 'Serum Iron',
    aliases: ['Serum Iron', 'Iron'],
    unit: 'µg/dL',
    unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 65,
    max: 175,
    category: 'vitamins',
    direction: 'band',
    simpleName: 'Iron level in your blood right now',
    plain:
      'A single snapshot — varies through the day. Pair with ferritin (your iron stores) for the real picture.',
  },
  {
    id: 'tibc',
    name: 'TIBC',
    aliases: [
      'TIBC',
      'Total Iron Binding Capacity',
      'Total Iron-Binding Capacity',
    ],
    unit: 'µg/dL',
    unitAliases: ['ug/dL', 'mcg/dL', 'µg/dl'],
    min: 250,
    max: 450,
    category: 'vitamins',
    direction: 'band',
    simpleName: 'How much iron your blood can carry',
    plain:
      'High TIBC often signals iron deficiency; low TIBC can point to inflammation or chronic disease.',
  },

  /* ---- Additional Liver ---------------------------------------- */
  {
    id: 'ast',
    name: 'AST (SGOT)',
    aliases: [
      'AST (SGOT)',
      'AST',
      'SGOT',
      'Aspartate Aminotransferase',
      'Aspartate Transaminase',
    ],
    unit: 'U/L',
    unitAliases: ['u/L', 'IU/L'],
    min: 8,
    max: 40,
    optimalMin: 8,
    optimalMax: 30,
    optimalSource: {
      label:
        'Prati et al., Annals of Internal Medicine 2002 — updated healthy AST/ALT ceilings (men ≤30 U/L)',
      url: 'https://www.acpjournals.org/doi/10.7326/0003-4819-137-1-200207020-00006',
      audience: 'adult men',
    },
    // Critical: ≥300 suggests acute hepatocellular injury (viral
    // hepatitis flare, drug toxicity, ischemic hepatitis). Pair with
    // ALT for confirmation but the magnitude itself is the signal.
    criticalHigh: 300,
    physicalMin: 0,
    physicalMax: 10000,
    category: 'liver',
    direction: 'down',
    simpleName: 'A liver enzyme (also in muscle)',
    plain:
      'AST rises with liver stress but also after intense exercise or muscle damage. Pair with ALT for liver-specific reading.',
  },
  {
    id: 'alp',
    name: 'ALP',
    aliases: ['Alkaline Phosphatase', 'ALP', 'Alk Phos', 'SAP'],
    unit: 'U/L',
    unitAliases: ['u/L', 'IU/L'],
    min: 44,
    max: 147,
    category: 'liver',
    direction: 'band',
    simpleName: 'A liver/bone enzyme',
    plain:
      'ALP is elevated in liver-bile duct issues and bone disorders. Context matters — pair with GGT to isolate liver vs bone.',
  },
  {
    id: 'ggt',
    name: 'GGT',
    aliases: ['GGT', 'Gamma GT', 'Gamma-Glutamyl Transferase', 'GGTP'],
    unit: 'U/L',
    unitAliases: ['u/L', 'IU/L'],
    min: 9,
    max: 48,
    category: 'liver',
    direction: 'down',
    simpleName: 'A liver enzyme sensitive to alcohol',
    plain:
      'GGT is the most sensitive liver enzyme — often elevated with alcohol use, fatty liver, or bile duct issues.',
  },
  {
    id: 'total-bilirubin',
    name: 'Total Bilirubin',
    aliases: [
      'Total Bilirubin',
      'Bilirubin Total',
      'Bilirubin - Total',
      'Bilirubin (Total)',
      'Bilirubin, Total',
      'T. Bilirubin',
      'TBIL',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0.1,
    max: 1.2,
    // Critical: ≥10 mg/dL = severe hyperbilirubinemia (acute liver
    // failure, fulminant hepatitis, massive hemolysis, complete biliary
    // obstruction). Urgent hepatology workup is the expected next step.
    criticalHigh: 10,
    physicalMin: 0,
    physicalMax: 60,
    category: 'liver',
    direction: 'band',
    simpleName: 'A breakdown product processed by your liver',
    plain:
      'Mildly elevated bilirubin is often benign (Gilbert syndrome). Substantially high needs investigation.',
  },
  {
    id: 'direct-bilirubin',
    name: 'Direct Bilirubin',
    aliases: [
      'Direct Bilirubin',
      'Bilirubin Direct',
      'Bilirubin - Direct',
      'Bilirubin (Direct)',
      'Bilirubin, Direct',
      'Conjugated Bilirubin',
      'D. Bilirubin',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 0,
    max: 0.3,
    physicalMin: 0,
    physicalMax: 30,
    category: 'liver',
    direction: 'down',
    simpleName: 'Processed bilirubin — points to bile/liver issues',
    plain:
      'Elevated direct bilirubin (out of proportion to total) points to biliary obstruction or intrahepatic cholestasis — needs medical attention.',
  },
  {
    id: 'total-protein',
    name: 'Total Protein',
    aliases: ['Total Protein', 'Protein Total', 'Total Serum Protein'],
    unit: 'g/dL',
    unitAliases: ['g/dl', 'gm/dL'],
    min: 6,
    max: 8.3,
    category: 'liver',
    direction: 'band',
    simpleName: 'All proteins in your blood combined',
    plain:
      'Includes albumin and globulins. Low total protein suggests malnutrition or liver issues.',
  },
  {
    id: 'albumin',
    name: 'Albumin',
    aliases: ['Albumin', 'Serum Albumin'],
    unit: 'g/dL',
    unitAliases: ['g/dl', 'gm/dL'],
    min: 3.5,
    max: 5,
    category: 'liver',
    direction: 'up',
    simpleName: 'The main blood protein your liver makes',
    plain:
      'Low albumin can mean liver dysfunction, malnutrition, or chronic disease. A solid health-status indicator.',
  },

  /* ---- Additional Kidney --------------------------------------- */
  {
    id: 'bun',
    // Indian labs overwhelmingly print "Blood Urea" / "Urea" on the
    // UREA scale (~15–40 mg/dL), NOT the US "BUN" nitrogen scale
    // (~7–20). These measure the same chemistry but differ by ~2.14×
    // (Urea = BUN × 2.14), so one band cannot be correct for both. We
    // grade on the India-first urea scale. A report that prints its own
    // reference range overrides this band anyway (statusForValue trusts
    // the lab's printed range), so a "BUN"-scale report still grades
    // correctly off its printed range; only the fallback band + the
    // critical cliff assume the urea scale. A clean BUN-vs-Urea split
    // would be more precise but needs a matcher change (bare "Urea"
    // substring-matches "Blood Urea Nitrogen", and the matcher emits
    // every matching template), so it's deferred. See
    // docs/CLINICAL-ACCURACY.md.
    name: 'Blood Urea',
    aliases: [
      'Blood Urea',
      'Urea',
      'Serum Urea',
      'BUN',
      'Blood Urea Nitrogen',
      'Urea Nitrogen',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    // SI: urea 1 mmol/L = 6.006 mg/dL (MW 60.06) — converts onto the same
    // urea-scale mg/dL band this template grades on. (Distinct from the
    // BUN-nitrogen scale; see the id comment above.)
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 6.006 }],
    min: 15,
    max: 40,
    // Critical: Urea ≥100 mg/dL (≈ BUN ≥47) is dialysis-consideration
    // territory — same-day nephrology. Pitched on the urea scale to
    // match the dominant Indian convention. This previously sat at 47
    // (the BUN scale) and fired a FALSE 'critical' on normal urea
    // values of ~48–99 mg/dL on every path — the cliff is checked
    // before the lab-range override, so even a correctly-printed range
    // couldn't rescue it. A genuinely high BUN-scale value still
    // surfaces as 'concern' rather than a silent normal.
    criticalHigh: 100,
    physicalMin: 2,
    physicalMax: 430,
    category: 'kidney',
    direction: 'band',
    simpleName: 'A waste product filtered by your kidneys',
    plain:
      'High blood urea can mean kidney issues, dehydration, or a high-protein diet. Pair with creatinine for a kidney-specific reading.',
  },
  {
    id: 'egfr',
    name: 'eGFR',
    aliases: [
      'eGFR',
      'Estimated GFR',
      'Estimated Glomerular Filtration Rate',
      'GFR',
    ],
    unit: 'mL/min',
    unitAliases: [
      'ml/min',
      'mL/min/1.73m²',
      'mL/min/1.73m2',
      'ml/min/1.73m²',
      'ml/min/1.73m2',
    ],
    // KDIGO CKD staging mapped onto the four status tiers via the band:
    //   ≥90   (G1, normal)          → good      (optimal band below)
    //   60–89 (G2, mildly reduced)  → attention — NOT CKD on its own
    //                                 without kidney-damage markers, so
    //                                 deliberately calm, not 'concern'
    //   <60   (G3, sustained = CKD) → concern   — the clinically
    //                                 meaningful cutoff, now visible in
    //                                 the band (was hidden when the floor
    //                                 was 90: 60–89 and <60 both read the
    //                                 same 'concern')
    //   <30   (G4/G5)               → critical
    // The healthy floor sits at the KDIGO 60 cutoff so a mildly-reduced
    // older-adult eGFR (60–89) doesn't read as a false 'out of range'.
    min: 60,
    max: 150,
    optimalMin: 90,
    optimalMax: 150,
    optimalSource: {
      label:
        'KDIGO 2024 CKD classification — G1 (≥90 mL/min/1.73m²) is normal kidney function; an eGFR <60 sustained ≥3 months defines CKD',
      url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/',
      audience: 'adults (CKD-EPI 2021, race-free)',
    },
    // Critical floor: <30 = CKD stage 4 (advanced kidney disease,
    // nephrology referral expected). <15 = end-stage, dialysis
    // territory.
    criticalLow: 30,
    physicalMin: 0,
    physicalMax: 200,
    category: 'kidney',
    direction: 'up',
    simpleName: 'How fast your kidneys filter blood',
    plain:
      'The most direct kidney function number. ≥90 is ideal and 60–89 is mildly reduced (often normal with age); a persistent reading below 60 indicates chronic kidney disease, and below 30 needs prompt kidney care.',
  },
  {
    id: 'uric-acid',
    name: 'Uric Acid',
    aliases: ['Uric Acid', 'Serum Uric Acid', 'UA'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    // SI: uric acid 1 mmol/L = 16.81 mg/dL (MW 168.11). Standard in
    // Malaysia/UK/EU reports.
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 16.81 }],
    min: 3.5,
    max: 7.2,
    // Critical: ≥10 = severe hyperuricemia, acute-gout-flare and
    // uric-acid nephrolithiasis risk; tumor-lysis-syndrome workup.
    criticalHigh: 10,
    physicalMin: 0,
    physicalMax: 30,
    category: 'kidney',
    direction: 'down',
    simpleName: 'Waste product that can crystallise — causes gout',
    plain:
      'Elevated uric acid risks gout flares and kidney stones. Common drivers: red meat, alcohol, fructose.',
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
    aliases: [
      'Total Leucocyte Count',
      'Total Leukocyte Count',
      'White Blood Cells',
      'White Blood Cell Count',
      'Total WBC Count',
      // Dotted "W.B.C" is common on small-lab templates (Dr N.M. Kazi
      // etc.) — 'WBC' can't match it because the dots break the token.
      'W.B.C Total Count',
      'WBC Total Count',
      'W.B.C Count',
      'WBC Count',
      'TLC',
      'W.B.C',
      'WBC',
    ],
    // Canonical /cumm with every glyph/punctuation variant seen across
    // Thyrocare/Lal/Metropolis/SRL/Apollo/Healthians. Thou/lakh
    // prefixes are scaled by unitMultiplier — only the bare-unit
    // glyphs need to be listed here.
    unit: '/cumm',
    unitAliases: [
      'cells/cumm',
      'cells/μL',
      '/μL',
      'thousand/μL',
      '/cu.mm',
      'cu.mm',
      '/cu mm',
      'cu mm',
      'cumm',
      'cells/cu.mm',
      'cells/cu mm',
      'thou/mm3',
      'thou/mm³',
      'thousand/mm3',
      'thousand/mm³',
      'thou/cumm',
      'thousand/cumm',
      'thou/cu.mm',
      'thou/cu mm',
      '10^3/μL',
      '10^3/uL',
      'x10^3/μL',
      'x10³/μL',
    ],
    min: 4000,
    max: 11000,
    // Critical: <2000 = severe neutropenia + infection risk;
    // >30,000 = leukemoid reaction or marrow disorder warrants urgent
    // hematology eval.
    criticalLow: 2000,
    criticalHigh: 30000,
    physicalMin: 0,
    physicalMax: 500000,
    category: 'blood',
    direction: 'band',
    simpleName: 'Your infection-fighting cells',
    plain:
      'High WBC often signals infection or inflammation. Low WBC can mean viral illness or bone-marrow issues.',
  },
  {
    id: 'rbc',
    name: 'RBC (Total Count)',
    aliases: [
      'Total Red Cell Count',
      'Red Blood Cells',
      'RBC Count',
      'Total RBC Count',
      'Erythrocyte Count',
      'RBC',
    ],
    unit: 'million/cumm',
    unitAliases: [
      'mill/cumm',
      'million/μL',
      'M/μL',
      'mill/mm3',
      'mill/mm³',
      'million/mm3',
      'million/mm³',
      'mil/cu mm',
      'mill/cu mm',
      '10^6/μL',
      '10^6/uL',
      'x10^6/μL',
      'x10⁶/μL',
    ],
    min: 4.5,
    max: 5.9,
    category: 'blood',
    direction: 'band',
    simpleName: 'Your oxygen-carrying cells',
    plain:
      'Low RBC is anaemia; high can mean dehydration or, rarely, blood disorders.',
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
      'cells/cumm',
      'cells/μL',
      '/μL',
      '/cu.mm',
      'cu.mm',
      '/cu mm',
      'cu mm',
      'cumm',
      'cells/cu.mm',
      'cells/cu mm',
      'thou/mm3',
      'thou/mm³',
      'thousand/mm3',
      'thousand/mm³',
      'thou/cumm',
      'thousand/cumm',
      'thou/cu.mm',
      'thou/cu mm',
      'lakh/cumm',
      'lakhs/cumm',
      'lac/cumm',
      'lakh/cu mm',
      'lakh/μL',
      'lakhs/μL',
      '10^3/μL',
      '10^3/uL',
      'x10^3/μL',
      'x10³/μL',
    ],
    min: 150000,
    max: 450000,
    // Critical: <50,000 = bleeding risk (CBC-emergency threshold);
    // >1,000,000 = essential thrombocythemia / reactive thrombocytosis
    // warranting hematology workup.
    criticalLow: 50000,
    criticalHigh: 1000000,
    physicalMin: 0,
    physicalMax: 5000000,
    category: 'blood',
    direction: 'band',
    simpleName: 'Your clotting cells',
    plain:
      'Low platelets risk bleeding; high platelets risk clotting. Both ends warrant medical follow-up.',
  },
  {
    id: 'hematocrit',
    name: 'Hematocrit (PCV)',
    aliases: [
      'Hematocrit',
      'Haematocrit',
      'Haemoticrit',
      'Haemoticrit (PCV)',
      'Packed Cell Volume',
      'PCV',
      'HCT',
    ],
    unit: '%',
    unitAliases: ['vol%'],
    min: 41,
    max: 50,
    category: 'blood',
    direction: 'band',
    simpleName: '% of your blood that is red cells',
    plain:
      'A direct measure of red-cell volume. Pairs with hemoglobin for anaemia diagnosis.',
  },
  {
    id: 'mcv',
    name: 'MCV',
    aliases: ['MCV', 'Mean Corpuscular Volume', 'Mean Cell Volume'],
    unit: 'fL',
    unitAliases: ['fl', 'femtolitre'],
    min: 80,
    max: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Average size of your red cells',
    plain:
      'Small RBCs (low MCV) suggest iron deficiency. Large RBCs (high MCV) suggest B12 / folate deficiency or liver issues.',
  },
  {
    id: 'mch',
    name: 'MCH',
    aliases: [
      'MCH',
      'Mean Corpuscular Hemoglobin',
      'Mean Corpuscular Haemoglobin',
      'Mean Cell Hemoglobin',
    ],
    unit: 'pg',
    unitAliases: ['picogram'],
    min: 27,
    max: 32,
    category: 'blood',
    direction: 'band',
    simpleName: 'Average hemoglobin per red cell',
    plain:
      'Low MCH often signals iron deficiency; high MCH suggests B12 / folate issues.',
  },
  {
    id: 'mchc',
    name: 'MCHC',
    aliases: [
      'MCHC',
      'Mean Corpuscular Hemoglobin Concentration',
      'Mean Corpuscular Haemoglobin Concentration',
    ],
    // MCHC is dimensionally g/dL (mass per volume), but many Indian
    // and older Commonwealth labs report it as % — both notations are
    // numerically interchangeable (g/dL × 1 = g/100mL → expressed as %).
    // Adding "%" so those reports parse without changing the canonical
    // unit used for display.
    unit: 'g/dL',
    unitAliases: ['g/dl', 'gm/dL', '%', 'gms/dl'],
    min: 32,
    max: 36,
    category: 'blood',
    direction: 'band',
    simpleName: 'Hemoglobin density per red cell',
    plain:
      'Together with MCV and MCH, MCHC helps classify the type of anaemia.',
  },
  {
    id: 'rdw',
    name: 'RDW',
    aliases: [
      'RDW-CV',
      'RDW-SD',
      'RDW',
      'Red Cell Distribution Width',
      'Red cell distribution width',
    ],
    unit: '%',
    min: 11.5,
    max: 14.5,
    category: 'blood',
    direction: 'down',
    simpleName: 'How variable your red-cell sizes are',
    plain:
      'High RDW means your red cells vary in size — an early sign of nutritional deficiency or marrow stress.',
  },

  /* ---- Electrolytes -------------------------------------------- */
  {
    id: 'sodium',
    name: 'Sodium',
    aliases: ['Sodium', 'Serum Sodium'],
    unit: 'mmol/L',
    unitAliases: ['mEq/L', 'mmol/l'],
    min: 135,
    max: 145,
    // Critical: <125 = severe hyponatremia (seizure risk, cerebral
    // edema); >155 = severe hypernatremia (CNS dysfunction, brain
    // dehydration). Both are same-day-care.
    criticalLow: 125,
    criticalHigh: 155,
    physicalMin: 90,
    physicalMax: 200,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Salt — fluid balance',
    plain:
      'Sodium controls your blood volume. Both ends are clinically significant; context matters.',
  },
  {
    id: 'potassium',
    name: 'Potassium',
    aliases: ['Potassium', 'Serum Potassium'],
    unit: 'mmol/L',
    unitAliases: ['mEq/L', 'mmol/l'],
    min: 3.5,
    max: 5,
    // Critical: ≤2.5 or ≥6.0 are arrhythmia / cardiac arrest thresholds.
    // This is the marker where "critical" tier is least negotiable —
    // a value of 6.5 mEq/L is a same-hour emergency regardless of
    // patient context.
    criticalLow: 2.5,
    criticalHigh: 6,
    physicalMin: 1,
    physicalMax: 10,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Heart-rhythm electrolyte',
    plain:
      'Potassium runs your nerves and heart rhythm. Out-of-range values need immediate medical attention.',
  },
  {
    // Chloride completes the basic electrolyte panel alongside sodium +
    // potassium — it was missing, so a standard panel (very common on
    // Malaysian/Indian/US reports) dropped this row. mmol/L and mEq/L are
    // numerically identical for chloride, so no SI conversion is needed.
    id: 'chloride',
    name: 'Chloride',
    aliases: ['Chloride', 'Serum Chloride'],
    unit: 'mmol/L',
    unitAliases: ['mEq/L', 'mmol/l'],
    min: 98,
    max: 107,
    physicalMin: 70,
    physicalMax: 130,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Salt partner to sodium',
    plain:
      'Moves with sodium to balance fluids and blood acidity. Usually only meaningful read alongside sodium and bicarbonate.',
  },
  {
    id: 'calcium',
    name: 'Calcium',
    aliases: ['Calcium', 'Total Calcium', 'Serum Calcium'],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    min: 8.5,
    max: 10.2,
    // Critical: <7 = severe hypocalcemia (tetany, seizure, prolonged
    // QT); >12 = hypercalcemia crisis (renal failure, coma risk).
    criticalLow: 7,
    criticalHigh: 12,
    physicalMin: 4,
    physicalMax: 20,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Bones, muscles, nerves',
    plain:
      'Calcium is regulated by parathyroid hormone and Vitamin D. Persistent abnormalities need investigation.',
  },

  /* ---- Inflammation -------------------------------------------- */
  {
    id: 'crp',
    name: 'CRP',
    aliases: [
      'hs-CRP',
      'High Sensitivity CRP',
      'High-Sensitivity CRP',
      'C-Reactive Protein',
      'C Reactive Protein',
      'CRP',
    ],
    unit: 'mg/L',
    unitAliases: ['mg/l'],
    min: 0,
    max: 3,
    optimalMin: 0,
    optimalMax: 1,
    optimalSource: {
      label:
        'AHA/CDC 2003 Scientific Statement on Inflammation (Pearson et al.) — <1 mg/L = low CVD risk band',
      url: 'https://www.ahajournals.org/doi/10.1161/01.CIR.0000052939.59093.45',
      audience: 'adults',
    },
    // Acute-phase reactant. The 5×-span fallback (cap ≈ 18) was
    // silently deleting COVID-19 / sepsis / acute pancreatitis
    // readings that legitimately spike to 100–500 mg/L. Bumped to
    // 1000 (covers documented sepsis maxima). Critical: ≥100 mg/L is
    // the clinical inflection — same-day evaluation is appropriate.
    criticalHigh: 100,
    physicalMin: 0,
    physicalMax: 1000,
    category: 'inflammation',
    direction: 'down',
    simpleName: 'A general inflammation signal',
    plain:
      'Persistently elevated CRP suggests low-grade inflammation — linked to heart disease and metabolic issues.',
  },
  {
    id: 'esr',
    name: 'ESR',
    aliases: ['ESR', 'Erythrocyte Sedimentation Rate', 'Sed Rate'],
    unit: 'mm/hr',
    unitAliases: ['mm/h', 'mm/1hr'],
    min: 0,
    max: 15,
    physicalMin: 0,
    physicalMax: 200,
    category: 'inflammation',
    direction: 'down',
    simpleName: 'Old-school inflammation marker',
    plain:
      'ESR is a non-specific inflammation gauge. Less precise than CRP but still useful in context.',
  },
  {
    id: 'd-dimer',
    name: 'D-Dimer',
    aliases: [
      'D-Dimer',
      'D Dimer',
      'D-dimer',
      'DDimer',
      'Fibrin Degradation Product',
    ],
    unit: 'ng/mL',
    unitAliases: ['ng/ml', 'µg/mL', 'mg/L', 'FEU ng/mL', 'DDU ng/mL'],
    min: 0,
    max: 500,
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
    physicalMin: 0,
    physicalMax: 100000,
    category: 'inflammation',
    direction: 'down',
    simpleName: 'Clotting-breakdown signal',
    plain:
      'Elevated D-Dimer suggests active clot formation — pulmonary embolism, DVT, or systemic inflammatory states like COVID-19.',
  },

  /* ---- Cardiac + sepsis emergency markers ----------------------
   * Standard Indian-lab "Acute Care" panels include Troponin I,
   * NT-proBNP, LDH, CK-MB, and Procalcitonin. Without catalog
   * coverage these would surface as "unrecognized rows" on every
   * emergency-room or post-MI workup report. Each carries an
   * explicit critical threshold — these are the markers where
   * same-day-care framing is the WHOLE point of the test.
   */
  {
    id: 'troponin-i',
    name: 'Troponin I',
    aliases: [
      'Troponin I',
      'cTnI',
      'Cardiac Troponin I',
      'hs-Trop I',
      'Hs-cTnI',
      'High Sensitivity Troponin I',
    ],
    unit: 'ng/mL',
    unitAliases: ['ng/ml', 'pg/mL', 'pg/ml'],
    min: 0,
    max: 0.04,
    // Critical: ≥0.04 ng/mL is the universal MI rule-in threshold
    // (4th Universal Definition of Myocardial Infarction, ESC/AHA
    // 2018). For a consumer dashboard, surfacing this value at all
    // means an acute-care setting — the critical framing is non-
    // negotiable here.
    criticalHigh: 0.04,
    physicalMin: 0,
    physicalMax: 1000,
    category: 'heart',
    direction: 'down',
    simpleName: 'Heart-muscle damage marker',
    plain:
      'Troponin I rises with cardiac injury — any detectable amount above the threshold is a same-day cardiology call. Used in acute-care settings to rule MI in or out.',
  },
  {
    id: 'nt-pro-bnp',
    name: 'NT-proBNP',
    aliases: [
      'NT-proBNP',
      'NTproBNP',
      'NT pro BNP',
      'N-Terminal pro-BNP',
      'BNP',
    ],
    unit: 'pg/mL',
    unitAliases: ['pg/ml', 'ng/L'],
    min: 0,
    max: 125,
    // Critical: ≥450 pg/mL (<50yr) / ≥900 pg/mL (50-75yr) — heart-
    // failure decompensation. Conservative single threshold of 450
    // since age-stratification would need patient context.
    criticalHigh: 450,
    physicalMin: 0,
    physicalMax: 50000,
    category: 'heart',
    direction: 'down',
    simpleName: 'Heart-strain signal from the ventricles',
    plain:
      'NT-proBNP rises when the heart’s ventricles are stretched — a sensitive heart-failure marker. Elevated values warrant urgent cardiology evaluation.',
  },
  {
    id: 'ldh',
    name: 'LDH',
    aliases: ['LDH', 'Lactate Dehydrogenase', 'Lactic Acid Dehydrogenase'],
    unit: 'U/L',
    unitAliases: ['u/L', 'IU/L'],
    min: 140,
    max: 280,
    // Critical: ≥600 = severe tissue damage / hemolysis / massive
    // tumor lysis. Non-specific but the magnitude itself is the
    // signal.
    criticalHigh: 600,
    physicalMin: 0,
    physicalMax: 10000,
    category: 'inflammation',
    direction: 'down',
    simpleName: 'Tissue-damage signal (non-specific)',
    plain:
      'LDH leaks from damaged cells. Elevated in heart attack, hemolysis, liver disease, lymphoma, and severe muscle injury. Pair with other markers for the specific cause.',
  },
  {
    id: 'ck-mb',
    name: 'CK-MB',
    aliases: ['CK-MB', 'CKMB', 'Creatine Kinase MB', 'CK-MB Mass'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml', 'µg/L'],
    min: 0,
    max: 5,
    // Critical: ≥10 = cardiac muscle injury. Less specific than
    // Troponin I but historically the workhorse cardiac marker.
    criticalHigh: 10,
    physicalMin: 0,
    physicalMax: 500,
    category: 'heart',
    direction: 'down',
    simpleName: 'Cardiac muscle damage marker (older)',
    plain:
      'CK-MB rises with cardiac muscle damage. Largely superseded by Troponin I, but still printed on many Indian lab panels.',
  },
  {
    id: 'procalcitonin',
    name: 'Procalcitonin',
    aliases: ['Procalcitonin', 'PCT', 'Pro-Calcitonin'],
    unit: 'ng/mL',
    unitAliases: ['ng/ml', 'µg/L'],
    min: 0,
    max: 0.1,
    // Critical: ≥2 ng/mL = high probability of bacterial sepsis;
    // ≥10 = septic-shock territory. The 2 ng/mL cutoff is the
    // antibiotic-escalation trigger used in most ICU protocols.
    criticalHigh: 2,
    physicalMin: 0,
    physicalMax: 1000,
    category: 'inflammation',
    direction: 'down',
    simpleName: 'Bacterial-sepsis marker',
    plain:
      'Procalcitonin is specific to bacterial infection — viral illness does not raise it. Useful for distinguishing bacterial from viral when both look similar clinically.',
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
    min: 0,
    max: 2.5,
    optimalMin: 0,
    optimalMax: 1.5,
    optimalSource: {
      label:
        'Wallace et al., Diabetes Care 2004 — insulin-sensitive band <1.5; resistance ≥2.5',
      url: 'https://diabetesjournals.org/care/article/27/6/1487/22845',
      audience: 'adults',
    },
    physicalMin: 0,
    physicalMax: 50,
    category: 'metabolic',
    direction: 'down',
    simpleName: 'How insulin-resistant you are',
    plain:
      'Combines fasting glucose + fasting insulin into one insulin-resistance number. Higher = your pancreas is working harder for the same blood sugar.',
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
    aliases: [
      'Neutrophils',
      'Neutrophil',
      'Neutrophils %',
      'Polymorphs',
      'Polymorphonuclear',
      'PMN',
      'Segmented Neutrophils',
    ],
    unit: '%',
    min: 40,
    max: 75,
    physicalMin: 0,
    physicalMax: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Front-line bacterial fighters',
    plain:
      'High % often signals bacterial infection or stress. Very low % can mean viral illness or marrow suppression.',
  },
  {
    id: 'lymphocytes',
    name: 'Lymphocytes',
    aliases: ['Lymphocytes', 'Lymphocyte', 'Lymphocytes %', 'Lymphs'],
    unit: '%',
    min: 20,
    max: 45,
    physicalMin: 0,
    physicalMax: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Viral / antibody-immunity cells',
    plain:
      'High % often suggests viral infection or chronic immune activation. Low % can point to acute stress, steroids, or HIV.',
  },
  {
    id: 'monocytes',
    name: 'Monocytes',
    aliases: ['Monocytes', 'Monocyte', 'Monocytes %', 'Monos'],
    unit: '%',
    min: 2,
    max: 10,
    physicalMin: 0,
    physicalMax: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Tissue cleanup + chronic-immunity cells',
    plain:
      'Elevated monocytes can signal chronic inflammation, certain infections, or recovery from acute illness.',
  },
  {
    id: 'eosinophils',
    name: 'Eosinophils',
    aliases: ['Eosinophils', 'Eosinophil', 'Eosinophils %', 'Eos'],
    unit: '%',
    min: 0,
    max: 6,
    physicalMin: 0,
    physicalMax: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Allergy + parasite cells',
    plain:
      'Elevated eosinophils usually suggest allergy, asthma, or parasitic infection. Common in Indian populations from intestinal parasites.',
  },
  {
    id: 'basophils',
    name: 'Basophils',
    aliases: ['Basophils', 'Basophil', 'Basophils %', 'Basos'],
    unit: '%',
    min: 0,
    max: 2,
    physicalMin: 0,
    physicalMax: 100,
    category: 'blood',
    direction: 'band',
    simpleName: 'Rare allergic-response cells',
    plain:
      'Usually <2% in a healthy sample. Persistent elevation can suggest allergic disorders or certain chronic conditions.',
  },
  {
    id: 'anc',
    name: 'Absolute Neutrophil Count',
    aliases: [
      'Absolute Neutrophil Count',
      'ANC',
      'Absolute Neutrophils',
      'Neutrophils Absolute',
    ],
    unit: '/cumm',
    unitAliases: [
      'cells/cumm',
      '/μL',
      '/cu.mm',
      'cu.mm',
      '/cu mm',
      'cumm',
      'thou/mm3',
      'thou/μL',
      'thousand/μL',
      'thou/cumm',
      '10^3/μL',
      '10^3/uL',
    ],
    min: 1500,
    max: 8000,
    // Critical floor: <500 = severe neutropenia (sepsis risk;
    // hospitalisation is standard); <1000 = febrile-neutropenia
    // threshold. Hospital labs panic-call ANC <500 universally.
    criticalLow: 500,
    physicalMin: 0,
    physicalMax: 50000,
    category: 'blood',
    direction: 'band',
    simpleName: 'Frontline infection-defence count',
    plain:
      'ANC < 1,500 is neutropenia; < 500 is severe and an immediate medical concern. Common in chemo patients, autoimmune disease, and severe viral illness.',
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
