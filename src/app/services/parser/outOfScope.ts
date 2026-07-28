/* ------------------------------------------------------------------ */
/* Scope verification                                                  */
/*                                                                      */
/* The product is scoped to general metabolic biomarkers + HPA-axis    */
/* endocrine panels (see catalog in data/biomarkers.ts). Other lab     */
/* outputs people might upload — viral antigen panels, X-ray narrative */
/* reports, dental records — would otherwise fall through to the       */
/* generic "we read it but didn't recognise any lab values" error.     */
/* That message is technically correct but doesn't tell the user WHY:  */
/* they wonder if our parser is buggy, when actually the document is   */
/* fundamentally a different category of report.                       */
/*                                                                      */
/* This classifier looks for clusters of keywords that strongly imply  */
/* an out-of-scope document, so the UI can show a category-specific    */
/* refusal message instead of "no matches."                            */
/*                                                                      */
/* Threshold: 2+ DISTINCT keyword hits from a single category. A lone  */
/* mention of "HIV antibody" inside an otherwise-comprehensive panel   */
/* doesn't trigger — only documents that are dominantly out-of-scope.  */
/* ------------------------------------------------------------------ */

import { escapeRegex } from './regexUtils';

export type OutOfScopeCategory =
  | 'viral'
  | 'imaging'
  | 'physical-exam'
  | 'urine'
  | 'product-safety';

/**
 * Per-category keyword sets, with a "definitive" subset that's specific
 * enough to fire on a single hit.
 *
 * Stored lowercased; we match against the normalized lowercased text.
 * `keywords` is the full pool used to count distinct hits (relaxed
 * mode: 1 definitive OR 2+ distinct; strict mode: 2+ distinct only).
 *
 * Definitive terms MUST also appear in `keywords` — this invariant is
 * asserted at module init below, so a future divergence becomes a
 * loud test failure rather than a silent tie-break bug.
 */
type OutOfScopeKeywordSet = {
  /** Anything plausibly indicative of the category. Multiple hits
   *  required to trigger out-of-scope on its own. Conservative entries
   *  ("x-ray" inside a referral note) live here too — the 2+ gate
   *  keeps them safe. */
  keywords: readonly string[];
  /** Specific enough that a single appearance is sufficient to flag
   *  the category. Used for relaxed-mode triggering on the failure
   *  path; ignored in strict mode. */
  definitive: readonly string[];
};

const OUT_OF_SCOPE: Record<OutOfScopeCategory, OutOfScopeKeywordSet> = {
  viral: {
    keywords: [
      'dengue ns1',
      'dengue igm',
      'dengue igg',
      'dengue',
      // "Dengue Combo NS1+IgM+IgG" / "NS1+IgM/IgG" style row labels —
      // some labs print them as a single combo line, so the
      // dengue-specific keywords above only hit once. Adding the
      // bare antibody fragments lifts the hit count past the
      // 2-distinct gate. False-positive risk is low: ns1 and igm/igg
      // outside an infectious-panel context are extremely rare in a
      // metabolic/HPA report.
      'ns1',
      'igm/igg',
      'igm+igg',
      'plasmodium',
      'malaria',
      'mp test',
      'sars-cov-2',
      'sars cov 2',
      'covid-19',
      'covid 19',
      'rt-pcr',
      'rt pcr',
      'hiv 1',
      'hiv 2',
      'hiv antibody',
      'anti-hiv',
      'hbsag',
      'hbeag',
      'anti-hcv',
      'anti-hbs',
      'hepatitis b surface',
      'hepatitis c',
      'influenza a',
      'influenza b',
      'h1n1',
      'h3n2',
      'chikungunya',
      'syphilis',
      'vdrl',
      'tpha',
      'rpr',
      'typhoid',
      'widal',
      'salmonella typhi',
    ],
    definitive: [
      'dengue',
      'hbsag',
      'anti-hcv',
      'anti-hbs',
      'widal',
      'vdrl',
      'tpha',
      'chikungunya',
      'plasmodium',
    ],
  },
  imaging: {
    keywords: [
      'x-ray',
      'x ray',
      'radiograph',
      'magnetic resonance',
      'mri brain',
      'mri chest',
      'mri abdomen',
      'mri pelvis',
      'ct scan',
      'computed tomography',
      'ct chest',
      'ct abdomen',
      'ultrasonography',
      'sonography',
      'usg abdomen',
      'usg pelvis',
      'doppler study',
      'no focal opacity',
      'no significant abnormality detected',
      'impression:',
      // ECG/EKG — tracings, not lab values
      'ecg',
      'ekg',
      'electrocardiogram',
      'qrs complex',
      'sinus rhythm',
      'st elevation',
      'st depression',
    ],
    definitive: [
      'no focal opacity',
      'no significant abnormality detected',
      'computed tomography',
      'sinus rhythm',
      'qrs complex',
    ],
  },
  'physical-exam': {
    keywords: [
      'audiometry',
      'audiogram',
      'pure tone average',
      'air conduction',
      'bone conduction',
      'visual acuity',
      'snellen',
      'refraction',
      'fundus examination',
      'intraocular pressure',
      'periodontal',
      'gingival',
      'occlusion',
      'mandibular',
      'maxillary',
      'caries',
      'oral cavity',
      'tonsillar',
      'turbinate',
    ],
    definitive: [
      'audiometry',
      'pure tone average',
      'snellen',
      'fundus examination',
      'periodontal',
      'caries',
    ],
  },
  // Urinalysis / urine routine. We read BLOOD markers; a urine report's
  // values are a different specimen (a urine pH / glucose / protein is not
  // the serum one), and its bare "pH" collides with the semen-pH alias —
  // so a urinalysis must be caught here, not parsed. Terms are urine-
  // exclusive; the 2+ gate (or one definitive) keeps a blood panel that
  // happens to say "urine" once from tripping.
  urine: {
    keywords: [
      'urine routine',
      'routine urine',
      'urine analysis',
      'urinalysis',
      'urine microscopy',
      'urine r/e',
      'pus cells',
      'epithelial cells',
      'epithelial cell',
      'urobilinogen',
      'specific gravity',
      'leucocyte esterase',
      'leukocyte esterase',
      'nitrite',
      'ketone bodies',
      'urinary',
    ],
    definitive: [
      'urinalysis',
      'urine routine',
      'urine microscopy',
      'urine r/e',
      'pus cells',
      'urobilinogen',
    ],
  },
  // Food / product-safety certificates. People searching their supplements
  // sometimes upload the manufacturer's microbiology or heavy-metals COA
  // (e.g. an "Iron for Men" powder tested for Listeria/Salmonella/CFU) — a
  // real document, just not a blood test. Terms are food-specific: notably
  // "salmonella" is EXCLUDED (it appears on Widal/typhoid BLOOD serology),
  // and the definitive set uses per-GRAM colony counts + food-report headers
  // that never appear on a human blood panel.
  'product-safety': {
    keywords: [
      'cfu/gm',
      'cfu/g',
      'cfu / g',
      'listeria',
      'listeria monocytogenes',
      'enterobacteriaceae',
      'per 25g',
      'per 25 g',
      'per 25gm',
      'quality characteristics',
      'total plate count',
      'aerobic plate count',
      'yeast and mould',
      'yeast & mould',
      'shelf life',
      'foods llp',
      'food safety',
      'mg/kg',
    ],
    definitive: [
      'cfu/gm',
      'cfu/g',
      'listeria monocytogenes',
      'enterobacteriaceae',
      'per 25g',
      'per 25 g',
      'quality characteristics',
    ],
  },
};

// Invariant: every definitive term must also live in the main keyword
// list. Without this guarantee, a definitive-only term would never
// contribute to the `hits` count used for tie-breaking — its category
// would lose ties to any 1-hit category from another domain. Run this
// check at module load (cheap, runs once) so divergence shows up as a
// loud failure at app/test boot rather than as a quiet
// misclassification at runtime.
for (const cat of Object.keys(OUT_OF_SCOPE) as OutOfScopeCategory[]) {
  const main = new Set(OUT_OF_SCOPE[cat].keywords);
  for (const term of OUT_OF_SCOPE[cat].definitive) {
    if (!main.has(term)) {
      throw new Error(
        `OUT_OF_SCOPE invariant: definitive term "${term}" in category "${cat}" is missing from the main keywords list. Add it (or drop it from definitive).`,
      );
    }
  }
}

/** Count distinct keyword hits within one category. We match on the
 *  lowercased text and require WORD-ish boundaries to avoid e.g.
 *  matching "dengue" inside "endenguered" — admittedly contrived, but
 *  this also protects against partial substrings like "ent" matching
 *  inside "patient". For multi-word keywords (e.g. "dengue ns1") we
 *  fall back to plain substring matching since adding regex anchors
 *  would over-restrict legitimate variants ("Dengue-NS1", "Dengue/NS1"). */
function countDistinctHits(text: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (
      kw.includes(' ') ||
      kw.includes('-') ||
      kw.includes('/') ||
      kw.includes('+')
    ) {
      if (text.includes(kw)) hits += 1;
    } else {
      // Single-word — require non-letter boundary to avoid substring traps.
      const re = new RegExp(`(^|[^a-z])${escapeRegex(kw)}([^a-z]|$)`, 'i');
      if (re.test(text)) hits += 1;
    }
  }
  return hits;
}

/**
 * Returns the strongest out-of-scope category if the text appears to be
 * dominated by it, or null otherwise.
 *
 * Trigger thresholds:
 *   - strict mode (default): 2+ distinct keywords from one category.
 *   - relaxed mode: ALSO triggers on a single definitive-term hit, for
 *     compact reports where the panel header is the only signal
 *     ("HBsAg ELISA: Non-reactive" alone is enough to know).
 *
 * The two call sites use different modes on purpose:
 *   - parseUploadedReport's FAILURE branch uses relaxed — a zero-match
 *     extraction is the moment to be most generous about reclassifying
 *     "this isn't a lab panel".
 *   - parseUploadedReport's SUCCESS branch uses strict — a mostly-
 *     metabolic report that boilerplates "Dengue Antibody: Not tested"
 *     shouldn't trip the "we ignored some sections" banner on a single
 *     polite no-test row.
 *
 * Ties broken by total hit count (`hits` from the main keyword list,
 * NOT the definitive subset). Pure function — no side effects.
 */
export function classifyOutOfScope(
  text: string,
  mode: 'strict' | 'relaxed' = 'relaxed',
): OutOfScopeCategory | null {
  if (!text) return null;
  const lowered = text.toLowerCase();
  let best: { category: OutOfScopeCategory; hits: number } | null = null;
  for (const category of Object.keys(OUT_OF_SCOPE) as OutOfScopeCategory[]) {
    const hits = countDistinctHits(lowered, OUT_OF_SCOPE[category].keywords);
    const definitiveHit =
      mode === 'relaxed' &&
      countDistinctHits(lowered, OUT_OF_SCOPE[category].definitive) > 0;
    if ((hits >= 2 || definitiveHit) && (!best || hits > best.hits)) {
      best = { category, hits };
    }
  }
  return best?.category ?? null;
}
