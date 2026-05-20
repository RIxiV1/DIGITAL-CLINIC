import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  Info,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BottomNav from '../components/BottomNav';
import LearnMoreModal from '../components/LearnMoreModal';
import { useNavigation, useQuiz } from '../AppContext';
import { recommendTestsFor } from '../data/tests';
import { getMarkerInfo } from '../data/markerInfo';
import { getTestInfo } from '../data/testInfo';

export default function RecommendedTestsPage() {
  const { quiz } = useQuiz();
  const { navigate } = useNavigation();
  const tests = useMemo(() => recommendTestsFor(quiz), [quiz]);
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
    <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
      <Header variant="page" title="Your recommended tests" />

      <Container size="wide" className="pt-5 lg:pt-10">
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="gold" size="md">
            <Sparkles size={11} />
            Personalised for you
          </Pill>

          <h1 className="font-display text-[28px] lg:text-[36px] leading-tight mt-3 text-balance">
            Here’s what we’d test, given what you told us.
          </h1>
          <p className="mt-2 text-[14.5px] lg:text-[15.5px] text-ink-soft text-pretty">
            Tap any test to see <em>why</em> we picked it and <em>what</em>’s
            actually measured.
          </p>
        </div>

        <div className="mt-7 grid gap-3 lg:max-w-3xl">
          {tests.map((t, i) => {
            const open = expanded === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
              >
                <Card padded={false} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : t.id)}
                    className="w-full text-left p-5 flex items-start gap-3"
                  >
                    <div className="grid place-items-center w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 font-display text-[15px] shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink">{t.name}</div>
                      <div className="text-[12.5px] text-muted mt-0.5">
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
                            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-gold-800">
                              Why this for you
                            </div>
                            {/* Hardcoded ink so the body stays dark on the
                                gold background in BOTH themes. text-ink
                                would invert to light in dark mode and the
                                copy would vanish into the gold tile. */}
                            <p className="mt-1.5 text-[14px] leading-relaxed text-[#0F1422]">
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
                              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-md px-1 -mx-1"
                            >
                              Learn more about this panel
                              <ChevronRight size={14} />
                            </button>
                          )}

                          <div className="mt-4">
                            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-indigo-700">
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
                                      <div className="font-semibold text-[14px]">
                                        {m.name}
                                      </div>
                                      <div className="text-[13px] text-ink-soft leading-relaxed">
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
                                        className="shrink-0 mt-0.5 grid place-items-center w-7 h-7 rounded-full text-muted hover:text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors"
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
              </motion.div>
            );
          })}
        </div>

        <Card className="mt-8 bg-indigo-50 border-indigo-100 lg:max-w-3xl">
          <div className="font-semibold text-indigo-800">
            Already done your blood work?
          </div>
          <p className="mt-1 text-[13px] text-indigo-700">
            Skip booking and go straight to your home dashboard. You can upload
            an existing report from there.
          </p>
        </Card>
      </Container>

      {/* Inline CTA visible on every viewport — no more sticky-bottom takeover
          that competed with the BottomNav on mobile. */}
      <Container size="wide" className="mt-6 lg:mt-8">
        <div className="lg:max-w-3xl">
          <Button
            size="lg"
            responsiveFullWidth
            onClick={() => navigate({ type: 'home' })}
            trailing={<ArrowRight size={18} />}
          >
            Go to my dashboard
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
