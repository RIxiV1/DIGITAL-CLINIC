import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Brain, Check, Sparkles, X } from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Logo from '../components/Logo';
import { useApp, type QuizAnswers } from '../AppContext';
import { quizSteps, totalQuizSteps } from '../data/quiz';

export default function QuizPage() {
  const { quiz, setQuiz, navigate, replace, back, hasCompletedQuiz } = useApp();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const step = quizSteps[stepIndex];
  const progress = ((stepIndex + 1) / totalQuizSteps) * 100;

  const currentValue = quiz[step.field as keyof QuizAnswers] as
    | string
    | string[]
    | undefined;

  const isSelected = (id: string) =>
    step.multi
      ? (currentValue as string[] | undefined)?.includes(id) ?? false
      : currentValue === id;

  const toggle = (id: string) => {
    if (step.multi) {
      const next = new Set((currentValue as string[] | undefined) ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setQuiz({ [step.field]: Array.from(next) } as Partial<QuizAnswers>);
    } else {
      setQuiz({ [step.field]: id } as Partial<QuizAnswers>);
    }
  };

  const canContinue = step.multi
    ? step.field === 'symptoms'
      ? true
      : ((currentValue as string[] | undefined)?.length ?? 0) > 0
    : !!currentValue;

  const goNext = () => {
    if (stepIndex < totalQuizSteps - 1) {
      setDirection(1);
      setStepIndex(stepIndex + 1);
    } else {
      // Brief AI personalization moment before we route to the results
      setIsPersonalizing(true);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStepIndex(stepIndex - 1);
    } else {
      back();
    }
  };

  const requestExit = () => {
    // If the user has made selections, ask before throwing them away.
    const touched =
      !!quiz.age ||
      !!quiz.activity ||
      quiz.priorities.length > 0 ||
      quiz.symptoms.length > 0;
    if (touched && stepIndex > 0) {
      setConfirmExit(true);
    } else {
      doExit();
    }
  };

  const doExit = () => {
    setConfirmExit(false);
    // If the user already finished a quiz earlier, return home; else landing.
    replace(hasCompletedQuiz ? { type: 'home' } : { type: 'landing' });
  };

  const sectionOrder: Array<'basics' | 'priorities' | 'symptoms'> = [
    'basics',
    'priorities',
    'symptoms',
  ];

  return (
    <div className="min-h-screen pb-36 bg-canvas">
      {/* Top */}
      <Container className="pt-5">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="grid place-items-center w-9 h-9 -ml-1.5 rounded-full hover:bg-indigo-50 text-indigo-700 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <Logo size="sm" />
          <button
            onClick={requestExit}
            className="grid place-items-center w-9 h-9 -mr-1.5 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors"
            aria-label="Exit quiz"
            title="Exit quiz"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {sectionOrder.map((s) => {
            const stepsInSection = quizSteps.filter(
              (x) => x.sectionId === s,
            ).length;
            const stepsBefore = quizSteps
              .slice(0, stepIndex + 1)
              .filter((x) => x.sectionId === s).length;
            const localPct = Math.max(
              0,
              Math.min(100, (stepsBefore / stepsInSection) * 100),
            );
            return (
              <div
                key={s}
                className="h-1.5 flex-1 rounded-full bg-indigo-100 overflow-hidden"
              >
                <motion.div
                  initial={false}
                  animate={{ width: `${localPct}%` }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-indigo-600 rounded-full"
                />
              </div>
            );
          })}
        </div>

        {/* Progress strip — step counter only. Section label is now inside the
            animated block so it crossfades with the question instead of
            updating instantly while the old title is still visible. */}
        <div className="mt-3 flex items-center justify-end text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Step {stepIndex + 1} of {totalQuizSteps} · {Math.round(progress)}%
        </div>
      </Container>

      {/* Step content */}
      <Container className="mt-6">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={step.id}
            custom={direction}
            initial={{ opacity: 0, x: direction === 1 ? 18 : -18 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{
              opacity: 0,
              x: direction === 1 ? -12 : 12,
              transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700 mb-2">
              {step.sectionLabel}
            </div>
            <h1 className="font-display text-[30px] leading-tight text-balance">
              {step.title}
            </h1>
            <p className="mt-2 text-[15px] text-ink-soft text-pretty">
              {step.subtitle}
            </p>

            {step.layout === 'cards' ? (
              <CardOptions
                options={step.options}
                isSelected={isSelected}
                toggle={toggle}
              />
            ) : (
              <PillOptions
                options={step.options}
                isSelected={isSelected}
                toggle={toggle}
                multi={step.multi}
              />
            )}

            {step.field === 'symptoms' && (
              <p className="mt-5 text-xs text-muted">
                Nothing fits? You can skip this step.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </Container>

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-5 pb-5 safe-bottom">
        <Container>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="secondary" size="lg" onClick={goBack}>
                Back
              </Button>
            )}
            {step.field === 'symptoms' && !canContinue && (
              <Button variant="ghost" size="lg" onClick={goNext}>
                Skip
              </Button>
            )}
            <Button
              size="lg"
              variant="primary"
              fullWidth
              disabled={!canContinue && step.field !== 'symptoms'}
              onClick={goNext}
              trailing={<ArrowRight size={18} />}
            >
              {stepIndex === totalQuizSteps - 1 ? 'See my plan' : 'Continue'}
            </Button>
          </div>
        </Container>
      </div>

      {/* Exit confirmation */}
      <AnimatePresence>
        {confirmExit && (
          <ExitConfirm
            onCancel={() => setConfirmExit(false)}
            onConfirm={doExit}
          />
        )}
      </AnimatePresence>

      {/* AI personalizing transition */}
      <AnimatePresence>
        {isPersonalizing && (
          <PersonalizingOverlay
            onDone={() => replace({ type: 'recommendedTests' })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exit confirmation modal                                             */
/* ------------------------------------------------------------------ */

function ExitConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 backdrop-blur-sm p-0 sm:p-6"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-pop border border-line p-6"
      >
        <div className="font-display text-[20px] leading-tight text-ink">
          Exit the quiz?
        </div>
        <p className="mt-2 text-[14px] text-ink-soft leading-relaxed">
          We won’t save your progress. You can always restart — it only takes
          two minutes.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
          <Button variant="secondary" size="md" fullWidth onClick={onCancel}>
            Keep going
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={onConfirm}>
            Yes, exit
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* "Personalizing your insights..." transition                         */
/* ------------------------------------------------------------------ */

const personalizingSteps = [
  'Reading your answers…',
  'Matching tests to your priorities…',
  'Building your personal plan…',
];

function PersonalizingOverlay({ onDone }: { onDone: () => void }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => Math.min(t + 1, personalizingSteps.length - 1));
    }, 650);
    const done = setTimeout(onDone, 2200);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 bg-canvas grid place-items-center px-6"
    >
      <div className="text-center max-w-sm">
        <div className="relative mx-auto w-24 h-24 grid place-items-center">
          <motion.span
            animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-3xl bg-indigo-200/60"
          />
          <motion.span
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-3 rounded-3xl bg-indigo-300/60"
          />
          <motion.div
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative grid place-items-center w-16 h-16 rounded-3xl bg-indigo-600 text-white shadow-indigo"
          >
            <Brain size={26} strokeWidth={2.2} />
            <motion.span
              animate={{ opacity: [0, 1, 0], y: [4, -10] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute -top-1.5 -right-1.5 grid place-items-center w-6 h-6 rounded-full bg-gold-500 text-indigo-900"
            >
              <Sparkles size={12} />
            </motion.span>
          </motion.div>
        </div>

        <h2 className="font-display text-[24px] leading-tight mt-7 text-balance">
          Personalizing your insights…
        </h2>

        <div className="mt-3 h-5 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={tick}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-x-0 text-[13.5px] text-ink-soft"
            >
              {personalizingSteps[tick]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-7 mx-auto max-w-[14rem] h-1.5 rounded-full bg-indigo-100 overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.1, ease: [0.22, 1, 0.36, 1] }}
            className="h-full bg-indigo-600 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

function PillOptions({
  options,
  isSelected,
  toggle,
  multi,
}: {
  options: { id: string; label: string }[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  multi: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      {options.map((opt) => {
        const selected = isSelected(opt.id);
        return (
          <motion.button
            key={opt.id}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1 }}
            onClick={() => toggle(opt.id)}
            className={`relative inline-flex items-center gap-2 h-12 px-5 rounded-full font-semibold text-[14px] border transition-all ${
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo'
                : 'bg-white border-line text-ink-soft hover:border-indigo-300 hover:text-indigo-700 shadow-soft'
            }`}
          >
            {multi && (
              <span
                className={`grid place-items-center w-5 h-5 rounded-full ${
                  selected
                    ? 'bg-gold-500 text-indigo-900'
                    : 'bg-canvas border border-line-strong text-transparent'
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function CardOptions({
  options,
  isSelected,
  toggle,
}: {
  options: { id: string; label: string; hint?: string; emoji?: string }[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-2.5">
      {options.map((opt) => {
        const selected = isSelected(opt.id);
        return (
          <motion.button
            key={opt.id}
            whileTap={{ scale: 0.985 }}
            onClick={() => toggle(opt.id)}
            className={`relative w-full text-left px-4 py-3.5 rounded-[16px] border transition-all ${
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo'
                : 'bg-white border-line text-ink hover:border-indigo-300 shadow-soft'
            }`}
          >
            <div className="flex items-center gap-3">
              {opt.emoji && (
                <div
                  className={`w-10 h-10 rounded-xl grid place-items-center text-lg ${
                    selected ? 'bg-indigo-500/40' : 'bg-canvas'
                  }`}
                >
                  {opt.emoji}
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold">{opt.label}</div>
                {opt.hint && (
                  <div
                    className={`text-[12px] mt-0.5 ${
                      selected ? 'text-indigo-100' : 'text-muted'
                    }`}
                  >
                    {opt.hint}
                  </div>
                )}
              </div>
              <div
                className={`w-6 h-6 rounded-full grid place-items-center border ${
                  selected
                    ? 'bg-gold-500 border-gold-500 text-indigo-900'
                    : 'border-line bg-white'
                }`}
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
