import {
  getTemplateById,
  statusForValue,
  type Biomarker,
} from '../data/biomarkers';

/**
 * Logic for the editable confirm gate (ProcessingPage's
 * ConfirmExtractedValuesView). Extracted from the component so the
 * safety-critical re-grade behaviour is unit-testable in isolation —
 * this decides what value commits after a user corrects an OCR misread,
 * so it earns direct test coverage rather than living inline in JSX.
 */

export type EditState = 'unedited' | 'empty' | 'out-of-range' | 'ok';

/**
 * Validity of an edited value field.
 *
 *   'unedited'     — raw is undefined (the user hasn't touched the field)
 *   'empty'        — blank, whitespace, or non-numeric (mid-edit keystroke)
 *   'out-of-range' — beyond ±5× the healthy span (a double-strike typo:
 *                    440 instead of 40); mirrors ManualEntryPage +
 *                    pdfParser so a manual correction can't commit a
 *                    wildly impossible value the parser would have dropped
 *   'ok'           — a plausible, in-bounds number
 */
export function editStateOf(
  marker: Pick<Biomarker, 'min' | 'max'>,
  raw: string | undefined,
): EditState {
  if (raw === undefined) return 'unedited';
  const trimmed = raw.trim();
  if (!trimmed) return 'empty';
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) return 'empty';
  const span = marker.max - marker.min || 1;
  if (num < marker.min - 5 * span || num > marker.max + 5 * span) {
    return 'out-of-range';
  }
  return 'ok';
}

/**
 * Re-grade a marker against an edited value string, preserving every
 * other field — history, the lab's printed range, critical bounds, plain
 * text — so a correction only ever changes `value` + `status`. Status is
 * recomputed against the lab's printed range when present (same priority
 * `statusForValue` uses everywhere), else the catalog band.
 *
 * Only a valid, in-bounds edit takes effect; anything else (an empty or
 * mid-edit-invalid field, or an out-of-range typo) returns the marker
 * UNCHANGED — so a partial keystroke can never commit a NaN or a broken
 * number, and the gate always has a validated value to compute.
 */
export function regradeMarker(
  marker: Biomarker,
  raw: string | undefined,
): Biomarker {
  if (editStateOf(marker, raw) !== 'ok') return marker;
  const num = parseFloat((raw as string).trim());
  const template = getTemplateById(marker.id);
  const labRef =
    typeof marker.labRefMin === 'number' &&
    typeof marker.labRefMax === 'number'
      ? { min: marker.labRefMin, max: marker.labRefMax }
      : undefined;
  const status = template
    ? statusForValue(template, num, labRef)
    : marker.status;
  return { ...marker, value: num, status };
}
