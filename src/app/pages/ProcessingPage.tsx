import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ScanLine, Sparkles } from 'lucide-react';
import Container from '../components/Container';
import Logo from '../components/Logo';
import { useNavigation, useReports } from '../AppContext';
import {
  consumePendingUpload,
  parseSteps,
  parseUploadedReport,
} from '../services/api';

/**
 * Multi-stage parsing UI for the upload pipeline.
 *
 * Stages (defined in services/api.ts so the simulation isn't owned by
 * the view): OCR → Classify → Validate → Translate. The page subscribes
 * to the parser's onProgress stream so each stage's inner progress bar
 * reflects real work-units, not a fixed timer. When the real backend
 * lands, this view doesn't change — only the service does.
 */
export default function ProcessingPage() {
  const { reports, markReportReady } = useReports();
  const { replace } = useNavigation();

  const latestProcessing =
    reports.find((r) => r.status === 'processing') ?? reports[0];
  const processingId = latestProcessing?.id;

  const [stepIndex, setStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [overall, setOverall] = useState(0);

  // StrictMode in dev double-mounts every effect. We track which
  // processingId we've *already started* parsing for, so the second
  // mount doesn't kick off a duplicate run. We deliberately do NOT
  // cancel the final navigation when the first mount is torn down —
  // doing that was the bug that left users stuck on this screen
  // forever in StrictMode. markReportReady + replace are both
  // idempotent, so the worst case is a no-op double-fire.
  const startedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!processingId) return;
    if (startedForRef.current === processingId) return;
    startedForRef.current = processingId;

    // Drain the pending upload once per processingId. If the user
    // refreshed mid-flow, this returns null and the parser falls back
    // to the demo dataset — graceful degradation rather than a hang.
    const file = consumePendingUpload();

    void parseUploadedReport(
      {
        name: latestProcessing?.name ?? 'My lab report',
        file,
      },
      ({ stepIndex, stepProgress, overall }) => {
        setStepIndex(stepIndex);
        setStepProgress(stepProgress);
        setOverall(overall);
      },
    ).then((result) => {
      // If real extraction yielded biomarkers, swap them into the
      // placeholder report. Otherwise leave the (sample) biomarkers
      // that makeReport() seeded.
      markReportReady(processingId, {
        biomarkers: result.biomarkers,
        lab: result.report.lab,
      });
      replace({ type: 'results', reportId: processingId });
    });
  }, [processingId, latestProcessing?.name, markReportReady, replace]);

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container
        size="narrow"
        className="flex-1 flex flex-col items-center justify-center text-center pb-16"
      >
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
            animate={{ opacity: [0, 1, 0], y: [4, -10] }}
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
          {parseSteps[stepIndex]?.detail ??
            'Almost done — getting your insights ready.'}
        </p>

        {/* Overall progress strip — a single number that tracks the four
            stages as one continuous arc. Useful for users who'd rather
            see "how close are we" than four parallel rows. */}
        <div className="mt-7 w-full max-w-sm">
          <div
            className="h-1.5 rounded-full bg-indigo-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(overall * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall parsing progress"
          >
            <motion.div
              initial={false}
              animate={{ width: `${Math.round(overall * 100)}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full bg-indigo-600 rounded-full"
            />
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.14em] font-bold text-muted text-right tabular-nums">
            {Math.round(overall * 100)}%
          </div>
        </div>

        <div className="mt-6 w-full max-w-sm">
          <div className="grid gap-3">
            {parseSteps.map((s, i) => {
              const state =
                i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'idle';
              return (
                <motion.div
                  key={s.id}
                  animate={{ opacity: state === 'idle' ? 0.45 : 1 }}
                  className="flex items-center gap-3 p-3.5 rounded-[16px] bg-surface border border-line shadow-soft text-left"
                >
                  <div
                    className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${
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
                      <span className="text-[11px] font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink leading-tight">
                      {s.label}
                    </div>
                    {/* Inner progress bar — only renders for the active
                        stage. Tracks the parser's stepProgress so users
                        get continuous feedback inside a long stage. */}
                    {state === 'active' && (
                      <div className="mt-2 h-1 rounded-full bg-indigo-50 overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ width: `${Math.round(stepProgress * 100)}%` }}
                          transition={{ duration: 0.15, ease: 'linear' }}
                          className="h-full bg-indigo-600 rounded-full"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <p className="mt-7 text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
          Usually under 60 seconds
        </p>
      </Container>
    </div>
  );
}
