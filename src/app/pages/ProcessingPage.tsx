import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Logo from '../components/Logo';
import Pill from '../components/Pill';
import { useNavigation, useReports } from '../AppContext';
import {
  consumePendingUpload,
  parseSteps,
  parseUploadedReport,
  type ParsedReport,
} from '../services/api';
import {
  categories as biomarkerCategories,
  statusColor,
  type Biomarker,
} from '../data/biomarkers';
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

/** Success-but-unconfirmed: the parser produced N markers and we're
 *  waiting on the user to verify before committing the report. */
type ConfirmState = {
  biomarkers: Biomarker[];
  fileName: string;
  rawText?: string;
  /** Value-shaped rows the parser saw but couldn't map to the catalog.
   *  Surfaced in the confirm step so a short extracted list reads as
   *  "your lab uses unusual markers" rather than "the parser is bad". */
  unrecognizedRows?: string[];
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
  /** Holds the parsed result after a successful extraction. We DON'T
   *  navigate to /results until the user confirms — previously the
   *  app auto-routed and the user had no chance to verify what was
   *  extracted before being shown a "your report" dashboard. */
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmState | null>(null);

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
  //
  // Captured via useState initializer so the decision is frozen at
  // mount time — without this, markReportReady flipping a report's
  // status from 'processing' to 'ready' mid-parse would later look
  // like "no processing reports exist" and bounce the user home in
  // the middle of their own success path.
  //
  // This pattern also kills the `eslint-disable-next-line
  // react-hooks/exhaustive-deps` the previous version needed: the
  // effect's only dep (`replace`) is stable, and the initial flag is
  // a useState seed that's reactive-deps clean.
  const [needsRedirectHome] = useState(
    () => !reports.some((r) => r.status === 'processing'),
  );
  useEffect(() => {
    if (needsRedirectHome) replace({ type: 'home' });
  }, [needsRedirectHome, replace]);

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
        // Real extraction succeeded — hand control to the user to
        // verify what was extracted before we commit the report.
        // The placeholder report stays in 'processing' state during
        // the confirm step (so the locker doesn't show a half-baked
        // entry); it's only marked ready when the user confirms.
        setPendingConfirm({
          biomarkers: result.biomarkers,
          fileName,
          rawText: result.rawText,
          unrecognizedRows: result.unrecognizedRows,
        });
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

  const enterManually = () => {
    setFailure(null);
    replace({ type: 'manualEntry' });
  };

  /* ---- Confirm-step actions ---- */

  const confirmExtractedValues = () => {
    if (!processingId || !pendingConfirm) return;
    markReportReady(processingId, {
      biomarkers: pendingConfirm.biomarkers,
      lab: 'Parsed from upload',
    });
    setPendingConfirm(null);
    replace({ type: 'results', reportId: processingId });
  };

  const rejectAndRetry = () => {
    if (processingId) removeReport(processingId);
    setPendingConfirm(null);
    replace({ type: 'upload' });
  };

  /* ================================================================ */
  /* Render                                                             */
  /* ================================================================ */

  if (failure) {
    return (
      <ParseFailedView
        failure={failure}
        onRetry={retryUpload}
        onSample={useSampleReport}
        onManualEntry={enterManually}
      />
    );
  }

  if (pendingConfirm) {
    return (
      <ConfirmExtractedValuesView
        biomarkers={pendingConfirm.biomarkers}
        fileName={pendingConfirm.fileName}
        rawText={pendingConfirm.rawText}
        unrecognizedRows={pendingConfirm.unrecognizedRows}
        onConfirm={confirmExtractedValues}
        onReject={rejectAndRetry}
      />
    );
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
  onManualEntry,
}: {
  failure: FailureState;
  onRetry: () => void;
  onSample: () => void;
  onManualEntry: () => void;
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

          <div className="p-5 grid gap-2.5">
            <Button
              size="md"
              variant="primary"
              leading={<Pencil size={14} />}
              onClick={onManualEntry}
              fullWidth
            >
              Enter values manually
            </Button>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <Button
                size="md"
                variant="secondary"
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
          </div>

          <div className="px-5 pb-5 -mt-1">
            <p className="text-[11.5px] text-muted leading-relaxed">
              Our parser currently recognises hormone, metabolic, heart, thyroid,
              vitamin, liver, kidney, blood, electrolyte, inflammation, and
              fertility markers from text-layer PDFs and clear photos. Older
              scanned PDFs or non-standard lab layouts may not parse —
              we don’t guess.
            </p>
          </div>
        </Card>
      </Container>
    </div>
  );
}

/* ================================================================== */
/* Inline confirm state — parser succeeded, user verifies before commit */
/* ================================================================== */

function ConfirmExtractedValuesView({
  biomarkers,
  fileName,
  rawText,
  unrecognizedRows,
  onConfirm,
  onReject,
}: {
  biomarkers: Biomarker[];
  fileName: string;
  rawText?: string;
  unrecognizedRows?: string[];
  onConfirm: () => void;
  onReject: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  // Group by category in canonical order so the user reads the values
  // in the same sequence as the eventual report.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Biomarker[]>();
    for (const m of biomarkers) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }
    return biomarkerCategories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ category: c, markers: byCategory.get(c.id) ?? [] }));
  }, [biomarkers]);

  return (
    <div className="min-h-dvh bg-canvas flex flex-col pb-32">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container size="wide" className="flex-1 mt-4 lg:mt-8">
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="gold" size="sm">
            <Check size={11} strokeWidth={3} /> Extraction complete
          </Pill>
          <h1 className="font-display text-[26px] lg:text-[32px] leading-tight mt-3 text-balance text-ink">
            We found {biomarkers.length}{' '}
            {biomarkers.length === 1 ? 'value' : 'values'} in your report.
          </h1>
          <p className="mt-2 text-[14px] lg:text-[15px] text-ink-soft text-pretty">
            Check each number against your report before continuing. We
            deliberately only show what we could pull out — if a marker
            you expected isn’t listed, it wasn’t in our catalog or our
            parser couldn’t find a match.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              File
            </span>
            <span className="break-all">{fileName}</span>
          </div>
        </div>

        <div className="mt-6 lg:max-w-3xl lg:mx-auto grid gap-4">
          {grouped.map(({ category, markers }) => (
            <Card key={category.id} padded={false} className="overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-line/70 flex items-center gap-2">
                <span
                  aria-label={category.name}
                  role="img"
                  className="text-[16px] leading-none"
                >
                  {category.icon}
                </span>
                <div className="font-display text-[15px] leading-tight">
                  {category.name}
                </div>
                <Pill tone="neutral" size="sm" className="ml-auto">
                  {markers.length}
                </Pill>
              </div>
              <ul className="divide-y divide-line/60">
                {markers.map((m) => {
                  const c = statusColor(m.status);
                  return (
                    <li
                      key={m.id}
                      className="px-5 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-ink leading-tight">
                          {m.name}
                        </div>
                        <div className="text-[11.5px] text-muted mt-0.5">
                          Reference {m.min}–{m.max}{m.unit ? ` ${m.unit}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-[18px] leading-none text-ink tabular-nums">
                          {m.value}
                          {m.unit && (
                            <span className="text-[11px] ml-1 text-muted font-sans font-medium">
                              {m.unit}
                            </span>
                          )}
                        </div>
                        <div
                          className={`mt-1 inline-flex items-center px-1.5 h-4 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${c.bg} ${c.text}`}
                        >
                          {c.label}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}

          {/* Unrecognized-rows notice — lab values we detected (label +
              number + recognized unit) but didn't have in the catalog.
              This is the difference between "your parser missed things"
              and "your lab uses markers we don't cover yet". Only shown
              when there's at least one such row. */}
          {unrecognizedRows && unrecognizedRows.length > 0 && (
            <Card padded={false} className="overflow-hidden border-amber-200/70">
              <div className="px-5 pt-4 pb-3 border-b border-amber-100 bg-amber-50/40 flex items-center gap-2">
                <span aria-hidden role="img" className="text-[15px] leading-none">
                  🔍
                </span>
                <div className="font-display text-[14px] leading-tight">
                  We saw these rows but couldn’t map them
                </div>
                <Pill tone="neutral" size="sm" className="ml-auto">
                  {unrecognizedRows.length}
                </Pill>
              </div>
              <div className="px-5 py-3">
                <p className="text-[12.5px] text-ink-soft leading-relaxed mb-2">
                  Your report mentioned these values, but they aren’t in
                  our catalog yet. Nothing was discarded — they just won’t
                  appear in the dashboard. If any of these look important
                  to you, let us know and we’ll add them.
                </p>
                <ul className="text-[12.5px] font-mono text-ink-soft space-y-1">
                  {unrecognizedRows.map((row, i) => (
                    <li key={`${row}-${i}`} className="break-words">
                      · {row}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {/* "Show what we read" diagnostic — useful for both the user
              (seeing whether OCR garbled values they care about) and
              for us debugging an off-by-one parse. Hidden by default so
              the success state stays tidy. */}
          {rawText && (
            <details
              className="mt-2 group"
              onToggle={(e) => setShowRaw(e.currentTarget.open)}
            >
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted hover:text-ink transition-colors w-fit">
                {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Show what we read from the file
              </summary>
              <pre className="mt-3 p-3 bg-surface border border-line rounded-[12px] text-[11px] text-ink-soft leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto font-mono">
                {rawText.slice(0, 8000)}
                {rawText.length > 8000 && '\n…(truncated)'}
              </pre>
            </details>
          )}
        </div>
      </Container>

      {/* Sticky bottom CTAs — fixed so they stay visible on long lists. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-4 pb-4 safe-bottom border-t border-line/70">
        <Container size="narrow">
          <div className="flex flex-col-reverse sm:flex-row items-stretch gap-2">
            <Button
              size="lg"
              variant="secondary"
              leading={<RotateCcw size={14} />}
              onClick={onReject}
              responsiveFullWidth
            >
              Wrong file — start over
            </Button>
            <Button
              size="lg"
              variant="primary"
              trailing={<ArrowRight size={18} />}
              onClick={onConfirm}
              fullWidth
            >
              Looks right — see my report
            </Button>
          </div>
        </Container>
      </div>
    </div>
  );
}
