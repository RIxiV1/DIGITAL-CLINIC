import type { Biomarker } from '../../data/biomarkers';

/* ------------------------------------------------------------------ */
/* MarkerRow — confirm-view row layout                                  */
/*                                                                      */
/* Hierarchy: status accent edge (left) → name + reference + mini      */
/* range bar (centre) → value + unit + status pill (right). The accent  */
/* edge is the strongest visual signal — at-risk markers earn a vivid   */
/* left-edge stripe and a soft row tint, "on track" rows stay quiet.    */
/* ------------------------------------------------------------------ */

export default function MarkerRow({
  marker,
  inputValue,
  onValueChange,
  invalid,
  hint,
  showTopBorder,
}: {
  /** The (possibly re-graded) marker — drives status tint + mini-range. */
  marker: Biomarker;
  /** Current string in the editable value field. */
  inputValue: string;
  onValueChange: (next: string) => void;
  /** True when the edited value is empty or wildly out of bounds. */
  invalid: boolean;
  /** Inline correction hint shown under the field when invalid. */
  hint?: string;
  showTopBorder: boolean;
}) {
  const isCritical = marker.status === 'critical';
  const isConcern = marker.status === 'concern';
  const isAttention = marker.status === 'attention';
  // Critical uses the same concern color but a fatter accent edge
  // (visible-from-thumbnail width) — we deliberately don't introduce
  // a new color hue for critical because the existing concern red is
  // already the strongest signal in the design system; doubling it
  // would dilute. The fatter edge + the same-day-care banner above is
  // the differentiator.
  const accentBg =
    isCritical || isConcern
      ? 'bg-concern'
      : isAttention
        ? 'bg-attention'
        : 'bg-transparent';
  const accentWidth = isCritical ? 'w-1.5' : 'w-1';
  // Critical rows get a slightly stronger tint than concern (50 vs 40)
  // so the row reads as "the most important one to look at right now"
  // when scanning a long list.
  const rowTint = isCritical
    ? 'bg-concern-soft/55'
    : isConcern
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
      <div className={`${accentWidth} shrink-0 ${accentBg}`} aria-hidden />
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
            Normal {marker.min}–{marker.max}
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
        {/* Editable value. The confirm gate's whole job is "does this
            number match your report?" — so the number is a field, not
            static text. A misread (0.8 → 8, or a captured reference-range
            limit) gets fixed right here; the row re-grades live and the
            corrected value is what commits. */}
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={inputValue}
              onChange={(e) => onValueChange(e.target.value)}
              aria-label={`${marker.name} value${marker.unit ? ' in ' + marker.unit : ''}`}
              aria-invalid={invalid || undefined}
              className={`w-[5.5rem] h-11 px-2.5 text-right text-body-sm sm:text-body-lg font-display tabular-nums rounded-[12px] focus:outline-none focus:ring-2 transition-colors ${
                invalid
                  ? 'bg-concern-soft border border-concern/60 text-concern focus:ring-concern/40 focus:border-concern'
                  : 'bg-surface border border-line text-ink focus:ring-indigo-400/60 focus:border-indigo-400'
              }`}
            />
            {marker.unit && (
              <span className="text-caption text-muted font-medium w-12 text-left shrink-0">
                {marker.unit}
              </span>
            )}
          </div>
          {hint && (
            <div className="mt-1 text-caption text-concern font-medium leading-snug max-w-[12rem] ml-auto">
              {hint}
            </div>
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
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-surface border-2 border-ink shadow-sm"
        style={{ left: `${pinPct}%` }}
      />
    </div>
  );
}
