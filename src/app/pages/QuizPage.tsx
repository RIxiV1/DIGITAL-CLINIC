import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Logo from '../components/Logo';
import StickyBottomBar from '../components/StickyBottomBar';
import { useNavigation, useQuiz, type QuizAnswers } from '../AppContext';
import {
  exclusiveOptionIds,
  quizSteps,
  toggleMultiSelect,
  totalQuizSteps,
  type QuizStep,
} from '../data/quiz';
import { useModalA11y } from '../utils/useModalA11y';

type Field = 'age' | 'activity' | 'priorities' | 'symptoms' | 'comorbidities';

/** Pixels of horizontal travel before we treat a touch drag as a swipe.
 *  60px lines up with iOS Safari's own swipe-back gesture so we don't
 *  triggers on incidental scrolls. */
const SWIPE_THRESHOLD_PX = 60;

export default function QuizPage() {
  const { quiz, setQuiz, hasCompletedQuiz, resetQuiz } = useQuiz();
  const { replace, back } = useNavigation();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  /** Holds the "yes, leave" action while the unsaved-work confirm
   *  dialog is open. `null` ⇒ no dialog. Stored as a function so each
   *  entry point can choose its own destination — the X / Logo route
   *  to home/landing via doExit(), but the step-0 back arrow routes
   *  through `back()` to honor the browser back-stack the user came
   *  in on. Previously this was a boolean and the modal hard-coded
   *  doExit, which meant the back arrow either discarded data
   *  silently (old code) or destroyed back-history (my first
   *  attempted fix). Storing the action fixes both. */
  const [pendingExit, setPendingExit] = useState<null | (() => void)>(null);

  const step = quizSteps[stepIndex];
  const isCompound = !!step.subSteps;
  const progress = ((stepIndex + 1) / totalQuizSteps) * 100;

  /* ---- simple-step helpers ---- */
  const currentValue =
    !isCompound && step.field
      ? (quiz[step.field as keyof QuizAnswers] as string | string[] | undefined)
      : undefined;

  const isSelectedFor = (id: string, field: Field): boolean => {
    const value = quiz[field as keyof QuizAnswers];
    if (Array.isArray(value)) return value.includes(id);
    return value === id;
  };

  const toggleFor = (id: string, field: Field, multi: boolean) => {
    if (multi) {
      const value = quiz[field as keyof QuizAnswers] as string[] | undefined;
      // Honour exclusive opt-outs ("Nothing specific" / "None of these"):
      // selecting one clears the rest and vice versa, so the safety gate
      // can't hold contradictory state like ['nitrates','none'].
      const next = toggleMultiSelect(
        value ?? [],
        id,
        exclusiveOptionIds(field),
      );
      setQuiz({ [field]: next } as Partial<QuizAnswers>);
    } else {
      setQuiz({ [field]: id } as Partial<QuizAnswers>);
    }
  };

  /** Wipe the current step's selections. Used by the "Clear all" link
   *  that appears below the option grid on multi-select steps (symptoms,
   *  priorities) once at least one chip is selected. For single-selects
   *  the user just picks a different option, so the button doesn't
   *  render there. */
  const clearField = (field: Field, multi: boolean) => {
    setQuiz({
      [field]: multi ? [] : undefined,
    } as Partial<QuizAnswers>);
  };

  /** How many chips are currently selected on the active step. Drives
   *  the "Clear all" button's visibility AND its label — the count
   *  reassures the user that the click will actually do something. */
  const currentMultiCount = (() => {
    if (isCompound || !step.multi || !step.field) return 0;
    const value = quiz[step.field as keyof QuizAnswers];
    return Array.isArray(value) ? value.length : 0;
  })();

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

  /** Does the user have anything we'd lose by leaving now? */
  const isQuizTouched = () =>
    !!quiz.age ||
    !!quiz.activity ||
    quiz.priorities.length > 0 ||
    quiz.symptoms.length > 0 ||
    quiz.comorbidities.length > 0;

  /** Try to run `action`. If the user has touched anything, the
   *  unsaved-work confirm dialog opens first; otherwise the action
   *  runs immediately. */
  const requestLeave = (action: () => void) => {
    if (isQuizTouched()) {
      // useState passing a function value needs the (() => fn) wrapper
      // or React would treat `fn` as an updater and call it.
      setPendingExit(() => action);
    } else {
      action();
    }
  };

  /** Exit-to-app destination, same as the X and Logo buttons. */
  const doExit = () => {
    replace(hasCompletedQuiz ? { type: 'home' } : { type: 'landing' });
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStepIndex(stepIndex - 1);
    } else {
      // Step 0 back arrow: honour the back-stack the user arrived
      // with, but confirm first if they've already picked anything.
      requestLeave(back);
    }
  };

  const requestExit = () => {
    // X / Logo exit: always routes to home or landing (doExit), with
    // the unsaved-work confirm in front. Distinct from the step-0
    // back arrow above, which preserves history via back().
    requestLeave(doExit);
  };

  /**
   * Global keyboard navigation. Power users hate clicking "Continue"
   * fourteen times — they want Enter / arrow keys. Listener is
   * page-scoped, ignores keystrokes when the user is mid-typing in an
   * input/textarea, and yields to the exit/personalizing overlays
   * (those swallow their own keys).
   *
   * Stale-closure fix: the listener reads `goNext`/`goBack`/etc.
   * through a ref that's refreshed on every render. That decouples
   * the effect's stability (mounts once, tears down on overlay) from
   * the handler freshness — no more `eslint-disable-next-line
   * react-hooks/exhaustive-deps` papering over a real race where
   * a same-tick state change made the closed-over goNext stale.
   */
  const keyboardHandlersRef = useRef({
    goNext,
    goBack,
    requestExit,
    canContinue,
    stepField: step.field,
  });
  useEffect(() => {
    keyboardHandlersRef.current = {
      goNext,
      goBack,
      requestExit,
      canContinue,
      stepField: step.field,
    };
  });
  useEffect(() => {
    if (pendingExit || isPersonalizing) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (editable) return;
      // Read latest values via ref every key event — never a stale
      // closure from when the listener was first attached.
      const h = keyboardHandlersRef.current;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (h.canContinue || h.stepField === 'symptoms') {
          e.preventDefault();
          h.goNext();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        h.goBack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        h.requestExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingExit, isPersonalizing]);

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
    if (
      target?.closest('button, a, input, select, textarea, [role="button"]')
    ) {
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
    'health',
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
            className="inline-flex items-center min-h-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
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
        <div className="mt-3 flex items-center justify-between text-micro font-bold uppercase tracking-eyebrow text-muted">
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
              <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700 mb-2">
                {step.sectionLabel}
              </div>
              <h1 className="font-display text-display-md leading-tight text-balance">
                {step.title}
              </h1>
              <p className="mt-2 text-body text-ink-soft text-pretty">
                {step.subtitle}
              </p>

              {stepIndex === 0 && (
                /* Validation beat — shown only at the front door (first
                   step). The PRD's "you're not alone" moment, placed at the
                   point he commits. Calm and quiet, not a banner. */
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-indigo-50/60 border border-line/70 px-4 py-3">
                  <ShieldCheck
                    size={15}
                    className="text-indigo-700 shrink-0 mt-0.5"
                  />
                  <p className="text-caption text-ink-soft leading-relaxed text-pretty">
                    You’re not alone — most men have wondered about at least one
                    of these. It’s completely private, and there’s no wrong
                    answer.
                  </p>
                </div>
              )}

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
                    options={step.options}
                    groups={step.optionGroups}
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

              {/* Clear all — only on multi-select steps once at least
                  one chip is picked. Right-aligned, low-emphasis text
                  button so it doesn't compete with Continue. Count in
                  the label confirms what the click affects. */}
              {currentMultiCount > 0 && step.field && (
                <div className="mt-4 flex">
                  <button
                    type="button"
                    onClick={() => step.field && clearField(step.field, true)}
                    aria-label={`Clear all ${currentMultiCount} selections on this step`}
                    className="ml-auto inline-flex items-center gap-1 min-h-11 px-2 -mr-2 text-caption font-semibold text-muted hover:text-ink underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
                  >
                    <X size={12} />
                    Clear all
                    <span className="text-muted/70 font-normal">
                      ({currentMultiCount})
                    </span>
                  </button>
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

      {/* Exit confirmation. `pendingExit` carries the action that
          fires on "Yes, leave" — doExit for X/Logo (forces to
          home/landing) or `back` for the step-0 back arrow (honours
          history). `onStartOver` is the deliberate global-reset path:
          wipes answers (resetQuiz) then runs the same exit action.
          Sits as a tertiary link below the main buttons because the
          frequency curve is one-sided — most users want to come back
          to their answers, only a small minority truly want to start
          fresh, and a destructive action that big belongs behind the
          smaller affordance. */}
      <AnimatePresence>
        {pendingExit && (
          <ExitConfirm
            onCancel={() => setPendingExit(null)}
            onConfirm={() => {
              const action = pendingExit;
              setPendingExit(null);
              action();
            }}
            onStartOver={() => {
              const action = pendingExit;
              setPendingExit(null);
              resetQuiz();
              action();
            }}
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
  onStartOver,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  /** Tertiary action: clears every quiz answer (resetQuiz) and exits.
   *  Distinct from `onConfirm` which exits but preserves answers so
   *  the user can resume on next visit. Optional so the component
   *  stays usable in any future exit-flow that doesn't expose the
   *  reset path. */
  onStartOver?: () => void;
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
        {/* Copy correction: QuizContext persists answers to localStorage
            on every setQuiz, so exiting does NOT lose them — a returning
            user lands back on the same partial state. The previous "We
            won't save your progress" line was a leftover from before
            persistence existed and conflicted with the actual behavior.
            Honest framing also sets up the tertiary Start over below
            ("answers ARE saved → here's how to clear them deliberately"). */}
        <p className="mt-2 text-body-sm text-ink-soft leading-relaxed">
          Your answers are saved — come back any time to pick up where you left
          off.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
          <Button variant="secondary" size="md" fullWidth onClick={onCancel}>
            Keep going
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={onConfirm}>
            Yes, exit
          </Button>
        </div>
        {/* Tertiary global reset. Rendered as a low-emphasis text link
            so it doesn't compete with the two primary actions — most
            users want "exit and resume," only a few want "wipe and
            start fresh." min-h-11 keeps the WCAG 2.5.5 hit area even
            though the visible glyph is small. */}
        {onStartOver && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onStartOver}
              className="inline-flex items-center gap-1 min-h-11 px-2 -mx-2 text-caption font-semibold text-muted hover:text-concern underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-concern/60 rounded-sm"
            >
              Or clear my answers and start over
            </button>
          </div>
        )}
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
            className="relative grid place-items-center w-16 h-16 rounded-3xl bg-indigo-600 text-on-primary shadow-indigo"
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
//
// Pill rendering supports either a flat `options` list (the existing
// shape — priorities, sub-step options) or a grouped `groups` list
// (new — symptoms, where the 11-pill wall needed chunking for
// Miller's-Law sanity). When grouped, each cluster renders under an
// optional uppercase label using the same `text-micro` / `tracking-
// label` tokens the rest of the codebase uses for ornamental
// section headers. A group with no label renders bare — used for
// the standalone "Nothing specific" opt-out below the four thematic
// clusters.
function PillOptions({
  options,
  groups,
  isSelected,
  toggle,
  multi,
}: {
  options?: { id: string; label: string }[];
  groups?: Array<{
    label?: string;
    options: { id: string; label: string }[];
  }>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  multi: boolean;
}) {
  const renderPill = (opt: { id: string; label: string }) => {
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
            ? 'bg-indigo-600 border-indigo-600 text-on-primary shadow-indigo'
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
  };

  if (groups) {
    return (
      <div className="space-y-5">
        {groups.map((g, i) => (
          <div key={g.label ?? `_ungrouped_${i}`}>
            {g.label && (
              <div className="text-micro uppercase tracking-label font-bold text-muted mb-2.5">
                {g.label}
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              {g.options.map(renderPill)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {(options ?? []).map(renderPill)}
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
                ? 'bg-indigo-600 border-indigo-600 text-on-primary shadow-indigo'
                : 'bg-surface border-line text-ink hover:border-indigo-300 shadow-soft'
            }`}
          >
            <div className="flex items-center gap-3">
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
