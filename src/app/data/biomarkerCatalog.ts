import type { BiomarkerTemplate } from './biomarkers';

/* ------------------------------------------------------------------ *
 * biomarkerCatalog — the clinical data table.
 *
 * Extracted verbatim from biomarkers.ts so the ~2,000-line marker
 * "database" (ranges, aliases, harm-anchors, plain-language copy) lives
 * apart from the scoring/trend/template LOGIC that consumes it. Pure
 * data: no value imports, only the BiomarkerTemplate shape (type-only,
 * erased at runtime — no import cycle with biomarkers.ts).
 *
 * Order is preserved exactly. The parser's matcher suppresses by span
 * specificity, not catalog order (see extractBiomarkersFromText), but
 * the output marker order still follows this array, so entries stay in
 * their original sequence. Append new markers in the right section.
 * ------------------------------------------------------------------ */

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
    id: 'psa',
    name: 'PSA (Total)',
    aliases: [
      'Prostate Specific Antigen',
      'Prostate-Specific Antigen',
      'PSA Total',
      'PSA, Total',
      'Total PSA',
      'Serum PSA',
      'PSA',
    ],
    unit: 'ng/mL',
    unitAliases: ['ng/ml'],
    min: 0,
    max: 4,
    // No optimal sub-band: within the normal range PSA has no "better when
    // lower" target — a healthy 0.5 and a healthy 3.5 read the same. Only
    // the upper bound carries clinical meaning.
    // Harm-anchor: the conventional total-PSA screening threshold. >4.0 ng/mL
    // is the long-standing referral line — age-dependent and non-specific
    // (see plain), NOT a same-day emergency, so no critical bound: a raised
    // PSA is an unhurried urology conversation, not a panic value.
    actionMax: 4,
    actionSource: {
      label:
        'Catalona et al., NEJM 1991 — 4.0 ng/mL total-PSA screening threshold (the conventional referral cutoff; age-specific ranges refine it)',
      url: 'https://www.nejm.org/doi/full/10.1056/NEJM199104253241702',
      audience: 'adult men · age-dependent',
    },
    // Physical ceiling deliberately generous: metastatic prostate disease
    // pushes PSA into the hundreds or thousands, and the 5×-span fallback
    // (cap ≈ 24) would silently drop those real, important reads.
    physicalMin: 0,
    physicalMax: 10000,
    category: 'hormones',
    direction: 'down',
    simpleName: 'Prostate screening marker',
    plain:
      'A prostate protein used for screening. A raised PSA is common and usually NOT cancer — an enlarged prostate, a recent bike ride or ejaculation, or inflammation all lift it, and the normal cutoff rises with age. Treat a high value as a reason to talk to a doctor, not to worry.',
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
    // Men's E2 climbs into the hundreds with aromatase excess, obesity,
    // cirrhosis or an oestrogen-secreting tumour — the causes of the
    // gynaecomastia this panel exists to explain. Fallback ceiling was 209.
    physicalMin: 0,
    physicalMax: 1000,
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
      'Fasting Plasma Glucose',
      'FBS',
      'FPG',
      // Unqualified glucose. On a chemistry panel an unlabelled "Glucose"
      // is the fasting draw by clinical convention, so these grade against
      // the fasting band — the bare forms were previously MISSED entirely
      // (a report printing just "Glucose 105 mg/dL" extracted nothing).
      // excludeIfRowMatches below keeps urine / random / post-prandial
      // glucose — same name, different specimen or timing, different range —
      // from being graded here and firing a false flag.
      'Glucose',
      'Blood Glucose',
      'Plasma Glucose',
      'Serum Glucose',
      'Blood Sugar',
    ],
    // Refuse rows where "glucose"/"sugar" means a DIFFERENT test than the
    // fasting blood draw this template grades: a different specimen (urine,
    // CSF, body fluid — normally near-zero, so a value would false-critical
    // against the 70–99 band) or a different timing (random / post-prandial /
    // OGTT — legitimately higher, so a normal 130 would false-flag as
    // 'concern'). The timed draws are instead graded by the dedicated
    // glucose-random / glucose-pp templates below (whose specific aliases
    // never match a fasting row); this guard just stops the fasting band
    // from also claiming them. Authored without the `g` flag (stateless).
    excludeIfRowMatches:
      /\b(?:urine|urinary|csf|cerebrospinal|pleural|ascitic|peritoneal|synovial|body[\s-]*fluid|random|post[\s-]?prandial|postprandial|non[\s-]?fasting|ogtt|gtt|tolerance|pp|ppbs|rbs|ppg)\b/i,
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
      'Your blood sugar this morning, before food. Movement after meals helps many men keep it steady — but a high reading is worth confirming with a doctor.',
  },
  {
    id: 'glucose-pp',
    name: 'Post-Prandial Glucose',
    // Every alias carries an explicit post-meal marker (PP / prandial / post
    // lunch / 2 hour), so none can match a fasting or random row — and the
    // fasting template's excludeIfRowMatches keeps IT from claiming these.
    aliases: [
      'Post-Prandial Glucose',
      'Post-Prandial Blood Sugar',
      'Post Prandial Blood Sugar',
      'Postprandial Blood Sugar',
      'Post Prandial Plasma Glucose',
      'Post Prandial Glucose',
      'Postprandial Glucose',
      '2 Hour Post Prandial',
      'Post Lunch Blood Sugar',
      'Glucose Post Prandial',
      'Glucose, PP',
      'Glucose PP',
      'PPBS',
      'PLBS',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 18.0156 }],
    // Same specimen caveat as fasting glucose: a urine/body-fluid draw is a
    // different test on a different scale.
    excludeIfRowMatches:
      /\b(?:urine|urinary|csf|cerebrospinal|pleural|ascitic|peritoneal|synovial|body[\s-]*fluid)\b/i,
    // WHO/ICMR 2-hour post-load thresholds: <140 normal, 140–199 impaired
    // glucose tolerance, ≥200 diagnostic of diabetes. The lower bound is the
    // hypoglycaemia floor, not a target — there's no "optimal" post-meal peak
    // beyond "under 140".
    min: 70,
    max: 140,
    criticalLow: 50,
    criticalHigh: 300,
    physicalMin: 30,
    physicalMax: 900,
    actionMax: 200,
    actionSource: {
      label:
        'WHO/ICMR diabetes diagnostic line (2-hour post-load glucose ≥200 mg/dL); 140–199 mg/dL is impaired glucose tolerance',
      url: 'https://main.icmr.nic.in/sites/default/files/guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf',
      audience: 'adults · India (ICMR/WHO criteria)',
    },
    category: 'metabolic',
    direction: 'down',
    simpleName: 'Blood sugar ~2 hours after a meal',
    plain:
      'Your blood sugar about two hours after eating. Under 140 is normal; a higher reading means your body cleared the meal slowly — worth confirming with a doctor.',
  },
  {
    id: 'glucose-random',
    name: 'Random Glucose',
    aliases: [
      'Random Blood Sugar',
      'Random Blood Glucose',
      'Random Plasma Glucose',
      'Random Glucose',
      'Glucose Random',
      'Glucose, Random',
      'RBS',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 18.0156 }],
    excludeIfRowMatches:
      /\b(?:urine|urinary|csf|cerebrospinal|pleural|ascitic|peritoneal|synovial|body[\s-]*fluid)\b/i,
    // A random (non-fasting) draw has no fasting reference: WHO/ADA read
    // <140 mg/dL as normal and ≥200 mg/dL (with symptoms) as diagnostic of
    // diabetes. 140–199 warrants a fasting re-check.
    min: 70,
    max: 140,
    criticalLow: 50,
    criticalHigh: 300,
    physicalMin: 30,
    physicalMax: 900,
    actionMax: 200,
    actionSource: {
      label:
        'WHO/ADA random plasma glucose ≥200 mg/dL (with symptoms) is diagnostic of diabetes; <140 mg/dL is normal',
      url: 'https://main.icmr.nic.in/sites/default/files/guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf',
      audience: 'adults · India (ICMR/WHO criteria)',
    },
    category: 'metabolic',
    direction: 'down',
    simpleName: 'Blood sugar at a random time',
    plain:
      'Blood sugar measured without fasting. Under 140 is normal; 140–199 is worth a fasting re-check, and 200 or above needs a doctor’s review.',
  },
  {
    id: 'insulin',
    name: 'Fasting Insulin',
    aliases: ['Fasting Insulin', 'Insulin Fasting', 'Insulin, Fasting'],
    unit: 'µIU/mL',
    unitAliases: ['uIU/mL', 'mIU/L', 'µIU/ml'],
    min: 2,
    max: 25,
    // Severe insulin resistance runs fasting insulin 50-150 uIU/mL, an
    // insulinoma far higher; the fallback ceiling of 140 clipped exactly the
    // metabolic pictures worth catching. HOMA-IR is derived FROM insulin, so
    // a clipped insulin silently removes the derived marker too.
    physicalMin: 0,
    physicalMax: 1000,
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
      'Mostly carries triglycerides. It rises and falls with them, so what helps is the same: less sugar, refined carbs, and alcohol.',
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
    // Critical: ≥300 suggests acute hepatocellular injury (viral hepatitis
    // flare, drug toxicity, ischaemic hepatitis) — the same cliff AST sets,
    // for the same reason. ALT is the MORE liver-specific of the pair (AST
    // also comes from muscle and heart), so it having no critical threshold
    // while AST had one was backwards: AST 350 said "speak to a doctor
    // promptly" while ALT 1200 said "discuss it at your appointment".
    criticalHigh: 300,
    // ALT genuinely reaches the thousands in acute hepatocellular injury.
    // The 5×-span fallback capped this at ~301 and BINNED anything above —
    // so the most dangerous ALT a report can carry was silently dropped and
    // the user saw no ALT at all. AST already sets 10000 and its own note
    // says "pair with ALT for confirmation", which we were making
    // impossible. Matched to AST.
    physicalMin: 0,
    physicalMax: 10000,
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
      // "Percentage motility" / "Motility (Total)" — DRLOGY & other Indian
      // seminogram templates. Both name the total explicitly, so (unlike
      // bare "Motility") they can't collide with the progressive/forward
      // grades.
      'Percentage motility',
      'Motility (Total)',
      'Total Motility (PR+NP)',
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
    id: 'sperm-vitality',
    name: 'Vitality',
    // "Vitality" / "Viability" — the live-sperm fraction, a distinct WHO
    // parameter from motility (a sperm can be alive but not moving). Common
    // on Indian seminograms and previously missing entirely.
    aliases: [
      'Sperm vitality',
      'Vitality',
      'Sperm viability',
      'Viability',
      'Live sperm',
    ],
    unit: '%',
    min: 54,
    max: 100,
    category: 'fertility',
    direction: 'up',
    simpleName: '% of sperm that are alive',
    plain:
      'WHO 2021 reference is ≥54% live sperm. A sperm can be alive but not moving, so vitality is checked separately from motility — a low value with low motility points to a viability problem.',
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
    // LH and FSH are the DISCRIMINATOR for low testosterone, and the reason
    // they are on this panel at all:
    //   high LH/FSH + low T -> primary (the testes have failed)
    //   low  LH/FSH + low T -> secondary (the pituitary isn't signalling)
    // It is the next question any doctor asks, and the two answers lead to
    // completely different places.
    //
    // Primary hypogonadism runs LH 15-50 and FSH 20-90; Klinefelter's,
    // castrate-range and post-chemotherapy failure go higher still. The
    // 5×-span fallback ceilings sat at 43 and 67 — inside that range. So on
    // the reports where the answer was most obvious, we deleted it, and the
    // man saw low testosterone with no explanation next to it. Same failure
    // as prolactin: the clearer the finding, the more likely we binned it.
    id: 'lh',
    name: 'LH',
    aliases: ['LH', 'Luteinizing Hormone', 'Luteinising Hormone'],
    unit: 'mIU/mL',
    unitAliases: ['mIU/ml', 'IU/L'],
    min: 1.7,
    max: 8.6,
    physicalMin: 0,
    physicalMax: 200,
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
    // See the note above LH — same axis, same reasoning. Primary testicular
    // failure drives FSH to 30-90+; the fallback ceiling was 67.
    physicalMin: 0,
    physicalMax: 200,
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
    // The most important ceiling in this file for THIS app.
    //
    // A prolactin-secreting pituitary adenoma is the classic treatable cause
    // of the exact picture we exist to explain: low testosterone, low libido,
    // erectile dysfunction, gynaecomastia. >100 ng/mL is near-diagnostic of a
    // prolactinoma and a macroadenoma routinely runs 200-2000+.
    //
    // The 5×-span fallback put the ceiling at ~71 — BELOW every prolactinoma
    // that exists. So on a report where high prolactin was the answer to the
    // low testosterone printed beside it, we deleted the prolactin and showed
    // the man his low T with nothing to explain it. The one thing this app
    // most needed to surface was the one thing it structurally could not.
    physicalMin: 0,
    physicalMax: 10000,
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
    // Cushing's, acute stress and exogenous steroid push AM cortisol past
    // 50 ug/dL; adrenal crisis is the mirror. Fallback ceiling was 85.
    physicalMin: 0,
    physicalMax: 200,
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
    // Thyroid storm: total T3 400-800 ng/dL. Fallback: 800.
    physicalMin: 0,
    physicalMax: 1500,
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
    // SI: UK/EU labs report Free T3 in pmol/L. FT3 (MW 650.98):
    // 1 pmol/L = 0.651 pg/mL. Without this a UK thyroid panel dropped
    // FT3 entirely (its pmol/L value fell outside the pg/mL band).
    altUnits: [{ units: ['pmol/L', 'pmol/l'], toCanonical: 0.651 }],
    min: 2.3,
    max: 4.2,
    // T3 toxicosis / thyroid storm reaches 20-30 pg/mL. Fallback: 14.
    physicalMin: 0,
    physicalMax: 50,
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
    // SI: UK/EU labs report Free T4 in pmol/L (typical 12–22). FT4
    // (MW 776.87): 1 pmol/L = 0.0777 ng/dL. Without this a UK thyroid
    // panel matched only TSH and dropped FT4.
    altUnits: [{ units: ['pmol/L', 'pmol/l'], toCanonical: 0.0777 }],
    min: 0.8,
    max: 1.8,
    // Critical thresholds MIRROR the already-reviewed TSH decision (TSH
    // criticalLow 0.01 = storm, criticalHigh 50 = myxedema) so a thyroid
    // emergency still escalates when TSH is absent from the report or was
    // misread. Deliberately conservative — overt hyperthyroidism (FT4 ~2-4)
    // stays 'concern'; only clearly-severe values trip 'critical', so common
    // thyroid disease isn't over-alarmed. FT4 >5 ng/dL (≈3x ULN) is florid
    // thyrotoxicosis territory; <0.3 is severe hypothyroidism.
    // NOTE FOR CLINICAL REVIEW: confirm these two cutoffs (5.0 / 0.3 ng/dL).
    criticalLow: 0.3,
    criticalHigh: 5,
    // Thyroid storm reaches 5-10 ng/dL. Fallback ceiling was 7 — inside
    // the range, so the most florid thyrotoxicosis was the most likely to
    // be binned.
    physicalMin: 0,
    physicalMax: 20,
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
      'High TIBC can go with iron deficiency; low TIBC with inflammation or a long-term illness. Read it alongside your other iron markers.',
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
    // Biliary obstruction and Paget's disease push ALP into the thousands;
    // the 5×-span fallback capped it at ~662 and binned them. Same failure
    // as ALT — the more urgent the reading, the more likely we deleted it.
    physicalMin: 0,
    physicalMax: 5000,
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
    // Alcoholic hepatitis and biliary obstruction reach 1000-3000 U/L. The
    // 5×-span fallback capped GGT at ~243 — and GGT is the marker most often
    // reached for when alcohol is the question, so binning the high end
    // removed the answer precisely when it was the point.
    physicalMin: 0,
    physicalMax: 5000,
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
    // 'Protein, Total' — the comma form — was missing while every sibling
    // that inverts this way already had it ('Cholesterol, Total',
    // 'Bilirubin, Total', 'Testosterone, Total'). Caught on Dr Lal PathLabs'
    // own published specimen (E001, protein electrophoresis), which prints
    // 'Protein, Total' while their SWASTHFIT panel prints 'Total Protein' —
    // the same lab uses both, so the comma alone was losing the marker.
    aliases: [
      'Total Protein',
      'Protein, Total',
      'Protein Total',
      'Total Serum Protein',
    ],
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
  {
    id: 'globulin',
    name: 'Globulin',
    aliases: ['Total Globulin', 'Serum Globulin', 'Globulin'],
    unit: 'g/dL',
    unitAliases: ['g/dl', 'gm/dL'],
    // Guard the shared "globulin" suffix: protein-electrophoresis fractions
    // (alpha / beta / gamma globulin) and the binding globulins (SHBG, TBG,
    // CBG) are DIFFERENT analytes on different scales and must not grade
    // against the total-globulin band. "Immunoglobulin" is already blocked
    // by the alias left-boundary (…noGlobulin has no word break before it);
    // the spaced fraction/binding names need this. Unit gate (g/dL) also
    // rejects SHBG (nmol/L), but the guard keeps the g/dL electrophoresis
    // fractions out too.
    excludeIfRowMatches:
      /\b(?:alpha|beta|gamma|immuno|sex[\s-]*hormone|shbg|thyroxine|corticosteroid|binding)\b/i,
    min: 2,
    max: 3.5,
    category: 'liver',
    direction: 'band',
    simpleName: 'Immune & transport proteins',
    plain:
      'The blood proteins other than albumin — many of them antibodies. Reported alongside total protein and albumin; a persistent abnormality is worth a look with your doctor.',
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
      'Low MCH can go with iron deficiency, high MCH with low B12 or folate. On its own it doesn’t pin down the cause — it’s read alongside your other red-cell markers.',
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
  {
    id: 'phosphorus',
    name: 'Phosphorus',
    aliases: [
      'Inorganic Phosphorus',
      'Serum Phosphorus',
      'Phosphorus',
      'Phosphorous',
      'Inorganic Phosphate',
      'Serum Phosphate',
      'Phosphate',
    ],
    unit: 'mg/dL',
    unitAliases: ['mg/dl'],
    // SI: 1 mmol/L phosphorus = 3.097 mg/dL (atomic mass P = 30.97).
    // UK / EU / Malaysian reports print mmol/L.
    altUnits: [{ units: ['mmol/L', 'mmol/l'], toCanonical: 3.097 }],
    min: 2.5,
    max: 4.5,
    // Critical: <1.0 mg/dL is severe hypophosphatemia (respiratory-muscle
    // weakness, rhabdomyolysis) — a recognised panic value. >9 mg/dL is
    // severe hyperphosphatemia, typically advanced renal failure.
    criticalLow: 1,
    criticalHigh: 9,
    physicalMin: 0.2,
    physicalMax: 20,
    category: 'electrolytes',
    direction: 'band',
    simpleName: 'Bone & energy mineral',
    plain:
      'Phosphorus partners with calcium for bone strength and powers your cells. Abnormal levels usually point to kidney function or Vitamin D rather than diet.',
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
      'Your first responders to infection. A high share can go with a bacterial infection or stress; a very low share with a viral illness.',
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
      'Behind your longer-term immunity. A high share can go with a viral infection; a low share with stress or some medicines.',
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
      'Your clean-up crew. Higher numbers can go with ongoing inflammation, an infection, or bouncing back from an illness.',
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
      'Allergy and parasite responders. Higher numbers can go with allergies, asthma, some medicines, or a parasite — it depends on the wider picture.',
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
      'The rarest of your white cells. A small number is normal; a lasting rise can go with allergies or some longer-term conditions.',
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
