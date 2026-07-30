import type { ParsedReport } from '../../services/api';
import type { Biomarker } from '../../data/biomarkers';

/**
 * Shared state shapes for the upload/parse flow, lifted out of
 * ProcessingPage so the orchestrator and the extracted view components
 * reference one definition.
 */

export type FailureState = {
  /** The parser's own reasons, plus two UI-level reasons the parser never
   *  emits, refined from the vague 'no-matches' in ProcessingPage using
   *  what the parser saw:
   *    - 'blank'          — nothing readable (a blank page, or a scan/photo
   *                         too dark or low-res to read).
   *    - 'not-lab-content'— readable text but no lab-value rows (a form, a
   *                         name, a screenshot) — not a blood test.
   *  They live here rather than in ParsedReport['failureReason'] because
   *  the page, not the parser, classifies them. */
  reason:
    | NonNullable<ParsedReport['failureReason']>
    | 'blank'
    | 'not-lab-content';
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
  /** The original uploaded File, preserved across the failure boundary
   *  so the Vision-LLM fallback (Pipeline 3) can re-try the same bytes
   *  without forcing the user to re-upload. Only set when the upload
   *  actually carried a File (the no-file refresh path leaves it
   *  undefined and the AI parser button stays hidden). */
  file?: File;
};

/** Success-but-unconfirmed: the parser produced N markers and we're
 *  waiting on the user to verify before committing the report. */
export type ConfirmState = {
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
  ignoredCategory?:
    | 'viral'
    | 'imaging'
    | 'physical-exam'
    | 'urine'
    | 'product-safety';
  /** OCR diagnostic — non-zero `pagesSkipped` means the user's report
   *  parsed partially. We surface a banner so a partial result isn't
   *  mistaken for a complete one. */
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
  /** Mean OCR confidence (0–100); undefined when no OCR ran. A low value
   *  drives a "double-check these values" banner so a shaky read isn't
   *  presented as authoritative. */
  ocrConfidence?: number;
  /** Set when the raw text mentions WHO 2010 (or the WHO 5th edition).
   *  Our semen-axis catalog scores against WHO 2021 (6th edition); a
   *  report graded against the older reference will surface a verdict
   *  that disagrees with the lab's printed "Low / Normal" call. We
   *  flag this so the confirm view can disclose the standard mismatch
   *  rather than letting the user assume one of us is wrong. */
  semenStandardMismatch?: boolean;
  /** ISO yyyy-mm-dd read off the report header. Committed as the report's
   *  date so a backfilled upload sorts by when the blood was drawn, not by
   *  when it was uploaded. Undefined when the report printed no trustworthy
   *  date — the report then keeps its upload date. */
  collectionDate?: string;
};
