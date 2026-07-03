/**
 * Evidence grading for lifestyle recommendations.
 *
 * The audits asked for it; the over-trust risk makes HOW we do it the whole
 * game. Two rules keep it honest:
 *
 *  1. CONSERVATIVE + CITE-OR-OMIT. We only grade levers with a real,
 *     named source behind them, matched by tight patterns. Anything we
 *     can't confidently ground returns null and shows no badge — an
 *     ungraded line is honest; a guessed "Strong evidence" badge is the
 *     exact false authority we warn users about elsewhere.
 *
 *  2. GRADE-ALIGNED, CONTEXT-AWARE. Tiers mirror the GRADE working group's
 *     certainty language ("decreases" / "probably" / "may"). Because
 *     evidence is usually strong FOR A SPECIFIC OUTCOME (omega-3 lowers
 *     triglycerides; its CV-outcome evidence is weaker), every lever names
 *     what it `supports`, so the grade never reads as blanket.
 *
 * Classifying the EXISTING recommendation strings at render time means we
 * touch zero clinical data files — no mass re-annotation, no merge churn.
 *
 * Tier sources (GRADE): GRADE Working Group; Cochrane Handbook ch.14.
 * Lever sources are named per-entry below.
 */

export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

/** User-facing meaning of each tier, in GRADE's own certainty language. */
export const EVIDENCE_TIERS: Record<
  EvidenceLevel,
  { label: string; meaning: string }
> = {
  strong: {
    label: 'Strong evidence',
    meaning:
      'Backed by randomized trials and major clinical guidelines — reliably helps.',
  },
  moderate: {
    label: 'Moderate evidence',
    meaning: 'Consistent evidence that it probably helps, but less definitive.',
  },
  emerging: {
    label: 'Emerging',
    meaning: 'Early or mixed evidence — it may help, but it isn’t settled.',
  },
};

export type EvidenceMatch = {
  level: EvidenceLevel;
  /** The specific outcome the grade applies to, so it never reads blanket. */
  supports: string;
  source: { label: string; url: string };
};

type Lever = { pattern: RegExp; match: EvidenceMatch };

// Ordered strongest-first; the first matching lever wins, so a line that
// mentions both a strong and a weaker lever is graded by the strong one.
const LEVERS: Lever[] = [
  {
    pattern:
      /\b(walk|walking|after every meal|after meals|aerobic|cardio|physical activ|move more|exercise)\b/i,
    match: {
      level: 'strong',
      supports: 'blood sugar and insulin sensitivity',
      source: {
        label: 'ADA — Physical Activity/Exercise and Diabetes (position statement)',
        url: 'https://diabetesjournals.org/care/article/39/11/2065/37249/Physical-Activity-Exercise-and-Diabetes-A-Position',
      },
    },
  },
  {
    pattern: /\b(strength|resistance|lift(ing)?|weight training|muscle)\b/i,
    match: {
      level: 'strong',
      supports: 'blood sugar control and muscle mass',
      source: {
        label: 'ADA — Physical Activity/Exercise and Diabetes (position statement)',
        url: 'https://diabetesjournals.org/care/article/39/11/2065/37249/Physical-Activity-Exercise-and-Diabetes-A-Position',
      },
    },
  },
  {
    pattern: /\b(lose|losing|reduce|reducing|drop)\s+(weight|belly fat|body fat)\b/i,
    match: {
      level: 'strong',
      supports: 'testosterone, blood sugar, and lipids',
      source: {
        label: 'Corona et al. — weight loss reverts obesity-associated hypogonadism (Eur J Endocrinol 2013)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9791266/',
      },
    },
  },
  {
    pattern: /\b(omega-?3|epa\b|dha\b|fish oil)\b/i,
    match: {
      level: 'strong',
      supports: 'lowering triglycerides (dose-dependent)',
      source: {
        label: 'AHA — Omega-3 Fatty Acids for Hypertriglyceridemia (science advisory)',
        url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000709',
      },
    },
  },
  {
    pattern: /\b((cut|reduce|less|avoid)\s+(added\s+)?sugar|sugary|sweet(ened)?\s+(drinks|chai|beverages|coffee)|soda)\b/i,
    match: {
      level: 'strong',
      supports: 'blood sugar and triglycerides',
      source: {
        label: 'AHA — Added Sugars and Cardiovascular Disease (advisory)',
        url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000439',
      },
    },
  },
  {
    pattern: /\b((quit|stop)\s+smoking|smoking|tobacco)\b/i,
    match: {
      level: 'strong',
      supports: 'cardiovascular and sperm health',
      source: {
        label: 'US Surgeon General — Health Consequences of Smoking',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK179276/',
      },
    },
  },
  {
    pattern: /\b((cut|reduce|less)\s+alcohol|drink less|alcohol)\b/i,
    match: {
      level: 'moderate',
      supports: 'triglycerides and liver markers',
      source: {
        label: 'AHA — Omega-3 / triglyceride management advisory',
        url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000709',
      },
    },
  },
  {
    // Tight: the line must be ABOUT getting sleep, not merely mention the
    // word (so "magnesium … helps you sleep" or "sleep apnea" don't grade
    // as a sleep lever).
    pattern: /\b(sleep 7|7[–-]8 hours|hours of sleep|deep sleep|prioriti[sz]e sleep|fix sleep|better sleep)\b/i,
    match: {
      level: 'moderate',
      supports: 'testosterone, recovery, and metabolic health',
      source: {
        label: 'Wittert — sleep and testosterone (Curr Opin Endocrinol Diabetes Obes 2014)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24739312/',
      },
    },
  },
  {
    pattern: /\bvitamin d\b/i,
    match: {
      level: 'moderate',
      supports: 'correcting a deficiency (most benefit when low)',
      source: {
        label: 'Endocrine Society — Vitamin D Clinical Practice Guideline',
        url: 'https://www.endocrine.org/clinical-practice-guidelines/vitamin-d',
      },
    },
  },
  {
    pattern: /\b(zinc|magnesium|b12|selenium|coq10|antioxidant)\b/i,
    match: {
      level: 'emerging',
      supports: 'mainly when a deficiency is present — evidence is mixed',
      source: {
        label: 'NIH Office of Dietary Supplements — fact sheets',
        url: 'https://ods.od.nih.gov/factsheets/list-all/',
      },
    },
  },
];

/**
 * Grade a single recommendation string, or null if we can't confidently
 * ground it. Conservative by design — null is the honest default.
 */
export function evidenceForRecommendation(text: string): EvidenceMatch | null {
  for (const lever of LEVERS) {
    if (lever.pattern.test(text)) return lever.match;
  }
  return null;
}
