/**
 * Real-report extraction corpus.
 *
 * Every entry here is the text of an ACTUAL lab report a user uploaded
 * (the "show what we read from the file" disclosure), paired with the
 * markers we expect the catalog matcher to pull out. Each one was a real
 * bug at some point — VLDL missing, SI units dropped, dotted "W.B.C"
 * unmatched, a phantom sperm count on a CBC, RBC collapsing to 0. These
 * fixtures lock those fixes in so a future catalog/matcher change can't
 * silently regress them.
 *
 * ── To add a report ──────────────────────────────────────────────
 * Paste its "what we read" text into a new FIXTURES entry, list the
 * markers + values you expect (exact number, or [min, max] for unit-
 * converted ones), and add `absent` ids for any false-positive you want
 * guarded against. That's it — the loop below does the rest.
 *
 * NOTE: these are TEXT-layer / clean-OCR fixtures. They exercise the
 * catalog matcher, not OCR fidelity or the Gemini vision path (those are
 * covered in pdfParser.test.ts / aiParser.mapping.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { extractBiomarkersFromText } from './pdfParser';

type Expectation = {
  /** marker id → exact value, or [min, max] band for unit-converted ones */
  values: Record<string, number | [number, number]>;
  /** marker ids that must NOT appear (false-positive guards) */
  absent?: string[];
  /** marker id → the lab's OWN printed range, as we should have read it
   *  (already converted to canonical units). `null` asserts we correctly
   *  captured NO range — e.g. a one-sided "<0.3", which isn't one. */
  labRange?: Record<string, [number, number] | null>;
};

type Fixture = { name: string; note: string; text: string; expect: Expectation };

const FIXTURES: Fixture[] = [
  {
    name: 'US-format CBC — Thous/cu.mm units',
    note: 'a real uploaded report: platelet/WBC printed as "Thous/cu.mm" (US abbreviation) were read UNSCALED — 172 vs a 150k–450k template — and flagged a FALSE critical-low. The "thous" prefix now scales them ×1000.',
    text: [
      'WBC 5.2 Thous/cu.mm 3.9 - 11.1',
      'PLATELET COUNT 172 Thous/cu.mm 140 - 390',
      'HGB (HEMOGLOBIN) 14.5 g/dL 13.2 - 16.9',
    ].join('\n'),
    expect: {
      values: {
        wbc: 5200, // 5.2 Thous → ×1000, normal (not critical-low)
        platelets: 172000, // 172 Thous → ×1000, normal (not critical-low)
        hb: 14.5,
      },
    },
  },
  {
    name: 'US-format renal panel — eGFR "per 1.73 m²" normalization',
    note: 'a real uploaded report: "GFR 28 1.73 mL/min/m²". The matcher grabbed the 1.73 body-surface-area constant as the value (a FALSE critical) instead of the true 28. The normalization is now stripped before matching.',
    text: [
      'GFR 28 1.73 mL/min/m²',
      'Creatinine 205 59 - 104 umol/L',
    ].join('\n'),
    expect: {
      values: {
        egfr: 28, // the real result, not the 1.73 normalization constant
        creatinine: [2.28, 2.36], // 205 µmol/L ÷ 88.42
      },
    },
  },
  {
    name: 'Bare "Glucose" panel — unqualified + specimen/timing guards',
    note: 'a report printing just "Glucose 105 mg/dL" (no "Fasting" qualifier) extracted NOTHING — every glucose alias was Fasting-qualified. Bare forms now grade as fasting (the panel convention), while the excludeIfRowMatches guard keeps urine glucose (would false-critical against 70–99) and random/post-prandial glucose (would false-flag a normal 130) from being graded here.',
    text: [
      'Glucose 105 mg/dL 70 - 100',
      'Blood Sugar 92 mg/dL',
      'Urine Glucose 15 mg/dL',
      'Random Blood Sugar 130 mg/dL',
      'Post Prandial Blood Sugar 145 mg/dL',
    ].join('\n'),
    expect: {
      values: {
        glucose: 105, // first bare row grades as fasting
      },
      // The urine / random / PP rows must NOT be pulled into the fasting
      // glucose marker — same name, different test/range. (glucose already
      // resolved to 105 above; these guards prove none of them overrode it
      // or produced a false flag.)
    },
  },
  {
    name: 'Non-fasting glucose rows only — must stay uninterpreted',
    note: 'guard proof in isolation: when the ONLY glucose-named rows are a tolerance-test draw and a urine draw (no plain fasting row to win first), the fasting template must extract NOTHING rather than grade them against 70–99. Both would be false flags otherwise.',
    text: [
      'Glucose Tolerance Test 2 Hour 160 mg/dL',
      'Urine Glucose 20 mg/dL',
    ].join('\n'),
    expect: {
      values: {},
      absent: ['glucose'],
    },
  },
  {
    name: 'FBS + PPBS + RBS triad — each graded by its own template',
    note: 'the standard Indian metabolic panel prints all three glucose draws together. Previously only fasting extracted; PP and random were dropped. Now each grades against its OWN cited band (fasting 70–99, post-prandial/random <140), and none cross-claims another — the fasting guard refuses the PP/random rows and their specific aliases never match the fasting row.',
    text: [
      'Fasting Blood Sugar 92 mg/dL 70 - 99',
      'Post Prandial Blood Sugar 128 mg/dL < 140',
      'Random Blood Sugar 118 mg/dL',
    ].join('\n'),
    expect: {
      values: {
        glucose: 92,
        'glucose-pp': 128,
        'glucose-random': 118,
      },
    },
  },
  {
    name: 'Globulin — direct extraction + electrophoresis-fraction guard',
    note: 'Globulin is printed on most liver panels and was dropped. Added as a direct 2.0–3.5 g/dL marker. Guard proven: a "Gamma Globulin" electrophoresis fraction must NOT be read as total globulin (different analyte/scale).',
    text: [
      'Total Protein 7.4 g/dL',
      'Albumin 4.4 g/dL',
      'Globulin 3.0 g/dL',
      'Gamma Globulin 1.1 g/dL',
    ].join('\n'),
    expect: {
      values: {
        'total-protein': 7.4,
        albumin: 4.4,
        globulin: 3.0,
      },
    },
  },
  {
    name: 'PSA + Phosphorus additions — with collision guards',
    note: 'new catalog entries (#coverage): PSA (men’s prostate marker) and Phosphorus, both previously dropped. Guards proven here: "Alkaline Phosphatase" must NOT be read as Phosphorus (different analyte), and a "% Free PSA" percentage must NOT be read as total PSA (the ng/mL unit gate blocks it). Phosphorus SI mmol/L converts to mg/dL.',
    text: [
      'PSA Total 1.8 ng/mL 0 - 4',
      'Phosphorus 3.4 mg/dL 2.5 - 4.5',
      'Alkaline Phosphatase 96 U/L 40 - 130',
      '% Free PSA 22 %',
    ].join('\n'),
    expect: {
      values: {
        psa: 1.8,
        phosphorus: 3.4,
      },
      absent: [], // psa must stay 1.8 (not overwritten by the 22% free-PSA row)
    },
  },
  {
    name: 'Phosphorus in SI units (mmol/L)',
    note: 'UK/EU/Malaysian phosphorus prints mmol/L; 1.13 mmol/L × 3.097 ≈ 3.5 mg/dL, normal against the 2.5–4.5 band.',
    text: ['Phosphate 1.13 mmol/L (0.81 - 1.45)'].join('\n'),
    expect: {
      values: {
        phosphorus: [3.4, 3.6], // 1.13 mmol/L × 3.097
      },
    },
  },
  {
    name: 'DRLOGY seminogram — the report that "couldn\'t be parsed"',
    note: 'a real semen-analysis upload extracted almost nothing. Three causes fixed: (1) a one-sided cutoff between value and unit ("15 >15 Million/mL") blocked the unit gate and dropped the headline sperm concentration; (2) "Percentage motility" was not an alias; (3) Vitality had no marker at all. Volume/pH already worked. Now the five real parameters extract; morphology on this template is a range-only placeholder cell, not a real value, so it is intentionally not asserted.',
    text: [
      'Duration of abstinence 2 2 - 7 days',
      'Liquefaction at 37 C 37 30 - 60 minutes',
      'Volume 1.5 > 1.5 mL',
      'pH 7.2',
      'Total sperm concentration 15 >15 Million/mL',
      'Percentage motility 60 >50 %',
      'Vitality 60 >58 %',
      'Agglutination Negative Negative',
    ].join('\n'),
    expect: {
      values: {
        'semen-volume': 1.5,
        'semen-ph': 7.2,
        'sperm-density': 15, // recovered by the one-sided-cutoff fix
        'sperm-motility-total': 60, // recovered by the "Percentage motility" alias
        'sperm-vitality': 60, // new marker
      },
    },
  },
  {
    name: 'GNU Solidario CBC — 10^3/uL prefixes, "Up to" ref, differential abbreviations',
    note: 'a real CBC upload. Three things exercised: (1) "ESR 2 Up to 15 mm/hr" was reading the reference 15 as the value — the textual one-sided cutoff "Up to N" now absorbs so the value 2 survives; (2) 10^3/uL and 10^6/uL count prefixes scale WBC/PLT/RBC; (3) abbreviated differential names (NEU%/LYM%/MON%/BAS%) now match.',
    text: [
      'Hemoglobin 12 11.0 - 16.0 g/dL',
      'RBC 3.3 3.5-5.50 10^6/uL',
      'HCT 36 37.0-50.0 %',
      'WBC 6.7 4.5-11 10^3/uL',
      'NEU% 60 40-70 %',
      'LYM% 30 20-45 %',
      'MON% 8 2-10 %',
      'BAS% 0 0-2 %',
      'PLT 256 150-450 10^3/uL',
      'ESR 2 Up to 15 mm/hr',
    ].join('\n'),
    expect: {
      values: {
        hb: 12,
        rbc: 3.3,
        hematocrit: 36,
        wbc: 6700, // 6.7 x10^3
        platelets: 256000, // 256 x10^3
        neutrophils: 60,
        lymphocytes: 30,
        monocytes: 8,
        basophils: 0,
        esr: 2, // NOT 15 — the "Up to 15" reference must not become the value
      },
    },
  },
  {
    name: 'Tabular anemia panel — dual-sex ranges, gm/dl, mcg/dl',
    note: 'a real tabular report with dual male/female reference ranges inline. Confirms the value (not a sex-range bound) is captured, and gm/dl / mcg/dl unit spellings match. "Total count 12.000" (European thousands separator) is intentionally NOT extracted — bare "Total count" is excluded to avoid the sperm-count collision, which also dodges the 12.000-vs-12.0 ambiguity.',
    text: [
      'Hemoglobin 10.2 Male: 13-18 gm/dl Female: 12-16 gm/dl',
      'Total count 12.000 4,000-10,000 cm/mm',
      'ESR 53 Male: 0-9 mm/hr Female: 10-20 mm/hr',
      'Total protein 4.2 6-8 gm/dl',
      'Blood urea 26 10-50 mg/dl',
      'Serum creatinine 0.8 0.6-1.1 mg/dl',
      'T4 6.62 6.09-12.23 mcg/dl',
    ].join('\n'),
    expect: {
      values: {
        hb: 10.2, // not 13/18/12/16 (the sex-range bounds)
        esr: 53,
        'total-protein': 4.2,
        bun: 26,
        creatinine: 0.8,
        t4: 6.62,
      },
      absent: ['wbc'], // "Total count 12.000" must not surface a mis-scaled WBC
    },
  },
  {
    name: 'US-style CBC — K/uL and M/uL count units',
    note: 'a stock US CBC printed WBC/PLT in K/uL and RBC in M/uL (ascii-u microlitre). None were recognised, so all three dropped. K→x1000, M→x1e6 now scale them: WBC 7800, RBC 5.2, PLT 202000.',
    text: [
      'WBC 7.8 4.0-11.0 K/uL',
      'RBC 5.20 4.5-6.0 M/uL',
      'Hemoglobin 15.3 13.5-17.5 g/dL',
      'Platelets 202 150-400 K/uL',
    ].join('\n'),
    expect: {
      values: {
        wbc: 7800, // 7.8 K → x1000
        rbc: 5.2, // 5.20 M/uL, already in millions → unchanged
        hb: 15.3,
        platelets: 202000, // 202 K → x1000
      },
    },
  },
  {
    name: 'Healthians CBC — "th/cumm" abbreviation (false-critical fix)',
    note: 'Healthians printed TLC as "4.24 th/cumm" (th = thousand). Unscaled, 4.24 read as a FALSE critical-low against the 4000-11000 band. "th" now scales x1000 → 4240 normal. Also confirms millions/cumm (RBC) and lakh/uL (platelets).',
    text: [
      'HAEMOGLOBIN 14.3 gm/dl 13.0-18.0',
      'TLC (Total Leucocyte Count) 4.24 th/cumm 4.0-10.0',
      'RBC 4.9 millions/cumm 4.5-5.5',
      'PLATELET COUNT 2.19 lakh/uL 1.5-4.5',
    ].join('\n'),
    expect: {
      values: {
        hb: 14.3,
        wbc: 4240, // 4.24 th → x1000, NORMAL (not critical-low)
        rbc: 4.9,
        platelets: 219000, // 2.19 lakh → x1e5
      },
    },
  },
  {
    name: 'Clinical-accuracy unit conversions (troponin, D-dimer, SI uric acid/calcium)',
    note: 'the Jul-2026 accuracy pass found two different-scale units miscoded as same-scale aliases. Troponin pg/mL (≡ng/L) must ÷1000 — a normal 14 pg/mL was reading as 14 ng/mL = a FALSE MI. D-Dimer mg/L / µg/mL must ×1000 — a PE-range 2.5 mg/L was reading as 2.5 ng/mL = a SILENTLY missed PE. Plus SI uric acid (µmol/L) and calcium (mmol/L) conversions.',
    text: [
      'Troponin I 14 pg/mL',
      'D-Dimer 2.5 mg/L',
      'Uric Acid 600 umol/L',
      'Calcium 2.4 mmol/L',
    ].join('\n'),
    expect: {
      values: {
        'troponin-i': [0.013, 0.015], // 14 pg/mL ÷1000 = 0.014 (normal, not a false MI)
        'd-dimer': 2500, // 2.5 mg/L ×1000 (PE-range critical, not missed)
        'uric-acid': [10.0, 10.2], // 600 µmol/L ×0.016814
        calcium: [9.5, 9.7], // 2.4 mmol/L ×4.008
      },
    },
  },
  {
    name: 'Shaukat Khanum haematology — reverse column order (value in rightmost column)',
    note: 'a real hospital report laid out as TEST | NORMAL-RANGE | UNIT | RESULT — the value is in the RIGHTMOST column, after both the reference range and the unit. The forward matcher was grabbing the range endpoint (WBC read 10000 instead of 7700). Fixed by (a) numPattern refusing a range-max capture, so forward fails cleanly, and (b) a range-gated reverse pattern that reads the trailing value. HGB alias added. rbc/mchc land just above the lab\'s own printed range, which correctly drives their status.',
    text: [
      'WBC 4-10 x10^3/ul 7.7',
      'RBC 3.5-5.5 x10^6/ul 5.53',
      'HGB 13-17 g/dL 15.7',
      'MCV 76-96 fL 81.9',
      'MCHC 31.5-34.5 g/dL 34.7',
      'PLT 150-400 x10^3/ul 294',
    ].join('\n'),
    expect: {
      values: {
        wbc: 7700, // 7.7 x10^3 — NOT the range max 10 (→10000)
        rbc: 5.53,
        hb: 15.7,
        mcv: 81.9,
        mchc: 34.7,
        platelets: 294000, // 294 x10^3 — NOT the range max 400
      },
    },
  },
  {
    name: 'Best One Lab (Pakistan) — reverse column, Total RBCs, x10^9/l platelets',
    note: 'a real image upload, reverse column order (TEST | RANGE | UNIT | RESULT). Two catalog gaps it exposed: "Total RBCs" (plural — the bare RBC alias cannot match "RBCs") and platelets in x10^9/l (SI ≡ x10^3/µL, ×1000 → 82,000, a typhoid thrombocytopenia that was dropped whole). All 12 hematology values now read on clean text.',
    text: [
      'Hemoglobin (HB) 13.00 - 17.00 g/dl 12.7',
      'WBC (TLC) 4.00 - 12.00 x10^3/uL 7.4',
      'Total RBCs 4.50 - 6.50 x10^6/uL 5.13',
      'HCT (Hematocrit) 40.00 - 50.00 % 41.7',
      'MCV 80.00 - 96.00 fl 81.3',
      'MCH 27.00 - 32.00 pg 24.8',
      'MCHC 30.00 - 35.00 g/dl 30.5',
      'Platelet Count 150.00 - 450.00 x10^9/l 82',
      'Neutrophils 40.00 - 80.00 % 80',
      'Lymphocytes 20.00 - 40.00 % 12',
      'Monocytes 2.00 - 10.00 % 05',
      'Eosinophils 1.00 - 6.00 % 03',
    ].join('\n'),
    expect: {
      values: {
        hb: 12.7,
        wbc: 7400, // 7.4 x10^3
        rbc: 5.13, // "Total RBCs" plural alias
        hematocrit: 41.7,
        mcv: 81.3,
        mch: 24.8,
        mchc: 30.5,
        platelets: 82000, // 82 x10^9/l ×1000 (thrombocytopenia)
        neutrophils: 80,
        lymphocytes: 12,
        monocytes: 5,
        eosinophils: 3,
      },
    },
  },
  {
    name: 'ACCESA PSA — "<= 4.0" two-char cutoff (was reading 600 as normal 4.0)',
    note: 'a real US PSA report: "TOTAL PSA 600.3 HIGH <= 4.0 ng/mL". The two-char "<=" (OCR/lab shorthand for ≤) was not recognised as a cutoff, so the value 600.3 could not reach its unit and the matcher fell back to the reference 4.0 next to ng/mL — reading a metastatic-range PSA of 600 as a NORMAL 4.0, the worst kind of false reassurance. Now "<=" / ">=" are absorbed, and numPattern refuses a value sitting after a cutoff sign.',
    text: [
      'PSA (FREE AND TOTAL)',
      'TOTAL PSA 600.3 HIGH <= 4.0 ng/mL EN',
      'FREE PSA >17.0 ng/mL EN',
    ].join('\n'),
    expect: {
      values: {
        psa: 600.3, // the real value, NOT the 4.0 reference cutoff
      },
    },
  },
  {
    name: 'Adversarial-sweep regression guards (Jul-2026 best-possible pass)',
    note: 'four bugs an exhaustive adversarial battery surfaced: (1) dual-sex range with the unit printed ONCE after both ranges; (2) a urine-glucose row printed ABOVE the real blood-glucose row (the guard used to give up on the first match); (3) a slash-spaced unit "mg / dL"; (4) exponent-E count notation "10E3/uL". Each is one line, exercised together here.',
    text: [
      'Hemoglobin 10.2 Male: 13-18 Female: 12-16 gm/dl',
      'Urine Glucose 15 mg/dL',
      'Glucose 105 mg/dL',
      'Creatinine 1.0 mg / dL',
      'Platelet Count 250 10E3/uL',
    ].join('\n'),
    expect: {
      values: {
        hb: 10.2, // dual-sex, unit printed once after both ranges
        glucose: 105, // the blood row below the excluded urine row
        creatinine: 1.0, // "mg / dL" with spaces around the slash
        platelets: 250000, // 250 x10E3
      },
      absent: [], // urine glucose must not have become the glucose value
    },
  },
  {
    name: 'SI renal/metabolic panel — eGFR 28, converted values rounded, g/L albumin',
    note: 'a real 3-column table (Test | Result | Normal range). eGFR value is 28 (the "1.73 mL/min/m²" is the normal-range column, stripped before matching). SI conversions now round to 3 sig-figs (no 2.3184799819 clutter), x10^9/L scales WBC/platelets, and g/L albumin (÷10) is newly supported.',
    text: [
      'Hemoglobin 13.1 12.1-16.3 g/dL',
      'WBC 8 4.0-11.1 x10^9/L',
      'Platelet count 316 150-400 x10^9/L',
      'BUN 8.8 2.8-8.1 mmol/L',
      'Creatinine 205 59-104 umol/L',
      'GFR 28 1.73 mL/min/m²',
      'ESR 37 0-22 mm/hr',
      'ALT 23 0-41 U/L',
      'AST 87 0-40 U/L',
      'Calcium 3.35 2.15-2.55 mmol/L',
      'Albumin 45 35-52 g/L',
    ].join('\n'),
    expect: {
      values: {
        hb: 13.1,
        wbc: 8000, // 8 x10^9/L
        platelets: 316000, // 316 x10^9/L
        bun: 52.9, // 8.8 mmol/L x6.006, rounded to 3 sig-figs
        creatinine: 2.32, // 205 µmol/L ÷88.42, rounded (was 2.3184799819)
        egfr: 28, // the result, NOT the 1.73 normal-range constant
        esr: 37,
        alt: 23,
        ast: 87,
        calcium: 13.4, // 3.35 mmol/L x4.008, rounded (real hypercalcemia)
        albumin: 4.5, // 45 g/L ÷10
      },
    },
  },
  {
    name: 'US LabCorp CMP (flattened) — no phantom Magnesium from "mg/dL"',
    note: 'a real LabCorp report: the bare "Mg" magnesium alias matched the "mg" starting the "mg/dL" unit, and in flattened text the between-window bound the "11" from "BUN 11 mg/dL" as a phantom Magnesium 11 (critical) — which ALSO suppressed the real BUN via specificity. Dropping the "Mg" alias fixes both. Also guards the E-notation "x10E3/uL" and the "eGFR If NonAfricn Am" 117 read (not the 1.73 constant).',
    text: 'WBC 6.4 x10E3/uL 3.4 - 10.8 Glucose 90 mg/dL 65 - 99 BUN 11 mg/dL 6 - 20 Creatinine 0.70 mg/dL 0.57 - 1.00 eGFR If NonAfricn Am 117 mL/min/1.73 >59',
    expect: {
      values: {
        wbc: 6400, // 6.4 x10E3
        glucose: 90,
        bun: 11, // real BUN, no longer suppressed by phantom magnesium
        creatinine: 0.7,
        egfr: 117, // the result, not the 1.73 constant
      },
      absent: ['magnesium'], // "mg/dL" must never surface a magnesium value
    },
  },
  {
    name: 'Labsmart — lipid profile (India)',
    note: 'surfaced the missing VLDL catalog entry (#67)',
    text: [
      'TOTAL CHOLESTEROL 180 mg/dl 125 - 200',
      'TRIGLYCERIDES 172 mg/dl 25 - 200',
      'HDL CHOLESTEROL 55 mg/dl 35 - 80',
      'LDL CHOLESTEROL 90.60 mg/dl 85 - 130',
      'VLDL CHOLESTEROL 34.40 mg/dl 5 - 40',
    ].join('\n'),
    expect: {
      values: {
        'total-chol': 180,
        ldl: 90.6,
        hdl: 55,
        tg: 172,
        vldl: 34.4,
      },
    },
  },
  {
    name: 'Innoquest — SI-unit screening panel (Malaysia)',
    note: 'surfaced SI-unit support + Chloride (#69)',
    text: [
      'Sodium 141 mmol/L (135-145)',
      'Potassium 4.1 mmol/L (3.5-5.1)',
      'Chloride 99 mmol/L (95-110)',
      'Urea 7.1 mmol/L (3.0-10.0)',
      'Creatinine 88 umol/L (44-110)',
      'Uric Acid 0.21 mmol/L (0.15-0.45)',
      'AST 33 U/L (< 41)',
      'ALT 25 U/L (< 51)',
      'HbA1c 5.2 %',
    ].join('\n'),
    expect: {
      values: {
        sodium: 141,
        potassium: 4.1,
        chloride: 99,
        bun: [42, 43], // 7.1 mmol/L × 6.006
        creatinine: [0.95, 1.05], // 88 µmol/L ÷ 88.42
        'uric-acid': [3.4, 3.6], // 0.21 mmol/L × 16.81
        ast: 33,
        alt: 25,
        hba1c: 5.2,
      },
      // Ranges printed in SI must be converted with the same factor as the
      // value, or we'd grade a mg/dL number against a mmol/L band. Urea is
      // the case that proves it: 7.1 mmol/L is NORMAL against the lab's own
      // 3.0-10.0, but graded against our urea band it came back 'concern' —
      // a false alarm on a healthy man, caused purely by not reading the row.
      labRange: {
        sodium: [135, 145],
        bun: [18.02, 60.06], // 3.0-10.0 mmol/L x 6.006
        creatinine: [0.4976, 1.244], // 44-110 umol/L / 88.42
      },
    },
  },
  {
    name: 'Dr N.M. Kazi — CBC (small-lab template)',
    note: 'surfaced dotted W.B.C, Gms% Hb, and the phantom sperm count (#71)',
    text: [
      'W.B.C Total Count 10900 4000 - 11000 /Cumm',
      'RBC COUNT 5.53 4.2-5.8 Mill/cumm',
      'Haemoglobin % 14.8 12 - 17 Gms%',
      'PCV 43.6 36 - 48 %',
      'Platelet Count 2.63 150000 - 450000 Lakh/cumm',
    ].join('\n'),
    expect: {
      values: {
        wbc: 10900,
        rbc: 5.53,
        hb: 14.8,
        hematocrit: 43.6,
        platelets: 263000, // 2.63 Lakh × 1e5
      },
      absent: ['sperm-total-count'], // "Total Count" must not match a CBC
    },
  },
  {
    name: 'Dr Lal PathLabs — SWASTHFIT SUPER 4 (real template)',
    note: 'first fixture from a genuine Indian lab PDF, not a hand-typed one',
    // Lifted verbatim from Lal PathLabs' own published specimen report
    // (cdn1.lalpathlabs.com/live/reports/WM17S.pdf — patient literally named
    // "DUMMY", so no real person's data is in this repo), as our own text
    // reconstruction renders it.
    //
    // Worth its length, because a real template does things a hand-written
    // fixture never thinks of:
    //   - a "(Method)" line after EVERY row, several carrying bare years —
    //     "(CKD EPI Equation 2021)", "(KDIGO Guideline 2012)" — sitting right
    //     where a value would be. Prime false-positive bait.
    //   - section headers ("LIPID SCREEN, SERUM") between rows.
    //   - qualitative rows with no number ("GFR Category G1").
    //   - one-sided reference ranges (<200.00, >40.00) rather than a-b.
    //   - names our aliases have to actually cover: "AST (SGOT)", "GGTP",
    //     "Cholesterol, Total", "LDL Cholesterol, Calculated".
    //   - BOTH "Urea 40.00" and "Urea Nitrogen Blood 18.68" on one report —
    //     the same chemistry on two scales, 2.14x apart (see the bun template
    //     note in the catalog).
    text: [
      'SWASTHFIT SUPER 4',
      'LIVER & KIDNEY PANEL, SERUM',
      'Creatinine 1.00 mg/dL 0.70 - 1.30',
      '(Modified Jaffe,Kinetic)',
      'GFR Estimated 107 mL/min/1.73m2 >59',
      '(CKD EPI Equation 2021)',
      'GFR Category G1',
      '(KDIGO Guideline 2012)',
      'Urea 40.00 mg/dL 13.00 - 43.00',
      '(Urease UV)',
      'Uric Acid 7.00 mg/dL 3.50 - 7.20',
      '(Uricase)',
      'AST (SGOT) 30.0 U/L 15.00 - 40.00',
      '(IFCC without P5P)',
      'ALT (SGPT) 40.0 U/L 10.00 - 49.00',
      '(IFCC without P5P)',
      'GGTP 50.0 U/L 0 - 73',
      '(IFCC)',
      'Alkaline Phosphatase (ALP) 100.00 U/L 30.00 - 120.00',
      '(IFCC-AMP)',
      'Bilirubin Total 1.00 mg/dL 0.30 - 1.20',
      '(Oxidation)',
      'Bilirubin Direct 0.20 mg/dL <0.3',
      '(Oxidation)',
      'Total Protein 8.00 g/dL 5.70 - 8.20',
      '(Biuret)',
      'Albumin 4.00 g/dL 3.20 - 4.80',
      '(BCG)',
      'Calcium, Total 9.00 mg/dL 8.70 - 10.40',
      'LIPID SCREEN, SERUM',
      'Cholesterol, Total 100.00 mg/dL <200.00',
      '(CHO-POD)',
      'Triglycerides 100.00 mg/dL <150.00',
      '(GPO-POD)',
      'HDL Cholesterol 30.00 mg/dL >40.00',
      '(Enz Immunoinhibition)',
      'LDL Cholesterol, Calculated 50.00 mg/dL <100.00',
      '(Calculated)',
      'VLDL Cholesterol,Calculated 20.00 mg/dL <30.00',
      '(Calculated)',
      'Non-HDL Cholesterol 70 mg/dL <130',
      '(Calculated)',
    ].join('\n'),
    expect: {
      values: {
        creatinine: 1.0,
        egfr: 107,
        bun: 40, // "Urea", graded off the lab's printed range — see catalog
        'uric-acid': 7.0,
        ast: 30,
        alt: 40,
        ggt: 50,
        alp: 100,
        'total-bilirubin': 1.0,
        'direct-bilirubin': 0.2,
        'total-protein': 8.0,
        albumin: 4.0,
        calcium: 9.0,
        'total-chol': 100,
        tg: 100,
        hdl: 30,
        ldl: 50,
        vldl: 20,
        'non-hdl': 70,
      },
      // The lab's OWN range, read off the row. This is the layout every real
      // report uses (value, unit, THEN range) and the one we used to miss
      // entirely — so we silently graded against our catalog band instead of
      // what the lab actually said. Bilirubin Direct pins the other side:
      // "<0.3" is one-sided, not a range, and must stay uncaptured.
      labRange: {
        creatinine: [0.7, 1.3],
        ast: [15, 40],
        alt: [10, 49],
        bun: [13, 43],
        'total-protein': [5.7, 8.2],
        'direct-bilirubin': null,
      },
    },
  },
  {
    name: 'Dr Lal PathLabs — protein electrophoresis (real template)',
    note: "'Protein, Total' (comma form) was unmatched — same lab, other word order",
    // From Lal PathLabs' published specimen E001. Two things worth pinning:
    //   1. 'Protein, Total' matches now. Their SWASTHFIT panel prints 'Total
    //      Protein', this one inverts it — one lab, both forms.
    //   2. The globulin fractions must NOT be invented as markers. They're a
    //      real part of this report and deliberately outside the catalog;
    //      surfacing them would mean showing a number we can't interpret.
    text: [
      'PROTEIN ELECTROPHORESIS, SERUM',
      '(Capillary Electrophoresis)',
      'Protein, Total 7.20 g/dL 6.40 - 8.30',
      'Albumin 4.00 g/dL 3.60 - 5.50',
      'Alpha 1 globulin 0.30 g/dL 0.20 - 0.40',
      'Alpha 2 globulin 0.80 g/dL 0.50 - 1.00',
      'Beta 1 globulin 0.90 g/dL 0.50 - 1.10',
      'Gamma globulin 1.10 g/dL 0.70 - 1.60',
    ].join('\n'),
    expect: {
      values: { 'total-protein': 7.2, albumin: 4.0 },
    },
  },
  {
    name: 'OCR-mangled RANGE must not invent a false flag',
    note: 'a misread range drove a normal platelet count to concern once we started trusting ranges',
    // A real photo turned platelet "1.5 - 4.5" (lakh) into "15-45", which
    // lakh-scales to 1.5M-4.5M. Once the printed range began DRIVING status,
    // that dragged a perfectly normal 250k count to 'concern' — a false alarm
    // invented purely by trusting a corrupt range. The value sits an order of
    // magnitude below its own range, so the RANGE is the misread: drop it,
    // grade on the catalog band. `labRange: {platelets: null}` pins that we
    // captured no range here.
    text: ['PLATELET COUNT 2.50 Lakh/cumm ~~ 15-45'].join('\n'),
    expect: {
      values: { platelets: 250000 },
      labRange: { platelets: null },
    },
  },
  {
    name: 'a genuinely LOW value keeps its printed range and its flag',
    note: 'the counterweight — the range guard must not suppress real out-of-range results',
    text: ['PLATELET COUNT 0.40 Lakh/cumm 1.5 - 4.5'].join('\n'),
    expect: {
      values: { platelets: 40000 },
      labRange: { platelets: [150000, 450000] },
    },
  },
  {
    name: 'OCR-mangled units — c→e, m→rn',
    note: 'a perfectly-read marker was dropped over one wrong letter in its unit',
    // Straight off the OCR bench: a realistic phone photo produced
    // "WBC COUNT 7800 /eumm 4000 - 11000" — name and value read perfectly,
    // unit misread by a single character — and the marker vanished, because
    // the matcher requires a known unit token as its false-positive guard.
    // c→e and m→rn are the two most common Tesseract confusions there are,
    // so this was silently costing markers on every photo.
    text: [
      'WBC COUNT 7800 /eumm 4000 - 11000',
      'HAEMOGLOBIN 14.2 g/dL 13.0 - 17.0',
      'TRIGLYCERIDES 150 rng/dL 0 - 150',
    ].join('\n'),
    expect: {
      values: { wbc: 7800, hb: 14.2, tg: 150 },
    },
  },
  {
    name: 'Unit gate still guards against a bare number',
    note: 'the tolerance must not become "any number after the name wins"',
    // The counterweight to the fixture above. The unit gate is what stops
    // "WBC COUNT" binding to a page number or a date, so tolerance of a
    // MISREAD unit must not collapse into accepting NO unit.
    text: ['WBC COUNT 7800', 'Page 2 of 3'].join('\n'),
    expect: {
      values: {},
      absent: ['wbc'],
    },
  },
  {
    name: 'UK thyroid panel — SI units (pmol/L)',
    note: 'Free T3/T4 in pmol/L were dropped entirely until altUnits added',
    text: [
      'TSH 2.10 mIU/L (0.27 - 4.20)',
      'Free T4 15.5 pmol/L (12.0 - 22.0)',
      'Free T3 4.8 pmol/L (3.1 - 6.8)',
    ].join('\n'),
    expect: {
      values: {
        tsh: 2.1,
        'free-t4': [1.15, 1.26], // 15.5 pmol/L × 0.0777 = 1.204 ng/dL
        'free-t3': [3.05, 3.2], // 4.8 pmol/L × 0.651 = 3.125 pg/mL
      },
    },
  },
  {
    name: 'CBC additions — MPV + absolute differential counts',
    note: 'coverage additions: MPV and the absolute Lymphocyte/Monocyte/Eosinophil/Basophil counts were dropped (only ANC existed). Guard proven: an "Absolute Eosinophil Count 180 /cumm" row must NOT be read as the eosinophil PERCENT marker (different unit + scale) — the /cumm unit gate and span suppression keep the % differentials out.',
    text: [
      'MPV 9.8 fL 7.5 - 11.5',
      'Absolute Lymphocyte Count 2100 /cumm 1000 - 4000',
      'Absolute Monocyte Count 500 /cumm 200 - 1000',
      'Absolute Eosinophil Count 180 /cumm 20 - 500',
      'Absolute Basophil Count 40 /cumm 0 - 200',
    ].join('\n'),
    expect: {
      values: {
        mpv: 9.8,
        'abs-lymphocytes': 2100,
        'abs-monocytes': 500,
        'abs-eosinophils': 180,
        'abs-basophils': 40,
      },
      // The absolute-count rows must not leak into the PERCENT differentials.
      absent: ['lymphocytes', 'monocytes', 'eosinophils', 'basophils'],
    },
  },
  {
    name: 'Electrolyte panel — Bicarbonate added',
    note: 'coverage addition: Bicarbonate (Total CO2) is on every electrolyte panel and was dropped. Reads mmol/L and mEq/L; bare "CO2" is deliberately not an alias (collision-prone), so the spelled forms carry it.',
    text: [
      'Sodium 140 mmol/L 136 - 145',
      'Potassium 4.2 mmol/L 3.5 - 5.1',
      'Chloride 102 mmol/L 98 - 107',
      'Bicarbonate 24 mmol/L 22 - 29',
    ].join('\n'),
    expect: {
      values: {
        sodium: 140,
        potassium: 4.2,
        chloride: 102,
        bicarbonate: 24,
      },
    },
  },
  {
    name: 'Total CO2 alias + mEq/L unit',
    note: 'the same bicarbonate marker under its US "Total CO2" name and mEq/L unit.',
    text: ['Total CO2 26 mEq/L 22 - 29'].join('\n'),
    expect: { values: { bicarbonate: 26 } },
  },
  {
    name: 'Total CK vs CK-MB — isoenzyme collision guard',
    note: 'coverage addition: only the cardiac CK-MB isoenzyme existed; total CK/CPK (the skeletal-muscle enzyme, a different scale) was missing. Guard proven: a "CK-MB" row must NOT grade as total CK (excludeIfRowMatches \\bMB\\b), and total CK must read its own U/L value.',
    text: [
      'Creatine Kinase (CK) 180 U/L 39 - 308',
      'CK-MB 3.2 ng/mL 0 - 5',
    ].join('\n'),
    expect: {
      values: {
        'ck-total': 180,
        'ck-mb': 3.2,
      },
    },
  },
  {
    name: 'Pancreatic enzymes — Amylase + Lipase',
    note: 'coverage additions: both dropped previously. Standard U/L reference bands.',
    text: [
      'Amylase 65 U/L 30 - 110',
      'Lipase 35 U/L 13 - 60',
    ].join('\n'),
    expect: {
      values: {
        amylase: 65,
        lipase: 35,
      },
    },
  },
  {
    name: "Men's-health extras — DHEA-S, Homocysteine, Progesterone",
    note: 'coverage additions (Tier 2). DHEA-S is age-dependent so the lab range wins when printed; homocysteine is a cardiovascular marker; progesterone is naturally low in men.',
    text: [
      'DHEA-Sulfate 320 µg/dL 80 - 560',
      'Homocysteine 11 µmol/L 5 - 15',
      'Progesterone 0.4 ng/mL 0.1 - 1.0',
    ].join('\n'),
    expect: {
      values: {
        'dhea-s': 320,
        homocysteine: 11,
        progesterone: 0.4,
      },
    },
  },
  {
    name: 'DHEA-S in SI units (µmol/L)',
    note: 'UK/EU labs print DHEA-S in µmol/L; 6.5 µmol/L × 36.85 ≈ 239.5 µg/dL.',
    text: ['DHEA-S 6.5 µmol/L'].join('\n'),
    expect: { values: { 'dhea-s': [235, 245] } }, // 6.5 × 36.85 = 239.5
  },
  {
    name: '% Free PSA ratio — captured without overwriting total PSA',
    note: 'coverage addition: the free-to-total PSA percentage now surfaces as its own marker (higher is reassuring). Guard proven: it reads the % row and does NOT overwrite the ng/mL total PSA, and the bare "Free PSA" ng/mL absolute is deliberately not claimed as the ratio.',
    text: [
      'PSA Total 6.2 ng/mL 0 - 4',
      'Free PSA 1.4 ng/mL',
      '% Free PSA 24 %',
    ].join('\n'),
    expect: {
      values: {
        psa: 6.2,
        'free-psa-ratio': 24,
      },
    },
  },
  {
    name: 'Derived ratios — surfaced and labeled calculated',
    note: 'coverage additions: A/G, Cholesterol/HDL and Urea/Creatinine ratios plus indirect bilirubin (total − direct) now surface as calculated values. Unitless ratios match on their specific alias text; the lab range wins when printed.',
    text: [
      'A/G Ratio 1.6 1.0 - 2.1',
      'Cholesterol/HDL Ratio 3.2',
      'Urea/Creatinine Ratio 28',
      'Indirect Bilirubin 0.6 mg/dL 0.1 - 1.0',
    ].join('\n'),
    expect: {
      values: {
        'ag-ratio': 1.6,
        'tc-hdl-ratio': 3.2,
        'bun-creatinine-ratio': 28,
        'indirect-bilirubin': 0.6,
      },
    },
  },
  {
    name: 'Transferrin saturation — iron panel completion',
    note: 'coverage addition: TSAT (iron ÷ TIBC) is printed on most iron panels and was dropped.',
    text: [
      'Iron 90 µg/dL 65 - 175',
      'TIBC 320 µg/dL 250 - 450',
      'Transferrin Saturation 28 % 20 - 50',
    ].join('\n'),
    expect: {
      values: {
        iron: 90,
        tibc: 320,
        'transferrin-saturation': 28,
      },
    },
  },
];

describe('real-report extraction corpus', () => {
  for (const fx of FIXTURES) {
    describe(`${fx.name} — ${fx.note}`, () => {
      const byId = new Map(
        extractBiomarkersFromText(fx.text).map((m) => [m.id, m.value]),
      );

      for (const [id, expected] of Object.entries(fx.expect.values)) {
        it(`extracts ${id}`, () => {
          const v = byId.get(id);
          expect(v, `${id} should be extracted`).toBeDefined();
          if (Array.isArray(expected)) {
            expect(v!).toBeGreaterThanOrEqual(expected[0]);
            expect(v!).toBeLessThanOrEqual(expected[1]);
          } else {
            expect(v!).toBeCloseTo(expected, 1);
          }
        });
      }

      for (const id of fx.expect.absent ?? []) {
        it(`does not falsely surface ${id}`, () => {
          expect(byId.has(id)).toBe(false);
        });
      }

      const markerById = new Map(
        extractBiomarkersFromText(fx.text).map((m) => [m.id, m]),
      );
      for (const [id, range] of Object.entries(fx.expect.labRange ?? {})) {
        it(`reads the lab's own printed range for ${id}`, () => {
          const m = markerById.get(id);
          expect(m, `${id} should be extracted`).toBeDefined();
          if (range === null) {
            expect(m!.labRefMin, `${id}: should NOT have captured a range`).toBeUndefined();
            return;
          }
          expect(m!.labRefMin, `${id}: lab range was not captured at all`).toBeDefined();
          // Converted alongside the value, so compare loosely.
          expect(m!.labRefMin!).toBeCloseTo(range[0], 1);
          expect(m!.labRefMax!).toBeCloseTo(range[1], 1);
        });
      }
    });
  }
});
