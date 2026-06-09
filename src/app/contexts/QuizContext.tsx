import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { QuizAnswers } from './types';
import {
  QUIZ_COMPLETE_KEY,
  QUIZ_KEY,
  loadQuiz,
  loadQuizComplete,
  saveQuiz,
  saveQuizComplete,
} from '../utils/persistence';

/* ================================================================== */
/* Men's Health Risk Priority Algorithm                                 */
/*                                                                      */
/* Maps the user's symptom selections to three clinical systems with    */
/* weighted clinical priorities. The weights are tuned so that the      */
/* combined score for a system lands in one of three bands:             */
/*                                                                      */
/*   High Risk     — score ≥ 15                                         */
/*   Moderate Risk — score 7–14                                         */
/*   Low Risk      — score  < 7                                         */
/*                                                                      */
/* The map is exported so other surfaces (the recommendation engine,    */
/* a future "why we suggest these tests" view) can introspect it.       */
/*                                                                      */
/* Important: this is a screening heuristic, not a diagnosis. Anywhere  */
/* it's surfaced to the user, the copy must say so.                     */
/* ================================================================== */

export type RiskSystemId =
  | 'hypogonadism'
  | 'erectileDysfunction'
  | 'cardiovascular';

type RiskTier = 'low' | 'moderate' | 'high';

/** Human-facing label for each clinical system. Phrased as "signals
 *  for X" rather than "X risk indicators" — the algorithm outputs a
 *  symptom-cluster strength, not a diagnostic risk score. Putting
 *  "Hypogonadism: High Risk" on screen reads as a result; the actual
 *  signal is "you ticked enough boxes that weight toward hypogonadism."
 *  The reframe keeps the diagnostic vocabulary (clinicians need it)
 *  but drops the prescriptive framing. */
const SYSTEM_LABELS: Record<RiskSystemId, string> = {
  hypogonadism: 'Signals for low testosterone',
  erectileDysfunction: 'Signals for erectile-function issues',
  cardiovascular: 'Signals for cardiovascular risk',
};

/**
 * Weight table — for each symptom id (matching ids in data/quiz.ts), how
 * heavily it implicates each clinical system. Weights are 0–5 with 5 =
 * primary signal. Missing entries are treated as 0.
 *
 * Clinical basis (this is a screening heuristic, not a diagnostic
 * instrument — the table is informed by, not lifted from, these sources):
 *
 *   • Morley et al., ADAM Questionnaire (Aging Males' Symptoms screen,
 *     Saint Louis University, 2000): the canonical 10-item screen for
 *     androgen deficiency in aging men. Items #1 (low libido), #7 (sad
 *     / grumpy), #8 (erections less strong), #9 (deterioration in
 *     ability to play sports / endurance), and #10 (falling asleep
 *     after dinner) drove the weights on 'low-libido', 'low-mood',
 *     'difficulty-in-bed', 'low-energy', and 'poor-sleep' here.
 *   • Endocrine Society Clinical Practice Guideline — "Testosterone
 *     Therapy in Men With Hypogonadism" (Bhasin et al., J Clin
 *     Endocrinol Metab, 2018): identifies decreased libido, erectile
 *     dysfunction, and low mood / fatigue as the most specific
 *     symptoms, with reduced energy and reduced muscle/bone health as
 *     less specific signals — hence the asymmetric weighting (5/4 on
 *     the specific signals, 2–3 on the less specific ones).
 *   • Corona et al., "Body Weight Loss Reverts Obesity-Associated
 *     Hypogonadism" (Eur J Endocrinol, 2013) and Wittert, "Relationship
 *     between sleep disorders and testosterone" (Curr Opin Endocrinol
 *     Diabetes Obes, 2014): central adiposity and disordered sleep are
 *     independent, bidirectional contributors to low T and CV risk.
 *     This is why we weight 'belly-fat' and 'poor-sleep' across both
 *     hypogonadism and cardiovascular — they're commonly under-weighted
 *     in lay screens despite the evidence.
 *   • Gandaglia et al., "A systematic review of the association between
 *     erectile dysfunction and cardiovascular disease" (Eur Urol, 2014):
 *     ED is an independent predictor of CV events — basis for the
 *     cardiovascular weight on 'difficulty-in-bed'.
 *
 * Notes on the picks:
 *   - "difficulty-in-bed" is the strongest ED signal but also a known
 *     comorbidity with cardiovascular disease and low T — weighted on
 *     all three (see Gandaglia 2014 + Endocrine Society 2018).
 *   - "belly-fat" and "poor-sleep" are the most under-weighted clinical
 *     signals in lay screening — both are independent risk multipliers
 *     for low T AND cardiovascular events, so we weight them assertively
 *     (see Corona 2013, Wittert 2014).
 *   - "proactive" carries no risk weight; the user is symptom-free.
 */
export const SYMPTOM_WEIGHTS: Record<
  string,
  Partial<Record<RiskSystemId, number>>
> = {
  'low-energy':         { hypogonadism: 4, erectileDysfunction: 1, cardiovascular: 2 },
  'hair-loss':          { hypogonadism: 3 },
  'low-libido':         { hypogonadism: 5, erectileDysfunction: 4 },
  'belly-fat':          { hypogonadism: 3, erectileDysfunction: 2, cardiovascular: 4 },
  'brain-fog':          { hypogonadism: 2, cardiovascular: 1 },
  'poor-sleep':         { hypogonadism: 3, erectileDysfunction: 1, cardiovascular: 3 },
  'low-mood':           { hypogonadism: 3, erectileDysfunction: 2, cardiovascular: 1 },
  'stress':             { hypogonadism: 2, erectileDysfunction: 2, cardiovascular: 3 },
  'difficulty-in-bed':  { hypogonadism: 4, erectileDysfunction: 5, cardiovascular: 3 },
  'fertility-concerns': { hypogonadism: 5, erectileDysfunction: 2 },
  // 'proactive' deliberately omitted — no risk signal when the user is
  // symptom-free.
};

const ALL_SYSTEMS: readonly RiskSystemId[] = [
  'hypogonadism',
  'erectileDysfunction',
  'cardiovascular',
] as const;

/**
 * Maximum possible score per system — sum of every symptom's weight
 * for that system if the user ticked everything. Computed once from
 * SYMPTOM_WEIGHTS so we can show "Score 9/19" instead of bare
 * "Score 9". The denominator helps the user understand the signal as
 * bounded rather than a free-floating number.
 */
export const SYSTEM_MAX_SCORES: Record<RiskSystemId, number> = ALL_SYSTEMS
  .reduce(
    (acc, sysId) => {
      let total = 0;
      for (const weights of Object.values(SYMPTOM_WEIGHTS)) {
        const w = weights[sysId];
        if (typeof w === 'number') total += w;
      }
      acc[sysId] = total;
      return acc;
    },
    { hypogonadism: 0, erectileDysfunction: 0, cardiovascular: 0 } as Record<
      RiskSystemId,
      number
    >,
  );

function tierFor(score: number): RiskTier {
  if (score >= 15) return 'high';
  if (score >= 7) return 'moderate';
  return 'low';
}

/** Ranking helper so we can compute the "worst" tier across systems
 *  without a fragile if/else ladder. */
const TIER_RANK: Record<RiskTier, number> = { low: 0, moderate: 1, high: 2 };

export type RiskSystemResult = {
  id: RiskSystemId;
  label: string;
  score: number;
  tier: RiskTier;
};

export type RiskAssessment = {
  /** Raw weighted score per system (0..n, unbounded above). */
  systemScores: Record<RiskSystemId, number>;
  /** Tier per system, computed from the score thresholds. */
  systemTiers: Record<RiskSystemId, RiskTier>;
  /** The worst tier across all three systems — useful for the
   *  dashboard headline / "how should I feel about this?" cue. */
  highestTier: RiskTier;
  /** All three systems sorted highest-score-first so the UI can lead
   *  with the system that has the loudest signal. */
  rankedSystems: RiskSystemResult[];
};

/**
 * Compute the risk assessment for a given symptom selection. Pure
 * function — only the symptoms array matters, so memoization upstream
 * stays narrow.
 */
export function calculateRisk(symptoms: readonly string[]): RiskAssessment {
  const systemScores: Record<RiskSystemId, number> = {
    hypogonadism: 0,
    erectileDysfunction: 0,
    cardiovascular: 0,
  };

  for (const sId of symptoms) {
    const weights = SYMPTOM_WEIGHTS[sId];
    if (!weights) continue;
    // Iterate the canonical system list rather than Object.entries so
    // the key narrowing stays type-safe — no `as RiskSystemId` casts.
    for (const sysId of ALL_SYSTEMS) {
      const w = weights[sysId];
      if (typeof w === 'number') systemScores[sysId] += w;
    }
  }

  const systemTiers: Record<RiskSystemId, RiskTier> = {
    hypogonadism: tierFor(systemScores.hypogonadism),
    erectileDysfunction: tierFor(systemScores.erectileDysfunction),
    cardiovascular: tierFor(systemScores.cardiovascular),
  };

  let highestTier: RiskTier = 'low';
  for (const sysId of ALL_SYSTEMS) {
    if (TIER_RANK[systemTiers[sysId]] > TIER_RANK[highestTier]) {
      highestTier = systemTiers[sysId];
    }
  }

  const rankedSystems: RiskSystemResult[] = ALL_SYSTEMS.map((id) => ({
    id,
    label: SYSTEM_LABELS[id],
    score: systemScores[id],
    tier: systemTiers[id],
  })).sort((a, b) => b.score - a.score);

  return { systemScores, systemTiers, highestTier, rankedSystems };
}

/* ================================================================== */
/* Context                                                              */
/* ================================================================== */

type QuizValue = {
  quiz: QuizAnswers;
  hasCompletedQuiz: boolean;
  setQuiz: (next: Partial<QuizAnswers>) => void;
  resetQuiz: () => void;
  /** Derived risk assessment. Recomputes only when symptoms change. */
  riskAssessment: RiskAssessment;
};

const QuizContext = createContext<QuizValue | null>(null);

const emptyQuiz: QuizAnswers = {
  priorities: [],
  symptoms: [],
};

export function QuizProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage on first mount so a returning user sees
  // their quiz answers preserved across sessions.
  const [quiz, setQuizState] = useState<QuizAnswers>(() => {
    const persisted = loadQuiz<QuizAnswers>();
    if (persisted && typeof persisted === 'object') {
      // Defensive merge — persisted state might be from an older schema
      // missing the arrays we now require.
      return {
        ...emptyQuiz,
        ...persisted,
        priorities: Array.isArray(persisted.priorities)
          ? persisted.priorities
          : [],
        symptoms: Array.isArray(persisted.symptoms) ? persisted.symptoms : [],
      };
    }
    return emptyQuiz;
  });
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean>(
    () => loadQuizComplete(),
  );

  const setQuiz = useCallback((next: Partial<QuizAnswers>) => {
    setQuizState((prev) => ({ ...prev, ...next }));
  }, []);

  // Derive completion off the next quiz state via effect so we never set
  // state inside another updater (Strict-Mode-safe).
  useEffect(() => {
    if (quiz.age && quiz.activity && quiz.priorities.length > 0) {
      setHasCompletedQuiz(true);
    }
  }, [quiz.age, quiz.activity, quiz.priorities.length]);

  // Persist on every change (skipping the first render so we don't
  // overwrite the freshly-hydrated localStorage). The skipNextPersistRef
  // pair lets the cross-tab `storage` listener apply an external update
  // without immediately writing it back and pinging the other tab in a
  // loop — same pattern as ReportsContext.
  const firstQuiz = useRef(true);
  const skipNextQuizPersistRef = useRef(false);
  useEffect(() => {
    if (firstQuiz.current) {
      firstQuiz.current = false;
      return;
    }
    if (skipNextQuizPersistRef.current) {
      skipNextQuizPersistRef.current = false;
      return;
    }
    saveQuiz(quiz);
  }, [quiz]);

  const firstComplete = useRef(true);
  const skipNextCompletePersistRef = useRef(false);
  useEffect(() => {
    if (firstComplete.current) {
      firstComplete.current = false;
      return;
    }
    if (skipNextCompletePersistRef.current) {
      skipNextCompletePersistRef.current = false;
      return;
    }
    saveQuizComplete(hasCompletedQuiz);
  }, [hasCompletedQuiz]);

  /* Cross-tab sync. ReportsContext already listens for dc_reports
   * changes; the same problem applies to quiz state — a user editing
   * symptoms in tab A would otherwise have those overwritten by tab B's
   * stale-in-memory copy on its next save. Listen for `storage` events
   * on dc_quiz / dc_quizComplete and rehydrate from localStorage.
   *
   * `storage` events only fire on OTHER tabs in the same origin, so we
   * don't need to filter our own writes. The skip-refs prevent the
   * applied update from looping back through saveQuiz/saveQuizComplete. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === QUIZ_KEY) {
        const fresh = loadQuiz<QuizAnswers>();
        const merged: QuizAnswers = fresh
          ? {
              ...emptyQuiz,
              ...fresh,
              priorities: Array.isArray(fresh.priorities) ? fresh.priorities : [],
              symptoms: Array.isArray(fresh.symptoms) ? fresh.symptoms : [],
            }
          : emptyQuiz;
        skipNextQuizPersistRef.current = true;
        setQuizState(merged);
      } else if (e.key === QUIZ_COMPLETE_KEY) {
        skipNextCompletePersistRef.current = true;
        setHasCompletedQuiz(loadQuizComplete());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const resetQuiz = useCallback(() => {
    setQuizState(emptyQuiz);
    setHasCompletedQuiz(false);
  }, []);

  /**
   * Risk recomputes ONLY when the symptom set changes — toggling a
   * priority or editing age/activity won't re-run the algorithm.
   * This is the "update dynamically only when the final answer set
   * changes" guarantee the directive asks for.
   */
  const riskAssessment = useMemo(
    () => calculateRisk(quiz.symptoms),
    [quiz.symptoms],
  );

  const value = useMemo<QuizValue>(
    () => ({ quiz, hasCompletedQuiz, setQuiz, resetQuiz, riskAssessment }),
    [quiz, hasCompletedQuiz, setQuiz, resetQuiz, riskAssessment],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz(): QuizValue {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
}
