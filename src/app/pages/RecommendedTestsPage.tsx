import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  Info,
  Printer,
  Sparkles,
  Upload,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BottomNav from '../components/BottomNav';
import LearnMoreModal from '../components/LearnMoreModal';
import { useNavigation, useQuiz } from '../AppContext';
import {
  SYSTEM_MAX_SCORES,
  type RiskAssessment,
  type RiskSystemResult,
} from '../contexts/QuizContext';
import { recommendTestsFor } from '../data/tests';
import { getMarkerInfo } from '../data/markerInfo';
import { getTestInfo } from '../data/testInfo';

export default function RecommendedTestsPage() {
  const { quiz, riskAssessment } = useQuiz();
  const { navigate } = useNavigation();
  const tests = useMemo(() => recommendTestsFor(quiz), [quiz]);

  // Only surface the risk card when the user actually answered the
  // symptoms question — empty symptoms means there's nothing to
  // interpret and a "your symptoms suggest..." card would feel dishonest.
  const showRiskCard = quiz.symptoms.length > 0;
  const [expanded, setExpanded] = useState<string | null>(tests[0]?.id ?? null);

  /* Learn More state — only one of these is non-null at a time. */
  const [openTestId, setOpenTestId] = useState<string | null>(null);
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  /* Element that triggered the modal — restore focus to it on close. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const openTest = openTestId
    ? tests.find((t) => t.id === openTestId) ?? null
    : null;
  const openTestLM = openTestId ? getTestInfo(openTestId) ?? null : null;
  const openMarkerLM = openMarkerName ? getMarkerInfo(openMarkerName) ?? null : null;
  const modalTitle = openTest?.name ?? openMarkerName ?? '';
  const modalSubtitle = openTest ? openTest.short : 'Marker · Learn more';
  const modalInfo = openTestLM ?? openMarkerLM;

  const closeModal = () => {
    setOpenTestId(null);
    setOpenMarkerName(null);
    // Return focus to whichever trigger opened the modal.
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Your recommended tests" />

      <Container size="wide" className="pt-5 md:pt-10">
        <div className="lg:max-w-3xl md:mx-auto">
          <Pill tone="gold" size="md">
            <Sparkles size={11} />
            Personalised for you
          </Pill>

          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-3 text-balance">
            Here’s what we’d test, given what you told us.
          </h1>
          <p className="mt-2 text-body-sm lg:text-body text-ink-soft text-pretty">
            Tap any test to see <em>why</em> we picked it and <em>what</em>’s
            actually measured.
          </p>
        </div>

        {/* High-tier intercept — when the symptom cluster is strong, the
            user shouldn't move to "let me self-test and decide" without
            seeing the recommendation to talk to a clinician first. Not a
            blocking modal (paternalistic), but the first content card
            below the headline so it can't be missed. */}
        {showRiskCard && riskAssessment.highestTier === 'high' && (
          <div className="mt-6 lg:max-w-3xl">
            <Card className="!bg-concern-soft border-concern/30">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-2xl bg-concern text-white shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-body lg:text-body-lg text-ink leading-tight">
                    Talk to a doctor before acting on this.
                  </div>
                  <p className="mt-1.5 text-caption text-ink-soft leading-relaxed">
                    Your answers cluster strongly toward at least one
                    system. The tests below help confirm or rule it out —
                    but the interpretation belongs in a consultation,
                    not a self-diagnosis from a screener.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {showRiskCard && (
          <div className="mt-6 lg:max-w-3xl">
            <RiskSummaryCard assessment={riskAssessment} />
          </div>
        )}

        <div className="mt-7 grid gap-3 lg:max-w-3xl">
          {tests.map((t, i) => {
            const open = expanded === t.id;
            return (
              // Per-row entrance animation removed — see #6.7. With 4-6
              // tests in the list, stagger added ~250ms of perceived
              // wait on mid-tier devices without conveying useful
              // information. The section-level Reveal on the heading
              // still anchors the page transition.
              <div key={t.id}>
                <Card padded={false} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : t.id)}
                    className="w-full text-left p-5 flex items-start gap-3"
                  >
                    <div className="grid place-items-center w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 font-display text-body shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink">{t.name}</div>
                      <div className="text-caption text-muted mt-0.5">
                        {t.short}
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        {t.fasting && (
                          <Pill tone="gold" size="sm">
                            <Coffee size={10} /> Fasting
                          </Pill>
                        )}
                        <Pill tone="indigo" size="sm">
                          <Clock size={10} /> {t.turnaround}
                        </Pill>
                        <Pill tone="neutral" size="sm">
                          {t.includes.length} markers
                        </Pill>
                      </div>
                    </div>
                    <div className="text-indigo-700 shrink-0 mt-1">
                      {open ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5">
                          <div className="rounded-[16px] bg-gold-50 border border-gold-200 p-4">
                            <div className="text-micro uppercase tracking-[0.14em] font-bold text-gold-800">
                              Why this for you
                            </div>
                            {/* Hardcoded ink so the body stays dark on the
                                gold background in BOTH themes. text-ink
                                would invert to light in dark mode and the
                                copy would vanish into the gold tile. */}
                            <p className="mt-1.5 text-body-sm leading-relaxed text-[#0F1422]">
                              {t.whyTemplate(quiz)}
                            </p>
                          </div>

                          {/* Test-level Learn More — only shows if testInfo has an entry */}
                          {getTestInfo(t.id) && (
                            <button
                              onClick={(e) => {
                                triggerRef.current = e.currentTarget;
                                setOpenTestId(t.id);
                              }}
                              className="mt-3 inline-flex items-center gap-1.5 text-caption font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-md px-1 -mx-1"
                            >
                              Learn more about this panel
                              <ChevronRight size={14} />
                            </button>
                          )}

                          <div className="mt-4">
                            <div className="text-micro uppercase tracking-[0.14em] font-bold text-indigo-700">
                              What’s in this test
                            </div>
                            <ul className="mt-2 grid gap-2">
                              {t.includes.map((m) => {
                                const hasInfo = !!getMarkerInfo(m.name);
                                return (
                                  <li
                                    key={m.name}
                                    className="flex items-start gap-3 py-2 border-b border-line/70 last:border-0"
                                  >
                                    <CheckCircle2
                                      size={16}
                                      className="text-indigo-600 mt-0.5 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-body-sm">
                                        {m.name}
                                      </div>
                                      <div className="text-caption text-ink-soft leading-relaxed">
                                        {m.about}
                                      </div>
                                    </div>
                                    {hasInfo && (
                                      <button
                                        onClick={(e) => {
                                          triggerRef.current = e.currentTarget;
                                          setOpenMarkerName(m.name);
                                        }}
                                        aria-label={`Learn more about ${m.name}`}
                                        title={`Learn more about ${m.name}`}
                                        // 48x48 hit area; visible glyph stays
                                        // small via inner grid centering. -m-2
                                        // pulls the larger target back into
                                        // the row so it doesn't shove layout.
                                        className="shrink-0 -m-3 grid place-items-center w-12 h-12 rounded-full text-muted hover:text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors"
                                      >
                                        <Info size={14} />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </div>
            );
          })}
        </div>

        {/* "What now?" — two clear paths forward. Most users haven't
            done their bloods at this point, so the previous single
            "Go to dashboard" CTA confused new visitors who hadn't
            uploaded anything yet. Two cards: one for each state. */}
        <div className="mt-8 grid sm:grid-cols-2 gap-3 lg:max-w-3xl">
          <Card className="bg-indigo-50 border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-indigo-600 text-white shrink-0">
                <Upload size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-indigo-900 text-body-sm">
                  Done at the lab?
                </div>
                <p className="mt-1 text-caption text-indigo-700 leading-relaxed">
                  Upload your report and we’ll translate it into plain English.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate({ type: 'upload' })}
                  trailing={<ArrowRight size={14} />}
                >
                  Upload report
                </Button>
              </div>
            </div>
          </Card>

          <Card className="bg-canvas border-line">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-surface text-ink border border-line shrink-0">
                <Printer size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink text-body-sm">
                  Not yet?
                </div>
                <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                  Save this list to take to a lab — print it or screenshot it.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => window.print()}
                >
                  Print this list
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Container>

      {/* Secondary action — go to dashboard. Less prominent now that
          the two "next" cards above carry the primary intent. */}
      <Container size="wide" className="mt-5 md:mt-6">
        <div className="lg:max-w-3xl">
          <Button
            size="md"
            variant="ghost"
            responsiveFullWidth
            onClick={() => navigate({ type: 'home' })}
            trailing={<ArrowRight size={16} />}
          >
            Skip — go to my dashboard
          </Button>
        </div>
      </Container>

      <BottomNav />

      <LearnMoreModal
        open={!!modalInfo}
        title={modalTitle}
        subtitle={modalSubtitle}
        info={modalInfo}
        onClose={closeModal}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Risk summary — visible expression of the QuizContext risk algorithm */
/* ------------------------------------------------------------------ */

/**
 * Renders the three-system risk assessment from the quiz answers as a
 * short, ranked card. The lead copy adapts to the highest tier so that
 * a low-signal assessment doesn't claim symptoms "strongly point to"
 * anything.
 *
 * The card is intentionally framed as a *screening signal* — every
 * surface that talks about risk in this product must do the same so we
 * don't misrepresent the algorithm as a diagnosis.
 */
function RiskSummaryCard({ assessment }: { assessment: RiskAssessment }) {
  const top = assessment.rankedSystems[0];

  const lead =
    top.tier === 'low'
      ? `Your symptoms don't cluster strongly around any one system — the tests below cover the usual ground.`
      : top.tier === 'moderate'
        ? `Your symptoms cluster moderately around ${top.label.toLowerCase()}.`
        : `Your symptoms cluster strongly around ${top.label.toLowerCase()}. Worth bringing this to a doctor before assuming what it means.`;

  return (
    <Card className="border-indigo-100/80">
      <div className="flex items-center gap-2">
        <Pill tone="indigo" size="sm">
          <Sparkles size={10} /> Why these tests
        </Pill>
      </div>
      <p className="mt-2.5 text-body-sm leading-relaxed text-ink-soft">
        {lead}{' '}
        <span className="text-muted">
          Scores combine your symptom checks with their known clinical weight.
        </span>
      </p>

      <div className="mt-4 grid gap-1.5">
        {assessment.rankedSystems.map((system) => (
          <RiskRow key={system.id} system={system} />
        ))}
      </div>

      <p className="mt-3.5 text-caption text-muted leading-relaxed">
        This is a screening signal — not a diagnosis. The tests below cover
        the markers that would confirm or rule out each system.
      </p>
    </Card>
  );
}

/**
 * One row of the risk card — system label, score density, tier badge.
 *
 * Reframed for honesty:
 *   - "High Risk" → "Strong signal" (and friends). The product emits a
 *     symptom-cluster strength, not a diagnostic risk score, so the
 *     label should match the math.
 *   - "Score 9" → "Score 9 / 19 — screening only". The denominator
 *     bounds the metric so it can't be misread as a clinical scale,
 *     and the trailing clause repeats the disclaimer in line with the
 *     badge (not just at the bottom of the card).
 *
 * Visual weight still scales with tier: HIGH gets a soft red row tint
 * + alert-circle, MODERATE gets soft yellow + warning triangle, LOW
 * stays flat with a check icon.
 */
function RiskRow({ system }: { system: RiskSystemResult }) {
  const tierStyles =
    system.tier === 'high'
      ? {
          row: 'bg-concern-soft/40 -mx-3 px-3 rounded-lg',
          badge: 'bg-concern text-white shadow-sm',
          label: 'Strong signal',
          Icon: AlertCircle,
          iconClass: 'text-concern',
        }
      : system.tier === 'moderate'
        ? {
            row: 'bg-attention-soft/40 -mx-3 px-3 rounded-lg',
            badge: 'bg-attention text-white shadow-sm',
            label: 'Moderate signal',
            Icon: AlertTriangle,
            iconClass: 'text-attention',
          }
        : {
            row: '',
            badge: 'bg-good-soft text-good',
            label: 'Weak signal',
            Icon: CheckCircle2,
            iconClass: 'text-good',
          };
  const { Icon } = tierStyles;
  const maxScore = SYSTEM_MAX_SCORES[system.id];

  return (
    <div
      className={`flex items-start justify-between gap-3 py-2.5 border-b border-line/60 last:border-0 ${tierStyles.row}`}
    >
      {/* No `truncate` — system labels can run long and chopping them
          mid-word loses the meaning. Allow wrap to 2 lines. */}
      <div className="flex-1 min-w-0 flex items-start gap-2">
        <Icon
          size={15}
          className={`${tierStyles.iconClass} shrink-0 mt-0.5`}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-caption font-semibold text-ink leading-tight">
            {system.label}
          </div>
          <div className="mt-0.5 text-caption text-muted tabular-nums">
            Score {system.score} / {maxScore}{' '}
            <span className="not-italic">·</span> screening only
          </div>
        </div>
      </div>
      <div
        className={`shrink-0 mt-0.5 inline-flex items-center px-2.5 h-6 rounded-full text-micro font-bold uppercase tracking-[0.1em] ${tierStyles.badge}`}
        aria-label={`${system.label}: ${tierStyles.label}`}
      >
        {tierStyles.label}
      </div>
    </div>
  );
}
