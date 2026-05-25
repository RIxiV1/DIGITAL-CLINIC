import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { statusColor, type Biomarker } from '../data/biomarkers';

type Props = {
  marker: Biomarker;
  onClick?: () => void;
  compact?: boolean;
};

/* ------------------------------------------------------------------ */
/* Tri-tier classification                                              */
/* ------------------------------------------------------------------ */

type Tier = {
  id: 'optimal' | 'borderline' | 'critical';
  label: string;
  className: string;
  caption: string;
};

/**
 * Map a biomarker's status + optional optimal band into a clinical tier.
 *
 *   - "Optimal"    — value falls inside the marker's optimalMin/optimalMax
 *                    band (when defined), OR status is 'good' and there's
 *                    no narrower optimal band specified.
 *   - "Borderline" — value is inside the healthy range (min..max) but
 *                    outside the optimal sub-band; OR status is
 *                    'attention'.
 *   - "Critical"   — value is outside the healthy range entirely
 *                    (status === 'concern').
 */
function tierFor(marker: Biomarker): Tier {
  if (marker.status === 'concern') {
    return {
      id: 'critical',
      label: 'Critical',
      className: 'bg-concern text-white',
      caption: 'Outside healthy range',
    };
  }

  const hasOptimal =
    typeof marker.optimalMin === 'number' &&
    typeof marker.optimalMax === 'number';
  const inOptimal =
    hasOptimal &&
    marker.value >= (marker.optimalMin as number) &&
    marker.value <= (marker.optimalMax as number);

  if (marker.status === 'attention' || (hasOptimal && !inOptimal)) {
    return {
      id: 'borderline',
      label: 'Borderline',
      className: 'bg-attention text-white',
      caption: hasOptimal
        ? 'Inside healthy band, outside optimal'
        : 'Inside healthy band, room to improve',
    };
  }

  return {
    id: 'optimal',
    label: 'Optimal',
    className: 'bg-good text-white',
    caption: 'Right where it should be',
  };
}

/* ------------------------------------------------------------------ */
/* Piecewise positioning                                                */
/*                                                                      */
/* The bar is divided into three fixed visual segments, each occupying  */
/* exactly one-third of the track:                                      */
/*                                                                      */
/*   [0%       — 33.33%]  Critical-low zone   (criticalLow → min)       */
/*   [33.33%   — 66.66%]  Healthy zone        (min → max)               */
/*   [66.66%   — 100%]    Critical-high zone  (max → criticalHigh)      */
/*                                                                      */
/* This decouples visual position from the absolute clinical scale, so  */
/* a value at the centre of the healthy band always lands at the visual */
/* centre — regardless of whether the band is [4–5.7] (HbA1c) or        */
/* [300–1000] (testosterone). Clinically-skewed ranges read the same    */
/* way at a glance.                                                     */
/* ------------------------------------------------------------------- */

/** Exact one-third of the track. Used both for segment widths and for
 *  the position-mapping math; keeping it in one constant avoids drift. */
const SEGMENT_PCT = 100 / 3;

/**
 * Defensive buffer to stop the pin element from visually clipping past
 * either end of the track. Roughly half the pin's width (8px) on a
 * ~400px bar.
 */
const PIN_BUFFER_PCT = 2;

type CriticalBounds = {
  criticalLow: number;
  criticalHigh: number;
};

/**
 * Critical bounds heuristic — extends the healthy range by one full span
 * on each side, with a guard against the lower bound going negative for
 * markers that can't be negative (mass concentrations, counts, etc).
 *
 * Long-term, the correct fix is to add explicit `criticalLow` and
 * `criticalHigh` fields to the Biomarker schema in
 * src/app/data/biomarkers.ts — the heuristic here is deliberately
 * conservative so it works without that change.
 */
function getCriticalBounds(marker: Biomarker): CriticalBounds {
  const span = marker.max - marker.min || 1;
  const rawCriticalLow = marker.min - span;
  // No biomarker we track can be negative. Floor at 0.
  const criticalLow = Math.max(0, rawCriticalLow);
  const criticalHigh = marker.max + span;
  return { criticalLow, criticalHigh };
}

/**
 * Multi-segment piecewise linear interpolation.
 *
 * Maps a clinical `value` to a visual percentage position on the track
 * by interpolating *inside its own segment* and scaling that segment to
 * one-third of the track width. The pin position is then clamped to a
 * small safe range so the pin element never visually clips off the
 * rounded edges of the bar.
 */
function piecewisePosition(value: number, marker: Biomarker): number {
  const { criticalLow, criticalHigh } = getCriticalBounds(marker);
  const lo = marker.min;
  const hi = marker.max;

  let raw: number;
  if (value <= criticalLow) {
    raw = 0;
  } else if (value < lo) {
    // Segment 1: criticalLow → lo, mapped to [0%, SEGMENT_PCT].
    const denom = lo - criticalLow || 1;
    raw = ((value - criticalLow) / denom) * SEGMENT_PCT;
  } else if (value <= hi) {
    // Segment 2: lo → hi, mapped to [SEGMENT_PCT, 2*SEGMENT_PCT].
    const denom = hi - lo || 1;
    raw = SEGMENT_PCT + ((value - lo) / denom) * SEGMENT_PCT;
  } else if (value < criticalHigh) {
    // Segment 3: hi → criticalHigh, mapped to [2*SEGMENT_PCT, 100%].
    const denom = criticalHigh - hi || 1;
    raw = SEGMENT_PCT * 2 + ((value - hi) / denom) * SEGMENT_PCT;
  } else {
    raw = 100;
  }

  // Defensive bounds guard — pin must not clip off the rounded ends.
  return Math.max(PIN_BUFFER_PCT, Math.min(100 - PIN_BUFFER_PCT, raw));
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function BiomarkerBar({ marker, onClick, compact }: Props) {
  const colors = statusColor(marker.status);
  const tier = tierFor(marker);
  const direction = marker.direction ?? 'band';

  // Healthy-zone boundaries are always at the segment edges, regardless
  // of the absolute clinical scale. That's the entire point of the
  // piecewise mapping — the bar's geometry is constant across markers.
  const lowBoundaryPct = SEGMENT_PCT;
  const highBoundaryPct = SEGMENT_PCT * 2;

  const pinPct = piecewisePosition(marker.value, marker);

  // Optimal-band overlay. Clamp to [min, max] so a misconfigured
  // optimal range that spills outside healthy doesn't render an
  // optimal strip in the critical zone (would be visually misleading).
  const hasOptimal =
    typeof marker.optimalMin === 'number' &&
    typeof marker.optimalMax === 'number';
  const optMinClamped = hasOptimal
    ? Math.max(marker.min, marker.optimalMin as number)
    : 0;
  const optMaxClamped = hasOptimal
    ? Math.min(marker.max, marker.optimalMax as number)
    : 0;
  const optimalStartPct = hasOptimal
    ? piecewisePosition(optMinClamped, marker)
    : 0;
  const optimalEndPct = hasOptimal
    ? piecewisePosition(optMaxClamped, marker)
    : 0;

  // Three-zone gradient. Colors lean on the marker's direction:
  //   - "up is better"   — low side concern, high side attention
  //                        (overcorrection is rarely catastrophic).
  //   - "down is better" — high side concern, low side attention
  //                        (deficiency exists but isn't the primary
  //                        clinical risk for a "lower is better" marker).
  //   - "band"           — both extremes equally concerning.
  const lowZone =
    direction === 'down'
      ? 'var(--color-attention-soft, #FEF3C7)'
      : 'var(--color-concern-soft, #FEE2E2)';
  const highZone =
    direction === 'up'
      ? 'var(--color-attention-soft, #FEF3C7)'
      : 'var(--color-concern-soft, #FEE2E2)';
  const midZone = 'var(--color-good-soft, #DCFCE7)';

  const zoneGradient =
    `linear-gradient(to right, ` +
    `${lowZone} 0%, ${lowZone} ${SEGMENT_PCT}%, ` +
    `${midZone} ${SEGMENT_PCT}%, ${midZone} ${SEGMENT_PCT * 2}%, ` +
    `${highZone} ${SEGMENT_PCT * 2}%, ${highZone} 100%)`;

  const wrapperClasses = `w-full text-left rounded-[16px] ${compact ? 'p-4' : 'p-5'} transition-colors ${onClick ? 'hover:bg-canvas/60' : ''}`;

  const body = (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{marker.name}</div>
          {marker.simpleName && (
            <div className="text-caption text-ink-soft mt-0.5 truncate">
              {marker.simpleName}
            </div>
          )}
          <div className="mt-1 text-caption text-muted uppercase tracking-[0.08em]">
            Healthy range · {marker.min}–{marker.max} {marker.unit}
            {hasOptimal && (
              <>
                {' · '}
                <span className="text-good">
                  Optimal {marker.optimalMin}–{marker.optimalMax}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-display-md leading-none text-ink">
            {marker.value}
            <span className="text-caption ml-1 text-muted font-sans font-medium">
              {marker.unit}
            </span>
          </div>
          {/* Tri-tier tag — Optimal / Borderline / Critical. */}
          <div
            className={`mt-1.5 inline-flex items-center gap-1 px-2 h-5 rounded-full text-micro font-bold uppercase tracking-[0.1em] ${tier.className}`}
            aria-label={`${tier.label}: ${tier.caption}`}
          >
            {tier.label}
          </div>
          <div
            className={`mt-1 text-micro uppercase tracking-[0.1em] font-bold ${colors.text}`}
          >
            {colors.label}
          </div>
        </div>
      </div>

      {/* Piecewise zone bar — a single relative parent containing:
            1. The gradient track (overflow-hidden so optimal overlay
               and the gradient stops respect rounded corners)
            2. Boundary tick marks (siblings of the track so they can
               extend slightly above/below it)
            3. The value pin (sibling of the track so its shadow and
               vertical overhang aren't clipped by overflow-hidden)
          aria-valuenow is the *clinical* value, not the visual pct,
          so screen readers announce something meaningful. */}
      <div
        className="mt-4 relative"
        role="progressbar"
        aria-label={`${marker.name} position within reference range`}
        aria-valuemin={getCriticalBounds(marker).criticalLow}
        aria-valuemax={getCriticalBounds(marker).criticalHigh}
        aria-valuenow={marker.value}
        aria-valuetext={`${marker.value} ${marker.unit} — ${tier.label}`}
      >
        <div
          className="h-2.5 w-full rounded-full overflow-hidden relative"
          style={{ background: zoneGradient }}
          aria-hidden
        >
          {/* Optimal-zone overlay (when defined) — sits on top of the
              middle healthy segment to indicate the inner ideal band. */}
          {hasOptimal && optimalEndPct > optimalStartPct && (
            <div
              className="absolute inset-y-0 bg-good/35 ring-1 ring-good/40"
              style={{
                left: `${optimalStartPct}%`,
                width: `${Math.max(0, optimalEndPct - optimalStartPct)}%`,
              }}
            />
          )}
        </div>

        {/* Healthy-range boundary tick marks at the fixed segment edges. */}
        <div
          aria-hidden
          className="absolute -top-0.5 bottom-0 w-px bg-white/70"
          style={{ left: `${lowBoundaryPct}%` }}
        />
        <div
          aria-hidden
          className="absolute -top-0.5 bottom-0 w-px bg-white/70"
          style={{ left: `${highBoundaryPct}%` }}
        />

        {/* Value pin — animates in from 0% on mount; defensive clamp in
            piecewisePosition keeps it visually inside the track. */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${pinPct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-[2.5px] border-ink shadow-pop"
          aria-hidden
        />
      </div>

      <div className="mt-2 flex justify-between text-micro font-semibold uppercase tracking-[0.08em] text-muted">
        <span>Critical low</span>
        <span className="text-good">Healthy</span>
        <span>Critical high</span>
      </div>

      {/* Tier caption — explicit clinical-ish gloss for users who don't
          read the pill colour as meaning. */}
      <div className="mt-2 text-caption text-ink-soft">
        <span className="font-semibold text-ink">{tier.label}.</span>{' '}
        {tier.caption}.
      </div>

      {/* What this means */}
      {!compact && (
        <div className="mt-4 pt-4 border-t border-line/70">
          <div className="text-micro font-bold uppercase tracking-[0.14em] text-indigo-700">
            What this means
          </div>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-soft">
            {marker.plain}
          </p>
          {marker.problemId && onClick && (
            <div className="mt-3 inline-flex items-center gap-1 text-caption font-semibold text-indigo-700">
              Open the action plan <ChevronRight size={14} />
            </div>
          )}
        </div>
      )}
    </>
  );

  // Render as a real <button> when clickable — keyboard-navigable and
  // announced correctly to screen readers — otherwise as a plain <div>.
  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={wrapperClasses}
      >
        {body}
      </motion.button>
    );
  }

  return <div className={wrapperClasses}>{body}</div>;
}
