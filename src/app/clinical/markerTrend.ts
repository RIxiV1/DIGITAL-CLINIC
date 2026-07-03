import {
  getPreviousValue,
  getTrendTone,
  type Biomarker,
} from '../data/biomarkers';

/**
 * Per-marker trend line — the "trend beats a single reading" idea, surfaced
 * on the marker itself.
 *
 * The failure audit's emotionally-powerful case: Vitamin D 22 → 25 → 27 is
 * still below range, but it's improving — and showing only "Low" misses
 * that entirely (and the chance to reinforce progress). The status pill
 * still carries the range verdict; this line carries the MOVEMENT, so the
 * two together read as "still flagged, but heading the right way" without
 * us having to special-case range wording.
 *
 * Direction-aware via the existing getTrendTone (improving = the good way
 * for THIS marker — down for LDL, up for Vitamin D), so it's the single
 * source of truth for what "improving" means. Pure → unit-tested here, and
 * returns null when there's no history or the marker is a both-ends-bad
 * "band" type where a direction can't be called.
 */
export type MarkerTrendNote = {
  tone: 'improving' | 'declining' | 'stable';
  text: string;
};

export function markerTrendNote(marker: Biomarker): MarkerTrendNote | null {
  const tone = getTrendTone(marker);
  // 'neutral' = no history, or a band marker whose direction can't be judged.
  if (tone === 'neutral') return null;

  const prev = getPreviousValue(marker);
  if (prev === undefined) return null;

  const unit = marker.unit ? ` ${marker.unit}` : '';
  const span = `${prev}${unit} → ${marker.value}${unit}`;

  if (tone === 'improving') {
    return { tone, text: `Improving — ${span} since your last test.` };
  }
  if (tone === 'declining') {
    return { tone, text: `Worth watching — ${span} since your last test.` };
  }
  return {
    tone: 'stable',
    text: `Holding steady since your last test (${prev}${unit}).`,
  };
}
