import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ScanLine, Sparkles } from 'lucide-react';
import Container from '../components/Container';
import Logo from '../components/Logo';
import { useApp } from '../AppContext';

const steps = [
  { id: 'extract', label: 'Reading the document' },
  { id: 'parse', label: 'Picking out every value' },
  { id: 'compare', label: 'Comparing against healthy ranges' },
  { id: 'translate', label: 'Translating into plain English' },
];

// Duration the active-step indicator hangs on each line. Total processing
// time = steps.length * STEP_MS + COMPLETION_PAUSE_MS, so the redirect
// always fires AFTER the ticker has visibly reached the last step.
const STEP_MS = 900;
const COMPLETION_PAUSE_MS = 600;

export default function ProcessingPage() {
  const { reports, replace, markReportReady } = useApp();
  const [stepIndex, setStepIndex] = useState(0);

  const latestProcessing =
    reports.find((r) => r.status === 'processing') ?? reports[0];
  const processingId = latestProcessing?.id;

  useEffect(() => {
    if (!processingId) return;
    let cancelled = false;

    const id = setInterval(() => {
      setStepIndex((i) => {
        if (i >= steps.length - 1) {
          clearInterval(id);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);

    const done = setTimeout(
      () => {
        if (cancelled) return;
        markReportReady(processingId);
        replace({ type: 'results', reportId: processingId });
      },
      steps.length * STEP_MS + COMPLETION_PAUSE_MS,
    );

    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(done);
    };
  }, [processingId, markReportReady, replace]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container size="narrow" className="flex-1 flex flex-col items-center justify-center text-center pb-16">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(45,59,142,0.20)',
                '0 0 0 28px rgba(45,59,142,0)',
              ],
            }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="grid place-items-center w-24 h-24 rounded-3xl bg-indigo-600 text-gold-400"
          >
            <ScanLine size={44} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 1, 0],
              y: [4, -10],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            className="absolute -top-2 -right-2 grid place-items-center w-7 h-7 rounded-full bg-gold-500 text-indigo-900"
          >
            <Sparkles size={14} />
          </motion.div>
        </motion.div>

        <h1 className="font-display text-[26px] leading-tight mt-7 text-balance max-w-[22rem]">
          Reading your report carefully.
        </h1>
        <p className="mt-2 text-[14px] text-ink-soft max-w-[22rem] text-pretty">
          We’re extracting every number and translating each one into
          something you can actually use.
        </p>

        <div className="mt-8 w-full max-w-sm">
          <div className="grid gap-3">
            {steps.map((s, i) => {
              const state =
                i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'idle';
              return (
                <motion.div
                  key={s.id}
                  animate={{ opacity: state === 'idle' ? 0.45 : 1 }}
                  className="flex items-center gap-3 p-3.5 rounded-[16px] bg-white border border-line shadow-soft text-left"
                >
                  <div
                    className={`grid place-items-center w-8 h-8 rounded-full ${
                      state === 'done'
                        ? 'bg-good text-white'
                        : state === 'active'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-canvas text-muted'
                    }`}
                  >
                    {state === 'done' ? (
                      <Check size={16} strokeWidth={3} />
                    ) : state === 'active' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <span className="text-[11px] font-semibold">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-[14px] font-semibold text-ink">
                    {s.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <p className="mt-8 text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
          Usually under 60 seconds
        </p>
      </Container>
    </div>
  );
}
