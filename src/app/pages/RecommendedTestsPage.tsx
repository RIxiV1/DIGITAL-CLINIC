import { useEffect, useMemo, useRef, useState } from 'react';
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
  hasCardiometabolicRedFlag,
  hasPde5InteractionMed,
  SYSTEM_MAX_SCORES,
  type RiskAssessment,
  type RiskSystemResult,
} from '../contexts/QuizContext';
import { recommendTestsFor, type RecommendedTest } from '../data/tests';
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

  // Cardiometabolic red flag disclosed in the health screen (heart
  // condition, high BP, diabetes, or nitrate meds). When present, the
  // page must lead with a "see a doctor first" intercept regardless of
  // the symptom-cluster tier: sexual/energy symptoms alongside these
  // conditions can be an early CV-disease marker (Montorsi artery-size
  // hypothesis; Princeton III), and some treatments are unsafe with them
  // (PDE5i + nitrates is an absolute contraindication). We screen + point
  // to labs/clinicians; we never dispense, so this is a nudge, not a gate.
  const hasRedFlag = hasCardiometabolicRedFlag(quiz.comorbidities);
  // Named drug-interaction danger (nitrates / alpha-blockers + PDE5i).
  // Adds a specific, actionable line to the intercept — valuable even
  // though we dispense nothing, since a user could buy these elsewhere.
  const hasMedInteraction = hasPde5InteractionMed(quiz.comorbidities);
  // Default to collapsed. Was: open the first test on mount, which
  // dumped 6+ marker rows on the user's first paint without them
  // asking for it. The page's job is to show *what we'd test*; the
  // marker drill-down is intent-driven and belongs behind a tap.
  const [expanded, setExpanded] = useState<string | null>(null);
  // "Print this list" force-expands every test body so the printout
  // includes the actual markers — not just test names. Cards are
  // collapsed by default and the bodies only mount when open, so without
  // this the advertised "take it to a lab" sheet would be useless. We
  // expand, print once the DOM has the bodies, then collapse back. Using
  // an effect (not beforeprint) guarantees the render lands before the
  // print dialog, reliably across browsers.
  const [printExpand, setPrintExpand] = useState(false);
  useEffect(() => {
    if (!printExpand) return;
    window.print();
    setPrintExpand(false);
  }, [printExpand]);
  // Risk-card disclosure. Default-collapsed so the test list (the
  // actual content the user came for) isn't gated by a ~120px-tall
  // metadata panel explaining *why* the tests were picked. The
  // collapsed trigger still surfaces the headline finding ("Your
  // symptoms point strongest to...") so the reasoning isn't hidden
  // entirely — just the per-system breakdown.
  const [riskOpen, setRiskOpen] = useState(false);

  // Panel summary metrics for the hero footer pill row. Computed
  // from the live `tests` list so adding/removing categories in
  // recommendTestsFor() flows through automatically — no hand-coded
  // counts to drift.
  const totalMarkers = tests.reduce((sum, t) => sum + t.includes.length, 0);

  // Split the recommendation into the universal foundation + the
  // quiz-driven additions. The two groups get DIFFERENT layouts: the
  // Starter Check renders as a standalone hero card; the others
  // collapse into a single divide-y row-list inside one shared Card.
  // Previously all 6 were equal-weight Cards in a flat stack — visually
  // democratic but psychologically wrong: the Starter Check is the
  // panel everyone gets, the others are contextual. Treating them as
  // peers blurred that.
  const starter = tests.find((t) => t.id === 'foundational') ?? null;
  const others = tests.filter((t) => t.id !== 'foundational');

  /* Learn More state — only one of these is non-null at a time. */
  const [openTestId, setOpenTestId] = useState<string | null>(null);
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  /* Element that triggered the modal — restore focus to it on close. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const openTest = openTestId
    ? (tests.find((t) => t.id === openTestId) ?? null)
    : null;
  const openTestLM = openTestId ? (getTestInfo(openTestId) ?? null) : null;
  const openMarkerLM = openMarkerName
    ? (getMarkerInfo(openMarkerName) ?? null)
    : null;
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
        {/* Symmetric — both the cap (lg:max-w-3xl) and the centering
            (lg:mx-auto) fire at the same breakpoint. The asymmetric
            `md:mx-auto lg:max-w-3xl` pattern that lived here briefly
            left iPad portrait centered without a max-width cap, so
            the content stretched to whatever the wide Container
            offered. */}
        <div className="lg:max-w-3xl">
          <Pill tone="gold" size="md">
            Based on your answers
          </Pill>

          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-3 text-balance">
            Here’s what we’d test, given what you told us.
          </h1>
          <p className="mt-2 text-body-sm lg:text-body text-ink-soft text-pretty">
            Tap any test to see <em>why</em> we picked it and <em>what</em>’s
            actually measured.
          </p>

          {/* Panel scale, surfaced upfront. Lets a user know what they're
              committing to before they scroll through 6 collapsed cards —
              "how many tests is this and how many markers do they cover?"
              is the natural first question the headline doesn't answer. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold text-ink-soft">
            <span className="tabular-nums">
              {tests.length} {tests.length === 1 ? 'test' : 'tests'}
            </span>
            <span aria-hidden className="text-line">
              ·
            </span>
            <span className="tabular-nums">{totalMarkers} markers</span>
          </div>
        </div>

        {/* Clinical-evaluation-first intercept. Fires in two cases:
              1. A cardiometabolic red flag (heart condition, high BP,
                 diabetes, nitrate meds) — the priority. Sexual/energy
                 symptoms alongside these can be an early CV-disease
                 marker, and some treatments are unsafe with them, so the
                 "see a doctor first" message must show regardless of the
                 symptom-cluster tier.
              2. A strong symptom cluster (highest tier 'high') even with
                 no disclosed comorbidity.
            Not a blocking modal (paternalistic, and we dispense nothing
            to block) — the first content card below the headline so it
            can't be missed. Calm amber/charcoal treatment per clinical-UX
            guidance, not an alarmist bright red. */}
        {(hasRedFlag ||
          (showRiskCard && riskAssessment.highestTier === 'high')) && (
          <div className="mt-6 lg:max-w-3xl">
            <Card className="!bg-attention-soft border-attention/40">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-2xl bg-attention text-on-status shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-body lg:text-body-lg text-ink leading-tight">
                    {hasRedFlag
                      ? 'See a doctor before starting any treatment.'
                      : 'Talk to a doctor before acting on this.'}
                  </div>
                  <p className="mt-1.5 text-caption text-ink-soft leading-relaxed">
                    {hasRedFlag
                      ? 'You told us about a heart condition, high blood pressure, or diabetes. Symptoms like low energy or trouble in bed can be an early warning sign of cardiovascular problems — and some performance treatments are unsafe taken with heart, blood-pressure, or nitrate medicines. Get a proper clinical evaluation first, and bring the tests below to that appointment.'
                      : 'Your answers cluster strongly toward at least one system. The tests below help confirm or rule it out — but the interpretation belongs in a consultation, not a self-diagnosis from a screener.'}
                  </p>
                  {hasMedInteraction && (
                    <p className="mt-2 text-caption text-ink leading-relaxed font-semibold">
                      Because you take nitrate or alpha-blocker medication,
                      never take an erection or “performance” pill (like
                      sildenafil or tadalafil) without a doctor’s OK — together
                      they can drop your blood pressure dangerously low.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* "Why these tests" — the screening-signal breakdown. Used to
            sit always-open as a ~120px tall card above the test list,
            forcing every visitor to scroll past the reasoning to reach
            the actual tests. Now a disclosure: collapsed trigger shows
            the headline finding ("symptoms point strongest to X") so
            the reasoning isn't hidden; full per-system breakdown sits
            behind a tap. Same atoms, same data, ~half the default
            vertical footprint. */}
        {showRiskCard && (
          <div className="mt-5 lg:max-w-3xl">
            <RiskDisclosure
              assessment={riskAssessment}
              open={riskOpen}
              onToggle={() => setRiskOpen((v) => !v)}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* TEST LIST — STARTER HERO + COMPACT ROW LIST                    */}
        {/*                                                                */}
        {/* Two zones, not one flat stack:                                 */}
        {/*  · Starter Check: standalone Card with hero treatment (gold    */}
        {/*    ring, gold "01" badge, "Start here" pill, marker preview    */}
        {/*    line). Substantial — visually says "this is the foundation."*/}
        {/*  · Secondary tests: a SINGLE shared Card with divide-y rows.   */}
        {/*    No numbered badges per row, tight px-4 py-3.5 padding,      */}
        {/*    title + subtitle + 2 meta pills. Reads as a scannable list, */}
        {/*    not a wall of cards.                                        */}
        {/*                                                                */}
        {/* The previous flat 6-card stack treated the universal Starter   */}
        {/* and the quiz-driven additions as visual peers. They aren't —   */}
        {/* the Starter is the foundation everyone gets, the rest are      */}
        {/* contextual. This split surfaces that hierarchy at a glance.    */}
        {/* ============================================================ */}

        {/* Shared expanded-body renderer — captures quiz/refs/setters from
            the enclosing scope so we don't have to plumb 5 props into a
            sub-component. Used by both the Starter card and each row of
            the secondary list, with different padding classes so the body
            content aligns under each layout's collapsed title. */}
        {(() => {
          const renderExpandedBody = (t: RecommendedTest, padClass: string) => (
            <div className={padClass}>
              {/* "Why this for you" — left-accent treatment (no background
                  wash) so the personalised reasoning sits flush with the
                  rest of the expanded body. */}
              <div className="border-l-2 border-l-gold-500 pl-3.5">
                <div className="text-micro uppercase tracking-label font-bold text-gold-800">
                  Why this for you
                </div>
                <p className="mt-1 text-body-sm leading-relaxed text-ink">
                  {t.whyTemplate(quiz)}
                </p>
              </div>

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
                <div className="text-micro uppercase tracking-label font-bold text-indigo-700">
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
          );

          return (
            <div className="mt-7 grid gap-4 lg:max-w-3xl">
              {/* === STARTER CHECK — HERO CARD === */}
              {starter &&
                (() => {
                  const open = expanded === starter.id || printExpand;
                  return (
                    <Card
                      padded={false}
                      className="border-gold-500/40 ring-1 ring-gold-500/30 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpanded(open ? null : starter.id)}
                        className="w-full text-left flex items-start gap-3 p-5"
                      >
                        <div className="grid place-items-center w-11 h-11 rounded-2xl font-display text-body shrink-0 bg-gold-500 text-indigo-900">
                          01
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-semibold text-ink">
                              {starter.name}
                            </div>
                            <Pill tone="gold" size="sm">
                              Start here
                            </Pill>
                          </div>
                          <div className="text-caption text-muted mt-0.5">
                            {starter.short}
                          </div>
                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            {starter.fasting && (
                              <Pill tone="gold" size="sm">
                                <Coffee size={10} /> Fasting
                              </Pill>
                            )}
                            <Pill tone="indigo" size="sm">
                              <Clock size={10} /> {starter.turnaround}
                            </Pill>
                            <Pill tone="neutral" size="sm">
                              {starter.includes.length} markers
                            </Pill>
                          </div>
                          {/* Surface the personalised "why" in the COLLAPSED
                              state — previously it only appeared after the user
                              tapped to expand, hiding the one thing that makes
                              the recommendation feel earned. Existing copy, just
                              shown up front; line-clamped so the card stays
                              compact. */}
                          {!open && (
                            <p className="mt-2 text-caption leading-relaxed text-ink-soft border-l-2 border-l-gold-500/70 pl-2.5 line-clamp-2">
                              {starter.whyTemplate(quiz)}
                            </p>
                          )}
                          {starter.includes.length > 0 && (
                            <div className="mt-2 text-caption text-ink-soft leading-relaxed">
                              <span className="font-semibold">Includes:</span>{' '}
                              <span className="text-muted">
                                {starter.includes
                                  .slice(0, 3)
                                  .map((m) => m.name)
                                  .join(', ')}
                                {starter.includes.length > 3 &&
                                  ` +${starter.includes.length - 3} more`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-indigo-700 shrink-0 mt-1">
                          {open ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </div>
                      </button>
                      {open && renderExpandedBody(starter, 'px-5 pb-5')}
                    </Card>
                  );
                })()}

              {/* === DIVIDER EYEBROW === */}
              {starter && others.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="h-px bg-line flex-1" />
                  <span className="text-micro uppercase tracking-eyebrow font-bold text-muted shrink-0">
                    Based on your quiz
                  </span>
                  <div className="h-px bg-line flex-1" />
                </div>
              )}

              {/* === SECONDARY TESTS — COMPACT ROW LIST ===
                  All quiz-driven additions inside ONE Card with divide-y
                  rows. Each row is a tighter button (px-4 py-3.5, no
                  numbered badge) — they read as a list of related items
                  under the Starter Check, not as peers of it. The
                  expanded body uses the same renderer as the Starter so
                  the drill-down content is identical. */}
              {others.length > 0 && (
                <Card padded={false} className="overflow-hidden">
                  {others.map((t, i) => {
                    const open = expanded === t.id || printExpand;
                    return (
                      <div
                        key={t.id}
                        className={i > 0 ? 'border-t border-line/70' : ''}
                      >
                        <button
                          onClick={() => setExpanded(open ? null : t.id)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-canvas/40 transition-colors focus-visible:outline-none focus-visible:bg-canvas/40"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-ink">
                              {t.name}
                            </div>
                            <div className="text-caption text-muted mt-0.5">
                              {t.short}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
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
                            {/* Personalised "why" up front (collapsed) — this
                                is the symptom-driven reasoning, the magic that
                                was hidden behind the expand tap. */}
                            {!open && (
                              <p className="mt-2 text-caption leading-relaxed text-ink-soft border-l-2 border-l-gold-500/70 pl-2.5 line-clamp-2">
                                {t.whyTemplate(quiz)}
                              </p>
                            )}
                          </div>
                          <div className="text-indigo-700 shrink-0 mt-1">
                            {open ? (
                              <ChevronUp size={20} />
                            ) : (
                              <ChevronDown size={20} />
                            )}
                          </div>
                        </button>
                        {open && renderExpandedBody(t, 'px-4 pb-4')}
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>
          );
        })()}

        {/* "What now?" — two clear paths forward. Most users haven't
            done their bloods at this point, so the previous single
            "Go to dashboard" CTA confused new visitors who hadn't
            uploaded anything yet. Two cards: one for each state. */}
        <div className="mt-8 grid sm:grid-cols-2 gap-3 lg:max-w-3xl">
          <Card className="bg-indigo-50 border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-indigo-600 text-on-primary shrink-0">
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
                  onClick={() => setPrintExpand(true)}
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
/* Risk disclosure — collapsible expression of the QuizContext risk    */
/* algorithm.                                                          */
/*                                                                      */
/* Trigger (always visible): a Card-like button showing the "Why these */
/* tests" eyebrow + the lead sentence (tier-aware copy summarising the */
/* top signal). Chevron rotates 180° when open.                        */
/*                                                                      */
/* Body (visible when open): the three-row per-system breakdown + the  */
/* "screening signal — not a diagnosis" disclaimer.                    */
/*                                                                      */
/* The lead sentence stays on the trigger so the reasoning isn't       */
/* hidden — only the per-system detail is. Users who care about the    */
/* score breakdown tap once; users who just want the test list scroll  */
/* past a single Card-height row instead of a 120px-tall panel.        */
/* ------------------------------------------------------------------ */

function RiskDisclosure({
  assessment,
  open,
  onToggle,
}: {
  assessment: RiskAssessment;
  open: boolean;
  onToggle: () => void;
}) {
  const top = assessment.rankedSystems[0];

  const lead =
    top.tier === 'low'
      ? `Your symptoms don't cluster strongly around any one system — the tests below cover the usual ground.`
      : top.tier === 'moderate'
        ? `Your symptoms cluster moderately around ${top.label.toLowerCase()}.`
        : `Your symptoms cluster strongly around ${top.label.toLowerCase()}. Worth bringing this to a doctor before assuming what it means.`;

  return (
    <div className="rounded-[20px] bg-surface border border-line/70 shadow-soft overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left p-5 flex items-start gap-3 hover:bg-canvas/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <div className="flex-1 min-w-0">
          <Pill tone="indigo" size="sm">
            Why these tests
          </Pill>
          <p className="mt-2.5 text-body-sm leading-relaxed text-ink-soft">
            {lead}
          </p>
        </div>
        <span
          className={`grid place-items-center w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <ChevronDown size={16} />
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-line/70">
          <div className="mt-4 grid gap-1.5">
            {assessment.rankedSystems.map((system) => (
              <RiskRow key={system.id} system={system} />
            ))}
          </div>

          <p className="mt-3.5 text-caption text-muted leading-relaxed">
            This is a screening signal — not a diagnosis. The tests below cover
            the markers that would confirm or rule out each system.
          </p>
        </div>
      )}
    </div>
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
          badge: 'bg-concern text-on-status shadow-sm',
          label: 'Strong signal',
          Icon: AlertCircle,
          iconClass: 'text-concern',
        }
      : system.tier === 'moderate'
        ? {
            row: 'bg-attention-soft/40 -mx-3 px-3 rounded-lg',
            badge: 'bg-attention text-on-status shadow-sm',
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
          {/* "screening only" tail used to live on every row. Dropped:
              the bottom-of-card disclaimer already carries that caveat
              once for the whole card. Repeating it per row was noise. */}
          <div className="mt-0.5 text-caption text-muted tabular-nums">
            Score {system.score} / {maxScore}
          </div>
        </div>
      </div>
      <div
        className={`shrink-0 mt-0.5 inline-flex items-center px-2.5 h-6 rounded-full text-micro font-bold uppercase tracking-widest ${tierStyles.badge}`}
        aria-label={`${system.label}: ${tierStyles.label}`}
      >
        {tierStyles.label}
      </div>
    </div>
  );
}
