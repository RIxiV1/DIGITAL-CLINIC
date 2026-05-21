import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Logo from '../components/Logo';
import { useNavigation, useReports } from '../AppContext';
import {
  consumePendingUpload,
  parseSteps,
  parseUploadedReport,
  type ParsedReport,
} from '../services/api';
import { sampleReports } from '../data/reports';

/**
 * Multi-stage parsing UI for the upload pipeline.
 *
 * Two terminal states:
 *   - success: extractor produced ≥1 biomarker → patch the placeholder
 *              report with the real biomarkers and navigate to /results
 *   - failure: extractor produced 0 biomarkers (or threw) → roll back
 *              the placeholder report (so the locker doesn't carry a
 *              ghost "processing" entry) and render an inline error
 *              state. Previously we silently swapped in sampleBiomarkers
 *              and navigated as if everything was fine, which let the
 *              user see demo data and assume it was their report — the
 *              trust-killer bug behind the "hallucinated values"
 *              complaint.
 */
type FailureState = {
  reason: NonNullable<ParsedReport['failureReason']>;
  errorMessage?: string;
  fileName: string;
};

export default function ProcessingPage() {
  const { reports, markReportReady, removeReport, addReport } = useReports();
  const { replace, navigate } = useNavigation();

  const latestProcessing =
    reports.find((r) => r.status === 'processing') ?? reports[0];
  const processingId = latestProcessing?.id;

  const [stepIndex, setStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [overall, setOverall] = useState(0);
  const [failure, setFailure] = useState<FailureState | null>(null);

  // StrictMode in dev double-mounts every effect. We track which
  // processingId we've *already started* parsing for, so the second
  // mount doesn't kick off a duplicate run. We deliberately do NOT
  // cancel the final navigation when the first mount is torn down —
  // doing that was the bug that left users stuck on this screen
  // forever in StrictMode. markReportReady + replace are both
  // idempotent, so the worst case is a no-op double-fire.
  const startedForRef = useRef<string | null>(null);

  // Refresh / deep-link guard: someone lands on /?page=processing
  // directly, but there's no pending processing report (refreshed
  // mid-flow, or arrived via an old bookmark). Bounce home rather
  // than leaving them staring at a perpetual "reading your report".
  useEffect(() => {
    if (reports.length === 0 || !reports.some((r) => r.status === 'processing')) {
      replace({ type: 'home' });
    }
    // Only on mount — once we've started, we shouldn't bounce out
    // because markReportReady flips the status mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!processingId) return;
    if (startedForRef.current === processingId) return;
    startedForRef.current = processingId;

    // Drain the pending upload once per processingId. If the user
    // refreshed mid-flow, this returns null and parseUploadedReport
    // resolves with failureReason='no-file'.
    const file = consumePendingUpload();
    const fileName = latestProcessing?.name ?? 'My lab report';

    void parseUploadedReport(
      { name: fileName, file },
      ({ stepIndex, stepProgress, overall }) => {
        setStepIndex(stepIndex);
        setStepProgress(stepProgress);
        setOverall(overall);
      },
    ).then((result) => {
      if (result.parsedFromFile) {
        // Real extraction. Patch the placeholder report and route to
        // its results page.
        markReportReady(processingId, {
          biomarkers: result.biomarkers,
          lab: result.report.lab,
        });
        replace({ type: 'results', reportId: processingId });
        return;
      }
      // Extraction failed. Roll back the placeholder report so we
      // don't leave a forever-"processing" ghost in the locker, then
      // render the inline error state.
      removeReport(processingId);
      setFailure({
        reason: result.failureReason ?? 'no-matches',
        errorMessage: result.errorMessage,
        fileName,
      });
    });
  }, [
    processingId,
    latestProcessing?.name,
    markReportReady,
    removeReport,
    replace,
  ]);

  /* ---- Error state recovery actions ---- */

  const retryUpload = () => {
    setFailure(null);
    replace({ type: 'upload' });
  };

  const useSampleReport = () => {
    const sample = sampleReports[0];
    if (!reports.some((r) => r.id === sample.id)) {
      addReport(sample);
    }
    setFailure(null);
    navigate({ type: 'results', reportId: sample.id });
  };

  /* ================================================================ */
  /* Render                                                             */
  /* ================================================================ */

  if (failure) {
    return <ParseFailedView failure={failure} onRetry={retryUpload} onSample={useSampleReport} />;
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        {/* Logo is a real button — clicking it bails out of processing
            and goes home. Without this, if the parse stalls there's
            no way out except browser back / refresh. */}
        <button
          type="button"
          onClick={() => replace({ type: 'home' })}
          aria-label="Cancel parsing and go home"
          title="Cancel and go home"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <Logo />
        </button>
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

        {/* Overall progress strip */}
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

/* ================================================================== */
/* Inline error state — parser yielded zero usable markers              */
/* ================================================================== */

function ParseFailedView({
  failure,
  onRetry,
  onSample,
}: {
  failure: FailureState;
  onRetry: () => void;
  onSample: () => void;
}) {
  // Reason-specific headline so the user knows what actually happened
  // (parser-error from pdfjs/tesseract is different from "we read it
  // but nothing in the catalog matched", which is different from
  // "no file was attached").
  const copy = (() => {
    switch (failure.reason) {
      case 'parser-error':
        return {
          title: 'We couldn’t open this file.',
          detail:
            failure.errorMessage ??
            'The file may be corrupted, password-protected, or in an unexpected format.',
        };
      case 'no-file':
        return {
          title: 'There was nothing to parse.',
          detail:
            'It looks like the upload didn’t carry through — try uploading the file again from the Upload page.',
        };
      case 'no-matches':
      default:
        return {
          title: 'We read the file, but didn’t recognise any lab values.',
          detail:
            'Either the report’s layout is outside what our parser supports yet, or the file is something other than a lab report. We deliberately don’t make up values to fill in — you’d see numbers that weren’t in your report.',
        };
    }
  })();

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container
        size="narrow"
        className="flex-1 flex flex-col items-center justify-center pb-16"
      >
        <Card padded={false} className="w-full overflow-hidden">
          <div
            role="alert"
            aria-live="assertive"
            className="p-6 border-b border-concern/20 bg-concern-soft/60"
          >
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-11 h-11 rounded-2xl bg-concern/15 text-concern shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-concern">
                  Parsing failed
                </div>
                <h2 className="font-display text-[22px] leading-tight text-ink mt-1">
                  {copy.title}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                  {copy.detail}
                </p>
                <div className="mt-3 rounded-[10px] bg-surface border border-line/70 px-3 py-2 text-[12px] text-muted break-all">
                  <span className="font-bold uppercase tracking-[0.12em] text-[10px] text-muted block mb-0.5">
                    File
                  </span>
                  {failure.fileName}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 grid sm:grid-cols-2 gap-2.5">
            <Button
              size="md"
              variant="primary"
              leading={<RotateCcw size={14} />}
              onClick={onRetry}
              fullWidth
            >
              Try a different file
            </Button>
            <Button
              size="md"
              variant="secondary"
              leading={<Sparkles size={14} />}
              onClick={onSample}
              fullWidth
            >
              Use sample report
            </Button>
          </div>

          <div className="px-5 pb-5 -mt-1">
            <p className="text-[11.5px] text-muted leading-relaxed">
              Our parser currently recognises hormone, metabolic, heart, thyroid,
              vitamin, liver, kidney, blood, and fertility markers from
              text-layer PDFs and clear photos. Older scanned PDFs or
              non-standard lab layouts may not parse — we don’t guess.
            </p>
          </div>
        </Card>
      </Container>
    </div>
  );
}
