import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ShieldCheck } from 'lucide-react';
import Container from '../components/Container';
import Logo from '../components/Logo';
import { useNavigation, useReports } from '../AppContext';
import {
  consumePendingUpload,
  parseSteps,
  parseUploadedReport,
} from '../services/api';
import { type Biomarker } from '../data/biomarkers';
import { makeReport, sampleReports } from '../data/reports';
import {
  clearPendingConfirm,
  loadAiAutoFallbackSetting,
  loadPendingConfirm,
  savePendingConfirm,
} from '../utils/persistence';
import { parseWithAi } from '../services/aiParser';
import { OCR_LOW_CONFIDENCE_THRESHOLD } from '../services/pdfParser';
import { sanitizeFilename } from '../utils/sanitizeFilename';
// Extracted view components + shared state shapes. This page used to be a
// ~2,000-line monolith; the views now live in ./processing/*.
import type { ConfirmState, FailureState } from './processing/types';
import ClinicalSpot from '../components/ClinicalSpot';
import { useTypewriter } from './processing/useTypewriter';
import AiCascadeView from './processing/AiCascadeView';
import ParseFailedView from './processing/ParseFailedView';
import ConfirmExtractedValuesView from './processing/ConfirmExtractedValuesView';

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

/**
 * Detects "WHO 2010" / "WHO 5th edition" / "WHO Laboratory Manual 5th"
 * in raw text, case-insensitive. Returns true when the report cites the
 * old standard. Used to surface a one-line disclosure in the confirm
 * view so the user understands why our verdict may disagree with the
 * lab's interpretive copy.
 */
function detectsWho2010Reference(rawText: string | undefined): boolean {
  if (!rawText) return false;
  // Strict patterns — we don't want to trip on "WHO 2021" (the new
  // standard) or "WHO" alone (too generic). Specifically look for the
  // 2010 year, the 5th-edition wording, or the legacy WHO-criteria
  // strings labs print.
  return /WHO\s*(?:reference)?\s*(?:2010|5th\s*edition|5th\s*ed)/i.test(
    rawText,
  );
}

export default function ProcessingPage() {
  const { reports, markReportReady, removeReport, addReport } = useReports();
  const { replace } = useNavigation();

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

  // The live status line, typed out char-by-char for a "real-time scan"
  // feel that justifies the wait. Pure text + caret — NO scanning-beam or
  // glow (that's the generated-app look we avoid). Reduced-motion users get
  // the full string instantly (no typing animation).
  const prefersReduced = useReducedMotion();
  const detailText =
    detailOverride ??
    parseSteps[stepIndex]?.detail ??
    'Almost done — putting your results together.';
  const typedDetail = useTypewriter(detailText, !prefersReduced);
  /** Holds the parsed result after a successful extraction. We DON'T
   *  navigate to /results until the user confirms — previously the
   *  app auto-routed and the user had no chance to verify what was
   *  extracted before being shown a "your report" dashboard. */
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmState | null>(
    null,
  );
  /** When set, ProcessingPage is in the auto-cascade state: the local
   *  pipeline couldn't produce a trustworthy read on an image, so we're
   *  invoking the Vision-LLM fallback automatically (without requiring
   *  the user to tap the manual "Try AI parser" button). The render
   *  branch for this state shows a "Trying AI parser..." view with the
   *  privacy disclosure inline and a prominent Cancel button.
   *
   *  Gated by:
   *    - File MIME starts with `image/` (PDFs never auto-cascade — they
   *      have text layers, and a failed PDF is more likely a non-lab
   *      file than a parser miss)
   *    - User has `dc_aiAutoFallback` enabled (default true; togglable
   *      in Profile)
   *    - EITHER the local pipeline failed with a parser-miss reason
   *      (`no-matches` / `extraction-error` / `ocr-failed`), OR it
   *      "succeeded" but at LOW OCR confidence — a low-quality image
   *      scrape (e.g. Hematocrit "3%" from a garbled photo) is worse
   *      than no read, so we prefer the AI parser over presenting shaky
   *      numbers. Corruption / missing file shouldn't burn a quota tick. */
  const [aiCascadeFile, setAiCascadeFile] = useState<File | null>(null);
  /** AbortController for the in-flight AI cascade call. Held in a ref
   *  so the Cancel button (and unmount cleanup) can `.abort()` without
   *  triggering a re-render. Replaced on every cascade entry; aborted
   *  on every cascade exit (success, failure, cancel, unmount). */
  const aiCascadeAbortRef = useRef<AbortController | null>(null);

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
  // Mount guard for async paths whose state mutations would otherwise
  // run after the component has been removed from the tree — e.g., the
  // user clicks "Try AI parser" and immediately navigates to manual
  // entry. The AI call resolves seconds later; without this guard it
  // would call addReport (creating an orphan placeholder in the locker)
  // and setPendingConfirm (no-op on unmounted, but logs a warning).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

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
        ocrConfidence: persisted.ocrConfidence,
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

        // Auto-use AI for LOW-CONFIDENCE image reads. We scraped some
        // values, but a low OCR confidence means they're unreliable —
        // the same signal behind the "double-check these" banner. Real
        // example: a Pakistani CBC photo where Tesseract turned 12.5 into
        // "12s" and 38 into "3", surfacing a Hematocrit of 3% (impossible)
        // plus a panel of OCR garbage. Rather than present shaky numbers,
        // hand the image straight to the Vision-LLM, which reads layout +
        // digits far better. This mirrors the failure-branch cascade and
        // is gated identically: images only (the AI endpoint rejects PDFs,
        // and PDFs have a real text layer anyway), and only when the user
        // hasn't opted out (dc_aiAutoFallback, default on). A HIGH-
        // confidence image read (clean scan) and every PDF text-layer read
        // skip this and go straight to confirm — so we don't burn a Gemini
        // call when local extraction was trustworthy.
        const isImage = !!file && /^image\//.test(file.type || '');
        const lowConfidenceImage =
          isImage &&
          result.ocrConfidence !== undefined &&
          result.ocrConfidence <= OCR_LOW_CONFIDENCE_THRESHOLD;
        if (lowConfidenceImage && file && loadAiAutoFallbackSetting()) {
          clearPendingConfirm();
          removeReport(processingId);
          setAiCascadeFile(file);
          return;
        }

        // Detect WHO 2010 / 5th-edition references in the raw text;
        // only relevant when a semen-axis (fertility) marker was
        // matched, otherwise the standard-mismatch banner is noise.
        const hasFertilityMarker = result.biomarkers.some(
          (m) => m.category === 'fertility',
        );
        const semenStandardMismatch =
          hasFertilityMarker && detectsWho2010Reference(result.rawText);
        const confirmState: ConfirmState = {
          biomarkers: result.biomarkers,
          fileName,
          rawText: result.rawText,
          unrecognizedRows: result.unrecognizedRows,
          ignoredCategory: result.ignoredCategory,
          ocrPagesAttempted: result.ocrPagesAttempted,
          ocrPagesSkipped: result.ocrPagesSkipped,
          ocrConfidence: result.ocrConfidence,
          semenStandardMismatch,
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
      // decide between two paths: auto-cascade to the AI parser
      // (preferred for image uploads, when the setting is on) or fall
      // straight to the inline failure card (PDFs, opt-out, or
      // non-parser-miss reasons like corruption / no-file).
      clearPendingConfirm();
      removeReport(processingId);
      const reason = result.failureReason ?? 'no-matches';
      const isImage = !!file && /^image\//.test(file.type || '');
      // Cascade is image-only — the AI parser endpoint accepts JPEG /
      // PNG / WebP only. Sending a PDF here would round-trip a 400
      // from the server, so PDFs never cascade regardless of reason.
      //
      // For images, any failure reason except 'no-file' triggers the
      // cascade. The out-of-scope classifier was tuned against clean
      // pdfjs text-layer output where it's reliable; on noisy Tesseract
      // OCR from a phone photo (low contrast, glare, slight rotation),
      // false positives are common — a clearly-a-CBC image can get
      // flagged out-of-scope and the user previously saw a failure
      // card with no auto-recovery. Real-world example: a Pakistani
      // lab CBC photo where Tesseract's OCR garbled enough text that
      // the classifier guessed "not a lab report" and the prior gate
      // (excluding out-of-scope) blocked the AI fallback. For images,
      // trying Gemini is essentially free; if Gemini also sees
      // nothing, we drop through to the failure card anyway.
      const isCascadeReason = reason !== 'no-file';
      const shouldCascade =
        isImage && isCascadeReason && loadAiAutoFallbackSetting();
      if (shouldCascade && file) {
        // Don't paint the failure card — kick straight into the AI
        // cascade. The setAiCascadeFile state drives a new render
        // branch that shows the "Trying AI parser..." view with the
        // privacy disclosure inline.
        setAiCascadeFile(file);
        return;
      }
      setFailure({
        reason,
        errorMessage: result.errorMessage,
        fileName,
        ocrPagesAttempted: result.ocrPagesAttempted,
        ocrPagesSkipped: result.ocrPagesSkipped,
        rawText: result.rawText,
        // Preserve the original File so the user can opt into the
        // Vision-LLM fallback (Pipeline 3) without re-uploading. The
        // file was just consumed from setPendingUpload — it's the
        // only Blob handle we'll get for this upload.
        file: file ?? undefined,
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
    // Navigate to the sample report's id WITHOUT calling addReport.
    // findReport(userReports, id) falls back to the curated sample
    // pool, so navigation works without us injecting sample data into
    // the user's persistent locker. The previous addReport(sample)
    // wrote 'rep-001' (carrying canned testosterone 280 ng/dL, etc.)
    // into dc_reports as if the user owned it — turning what the
    // dashboard treated as "the user's most recent report" into
    // sample data labelled as theirs.
    setFailure(null);
    // replace (not navigate/push) so Back doesn't return to this dead
    // /processing screen — the pending upload is already consumed, so a
    // return here would re-run to a 'no-file' failure. Matches the other
    // terminal handlers on this page (retry / manual / confirm).
    replace({ type: 'results', reportId: sampleReports[0].id });
  };

  const enterManually = () => {
    setFailure(null);
    replace({ type: 'manualEntry' });
  };

  /**
   * Vision-LLM fallback (Pipeline 3). Called when the user opts in via
   * the "Try AI parser" button on the failure screen. Sends the original
   * File to /api/parse-image, which proxies to Gemini 2.5 Flash and
   * returns biomarker JSON. We then create a fresh placeholder report
   * (the original was already removed when the rule-based parse failed)
   * and hand the user the same ConfirmExtractedValuesView they'd see
   * after a successful Tesseract run — so the verification step is
   * identical regardless of which pipeline produced the values.
   *
   * On 0 mapped markers (Gemini saw nothing recognisable, or saw
   * markers our catalog doesn't cover yet), surface an inline error
   * and keep the user on the failure screen.
   */
  const tryAiParser = async (
    file: File,
    signal?: AbortSignal,
  ): Promise<{ error?: string }> => {
    try {
      const result = await parseWithAi(file, signal);
      // Race guard: if the component unmounted while the AI call was
      // in flight (user clicked Try AI parser, then navigated away or
      // hit "Enter values manually"), bail before we mutate global
      // state. Without this, addReport would land an orphan
      // 'processing' report in the locker that the user never asked
      // for. Return a benign empty result so the caller doesn't paint
      // an error message either — the user has moved on.
      if (!mountedRef.current) return {};
      if (result.biomarkers.length === 0) {
        return {
          error:
            result.rawCount > 0
              ? `Our AI parser found ${result.rawCount} marker${result.rawCount === 1 ? '' : 's'}, but none matched our catalog yet.`
              : 'Our AI parser couldn’t recognise any markers in this image either.',
        };
      }
      // Re-establish a processing report — the original was removed on
      // the rule-based failure. Set pendingConfirm in the same shape
      // as a normal Tesseract success so ConfirmExtractedValuesView
      // doesn't need a second code path.
      //
      // Sanitize the filename through the same gate the rule-based
      // path uses: a 250-char Android share-sheet path or a name
      // packed with bidi/control chars would otherwise survive the
      // AI fallback, get written into dc_reports, and then fail the
      // zod ReportSchema.name max(200) check on next app boot —
      // wiping the entire reports blob.
      const safeName = sanitizeFilename(file.name || 'AI-parsed report', 200);
      const newReport = makeReport(safeName);
      addReport(newReport);
      activeProcessingIdRef.current = newReport.id;
      // Pass AI-unmapped markers through as `unrecognizedRows` so the
      // confirm view surfaces "your lab also tested these N markers we
      // don't analyze yet" instead of silently dropping them. Cap at
      // 50 to mirror the rule-based path's surface.
      const unrecognizedFromAi = result.unmapped.slice(0, 50).map((u) => {
        const valueStr = Number.isFinite(u.value) ? String(u.value) : 'n/a';
        const unitStr = u.unit ? ` ${u.unit}` : '';
        return `${u.name} ${valueStr}${unitStr}`;
      });
      const confirmState: ConfirmState = {
        biomarkers: result.biomarkers,
        fileName: safeName,
        unrecognizedRows:
          unrecognizedFromAi.length > 0 ? unrecognizedFromAi : undefined,
      };
      savePendingConfirm<Biomarker>({
        processingId: newReport.id,
        ...confirmState,
      });
      setPendingConfirm(confirmState);
      setFailure(null);
      return {};
    } catch (err) {
      if (!mountedRef.current) return {};
      return {
        error:
          err instanceof Error
            ? err.message
            : 'Something went wrong contacting the AI parser.',
      };
    }
  };

  /* ---- Confirm-step actions ---- */

  // Commits the markers the user confirmed. `markers` carries any inline
  // corrections the user made on the confirm screen (re-graded already by
  // the view); falls back to the parsed set when nothing was edited.
  const confirmExtractedValues = (markers: Biomarker[]) => {
    if (!processingId || !pendingConfirm) return;
    markReportReady(processingId, {
      biomarkers: markers,
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

  /* ---- AI auto-cascade ---- */

  /**
   * Drive the AI cascade whenever `aiCascadeFile` flips on. The effect
   * owns the AbortController for the in-flight call so Cancel and
   * unmount can both interrupt cleanly. Three terminal transitions:
   *   - success → tryAiParser sets pendingConfirm; we clear aiCascadeFile
   *   - parser miss / error → setFailure (drops back to the manual
   *     failure card so the user can retry, enter manually, or use a
   *     sample); we clear aiCascadeFile
   *   - user cancel → setFailure with the same fallback set
   *
   * Race guards:
   *   - mountedRef: if the user navigates away mid-call, we don't mutate
   *     state on a dead component.
   *   - activeProcessingIdRef: if a new upload supersedes this one
   *     during the cascade, suppress side-effects.
   */
  useEffect(() => {
    if (!aiCascadeFile) return;
    const controller = new AbortController();
    aiCascadeAbortRef.current = controller;
    const cascadeProcessingId = activeProcessingIdRef.current;
    const fileName = aiCascadeFile.name || 'My lab report';

    void tryAiParser(aiCascadeFile, controller.signal).then((res) => {
      if (!mountedRef.current) return;
      if (activeProcessingIdRef.current !== cascadeProcessingId) return;
      if (controller.signal.aborted) {
        // User-triggered cancel: drop into the failure card with a
        // gentle reason so they can pick an alternative (manual,
        // sample, different file).
        setAiCascadeFile(null);
        setFailure({
          reason: 'no-matches',
          errorMessage:
            'AI parser cancelled. You can enter values manually or try a different file.',
          fileName,
          file: aiCascadeFile,
        });
        return;
      }
      if (res.error) {
        // tryAiParser returned an error (zero markers, network fail,
        // schema reject). Fall back to the manual failure card —
        // ParseFailedView already renders the "Try AI parser" button
        // so the user can retry if it was transient.
        setAiCascadeFile(null);
        setFailure({
          reason: 'no-matches',
          errorMessage: res.error,
          fileName,
          file: aiCascadeFile,
        });
        return;
      }
      // Success path: tryAiParser already called setPendingConfirm.
      // Just clear the cascade state so the next render shows the
      // confirm view (which is gated higher in this render function).
      setAiCascadeFile(null);
    });

    return () => {
      // On effect cleanup (component unmount OR aiCascadeFile changing
      // mid-flight), abort the in-flight call. The fetch will reject
      // with AbortError, tryAiParser will catch it, and the
      // mountedRef guard above will suppress the state mutation.
      controller.abort();
      aiCascadeAbortRef.current = null;
    };
    // tryAiParser is intentionally NOT in the dep list — it's
    // re-created on every render but its closed-over state we care
    // about (mountedRef / activeProcessingIdRef) is ref-stable. Adding
    // it would re-fire the effect every render and double-call the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiCascadeFile]);

  const cancelAiCascade = () => {
    aiCascadeAbortRef.current?.abort();
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
        onTryAi={tryAiParser}
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
        ocrConfidence={pendingConfirm.ocrConfidence}
        semenStandardMismatch={pendingConfirm.semenStandardMismatch}
        onConfirm={confirmExtractedValues}
        onReject={rejectAndRetry}
      />
    );
  }

  if (aiCascadeFile) {
    return (
      <AiCascadeView fileName={aiCascadeFile.name} onCancel={cancelAiCascade} />
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
        {/* The protagonist: the same sheet of paper the user just
            uploaded, now under the scanner. It leads the screen so the
            person SEES what's happening before reading it — and it's the
            same object they'll follow into confirm, report, Health Map. */}
        <ClinicalSpot name="scanning" size={132} className="mb-1" />

        <h1 className="font-display text-display-md leading-tight mt-6 text-balance max-w-[22rem]">
          Reading your report carefully.
        </h1>
        <p
          className="mt-2 text-body-sm text-ink-soft max-w-[22rem] text-pretty"
          aria-live="polite"
        >
          {typedDetail}
          {/* Blinking caret — only while actively typing, and never under
              reduced-motion. */}
          {!prefersReduced && typedDetail.length < detailText.length && (
            <span className="inline-block w-[1px] h-[1em] -mb-[0.1em] ml-0.5 bg-clay motion-safe:animate-pulse" />
          )}
        </p>

        {/* On-device manifest — the "how", kept as a quiet trust detail
            below the narration (was the hero before the scanner spot).
            engine / on-device / network:none is the answer to "why not
            just use ChatGPT?". */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm mt-6"
        >
          <dl className="font-mono text-caption border border-line rounded-md divide-y divide-line text-left">
            {[
              ['engine', 'pdf.js · tesseract'],
              ['location', 'on-device'],
              ['network', 'none'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-3 py-1.5">
                <dt className="text-muted lowercase tracking-wide">{k}</dt>
                <dd className="text-ink-soft lowercase tracking-wide">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

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
                        ? 'bg-good text-on-status'
                        : state === 'active'
                          ? 'bg-indigo-600 text-on-primary'
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
                      <span className="text-caption font-semibold">
                        {i + 1}
                      </span>
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
                          animate={{
                            width: `${Math.round(stepProgress * 100)}%`,
                          }}
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

        {/* On-device privacy reassurance during the CPU-heavy local parse.
            This view IS the local (pdf.js + Tesseract) path — nothing
            leaves the browser here. The optional AI reader is a separate,
            consent-gated view, so "stays on your device" is accurate for
            this screen without overclaiming. */}
        <div className="mt-4 inline-flex items-center gap-2 text-caption text-muted max-w-[26rem] text-pretty">
          <ShieldCheck size={14} className="text-good shrink-0" aria-hidden />
          <span>
            Running entirely on your device — your report stays in your browser.
          </span>
        </div>
      </Container>
    </div>
  );
}
