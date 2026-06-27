import type { Biomarker } from '../data/biomarkers';

/**
 * A calm, report-level answer to the worried-human question "how sure are
 * you about these numbers?" — shown ONCE near the Bottom Line, never as
 * per-card noise.
 *
 * Grounded purely in `ocrConfidence`: values parsed from a digital PDF's
 * text layer never carry it, so a clean read affirms "read directly from
 * your report." Values scanned from a photo do carry it, and dip below 65
 * when the photo was unclear — those are the ones already flagged inline
 * on their cards, so here we just tell the user up front how many to
 * double-check rather than letting them discover it card by card.
 *
 * Pure — depends only on its input — so it's unit-tested in isolation.
 */
export type ProvenanceNote = { tone: 'clean' | 'flagged'; text: string };

export function reportProvenanceNote(
  markers: Pick<Biomarker, 'ocrConfidence'>[],
): ProvenanceNote | null {
  if (markers.length === 0) return null;

  const unclear = markers.filter(
    (m) => typeof m.ocrConfidence === 'number' && m.ocrConfidence < 65,
  ).length;

  if (unclear === 0) {
    return {
      tone: 'clean',
      text: 'Every value here was read directly from your report — no guesswork.',
    };
  }

  return {
    tone: 'flagged',
    text:
      `${unclear} value${unclear === 1 ? '' : 's'} scanned from a photo came ` +
      `through unclear — we’ve flagged ${unclear === 1 ? 'it' : 'them'} below ` +
      `so you can double-check against your report. The rest read cleanly.`,
  };
}
