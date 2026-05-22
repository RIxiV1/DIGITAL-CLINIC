/**
 * Upload-pipeline plumbing.
 *
 * This file owns the bridge between the UploadPage's File handoff and
 * the ProcessingPage's parser invocation, plus the staged-progress
 * choreography that paces the UI while parsing runs.
 *
 * Pure data lives in ../data/*, presentational helpers (statusColor,
 * summarizeStatuses, bottomLineFor, …) live with the biomarkers they
 * describe. This file is the only one that needs to know about parsing
 * lifecycle.
 */

import { type Biomarker } from '../data/biomarkers';
import { type Report } from '../data/reports';
import { formatDate } from '../utils/uiUtils';
import { parsePdfFile } from './pdfParser';

/* ------------------------------------------------------------------ */
/* Pending-upload bridge                                                */
/*                                                                      */
/* Files can't ride through the in-memory navigation flow as state      */
/* (Reports persist to localStorage, which doesn't store File objects). */
/* Instead, UploadPage stashes the validated File here BEFORE it        */
/* navigates, and ProcessingPage consumes it on mount. If the page is   */
/* hard-refreshed between those points, consumePendingUpload() returns  */
/* null and the pipeline falls back to demo data — graceful degradation */
/* rather than a hang.                                                  */
/* ------------------------------------------------------------------ */

let pendingUpload: File | null = null;

export function setPendingUpload(file: File | null): void {
  pendingUpload = file;
}

export function consumePendingUpload(): File | null {
  const f = pendingUpload;
  pendingUpload = null;
  return f;
}

/* ------------------------------------------------------------------ */
/* Upload pipeline                                                     */
/* ------------------------------------------------------------------ */

type ParseStepId = 'metadata' | 'bounds' | 'ocr' | 'align';

export type ParseStep = {
  id: ParseStepId;
  /** Headline label shown next to the active spinner. Copy matches the
   *  diagnostic-log strings the Directive specifies verbatim. */
  label: string;
  /** Short copy shown under the active step's title. */
  detail: string;
  /** Approximate duration in ms — used to size the inner progress bar. */
  durationMs: number;
};

/**
 * Visible stages while a report is being parsed.
 *
 * Honest labels: each one corresponds to a real step the pipeline
 * actually takes. The previous copy ("Locating reference marker bounds",
 * "OCR Text extraction: found hormone & metabolic panels") was theatre
 * — those weren't real stages, they were credibility props. If a user
 * ever paid close attention they'd realise the loading screen was
 * lying and trust would drop further than if we'd just shown a spinner.
 *
 * The new labels describe what the pipeline does in plain terms:
 * extract text → run OCR if needed → match markers → score them.
 */
export const parseSteps: ParseStep[] = [
  {
    id: 'metadata',
    label: 'Reading your file',
    detail: 'Opening the PDF and pulling out the text layer.',
    durationMs: 900,
  },
  {
    id: 'bounds',
    label: 'Finding the values',
    detail: 'Scanning the document for marker names, numbers, and units.',
    durationMs: 950,
  },
  {
    id: 'ocr',
    label: 'Matching against our catalog',
    detail: 'Lining each row up against the markers we know how to read.',
    durationMs: 1100,
  },
  {
    id: 'align',
    label: 'Scoring against healthy ranges',
    detail: 'Flagging anything outside the normal band so we can highlight it.',
    durationMs: 800,
  },
];

export type UploadInput = {
  /** Display name shown in the locker. Caller should pass the file's
   *  basename (without extension) — services don't try to be clever. */
  name: string;
  /** The actual File to parse, if available. Without this the pipeline
   *  falls back to the demo dataset (the "you refreshed mid-flow" path). */
  file?: File | null;
};

export type ParsedReport = {
  report: Report;
  biomarkers: Biomarker[];
  /** True when the biomarkers came from real PDF extraction; false
   *  when we fell back to the demo dataset (no File, non-PDF, or zero
   *  markers extracted). The UI uses this to decide whether to render
   *  the success path or the parse-failed error state. */
  parsedFromFile: boolean;
  /** Why parsing didn't yield real markers — surfaced in the
   *  ProcessingPage error state so the user knows whether it was a
   *  format issue, an empty extraction, or a real parser error. */
  failureReason?: 'no-file' | 'no-matches' | 'parser-error';
  /** Specific error string from the parser (e.g. "password-protected
   *  PDF") when failureReason === 'parser-error'. */
  errorMessage?: string;
  /** Raw extracted text — surfaced in the confirm step as a
   *  "show what we read" diagnostic so the user can sanity-check
   *  what came out of pdfjs/Tesseract before we mark it as their
   *  report. Never persisted (may contain PII). */
  rawText?: string;
  /** Label-value-unit rows the parser saw but couldn't match against
   *  the catalog. Empty when extraction failed or yielded a complete
   *  match. Surfaced in the confirm step so the user knows whether a
   *  short list reflects an unusual report or a parser gap. Never
   *  persisted. */
  unrecognizedRows?: string[];
};

/**
 * Run the upload through the parsing pipeline. Streams per-stage
 * progress to `onProgress` while the visual stages run, AND in parallel
 * (when a real PDF File is passed) runs the actual pdfjs extractor +
 * catalog matcher. The final result combines the two:
 *
 *   - If extraction yielded ≥1 biomarker → use those (parsedFromFile = true)
 *   - Otherwise                          → fall back to sampleBiomarkers
 *                                          (parsedFromFile = false)
 *
 * The visual stages always take their full duration so the user gets a
 * coherent "we're parsing your file" experience even when extraction is
 * fast. Parsing kicks off concurrently with the first stage so by the
 * time the last stage finishes, the result is usually ready.
 */
export async function parseUploadedReport(
  input: UploadInput,
  onProgress: (state: {
    stepIndex: number;
    stepProgress: number; // 0..1 within the current step
    overall: number;      // 0..1 across the whole pipeline
  }) => void,
): Promise<ParsedReport> {
  // Kick off real extraction immediately, in parallel with the stages.
  // The parser internally routes to a PDF-text path, a PDF-OCR fallback,
  // or image OCR depending on file.type. We don't await it yet — the
  // visual stages run regardless so the UX is paced.
  type ExtractionOutcome =
    | { biomarkers: Biomarker[]; rawText: string; unrecognizedRows: string[] }
    | { biomarkers: null; reason: 'no-file' | 'no-matches' | 'parser-error'; message?: string; rawText?: string; unrecognizedRows?: string[] };

  let extractionDone = false;
  const extractionPromise: Promise<ExtractionOutcome> =
    input.file &&
    (input.file.type === 'application/pdf' ||
      input.file.type.startsWith('image/'))
      ? parsePdfFile(input.file)
          .then((r): ExtractionOutcome =>
            r.biomarkers.length > 0
              ? { biomarkers: r.biomarkers, rawText: r.rawText, unrecognizedRows: r.unrecognizedRows }
              : { biomarkers: null, reason: 'no-matches', rawText: r.rawText, unrecognizedRows: r.unrecognizedRows },
          )
          .catch((err: unknown): ExtractionOutcome => ({
            biomarkers: null,
            reason: 'parser-error',
            message: err instanceof Error ? err.message : String(err),
          }))
      : Promise.resolve<ExtractionOutcome>({ biomarkers: null, reason: 'no-file' });
  void extractionPromise.then(() => {
    extractionDone = true;
  });

  // The visual stages provide pacing for the UI but DO NOT gate the
  // result — actual progress is driven by the parser. Two adaptive
  // behaviours:
  //   1. If the parser finishes mid-stage, skip the rest of the
  //      animation and jump to 100%. The user doesn't wait on a fake
  //      timer when the work is already done.
  //   2. If the parser is still running when the visual stages would
  //      otherwise hit 100%, cap the last stage at 90% so the bar
  //      doesn't sit at full while we're actually still waiting. The
  //      stage spinner keeps animating, signalling "still working."
  const totalMs = parseSteps.reduce((sum, s) => sum + s.durationMs, 0);
  const lastIdx = parseSteps.length - 1;
  let elapsed = 0;

  stages: for (let i = 0; i < parseSteps.length; i++) {
    const step = parseSteps[i];
    const ticks = 24; // smoothness — 24 frames per stage feels fluid
    const tickMs = step.durationMs / ticks;
    const isLastStage = i === lastIdx;
    for (let t = 1; t <= ticks; t++) {
      await new Promise((r) => setTimeout(r, tickMs));
      if (extractionDone) {
        // Parser finished — snap to 100% on the last visible stage
        // and exit the stages loop without burning the remaining
        // visual budget.
        onProgress({ stepIndex: lastIdx, stepProgress: 1, overall: 1 });
        break stages;
      }
      const rawProgress = t / ticks;
      const rawOverall = (elapsed + step.durationMs * rawProgress) / totalMs;
      // Cap the LAST stage at 90% while extraction is still pending —
      // the user shouldn't see "100% complete" if we're actually still
      // waiting on Tesseract.
      const stepProgress = isLastStage ? Math.min(rawProgress, 0.9) : rawProgress;
      const overall = isLastStage ? Math.min(rawOverall, 0.95) : rawOverall;
      onProgress({ stepIndex: i, stepProgress, overall });
    }
    elapsed += step.durationMs;
  }

  // If the visual loop exited normally (without break) but the parser
  // is still running, hold the user on the last stage with the spinner
  // animating. Without this, an OCR pass that takes 30s would leave
  // them staring at a static "100%" indicator.
  if (!extractionDone) {
    // Polite poll — render a heartbeat tick so framer-motion has
    // something to bind to even though the progress number isn't
    // moving. The UI's spinner is the actual "still working" cue.
    while (!extractionDone) {
      await new Promise((r) => setTimeout(r, 250));
      onProgress({ stepIndex: lastIdx, stepProgress: 0.9, overall: 0.95 });
    }
    onProgress({ stepIndex: lastIdx, stepProgress: 1, overall: 1 });
  }

  const outcome = await extractionPromise;
  const parsedFromFile = outcome.biomarkers !== null;
  // When extraction failed, we still build a Report shape so the
  // ProcessingPage caller has a consistent object to read from — but
  // we DO NOT silently swap in sampleBiomarkers anymore. The caller
  // checks parsedFromFile and routes to an error state (no auto-
  // fallback to demo data, which was the trust-killer bug).
  const biomarkers = outcome.biomarkers ?? [];

  const report: Report = {
    id: `rep-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    lab: parsedFromFile ? 'Parsed from upload' : 'New upload',
    uploadedOn: formatDate(new Date()),
    status: 'ready',
    badge: 'analyzed',
    biomarkers,
  };
  if (parsedFromFile && 'rawText' in outcome) {
    return {
      report,
      biomarkers,
      parsedFromFile: true,
      rawText: outcome.rawText,
      unrecognizedRows: outcome.unrecognizedRows,
    };
  }
  // outcome.biomarkers === null branch — narrow to the failure variant
  // so reason/message are visible to TS.
  if (!('reason' in outcome)) {
    return { report, biomarkers, parsedFromFile: false };
  }
  return {
    report,
    biomarkers,
    parsedFromFile: false,
    failureReason: outcome.reason,
    errorMessage: outcome.message,
    rawText: outcome.rawText,
    unrecognizedRows: outcome.unrecognizedRows,
  };
}

/* ------------------------------------------------------------------ */
/* File validation                                                     */
/* ------------------------------------------------------------------ */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB — generous for lab PDFs
const ACCEPTED_MIME_PREFIXES = ['application/pdf', 'image/'];

export type FileValidationError =
  | { kind: 'empty'; message: string }
  | { kind: 'type'; message: string }
  | { kind: 'size'; message: string };

export type FileValidationResult =
  | { ok: true; file: File }
  | { ok: false; error: FileValidationError };

/**
 * Synchronous validation — runs the moment a file is selected, so the
 * user sees feedback immediately. We don't fake-async this because
 * there's no network involved; pretending there is would just add
 * pointless delay before the error message renders.
 *
 * Previously this gate also ran a "filename looks like a lab report"
 * heuristic (rejected anything not containing one of "report / blood /
 * lab / test / hormone / pdf" in the filename). That was hostile UX —
 * iOS camera-roll uploads (IMG_4421.jpg) and screenshots were all
 * pre-rejected before the parser ever saw them. The parser now self-
 * validates by reporting `no-matches` when it extracts zero markers,
 * which gives the user a real error grounded in actual content — not
 * a guess at the filename. The filename heuristic is gone.
 */
/**
 * iPhone defaults to HEIC for camera photos. Tesseract.js can't decode
 * HEIC in-browser (no native canvas support, no JS HEIC decoder bundled
 * here), so blocking is preferable to a silent OCR failure. The error
 * message points users at the conversion they can do themselves.
 *
 * Some iOS browsers report HEIC files as `image/heic`; some report
 * empty string. Check the filename extension too as a defense.
 */
function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === 'image/heic' || t === 'image/heif') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

export function validateUpload(file: File | null): FileValidationResult {
  if (!file) {
    return {
      ok: false,
      error: { kind: 'empty', message: 'Pick a file to continue.' },
    };
  }
  if (isHeic(file)) {
    return {
      ok: false,
      error: {
        kind: 'type',
        message:
          'HEIC photos aren’t supported yet. Convert to JPEG or PNG (iOS: Photos → Share → Save as JPEG), or upload a PDF.',
      },
    };
  }
  const okType = ACCEPTED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
  if (!okType) {
    return {
      ok: false,
      error: {
        kind: 'type',
        message: 'We can read PDFs and photos of reports. That file type isn’t supported yet.',
      },
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: {
        kind: 'size',
        message: 'That file is over 20 MB — please pick a smaller one.',
      },
    };
  }
  return { ok: true, file };
}
