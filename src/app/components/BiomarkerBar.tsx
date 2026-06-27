import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { statusColor, type Biomarker } from '../data/biomarkers';
import { markerTrendNote } from '../clinical';

type Props = {
  marker: Biomarker;
  onClick?: () => void;
  compact?: boolean;
  /** Optional context-aware note tying this marker to something the user
   *  told us in the quiz (a disclosed condition, their activity level).
   *  Computed by the caller via `markerContextNote` so this component
   *  stays presentational and the note logic stays unit-tested. */
  contextNote?: string | null;
};

/* ------------------------------------------------------------------ */
/* Tri-tier classification                                              */
/* ------------------------------------------------------------------ */

type Tier = {
  id: 'optimal' | 'borderline' | 'concern' | 'critical';
  label: string;
  className: string;
  caption: string;
};

/**
 * Map a biomarker's status + optional optimal band into a clinical tier.
 *
 *   - "Optimal"      — value falls inside the marker's
 *                      optimalMin/optimalMax band (when defined), OR
 *                      status is 'good' and there's no narrower optimal
 *                      band specified.
 *   - "Borderline"   — value is inside the healthy range (min..max) but
 *                      outside the optimal sub-band; OR status is
 *                      'attention'.
 *   - "Out of range" — value is outside healthy but within
 *                      clinically-reasonable abnormal range
 *                      (status === 'concern'). 12-week-plan copy.
 *   - "See a doctor" — value is in the critical band (severe
 *                      hypoglycemia, K+ >6, platelet <50k, etc.).
 *                      Same-day-care copy.
 */
function tierFor(marker: Biomarker): Tier {
  if (marker.status === 'critical') {
    return {
      id: 'critical',
      label: 'See a doctor',
      className: 'bg-concern text-on-status',
      caption: 'Same-day medical attention is appropriate',
    };
  }
  if (marker.status === 'concern') {
    return {
      id: 'concern',
      // Renamed from "Critical" to "Out of range" — the prior label was
      // overclaiming severity for borderline-abnormal readings, and now
      // a true `critical` tier exists for the same-day cases.
      label: 'Out of range',
      className: 'bg-concern/85 text-on-status',
      caption: 'Outside healthy range — worth a follow-up',
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
      className: 'bg-attention text-on-status',
      caption: hasOptimal
        ? 'Inside healthy band, outside optimal'
        : 'Inside healthy band, room to improve',
    };
  }

  return {
    id: 'optimal',
    label: 'Optimal',
    className: 'bg-good text-on-status',
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
 *  the position-mapping math; keeping it in one constant avoids drift.
 *  Exported so the dashboard's MarkerAttentionCard mini-bar places its
 *  value dot with the SAME piecewise math — one source of truth means
 *  the two bars can't disagree about where a value sits. */
export const SEGMENT_PCT = 100 / 3;

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
 * Critical bounds for the bar's high/low zones.
 *
 * Prefers the marker's EXPLICIT `criticalLow`/`criticalHigh` (propagated
 * from the catalog template via markerFromTemplate) — these are the real
 * same-day-care thresholds (glucose 250, HbA1c 10, etc.), so the value
 * pin lands at the spot that reflects how far it is from the *emergency*
 * line, not the healthy edge. Without that, a diabetic-but-not-acute
 * glucose of 150 used to peg to the very end of the track.
 *
 * Fallback (markers with no documented panic value): extend the healthy
 * range by TWO full spans on each side. Two, not one — a single span put
 * an only-mildly-out-of-range value deep in the terminal zone, reading as
 * "maxed out" when it wasn't. The lower bound is floored at 0 (no marker
 * we track can be negative).
 */
function getCriticalBounds(marker: Biomarker): CriticalBounds {
  const span = marker.max - marker.min || 1;
  const criticalLow =
    typeof marker.criticalLow === 'number'
      ? marker.criticalLow
      : Math.max(0, marker.min - 2 * span);
  const criticalHigh =
    typeof marker.criticalHigh === 'number'
      ? marker.criticalHigh
      : marker.max + 2 * span;
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
export function piecewisePosition(value: number, marker: Biomarker): number {
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

export default function BiomarkerBar({
  marker,
  onClick,
  compact,
  contextNote,
}: Props) {
  const colors = statusColor(marker.status);
  const tier = tierFor(marker);
  const direction = marker.direction ?? 'band';
  // Trend beats a single reading — show movement (and reinforce progress)
  // when the marker carries history. The status pill keeps the range
  // verdict; this carries the direction, so "still flagged but improving"
  // reads naturally without special-casing.
  const trendNote = markerTrendNote(marker);

  // Healthy-zone boundaries are always at the segment edges, regardless
  // of the absolute clinical scale. That's the entire point of the
  // piecewise mapping — the bar's geometry is constant across markers.
  const lowBoundaryPct = SEGMENT_PCT;
  const highBoundaryPct = SEGMENT_PCT * 2;

  const pinPct = piecewisePosition(marker.value, marker);

  // Harm-anchor — the cited clinical action threshold (e.g. the diabetes
  // diagnostic line). Rendered ONLY for out-of-range markers that carry a
  // CITED threshold, never a fabricated one. A static tick (no animation)
  // keeps it composite-safe. Positioned with the same piecewisePosition
  // math as everything else so it stays aligned across skewed lab scales.
  // Shows an out-of-range value sitting below the line as "elevated, not
  // yet at the action point" (Zikmund-Fisher et al., JMIR 2018).
  const actionValue =
    typeof marker.actionMax === 'number'
      ? marker.actionMax
      : typeof marker.actionMin === 'number'
        ? marker.actionMin
        : undefined;
  const showActionAnchor =
    actionValue !== undefined &&
    !!marker.actionSource &&
    (marker.status === 'concern' || marker.status === 'critical');
  const actionAnchorPct = showActionAnchor
    ? piecewisePosition(actionValue as number, marker)
    : 0;

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

  // Padding ramp on the card body. The old `p-5` (20px all sides)
  // ate ~40px of horizontal real estate on a 360px-wide phone, which
  // — combined with the Container's outer px-5 and the category Card
  // chrome — left only ~240px for the gradient bar + its three
  // "CRITICAL LOW / HEALTHY / CRITICAL HIGH" labels. The right
  // "CRITICAL HIGH" label was getting clipped on small phones because
  // tracking-widest uppercase chars don't fit in what's left. Drop to
  // p-4 (16px) on mobile so the bar and labels recover ~8px on each
  // side; sm+ keeps the original p-5 where there's room to spare.
  const wrapperClasses = `w-full text-left rounded-[16px] ${compact ? 'p-4' : 'p-4 sm:p-5'} transition-colors ${onClick ? 'hover:bg-canvas/60' : ''}`;

  const body = (
    <>
      {/* Header row.
       *  - `min-w-0` on the LEFT column lets long marker names and the
       *    healthy-range strip shrink instead of pushing the right
       *    column past the viewport edge.
       *  - `gap-2 sm:gap-3` tightens horizontal gap on phones so the
       *    right-aligned value + tier pill keep visible breathing room.
       *  - The healthy-range line was previously
       *    `uppercase tracking-widest` — on a 360-wide phone with an
       *    optimal sub-band appended, that single line could measure
       *    wider than the card's inner content area and force a
       *    horizontal-scroll on the whole page (no `min-w-0` on the
       *    flex parent meant intrinsic content width leaked upward).
       *    Drop the tracking on mobile and let it wrap naturally. */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink truncate">{marker.name}</div>
          {marker.simpleName && (
            <div className="text-caption text-ink-soft mt-0.5 truncate">
              {marker.simpleName}
            </div>
          )}
          <div className="mt-1 text-caption text-muted uppercase tracking-wide sm:tracking-widest break-words">
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
        <div className="text-right shrink-0 min-w-0">
          <div className="font-sans font-semibold text-display-md leading-none text-ink tabular-nums">
            {/* Dashed underline flags a unit conversion — the receipt below
                ("What this means") explains it. Native title for a quick
                hover hint; the full note is always there for tap/read. */}
            {marker.originalValue !== undefined && marker.originalUnit ? (
              <span
                className="border-b border-dashed border-muted/60"
                title={`Lab printed ${marker.originalValue} ${marker.originalUnit}, converted to standard units`}
              >
                {marker.value}
              </span>
            ) : typeof marker.ocrConfidence === 'number' &&
              marker.ocrConfidence < 65 ? (
              <span
                className="border-b border-dashed border-attention/70"
                title="Read from a photo, double-check this number against your report"
              >
                {marker.value}
              </span>
            ) : (
              marker.value
            )}
            <span className="text-caption ml-1 text-muted font-sans font-medium">
              {marker.unit}
            </span>
          </div>
          {/* Single status badge. Previously this rendered TWO pills — a
              tier tag ("Out of range") AND the status label ("NEEDS
              CARE") — two words for the same axis stacked on top of each
              other. Collapsed to one pill in the app-wide status
              vocabulary (statusColor.label); the position nuance the tier
              carried (optimal vs borderline, how far out of range) now
              lives in the zone bar + the caption below, not a competing
              second pill. */}
          <div
            className={`mt-1.5 inline-flex items-center gap-1 px-2 h-5 rounded-full text-micro font-bold uppercase tracking-widest ${colors.bg} ${colors.text}`}
            aria-label={`${colors.label}: ${tier.caption}`}
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

        {/* Healthy-range boundary tick marks at the fixed segment edges.
            Use a theme-adaptive ink divider, NOT white: the zone pastels
            (concern-soft red vs good-soft green) sit at near-identical
            luminance, so white/70 ticks washed out — invisibly so in light
            theme (white on a light pastel), and hard to perceive for
            protanopia/deuteranopia or under outdoor glare. An ink-based
            tick contrasts against the pastels in BOTH themes, so the
            healthy-zone boundaries read as structure regardless of colour
            perception. The "Low/Healthy/High" labels below remain the
            primary non-colour cue; this just makes the bar itself legible. */}
        <div
          aria-hidden
          className="absolute -top-0.5 bottom-0 w-px bg-ink/40"
          style={{ left: `${lowBoundaryPct}%` }}
        />
        <div
          aria-hidden
          className="absolute -top-0.5 bottom-0 w-px bg-ink/40"
          style={{ left: `${highBoundaryPct}%` }}
        />

        {/* Harm-anchor — dashed neutral tick at the cited clinical action
            threshold. Static (no animation) so it stays on the compositor;
            neutral ink (NOT concern-red) because its job is to REDUCE
            alarm, not add it. Taller than the boundary ticks so it reads
            as a distinct reference. */}
        {showActionAnchor && (
          <div
            aria-hidden
            className="absolute -top-1.5 bottom-0 border-l border-dashed border-ink-soft/70"
            style={{ left: `${actionAnchorPct}%` }}
          />
        )}

        {/* Value pin — animates in from 0% on mount; defensive clamp in
            piecewisePosition keeps it visually inside the track. */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${pinPct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-surface border-[2.5px] border-ink shadow-pop"
          aria-hidden
        />
      </div>

      {/* Bar-zone labels.
       *  Previously: three full "CRITICAL LOW / HEALTHY / CRITICAL HIGH"
       *  labels in uppercase tracking-widest. The combined min-content
       *  width (~225px) plus letter-spacing was wider than the card's
       *  inner area on small phones, which pushed the rightmost
       *  "CRITICAL HIGH" label off the visible viewport. Two changes:
       *    1. Drop the labels to short "LOW / HEALTHY / HIGH" on mobile
       *       (`sm:` restores the long form where there's room).
       *    2. Tighten letter-spacing on mobile (`tracking-wide` not
       *       `tracking-widest`) so the labels can't push the page
       *       wider than viewport. */}
      <div className="mt-2 flex justify-between text-micro font-semibold uppercase tracking-wide sm:tracking-widest text-muted gap-2">
        <span className="truncate">
          <span className="sm:hidden">Low</span>
          <span className="hidden sm:inline">Critical low</span>
        </span>
        <span className="text-good truncate">Healthy</span>
        <span className="truncate text-right">
          <span className="sm:hidden">High</span>
          <span className="hidden sm:inline">Critical high</span>
        </span>
      </div>

      {/* Position gloss — plain-English "where this sits" line. Used to
          lead with the tier label ("Out of range."), but that restated
          the status pill in a second vocabulary; now it's just the
          descriptive caption so there's one status word per card. */}
      <div className="mt-2 text-caption text-ink-soft">{tier.caption}.</div>

      {/* Trend line — movement since the last test, direction-aware.
          Improving reads green (reinforce progress); declining is a calm
          amber "worth watching", never alarm; steady is quiet. */}
      {trendNote && (
        <div
          className={`mt-1 text-caption font-medium ${
            trendNote.tone === 'improving'
              ? 'text-good'
              : trendNote.tone === 'declining'
                ? 'text-attention-ink'
                : 'text-muted'
          }`}
        >
          {trendNote.text}
        </div>
      )}

      {/* What this means */}
      {!compact && (
        <div className="mt-4 pt-4 border-t border-line/70">
          <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
            What this means
          </div>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-soft">
            {marker.plain}
          </p>
          {/* Context-aware note — ties this marker to what the user told
              us in the quiz (a disclosed condition, their training load).
              A left border + "Based on your answers" label marks it as
              personal context, distinct from the generic clinical copy
              above. The note ADDS context and always points toward the
              doctor; it never tells the user a flagged value is fine
              (and markerContextNote suppresses the benign-flavoured note
              on critical readings). */}
          {contextNote && (
            <div className="mt-2.5 border-l-2 border-l-indigo-300 pl-3">
              <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
                Based on your answers
              </div>
              <p className="mt-1 text-caption leading-snug text-ink-soft">
                {contextNote}
              </p>
            </div>
          )}
          {/* Unit-reconciliation receipt. Shown only when the parser
              rescaled the lab's printed number into canonical units (Indian
              count prefixes like lakh/thou/million per cumm). Reassures the
              user we didn't invent a different number — same result, standard
              unit. Indian digit grouping (en-IN) on the converted value. */}
          {marker.originalValue !== undefined && marker.originalUnit && (
            <p className="mt-2.5 text-micro text-muted leading-snug">
              <span className="font-semibold text-ink-soft">Unit converted.</span>{' '}
              Your lab printed{' '}
              <span className="font-mono text-ink-soft">
                {marker.originalValue} {marker.originalUnit}
              </span>
              . We show{' '}
              <span className="font-mono text-ink-soft">
                {marker.value.toLocaleString('en-IN')} {marker.unit}
              </span>
              , the standard unit. Same result.
            </p>
          )}
          {/* OCR low-confidence flag. Shown only for values read off a photo
              / scanned PDF whose OCR confidence fell below the threshold —
              so the user double-checks the SPECIFIC unclear numbers, not the
              whole report. Digital-text reads never carry ocrConfidence, so
              they never flag. */}
          {typeof marker.ocrConfidence === 'number' &&
            marker.ocrConfidence < 65 && (
              <p className="mt-2.5 text-micro text-attention-ink leading-snug">
                <span className="font-semibold">Read from a photo.</span> This
                number was scanned and the photo was a little unclear.
                Double-check it against your report.
              </p>
            )}
          {/* Harm-anchor explanation — ties the dashed tick to its cited
              clinical meaning. Gated on the same condition as the tick, so
              an uncited or in-range marker shows nothing (no fabricated
              clinical claim). The framing reduces over-triage: above the
              healthy range but left of this line is the borderline zone,
              distinct from the diagnostic/treatment threshold. */}
          {showActionAnchor && marker.actionSource && (
            <p className="mt-2.5 text-micro text-muted leading-snug">
              <span className="font-semibold text-ink-soft">
                The dashed marker
              </span>{' '}
              is {marker.actionSource.label} — being above the healthy range but
              to its left is the borderline zone, not the action point.
              {marker.actionSource.url && (
                <>
                  {' · '}
                  <a
                    href={marker.actionSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
                  >
                    source
                  </a>
                </>
              )}
            </p>
          )}
          {/* Range disclosure — when the parser captured the lab's
              printed range, that range is what we score against
              (the audit's "trust the diagnosing pathologist's range
              over the hardcoded standard" directive). The catalog's
              range becomes the fallback we'd use if the lab hadn't
              printed one. The optimal sub-band — when set — is a
              separate long-term-outcome target the catalog owns. */}
          {typeof marker.labRefMin === 'number' &&
            typeof marker.labRefMax === 'number' && (
              <div className="mt-2.5 rounded-[8px] border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-micro leading-snug">
                <div className="font-semibold text-ink-soft">
                  Status uses your lab's printed range
                </div>
                <div className="mt-0.5 text-muted">
                  <span className="font-medium text-ink-soft">
                    {marker.labRefMin}–{marker.labRefMax}
                    {marker.unit ? ` ${marker.unit}` : ''}
                  </span>{' '}
                  (your lab) · Digital Clinic's catalog {marker.min}–
                  {marker.max}
                  {marker.unit ? ` ${marker.unit}` : ''} would have been used if
                  your lab hadn't printed a range. We trust the pathologist who
                  signed your report over our hardcoded defaults when the two
                  disagree.
                </div>
              </div>
            )}
          {/* Optimal-range citation. Required by convention on every
              marker that defines an optimal sub-range — without it,
              users have no way to tell our optimal claim apart from a
              synthetic score, and the whole feature stops being
              trustworthy. Rendered small (text-micro) so it reads as
              a footnote, not the headline. Audience defaults to
              "adults" when unspecified — the field exists for
              templates where the range only applies to a narrower
              cohort (e.g. testosterone is men-specific). */}
          {marker.optimalSource && (
            <>
              <p className="mt-2.5 text-micro text-muted leading-snug">
                <span className="font-semibold text-ink-soft">
                  Optimal range
                </span>
                {marker.optimalSource.audience
                  ? ` (${marker.optimalSource.audience}): `
                  : ': '}
                {marker.optimalSource.label}
                {marker.optimalSource.url && (
                  <>
                    {' · '}
                    <a
                      href={marker.optimalSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
                    >
                      source
                    </a>
                  </>
                )}
              </p>
              {/* Sub-clinical disclaimer. Without this, a "Borderline"
                  flag on a value that sits comfortably inside the
                  lab's "Normal" range reads as a contradiction and
                  drives triage anxiety. The copy explicitly separates
                  the two range concepts: the lab's clinical reference
                  (the floor of "abnormal enough to investigate") vs.
                  our optimal sub-band (the band associated with
                  lowest-risk outcomes in cohort studies). One says
                  "you're not sick"; the other says "you're not at
                  the sweet spot yet." */}
              <p className="mt-2 text-micro text-muted/90 leading-snug italic">
                A value inside your lab's "Normal" range but outside this
                optimal sub-band isn't a sign of disease — it's a
                long-term-outcome nudge, not a clinical alarm.
              </p>
            </>
          )}
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
