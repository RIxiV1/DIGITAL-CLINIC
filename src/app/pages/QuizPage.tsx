import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Brain, Check, Sparkles, X } from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Emoji from '../components/Emoji';
import Logo from '../components/Logo';
import StickyBottomBar from '../components/StickyBottomBar';
import { useNavigation, useQuiz, type QuizAnswers } from '../AppContext';
import { quizSteps, totalQuizSteps, type QuizStep } from '../data/quiz';
import { useModalA11y } from '../utils/useModalA11y';

type Field = 'age' | 'activity' | 'priorities' | 'symptoms';

/** Pixels of horizontal travel before we treat a touch drag as a swipe.
 *  60px lines up with iOS Safari's own swipe-back gesture so we don't
 *  triggers on incidental scrolls. */
const SWIPE_THRESHOLD_PX = 60;

export default function QuizPage() {
  const { quiz, setQuiz, hasCompletedQuiz } = useQuiz();
  const { replace, back } = useNavigation();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const step = quizSteps[stepIndex];
  const isCompound = !!step.subSteps;
  const progress = ((stepIndex + 1) / totalQuizSteps) * 100;

  /* ---- simple-step helpers ---- */
  const currentValue =
    !isCompound && step.field
      ? (quiz[step.field as keyof QuizAnswers] as
          | string
          | string[]
          | undefined)
      : undefined;

  const isSelectedFor = (id: string, field: Field): boolean => {
    const value = quiz[field as keyof QuizAnswers];
    if (Array.isArray(value)) return value.includes(id);
    return value === id;
  };

  const toggleFor = (id: string, field: Field, multi: boolean) => {
    if (multi) {
      const value = quiz[field as keyof QuizAnswers] as string[] | undefined;
      const next = new Set(value ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setQuiz({ [field]: Array.from(next) } as Partial<QuizAnswers>);
    } else {
      setQuiz({ [field]: id } as Partial<QuizAnswers>);
    }
  };

  const canContinue = (() => {
    if (isCompound) {
      return step.subSteps!.every((s) => !!quiz[s.field]);
    }
    if (step.multi) {
      // Symptoms screen is skippable
      if (step.field === 'symptoms') return true;
      return ((currentValue as string[] | undefined)?.length ?? 0) > 0;
    }
    return !!currentValue;
  })();

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
    // Confirm if the user has touched anything — even on step 0.
    // Previous logic also required stepIndex > 0, which meant selecting
    // four symptoms on screen 1 and then tapping the logo silently
    // discarded the work. `touched` alone is the right signal.
    if (touched) {
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

  /**
   * Global keyboard navigation. Power users hate clicking "Continue"
   * fourteen times — they want Enter / arrow keys. Listener is
   * page-scoped, ignores keystrokes when the user is mid-typing in an
   * input/textarea, and yields to the exit/personalizing overlays
   * (those swallow their own keys).
   */
  useEffect(() => {
    if (confirmExit || isPersonalizing) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (editable) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (canContinue || step.field === 'symptoms') {
          e.preventDefault();
          goNext();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        requestExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinue, stepIndex, confirmExit, isPersonalizing, step.field]);

  /* ---- Swipe gestures ----
   *
   * Pointer-based so it works on both touch and trackpad. We only treat
   * a horizontal movement as a swipe if (a) it dominates over vertical
   * motion (otherwise scrolling-with-finger would feel like a swipe)
   * and (b) it exceeds SWIPE_THRESHOLD_PX. Swipe-right = back,
   * swipe-left = next.
   */
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return; // mouse uses keyboard / buttons
    // Don't start a swipe gesture when the press lands on an interactive
    // element — taps on buttons must select the option, not double-fire
    // a navigation. A drag from a button that crosses SWIPE_THRESHOLD_PX
    // would otherwise both select the option AND advance the step.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) < Math.abs(dy)) return; // mostly vertical = scroll
    if (dx < 0 && (canContinue || step.field === 'symptoms')) {
      goNext();
    } else if (dx > 0) {
      goBack();
    }
  };

  /**
   * New section order — symptoms first to create the "yes, that's me" moment,
   * demographics last as the low-engagement housekeeping step.
   */
  const sectionOrder: Array<QuizStep['sectionId']> = [
    'symptoms',
    'priorities',
    'basics',
  ];

  return (
    <div className="min-h-dvh pb-44 bg-canvas">
      {/* Top */}
      <Container size="narrow" className="pt-5">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="grid place-items-center w-12 h-12 -ml-1.5 rounded-full hover:bg-indigo-50 text-indigo-700 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          {/* Logo behaves like the X — clicking it requests exit (with
              progress-preserving confirm if the user has answers). The
              previous static <Logo /> looked clickable but did nothing,
              which made the page feel frozen. */}
          <button
            type="button"
            onClick={requestExit}
            aria-label="Exit quiz, go home"
            title="Go home"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <Logo size="sm" />
          </button>
          <button
            onClick={requestExit}
            className="grid place-items-center w-12 h-12 -mr-1.5 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors"
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

        {/* Progress strip — step counter + an unobtrusive swipe hint that
            only renders on touch contexts (hidden via the parent flex on
            very-small viewports otherwise). */}
        <div className="mt-3 flex items-center justify-between text-micro font-bold uppercase tracking-[0.16em] text-muted">
          <span className="hidden sm:inline opacity-70">
            Tip · arrow keys or swipe to move
          </span>
          <span>
            Step {stepIndex + 1} of {totalQuizSteps} · {Math.round(progress)}%
          </span>
        </div>
      </Container>

      {/* Step content — wrapped in the swipe / fade region. */}
      <Container size="narrow" className="mt-6">
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          // touch-action: pan-y lets the OS handle vertical scrolling
          // natively while we keep horizontal gesture detection
          style={{ touchAction: 'pan-y' }}
        >
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step.id}
              custom={direction}
              initial={{ opacity: 0, x: direction === 1 ? 22 : -22 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
              }}
              exit={{
                opacity: 0,
                x: direction === 1 ? -16 : 16,
                transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
              }}
            >
              <div className="text-micro font-bold uppercase tracking-[0.16em] text-indigo-700 mb-2">
                {step.sectionLabel}
              </div>
              <h1 className="font-display text-display-md leading-tight text-balance">
                {step.title}
              </h1>
              <p className="mt-2 text-body text-ink-soft text-pretty">
                {step.subtitle}
              </p>

              {isCompound ? (
                <CompoundOptions
                  subSteps={step.subSteps!}
                  isSelectedFor={isSelectedFor}
                  toggleFor={toggleFor}
                />
              ) : step.layout === 'cards' ? (
                <div className="mt-6">
                  <CardOptions
                    options={step.options ?? []}
                    isSelected={(id) =>
                      !!step.field && isSelectedFor(id, step.field)
                    }
                    toggle={(id) =>
                      step.field &&
                      toggleFor(id, step.field, step.multi ?? false)
                    }
                  />
                </div>
              ) : (
                <div className="mt-6">
                  <PillOptions
                    options={step.options ?? []}
                    isSelected={(id) =>
                      !!step.field && isSelectedFor(id, step.field)
                    }
                    toggle={(id) =>
                      step.field &&
                      toggleFor(id, step.field, step.multi ?? false)
                    }
                    multi={step.multi ?? false}
                  />
                </div>
              )}

              {step.field === 'symptoms' && (
                <p className="mt-5 text-xs text-muted">
                  Nothing fits? You can skip this step.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>

      {/* Sticky bottom CTA — "tall" padding for the row that can wrap
          into Back + Skip + Continue on small screens. */}
      <StickyBottomBar padding="tall">
        <Container size="narrow">
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
      </StickyBottomBar>

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
/* Compound options — used by the merged Age + Activity screen          */
/* ------------------------------------------------------------------ */

function CompoundOptions({
  subSteps,
  isSelectedFor,
  toggleFor,
}: {
  subSteps: NonNullable<QuizStep['subSteps']>;
  isSelectedFor: (id: string, field: Field) => boolean;
  toggleFor: (id: string, field: Field, multi: boolean) => void;
}) {
  return (
    <div className="mt-7 grid gap-8">
      {subSteps.map((sub, i) => (
        <motion.section
          key={sub.field}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { delay: 0.1 + i * 0.08, duration: 0.32 },
          }}
        >
          <div className="text-body font-semibold text-ink leading-tight">
            {sub.question}
          </div>
          <div className="mt-3">
            {sub.layout === 'cards' ? (
              <CardOptions
                options={sub.options}
                isSelected={(id) => isSelectedFor(id, sub.field)}
                toggle={(id) => toggleFor(id, sub.field, false)}
              />
            ) : (
              <PillOptions
                options={sub.options}
                isSelected={(id) => isSelectedFor(id, sub.field)}
                toggle={(id) => toggleFor(id, sub.field, false)}
                multi={false}
              />
            )}
          </div>
        </motion.section>
      ))}
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
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Esc + focus-trap + scroll lock + restore-focus, shared via
  // useModalA11y. No initialFocusRef — the hook's default (first
  // focusable in the card) IS the "Keep going" button here, which is
  // the safe option for a keyboard user backing out of an accidental
  // Esc / swipe trigger.
  useModalA11y({ open: true, cardRef, onClose: onCancel });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 backdrop-blur-md p-0 sm:p-6"
      role="presentation"
    >
      <motion.div
        ref={cardRef}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full sm:max-w-sm bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop border border-line p-6"
      >
        <div
          id={titleId}
          className="font-display text-display-md leading-tight text-ink"
        >
          Exit the quiz?
        </div>
        <p className="mt-2 text-body-sm text-ink-soft leading-relaxed">
          We won’t save your progress. You can always restart — it only takes
          two minutes.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onCancel}
          >
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

        <h2 className="font-display text-display-md leading-tight mt-7 text-balance">
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
              className="absolute inset-x-0 text-caption text-ink-soft"
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

/* ------------------------------------------------------------------ */
/* Reusable option groups (no top margin — caller controls spacing)    */
/* ------------------------------------------------------------------ */

// Was `grid grid-cols-1 min-[370px]:grid-cols-2 sm:grid-cols-3`,
// a 3-step breakpoint ladder with a hand-rolled `min-[370px]`
// duct-tape stop just to make iPhone SE fit. Pills are inherently
// compact (their width is set by their own padding + label, not by
// the column track), so a `flex flex-wrap` layout flows them into
// however many rows the viewport allows without needing any
// breakpoint reasoning at all. Long labels stay readable, short
// labels pack two per row on a phone, three+ on tablet+. No more
// 370px landmark.
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
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => {
        const selected = isSelected(opt.id);
        return (
          <motion.button
            key={opt.id}
            type="button"
            aria-pressed={multi ? selected : undefined}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1.5, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={() => toggle(opt.id)}
            className={`relative inline-flex items-center justify-center gap-2 min-h-12 h-auto py-2.5 px-4 rounded-full font-semibold text-caption border transition-all text-center ${
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo'
                : 'bg-surface border-line text-ink-soft hover:border-indigo-300 hover:text-indigo-700 shadow-soft'
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
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const selected = isSelected(opt.id);
        return (
          <motion.button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            whileTap={{ scale: 0.985 }}
            whileHover={{ y: -1, scale: 1.005 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={() => toggle(opt.id)}
            className={`relative w-full text-left px-4 py-3.5 rounded-[16px] border transition-all min-h-[52px] ${
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo'
                : 'bg-surface border-line text-ink hover:border-indigo-300 shadow-soft'
            }`}
          >
            <div className="flex items-center gap-3">
              {opt.emoji && (
                <div
                  className={`w-10 h-10 rounded-xl grid place-items-center ${
                    selected ? 'bg-indigo-500/40' : 'bg-canvas'
                  }`}
                >
                  <Emoji label={opt.label} className="text-lg leading-none">
                    {opt.emoji}
                  </Emoji>
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold">{opt.label}</div>
                {opt.hint && (
                  <div
                    className={`text-caption mt-0.5 ${
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
                    : 'border-line bg-surface'
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
