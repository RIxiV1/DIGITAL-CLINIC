/**
 * Mock async data layer.
 *
 * This file is the seam between the UI and "the network". Pages and
 * contexts that need data should import from here rather than from
 * `../data/*` directly, so the day we point at a real REST/GraphQL
 * endpoint, only this file changes.
 *
 * What lives here:
 *   - async fetchers that simulate realistic clinical-network latency
 *   - mutation helpers (createReport, deleteReport, ...) with the same
 *     shape a real backend would offer
 *   - the multi-step parsing pipeline used by the upload flow
 *
 * What does NOT live here:
 *   - pure presentational helpers (statusColor, summarizeStatuses,
 *     bottomLineFor, etc.) — those don't hit a network and there's no
 *     value in making them async.
 */

import {
  sampleBiomarkers,
  type Biomarker,
} from '../data/biomarkers';
import {
  initialReports,
  sampleReports,
  type Report,
} from '../data/reports';
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
/* Latency simulation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Realistic-feeling jitter for any single "request". A flat constant
 * delay feels fake — real APIs have variance. We sample uniformly in a
 * tight band so most calls feel snappy but not instant.
 */
function jitter(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Wrap a value in a promise that resolves after a randomized delay. */
function withLatency<T>(value: T, min = 220, max = 460): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), jitter(min, max));
  });
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function listReports(): Promise<Report[]> {
  return withLatency([...initialReports]);
}

export async function listSampleReports(): Promise<Report[]> {
  return withLatency([...sampleReports]);
}

export async function getReport(id: string): Promise<Report | null> {
  const found =
    initialReports.find((r) => r.id === id) ??
    sampleReports.find((r) => r.id === id) ??
    null;
  return withLatency(found);
}

export async function getSampleReport(): Promise<Report> {
  return withLatency(sampleReports[0]);
}

/* ------------------------------------------------------------------ */
/* Upload pipeline                                                     */
/* ------------------------------------------------------------------ */

export type ParseStepId = 'metadata' | 'bounds' | 'ocr' | 'align';

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
 * The four diagnostic stages the UI surfaces while a report is being
 * "parsed". The order is deliberate — metadata has to be read before
 * we can locate the value bounds, which has to finish before OCR is
 * meaningful, etc.
 *
 * Copy is intentionally clinical-sounding (talks about reference ranges,
 * panels, alignment) so the user has a credible picture of what the
 * pipeline is doing — even though, today, the pipeline is a UI
 * simulation. When the real backend lands, these labels stay; only the
 * underlying work changes.
 */
export const parseSteps: ParseStep[] = [
  {
    id: 'metadata',
    label: 'Reading PDF metadata',
    detail: 'Reading file headers, page count, and document fingerprint.',
    durationMs: 900,
  },
  {
    id: 'bounds',
    label: 'Locating reference marker bounds',
    detail: 'Finding the table boundaries that contain reference ranges and lab values.',
    durationMs: 950,
  },
  {
    id: 'ocr',
    label: 'OCR Text extraction: found hormone & metabolic panels',
    detail: 'Extracting biomarker names, values, and units from each panel.',
    durationMs: 1100,
  },
  {
    id: 'align',
    label: "Aligning values with ForMen Men's Reference ranges",
    detail: 'Cross-referencing each value against the clinical band library.',
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
    | { biomarkers: Biomarker[] }
    | { biomarkers: null; reason: 'no-file' | 'no-matches' | 'parser-error'; message?: string };

  const extractionPromise: Promise<ExtractionOutcome> =
    input.file &&
    (input.file.type === 'application/pdf' ||
      input.file.type.startsWith('image/'))
      ? parsePdfFile(input.file)
          .then((r): ExtractionOutcome =>
            r.biomarkers.length > 0
              ? { biomarkers: r.biomarkers }
              : { biomarkers: null, reason: 'no-matches' },
          )
          .catch((err: unknown): ExtractionOutcome => ({
            biomarkers: null,
            reason: 'parser-error',
            message: err instanceof Error ? err.message : String(err),
          }))
      : Promise.resolve<ExtractionOutcome>({ biomarkers: null, reason: 'no-file' });

  const totalMs = parseSteps.reduce((sum, s) => sum + s.durationMs, 0);
  let elapsed = 0;

  for (let i = 0; i < parseSteps.length; i++) {
    const step = parseSteps[i];
    const ticks = 24; // smoothness — 24 frames per stage feels fluid
    const tickMs = step.durationMs / ticks;
    for (let t = 1; t <= ticks; t++) {
      await new Promise((r) => setTimeout(r, tickMs));
      const stepProgress = t / ticks;
      const overall = (elapsed + step.durationMs * stepProgress) / totalMs;
      onProgress({ stepIndex: i, stepProgress, overall });
    }
    elapsed += step.durationMs;
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
  if (parsedFromFile) {
    return { report, biomarkers, parsedFromFile: true };
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
  };
}

/* ------------------------------------------------------------------ */
/* File validation                                                     */
/* ------------------------------------------------------------------ */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB — generous for lab PDFs
const ACCEPTED_MIME_PREFIXES = ['application/pdf', 'image/'];

/**
 * Substrings we expect to find in any genuine lab-report filename. The
 * heuristic is intentionally permissive — "pdf" alone qualifies every
 * PDF file, so most legitimate uploads pass. Where it fails is on
 * camera-roll names like "IMG_1234.jpg" or "screenshot.png" that give
 * us no signal at all that the user is uploading a lab document.
 *
 * Used by `validateUpload` to short-circuit before the (expensive,
 * simulated) parsing pipeline runs.
 */
export const LAB_FILENAME_INDICATORS = [
  'report',
  'blood',
  'formen',
  'lab',
  'test',
  'pdf',
  'hormone',
] as const;

export type FileValidationError =
  | { kind: 'empty'; message: string }
  | { kind: 'type'; message: string }
  | { kind: 'size'; message: string }
  | {
      kind: 'unrecognized';
      message: string;
      /** Display-only filename, lowercased for the error copy. */
      filename: string;
    };

export type FileValidationResult =
  | { ok: true; file: File }
  | { ok: false; error: FileValidationError };

/** True if the filename contains at least one indicator string. */
export function isLikelyLabReport(filename: string): boolean {
  const lower = filename.toLowerCase();
  return LAB_FILENAME_INDICATORS.some((needle) => lower.includes(needle));
}

/**
 * Synchronous validation — runs the moment a file is selected, so the
 * user sees feedback immediately. We don't fake-async this because
 * there's no network involved; pretending there is would just add
 * pointless delay before the error message renders.
 *
 * Order matters: empty → type → size → filename heuristic. The
 * heuristic is the LAST gate so the user sees a coherent reason rather
 * than e.g. "your image was rejected for being an image AND for not
 * looking like a report."
 */
export function validateUpload(file: File | null): FileValidationResult {
  if (!file) {
    return {
      ok: false,
      error: { kind: 'empty', message: 'Pick a file to continue.' },
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
  if (!isLikelyLabReport(file.name)) {
    return {
      ok: false,
      error: {
        kind: 'unrecognized',
        filename: file.name,
        message:
          "We couldn’t identify this file as a lab or hormone report. " +
          'The parser looks for lab-style filenames containing words like ' +
          '"report", "blood", "lab", "hormone", or "test".',
      },
    };
  }
  return { ok: true, file };
}
