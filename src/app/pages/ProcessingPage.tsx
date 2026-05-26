import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Emoji from '../components/Emoji';
import Logo from '../components/Logo';
import Pill from '../components/Pill';
import StickyBottomBar from '../components/StickyBottomBar';
import { useNavigation, useReports } from '../AppContext';
import {
  consumePendingUpload,
  parseSteps,
  parseUploadedReport,
  type ParsedReport,
} from '../services/api';
import {
  categories as biomarkerCategories,
  type Biomarker,
} from '../data/biomarkers';
import { sampleReports } from '../data/reports';
import {
  clearPendingConfirm,
  loadPendingConfirm,
  savePendingConfirm,
} from '../utils/persistence';

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
  /** OCR partial-failure diagnostic. When the parser failed AND some
   *  pages timed out, "we couldn't find anything" might actually mean
   *  "OCR couldn't read N of M pages." Surfacing the partial count
   *  reframes the failure from "your report is unusable" to "the
   *  parser hit a wall — retry might work." */
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
  /** Raw extracted text from the parser, when one ran. Surfaced on
   *  failure under a "Show what we read from the file" disclosure —
   *  same pattern the confirm view uses on success. Lets the user
   *  (and us, when they share it) see WHY the catalog matcher found
   *  nothing: OCR garbled the marker names? Layout flattened the
   *  columns? Empty extraction? Without this the failure was a black
   *  box. Undefined when the parser didn't run at all (no-file path). */
  rawText?: string;
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
  /** When the upload was a mixed document (e.g. CBC + Dengue panel),
   *  the classifier flags the out-of-scope half so the confirm view can
   *  say "we ignored these sections" rather than letting the deliberately
   *  skipped rows show up in the unrecognized-rows panel. */
  ignoredCategory?: 'viral' | 'imaging' | 'physical-exam';
  /** OCR diagnostic — non-zero `pagesSkipped` means the user's report
   *  parsed partially. We surface a banner so a partial result isn't
   *  mistaken for a complete one. */
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
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
  /** Optional copy override pushed by the pipeline when the parser is
   *  still running well after the visual stages finished — keeps users
   *  on phones from assuming the tab froze during a long OCR. */
  const [detailOverride, setDetailOverride] = useState<string | null>(null);
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
  // Tracks which processingId the most recent parse was started for.
  // When parse-A's .then fires AFTER the user has started parse-B
  // (rapid re-upload), the captured processingId no longer matches
  // this ref — we then suppress the side-effects (savePendingConfirm
  // / removeReport / setFailure) that would otherwise pollute B's
  // state or leave an orphan pendingConfirm record tagged with the
  // dead processingId.
  const activeProcessingIdRef = useRef<string | null>(null);

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
    activeProcessingIdRef.current = processingId;

    // Restore-from-localStorage path. The previous flow held the confirm
    // state in component-local state only — so navigating away from the
    // confirm view (browser back, bottom-nav tap on iOS) lost the parsed
    // values, and returning to /processing would re-run the parser
    // against a now-consumed pendingUpload → failureReason='no-file' →
    // "There was nothing to parse" error. By persisting the confirm
    // record on success and checking for it here on mount, the restore
    // is invisible to the user.
    const persisted = loadPendingConfirm<Biomarker>();
    if (persisted && persisted.processingId === processingId) {
      setPendingConfirm({
        biomarkers: persisted.biomarkers,
        fileName: persisted.fileName,
        rawText: persisted.rawText,
        unrecognizedRows: persisted.unrecognizedRows,
        ignoredCategory: persisted.ignoredCategory,
        ocrPagesAttempted: persisted.ocrPagesAttempted,
        ocrPagesSkipped: persisted.ocrPagesSkipped,
      });
      return;
    }

    // Drain the pending upload once per processingId. If the user
    // refreshed mid-flow, this returns null and parseUploadedReport
    // resolves with failureReason='no-file'.
    const file = consumePendingUpload();
    const fileName = latestProcessing?.name ?? 'My lab report';

    void parseUploadedReport(
      { name: fileName, file },
      ({ stepIndex, stepProgress, overall, detailOverride }) => {
        setStepIndex(stepIndex);
        setStepProgress(stepProgress);
        setOverall(overall);
        setDetailOverride(detailOverride ?? null);
      },
    ).then((result) => {
      // Race guard: if a new upload superseded this one while we were
      // parsing, the activeProcessingIdRef now points to the newer
      // placeholder. Suppress all side-effects to avoid polluting the
      // new flow's state and leaking an orphan pendingConfirm record
      // tagged with the abandoned processingId.
      if (activeProcessingIdRef.current !== processingId) return;

      if (result.parsedFromFile) {
        // Real extraction succeeded — hand control to the user to
        // verify what was extracted before we commit the report.
        // The placeholder report stays in 'processing' state during
        // the confirm step (so the locker doesn't show a half-baked
        // entry); it's only marked ready when the user confirms.
        const confirmState: ConfirmState = {
          biomarkers: result.biomarkers,
          fileName,
          rawText: result.rawText,
          unrecognizedRows: result.unrecognizedRows,
          ignoredCategory: result.ignoredCategory,
          ocrPagesAttempted: result.ocrPagesAttempted,
          ocrPagesSkipped: result.ocrPagesSkipped,
        };
        // Persist so a navigate-away-then-back can restore this view
        // without re-running the parser against the consumed file.
        savePendingConfirm<Biomarker>({
          processingId,
          ...confirmState,
        });
        setPendingConfirm(confirmState);
        return;
      }
      // Extraction failed. Roll back the placeholder report so we
      // don't leave a forever-"processing" ghost in the locker, then
      // render the inline error state. Defensive clear in case a stale
      // confirm record from a prior session is still sitting in storage.
      clearPendingConfirm();
      removeReport(processingId);
      setFailure({
        reason: result.failureReason ?? 'no-matches',
        errorMessage: result.errorMessage,
        fileName,
        ocrPagesAttempted: result.ocrPagesAttempted,
        ocrPagesSkipped: result.ocrPagesSkipped,
        rawText: result.rawText,
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
    clearPendingConfirm();
    setPendingConfirm(null);
    replace({ type: 'results', reportId: processingId });
  };

  const rejectAndRetry = () => {
    if (processingId) removeReport(processingId);
    clearPendingConfirm();
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
        ignoredCategory={pendingConfirm.ignoredCategory}
        ocrPagesAttempted={pendingConfirm.ocrPagesAttempted}
        ocrPagesSkipped={pendingConfirm.ocrPagesSkipped}
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

        <h1 className="font-display text-display-md leading-tight mt-7 text-balance max-w-[22rem]">
          Reading your report carefully.
        </h1>
        <p className="mt-2 text-body-sm text-ink-soft max-w-[22rem] text-pretty">
          {detailOverride ??
            parseSteps[stepIndex]?.detail ??
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
          <div className="mt-2 text-caption uppercase tracking-label font-bold text-muted text-right tabular-nums">
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
                      <span className="text-caption font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-sm font-semibold text-ink leading-tight">
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

        <p className="mt-7 text-caption uppercase tracking-label font-bold text-muted">
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
  // Reason-specific headline so the user knows what actually happened.
  // - parser-error: pdfjs/tesseract threw (corrupt PDF, locked PDF, …)
  // - no-file: pendingUpload was empty (refresh mid-flow, deep-link)
  // - out-of-scope: parsed fine but the document type isn't a lab panel
  //   (viral panel, imaging report, dental exam, ECG). Distinct copy
  //   so the user understands the parser isn't broken, the report
  //   is just outside what the product supports.
  // - no-matches: catch-all for "we read it but found nothing useful"
  //   when the out-of-scope classifier isn't confident.
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
      case 'out-of-scope':
        // Exact string. Keep it intact — backend / analytics / future
        // automated handlers should be able to string-match on it.
        return {
          title: 'This report is outside what we cover.',
          detail:
            'Error: The uploaded document contains testing (e.g., infectious disease panels or localized physical exams) that is not related to general metabolic biomarkers or the HPA axis ecosystem. We cannot analyze this report.',
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
                <div className="text-micro font-bold uppercase tracking-eyebrow text-concern">
                  Parsing failed
                </div>
                <h2 className="font-display text-display-md leading-tight text-ink mt-1">
                  {copy.title}
                </h2>
                <p className="mt-2 text-caption leading-relaxed text-ink-soft">
                  {copy.detail}
                </p>
                <div className="mt-3 rounded-[10px] bg-surface border border-line/70 px-3 py-2 text-caption text-muted break-all">
                  <span className="font-bold uppercase tracking-label text-micro text-muted block mb-0.5">
                    File
                  </span>
                  {failure.fileName}
                </div>
                {/* OCR partial-failure callout. Without this, a user
                    whose 3-page PDF had 2 pages time out reads "we
                    didn't recognise any lab values" and blames their
                    report — when actually the parser only saw 1/3 of
                    it. Calling it out turns blame into "try again /
                    upload pages individually". */}
                {failure.ocrPagesAttempted &&
                  failure.ocrPagesSkipped !== undefined &&
                  failure.ocrPagesSkipped > 0 && (
                    <div className="mt-3 rounded-[10px] bg-attention-soft/60 border border-attention/30 px-3 py-2 text-caption text-ink-soft">
                      <span className="font-bold uppercase tracking-label text-micro text-attention block mb-0.5">
                        Partial OCR
                      </span>
                      {failure.ocrPagesSkipped} of {failure.ocrPagesAttempted}{' '}
                      page{failure.ocrPagesAttempted === 1 ? '' : 's'}{' '}
                      timed out before we could read{' '}
                      {failure.ocrPagesAttempted === 1 ? 'it' : 'them'}. The
                      remaining page{failure.ocrPagesAttempted - failure.ocrPagesSkipped === 1 ? '' : 's'}{' '}
                      may not have had the values you were expecting.
                      Retrying — or cropping the relevant section into a
                      clearer photo — usually helps.
                    </div>
                  )}
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
            <p className="text-caption text-muted leading-relaxed">
              {failure.reason === 'out-of-scope'
                ? 'Your file looks like a viral panel, imaging report, or clinical exam — those aren’t something we interpret. If part of it has metabolic, hormone, or vitamin values, type them in via “Enter values manually”.'
                : 'Our parser currently recognises hormone, metabolic, heart, thyroid, vitamin, liver, kidney, blood, electrolyte, inflammation, and fertility markers from text-layer PDFs and clear photos. Older scanned PDFs or non-standard lab layouts may not parse — we don’t guess.'}
            </p>
          </div>

          {/* Raw-text diagnostic. Same disclosure pattern the confirm
              view uses on success — on failure it's even more useful
              because the user (and us) can see WHY the catalog matcher
              found nothing. If the marker names + values are in the
              text but the matcher missed them, the matcher's the bug.
              If the text is empty or garbled, OCR/text-layer
              extraction is the bug. Without this disclosure every
              failure was a black box. */}
          {failure.rawText && (
            <details className="group border-t border-line/70">
              <summary className="cursor-pointer list-none px-5 py-3 flex items-center gap-1.5 text-caption font-bold uppercase tracking-label text-muted hover:text-ink hover:bg-canvas/40 transition-colors">
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
                Show what we read from the file
              </summary>
              <pre className="px-5 pb-5 text-caption text-ink-soft leading-relaxed whitespace-pre-wrap font-mono break-words max-h-[320px] overflow-y-auto">
                {failure.rawText.slice(0, 8000)}
                {failure.rawText.length > 8000 && '\n…(truncated)'}
              </pre>
            </details>
          )}
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
  ignoredCategory,
  ocrPagesAttempted,
  ocrPagesSkipped,
  onConfirm,
  onReject,
}: {
  biomarkers: Biomarker[];
  fileName: string;
  rawText?: string;
  unrecognizedRows?: string[];
  ignoredCategory?: 'viral' | 'imaging' | 'physical-exam';
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  // Status summary — three counts the user can scan at a glance before
  // committing to the report. Putting them next to the headline turns
  // "we found N values" from a count into a verdict: "and X of them
  // need your attention right now."
  const counts = useMemo(() => {
    let concern = 0;
    let attention = 0;
    let good = 0;
    for (const m of biomarkers) {
      if (m.status === 'concern') concern += 1;
      else if (m.status === 'attention') attention += 1;
      else good += 1;
    }
    return { concern, attention, good };
  }, [biomarkers]);

  /** Per-category expansion mirrors the ReportResults pattern. Default-
   *  open: any category with at least one `concern` marker. Everything
   *  else collapses on first paint so the user can scan category
   *  headers + the SummaryChips up top to verify "did we get the
   *  numbers right?" without staring at 30+ MarkerRows. The categories
   *  carrying flagged values are the only ones that need scrutiny by
   *  default; the rest are one tap away. */
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => {
      const initial = new Set<string>();
      for (const m of biomarkers) {
        if (m.status === 'concern') initial.add(m.category);
      }
      return initial;
    },
  );
  const toggleCategory = (id: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group by category in canonical order so the user reads the values
  // in the same sequence as the eventual report. Within each category,
  // sort by severity (concern → attention → good) so the markers that
  // need verification most appear at the top of every section.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Biomarker[]>();
    for (const m of biomarkers) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }
    const severityRank: Record<Biomarker['status'], number> = {
      concern: 0,
      attention: 1,
      good: 2,
    };
    return biomarkerCategories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({
        category: c,
        markers: (byCategory.get(c.id) ?? []).slice().sort(
          (a, b) => severityRank[a.status] - severityRank[b.status],
        ),
      }));
  }, [biomarkers]);

  return (
    <div className="min-h-dvh bg-canvas pb-36">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container size="wide" className="mt-6 md:mt-10">
        {/* ---- Hero ---- */}
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="gold" size="sm">
            <Check size={11} strokeWidth={3} /> Extraction complete
          </Pill>
          <h1 className="font-display text-display-md lg:text-display-lg leading-[1.05] mt-3 text-balance text-ink">
            We found{' '}
            <span className="text-indigo-700">{biomarkers.length}</span>{' '}
            {biomarkers.length === 1 ? 'value' : 'values'} in your report.
          </h1>
          <p className="mt-3 text-body-sm lg:text-body text-ink-soft text-pretty max-w-xl">
            Check each number against your report before continuing. We
            deliberately only show what we could pull out — if a marker
            you expected isn’t listed, it wasn’t in our catalog or our
            parser couldn’t find a match.
          </p>

          {/* Status summary chips. Rendered ONLY when the category-card
              grid below would otherwise be empty (e.g., parser returned
              markers whose category IDs aren't in biomarkerCategories,
              so `grouped` is empty but `counts` is non-zero — an edge
              case, but real). In the normal case the category cards
              below already carry status via colored borders + per-card
              count pills, so showing chips here too is double-coding
              the same totals on the same screen. Single source of
              count signal in the dominant case; safety net in the
              degenerate one. */}
          {grouped.length === 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {counts.concern > 0 && (
                <SummaryChip tone="concern" count={counts.concern} label="need care" />
              )}
              {counts.attention > 0 && (
                <SummaryChip tone="attention" count={counts.attention} label="borderline" />
              )}
              {counts.good > 0 && (
                <SummaryChip tone="good" count={counts.good} label="on track" />
              )}
            </div>
          )}

          {/* File pill — replaces the bare "FILE filename" line. The
              card-shaped container gives the metadata real visual
              weight without making it compete with the headline. */}
          <div className="mt-5 inline-flex items-center gap-2.5 max-w-full pl-2.5 pr-3.5 py-2 rounded-[12px] bg-surface border border-line/70 shadow-soft">
            <div className="grid place-items-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
              <FileText size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-micro uppercase tracking-eyebrow font-bold text-muted leading-none">
                File parsed
              </div>
              <div className="mt-0.5 text-caption text-ink font-medium truncate">
                {fileName}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 lg:max-w-3xl lg:mx-auto grid gap-4">
          {/* OCR skip banner — surfaces when Tesseract couldn't finish
              one or more pages (timeout or render failure). Without
              this, a partial result on a multi-page report looks
              complete and the user trusts a half-extraction. */}
          {ocrPagesAttempted &&
            ocrPagesSkipped !== undefined &&
            ocrPagesSkipped > 0 && (
              <Card padded={false} className="overflow-hidden border-attention/30">
                <div className="px-5 py-4 bg-attention-soft/50 flex items-start gap-3">
                  <span aria-hidden role="img" className="text-body-lg leading-none">
                    ⚠️
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-body-sm leading-tight">
                      Some pages couldn’t be read
                    </div>
                    <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                      {ocrPagesSkipped} of {ocrPagesAttempted} page{ocrPagesAttempted === 1 ? '' : 's'}{' '}
                      failed during text extraction (OCR timeout). Any values
                      on those pages aren’t in the list below. If the report
                      looks short, try re-uploading or use manual entry.
                    </p>
                  </div>
                </div>
              </Card>
            )}

          {grouped.map(({ category, markers }) => {
            const open = expandedCategoryIds.has(category.id);
            return (
              <Card key={category.id} padded={false} className="overflow-hidden">
                {/* Tinted category header — clickable to toggle the
                    marker list. Default-open for categories with any
                    concern marker; collapsed otherwise. Icon badge +
                    description stay; existing count Pill + a chevron
                    on the right. */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={open}
                  aria-controls={`confirm-category-${category.id}`}
                  className={`w-full px-5 pt-4 pb-4 flex items-center gap-3 bg-indigo-50/50 text-left hover:bg-indigo-50/70 transition-colors ${
                    open ? 'border-b border-line/60' : ''
                  }`}
                >
                  <div className="grid place-items-center w-10 h-10 rounded-2xl bg-white border border-line/60 shadow-soft shrink-0">
                    <Emoji label={category.name} className="text-body-lg leading-none">
                      {category.icon}
                    </Emoji>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-body leading-tight text-ink">
                      {category.name}
                    </div>
                    <div className="text-caption text-muted mt-0.5 truncate">
                      {category.description}
                    </div>
                  </div>
                  <Pill tone="indigo" size="sm" className="shrink-0">
                    {markers.length} {markers.length === 1 ? 'value' : 'values'}
                  </Pill>
                  <ChevronDown
                    size={18}
                    className={`text-muted shrink-0 transition-transform duration-200 ${
                      open ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {open && (
                  <ul id={`confirm-category-${category.id}`}>
                    {markers.map((m, i) => (
                      <MarkerRow
                        key={m.id}
                        marker={m}
                        showTopBorder={i > 0}
                      />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          {/* "We ignored these sections" notice — appears when the
              upload bundles in-scope panels (CBC, hormones, …) with an
              out-of-scope panel (viral, imaging, dental). Without this,
              the dengue/X-ray rows would surface in the unrecognized-
              rows panel below as if the parser had missed them — but
              we deliberately don't analyze those sections. */}
          {ignoredCategory && (
            <Card padded={false} className="overflow-hidden border-indigo-200/70">
              <div className="px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50/40 flex items-center gap-2">
                <span aria-hidden role="img" className="text-body leading-none">
                  ℹ️
                </span>
                <div className="font-display text-body-sm leading-tight">
                  We ignored some sections of this report
                </div>
              </div>
              <div className="px-5 py-3">
                <p className="text-caption text-ink-soft leading-relaxed">
                  Your file also contained{' '}
                  <span className="font-semibold text-ink">
                    {ignoredCategory === 'viral'
                      ? 'infectious-disease / viral panel'
                      : ignoredCategory === 'imaging'
                        ? 'imaging or ECG'
                        : 'physical-exam'}{' '}
                    results
                  </span>
                  . Those aren’t part of the metabolic / HPA-axis analysis we
                  cover, so we didn’t try to interpret them. The values above
                  are everything we extracted from the in-scope sections.
                </p>
              </div>
            </Card>
          )}

          {/* Unrecognized-rows notice — diagnostic / power-user content,
              not action-driving. A user verifying their values cares
              about the marker grid above; the rows we couldn't map are
              informational (the difference between "your parser missed
              things" and "your lab uses markers we don't cover yet").
              Wrapped in `<details>` so the row list is collapsed by
              default — the header still shows the count, the body
              expands on intent. Mirrors the raw-text disclosure below. */}
          {unrecognizedRows && unrecognizedRows.length > 0 && (
            <Card padded={false} className="overflow-hidden border-amber-200/70">
              <details className="group">
                <summary className="cursor-pointer list-none px-5 pt-4 pb-3 bg-amber-50/40 flex items-center gap-2 hover:bg-amber-50/60 transition-colors">
                  <span aria-hidden role="img" className="text-body leading-none">
                    🔍
                  </span>
                  <div className="font-display text-body-sm leading-tight">
                    We saw these rows but couldn’t map them
                  </div>
                  <Pill tone="neutral" size="sm" className="ml-auto">
                    {unrecognizedRows.length}
                  </Pill>
                  <ChevronDown
                    size={16}
                    className="text-muted shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="px-5 py-3 border-t border-amber-100">
                  <p className="text-caption text-ink-soft leading-relaxed mb-2">
                    Your report mentioned these values, but they aren’t in
                    our catalog yet. Nothing was discarded — they just won’t
                    appear in the dashboard. If any of these look important
                    to you, let us know and we’ll add them.
                  </p>
                  <ul className="text-caption font-mono text-ink-soft space-y-1">
                    {unrecognizedRows.map((row, i) => (
                      <li key={`${row}-${i}`} className="break-words">
                        · {row}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
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
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-caption font-bold uppercase tracking-label text-muted hover:text-ink transition-colors w-fit">
                {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Show what we read from the file
              </summary>
              <pre className="mt-3 p-3 bg-surface border border-line rounded-[12px] text-caption text-ink-soft leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto font-mono">
                {rawText.slice(0, 8000)}
                {rawText.length > 8000 && '\n…(truncated)'}
              </pre>
            </details>
          )}
        </div>
      </Container>

      {/* Sticky bottom CTAs. The previous layout used `flex-col-reverse
          sm:flex-row items-stretch` with both buttons stretching to
          half-width on sm+, which crammed the long-copy secondary
          ("Wrong file — start over") into a 3-line wrap on narrow
          desktop containers. New layout: secondary becomes an icon-
          only button on mobile and a compact pill on sm+, primary
          dominates as flex-1 so it always reads in one line. */}
      <StickyBottomBar bordered>
        <Container size="narrow">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={onReject}
              aria-label="Wrong file — start over"
              title="Wrong file — start over"
              className="shrink-0 inline-flex items-center gap-1.5 h-14 px-4 sm:px-5 rounded-[14px] bg-surface border border-line text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 text-body-sm font-semibold shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Re-upload</span>
            </button>
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
      </StickyBottomBar>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary chip — used in the hero to render the concern/attention/    */
/* good counts. Kept here (vs Pill) because the visual treatment is    */
/* heavier: dot + bold count + descriptor, sized for a hero summary    */
/* not an inline tag.                                                  */
/* ------------------------------------------------------------------ */

function SummaryChip({
  tone,
  count,
  label,
}: {
  tone: 'concern' | 'attention' | 'good';
  count: number;
  label: string;
}) {
  const dot =
    tone === 'concern' ? 'bg-concern' : tone === 'attention' ? 'bg-attention' : 'bg-good';
  const bg =
    tone === 'concern'
      ? 'bg-concern-soft'
      : tone === 'attention'
        ? 'bg-attention-soft'
        : 'bg-good-soft';
  const text =
    tone === 'concern' ? 'text-concern' : tone === 'attention' ? 'text-attention' : 'text-good';
  return (
    <div
      className={`inline-flex items-center gap-2 pl-2.5 pr-3.5 h-9 rounded-full ${bg}`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
      <span className={`font-display text-body tabular-nums ${text} leading-none`}>
        {count}
      </span>
      <span className={`text-caption font-medium ${text} leading-none`}>
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MarkerRow — confirm-view row layout                                  */
/*                                                                      */
/* Hierarchy: status accent edge (left) → name + reference + mini      */
/* range bar (centre) → value + unit + status pill (right). The accent  */
/* edge is the strongest visual signal — at-risk markers earn a vivid   */
/* left-edge stripe and a soft row tint, "on track" rows stay quiet.    */
/* ------------------------------------------------------------------ */

function MarkerRow({
  marker,
  showTopBorder,
}: {
  marker: Biomarker;
  showTopBorder: boolean;
}) {
  const isConcern = marker.status === 'concern';
  const isAttention = marker.status === 'attention';
  const accentBg = isConcern
    ? 'bg-concern'
    : isAttention
      ? 'bg-attention'
      : 'bg-transparent';
  // Subtle tint for non-good rows so attention/concern jumps out
  // without screaming. The /40 + /20 opacities are tuned to be
  // perceptible but not noisy — closer to a highlight than a
  // colored box.
  const rowTint = isConcern
    ? 'bg-concern-soft/40'
    : isAttention
      ? 'bg-attention-soft/30'
      : '';
  // The per-row status Pill (UPPERCASE "NEEDS CARE" / "NEEDS ATTENTION")
  // used to live in the right cluster alongside the value. Dropped:
  // the SummaryChips in the hero already give the per-status counts
  // (the verdict the user is verifying), and the accent edge + row
  // tint already encode the per-marker status visually. Keeping the
  // pill would mean rendering the same severity dimension three times
  // (hero chip + edge/tint + pill) on every row — wallpaper that
  // stops popping. Right column is just `value + unit` now.
  return (
    <li
      className={`relative flex items-stretch ${rowTint} ${showTopBorder ? 'border-t border-line/50' : ''}`}
    >
      <div className={`w-1 shrink-0 ${accentBg}`} aria-hidden />
      {/* Mobile gap is tighter (gap-2) and value font is smaller
          (text-body-lg = 17px) so the right cluster stops eating
          ~100px on a 320px iPhone SE — there's now actual room for
          the marker name + reference + mini range bar without forced
          word wrap. From sm+ the original 24px value + gap-4 layout
          returns for the more generous viewport. */}
      <div className="flex-1 min-w-0 px-4 sm:px-5 py-4 flex items-start gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-body-sm font-semibold text-ink leading-tight">
            {marker.name}
          </div>
          <div className="text-caption text-muted mt-0.5">
            Reference {marker.min}–{marker.max}
            {marker.unit ? ` ${marker.unit}` : ''}
          </div>
          {/* Mini range bar — three-zone gradient with a pin showing
              where the value sits. Same piecewise math as
              BiomarkerBar (healthy band always at the visual centre)
              so a low value on HbA1c and a low value on testosterone
              read the same way at a glance.
              Hidden below sm (≤640px): the confirm view's job is
              "does this number match your report?" — value + reference
              are sufficient. The in-range visualisation belongs on
              ReportResultsPage where the job is "is it in range?".
              On phones the mini-range was getting clipped to ~120px
              inside an already-cramped flex row anyway. */}
          <div className="hidden sm:block mt-2.5 max-w-[220px]">
            <MiniRange marker={marker} />
          </div>
        </div>
        <div className="text-right shrink-0 font-display text-body-lg sm:text-display-md leading-none text-ink tabular-nums">
          {marker.value}
          {marker.unit && (
            <span className="text-caption ml-1 text-muted font-sans font-medium">
              {marker.unit}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* MiniRange — compact range visualisation                              */
/*                                                                      */
/* Piecewise positioning identical to BiomarkerBar's:                  */
/*   - left third  = critical-low zone                                  */
/*   - middle third = healthy band (min..max)                           */
/*   - right third = critical-high zone                                 */
/* This decouples visual position from clinical scale, so a marker at  */
/* the middle of its healthy band always lands at the visual centre   */
/* regardless of whether the band is [4–5.7] (HbA1c) or [300–1000]    */
/* (testosterone).                                                      */
/* ------------------------------------------------------------------ */

function MiniRange({ marker }: { marker: Biomarker }) {
  const SEGMENT = 100 / 3;
  const PIN_BUFFER = 2.5;
  const span = marker.max - marker.min || 1;
  const criticalLow = Math.max(0, marker.min - span);
  const criticalHigh = marker.max + span;
  const v = marker.value;
  let raw: number;
  if (v <= criticalLow) raw = 0;
  else if (v < marker.min) {
    const denom = marker.min - criticalLow || 1;
    raw = ((v - criticalLow) / denom) * SEGMENT;
  } else if (v <= marker.max) {
    const denom = span || 1;
    raw = SEGMENT + ((v - marker.min) / denom) * SEGMENT;
  } else if (v < criticalHigh) {
    const denom = criticalHigh - marker.max || 1;
    raw = SEGMENT * 2 + ((v - marker.max) / denom) * SEGMENT;
  } else raw = 100;
  const pinPct = Math.max(PIN_BUFFER, Math.min(100 - PIN_BUFFER, raw));

  const direction = marker.direction ?? 'band';
  // Colour the extremes per direction (matches BiomarkerBar): "up is
  // better" means the low end is the dangerous one, "down is better"
  // flips it, "band" keeps both ends red.
  const lowZoneClr =
    direction === 'down'
      ? 'var(--color-attention-soft)'
      : 'var(--color-concern-soft)';
  const highZoneClr =
    direction === 'up'
      ? 'var(--color-attention-soft)'
      : 'var(--color-concern-soft)';
  const midZoneClr = 'var(--color-good-soft)';
  const gradient =
    `linear-gradient(to right, ${lowZoneClr} 0%, ${lowZoneClr} ${SEGMENT}%, ` +
    `${midZoneClr} ${SEGMENT}%, ${midZoneClr} ${SEGMENT * 2}%, ` +
    `${highZoneClr} ${SEGMENT * 2}%, ${highZoneClr} 100%)`;

  return (
    <div className="relative" aria-hidden>
      <div
        className="h-1.5 w-full rounded-full"
        style={{ background: gradient }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-ink shadow-sm"
        style={{ left: `${pinPct}%` }}
      />
    </div>
  );
}
