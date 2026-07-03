import { biomarkerCatalog } from './biomarkerCatalog';

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
    description: 'Processes nutrients, medications, and waste.',
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
      'Right at the upper edge of normal. For many men, a short walk after meals helps nudge this down over time.',
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
    line = `One thing to act on: ${concerns[0]}. Everything else is on track or close to it — a focused plan, with your doctor, is a sensible next step.`;
  } else {
    line = `Two things to focus on: ${concerns.slice(0, 2).join(' and ')}. Both usually respond to the same set of habits — sleep, movement, and a couple of nutrient swaps.`;
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

/* The biomarkerCatalog data table — and the authoring conventions for
 * adding entries — now live in ./biomarkerCatalog.ts. Re-exported here so
 * every existing `import { biomarkerCatalog } from '.../data/biomarkers'`
 * (parser, AI fallback, manual entry, tests) keeps resolving unchanged. */
export { biomarkerCatalog };

/**
 * Find a template by id. Used by tests, the parser fallback, and any
 * surface that wants to render a known marker shape without a value
 * (e.g. "here's what we'd test").
 */
export function getTemplateById(id: string): BiomarkerTemplate | undefined {
  return biomarkerCatalog.find((t) => t.id === id);
}
