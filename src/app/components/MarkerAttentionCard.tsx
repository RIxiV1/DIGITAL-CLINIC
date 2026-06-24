import {
  AlertTriangle,
  ArrowRight,
  Info,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  formatDelta,
  getPreviousValue,
  getTrend,
  getTrendTone,
  statusColor,
  type Biomarker,
} from '../data/biomarkers';
import { useCountUp } from '../utils/useCountUp';
import { piecewisePosition, SEGMENT_PCT } from './BiomarkerBar';

type Props = {
  marker: Biomarker;
  onAction?: () => void;
  /** Click handler for the Info button — receives the event so the caller
   *  can capture currentTarget to restore focus when the modal closes. */
  onLearnMore?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Render the marker's plain-English explanation inline. On by default
   *  for the dashboard hero ("the one to focus on") so an anxious reader
   *  gets the *why* without hunting for the (i). The 12-card grid leaves
   *  it off to stay scannable — those cards defer context to the modal. */
  showExplanation?: boolean;
};

/**
 * The Zone 2 attention card on the dashboard. Visual upgrades:
 *  - Coloured edge bar on the left (status colour) so the card's status
 *    reads at a glance without parsing the pill.
 *  - Pulsing status dot replaces the static badge.
 *  - Animated count-up on the value (450ms, respects reduced motion).
 *  - Subtle hover lift + a soft glow tinted by the marker status.
 */
export default function MarkerAttentionCard({
  marker,
  onAction,
  onLearnMore,
  showExplanation = false,
}: Props) {
  const c = statusColor(marker.status);
  const trend = getTrend(marker);
  const tone = getTrendTone(marker);
  const prev = getPreviousValue(marker);
  const delta = formatDelta(marker);

  // Range position — where this value sits relative to the healthy band.
  // Uses the SAME piecewise mapping as the full BiomarkerBar (healthy
  // range = centre third; the low/high thirds scale against the marker's
  // clinical-critical bounds when known, else a 2×-span fallback). That
  // keeps the healthy band visually fixed across wildly different scales
  // AND stops a moderately-out-of-range value from pinning to the very
  // edge — the old 60%-padded linear domain pegged a glucose of 150 to
  // 100% even though it's nowhere near the DKA line.
  const span = marker.max - marker.min;
  const hasRange = Number.isFinite(span) && span > 0;
  const valuePos = hasRange ? piecewisePosition(marker.value, marker) : 0;
  // Healthy band is always the centre third — the point of the piecewise
  // mapping. Labels below are positioned to these same edges so "min" and
  // "max" sit under where the green band actually starts and ends, not at
  // the bar's extremes (which read as the wrong thresholds).
  const bandLeft = SEGMENT_PCT;
  const bandRight = SEGMENT_PCT * 2;

  // Whole numbers count up as ints; decimal markers (e.g. 8.4 free T)
  // animate at one decimal.
  const decimals = Number.isInteger(marker.value) ? 0 : 1;
  const animatedValue = useCountUp(marker.value, { decimals, duration: 500 });

  const trendIcon =
    trend === 'up' ? (
      <TrendingUp size={13} strokeWidth={2.5} />
    ) : trend === 'down' ? (
      <TrendingDown size={13} strokeWidth={2.5} />
    ) : null;

  const trendToneCls =
    tone === 'improving'
      ? 'text-good'
      : tone === 'declining'
        ? 'text-concern'
        : 'text-muted';

  // Edge bar colour mirrors the status. Critical reuses concern red
  // (no new hue introduced — the same-day-care framing comes from copy,
  // not color) but with a fatter edge so the card still pops above
  // concerns when scanning. Attention is amber, good is green.
  const edgeBarColor =
    marker.status === 'critical' || marker.status === 'concern'
      ? 'bg-concern'
      : marker.status === 'attention'
        ? 'bg-attention'
        : 'bg-good';
  const edgeBarWidth = marker.status === 'critical' ? 'w-1.5' : 'w-1';

  // Build the action label. problemId always wins if present — it points
  // at a real action plan inside the app. Critical overrides everything
  // else because same-day-care framing supersedes the 12-week-plan
  // language used for `concern`.
  const actionLabel = (() => {
    if (marker.status === 'critical') return 'Talk to a doctor today';
    if (marker.problemId) return 'Open action plan';
    if (marker.status === 'concern' && tone === 'declining')
      return marker.category === 'hormones'
        ? 'See an endocrinologist'
        : marker.category === 'heart'
          ? 'See a cardiologist'
          : 'See a specialist';
    if (marker.status === 'concern') return 'Retest in 90 days';
    if (marker.status === 'attention') return 'Retest in 90 days';
    if (tone === 'improving') return 'Keep doing what you’re doing';
    return null;
  })();

  // Stretched-link pattern. The card's hover-lift visually suggests
  // clickability, but the card itself can't be a <button> because it
  // already contains nested interactive elements (Info + action). A
  // wrapping <button> would be invalid HTML, ungrab-friendly for screen
  // readers, and break Tab order. Instead the PRIMARY action's ::after
  // pseudo-element is stretched to inset:0 covering the whole card,
  // and the Info button gets z-20 to stay above it. Clicking anywhere
  // on the card triggers the primary action; clicking Info still
  // opens the modal. Only one focusable surface exists per card, so
  // tab order stays clean.
  const stretchClass =
    'relative after:absolute after:inset-0 after:z-10 after:content-[""]';
  const isActionPrimary = !!(actionLabel && onAction);
  const isLearnMorePrimary = !isActionPrimary && !!onLearnMore;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative bg-surface border border-line rounded-lg h-full flex overflow-hidden group focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400"
    >
      {/* Status edge bar */}
      <div className={`${edgeBarWidth} ${edgeBarColor} shrink-0`} aria-hidden />

      <div className="flex-1 p-5 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-micro uppercase tracking-label font-bold text-muted truncate">
              {marker.name}
            </div>
            {marker.simpleName && (
              <div className="text-caption text-ink-soft mt-0.5 truncate">
                {marker.simpleName}
              </div>
            )}
          </div>
          {onLearnMore && (
            <button
              type="button"
              onClick={onLearnMore}
              aria-label={`Learn more about ${marker.name}`}
              title={`Learn more about ${marker.name}`}
              // 48x48 hit area; -mr-3 -mt-3 pulls the larger button into
              // the corner so it doesn't push other card content around.
              // When the action button is the stretched-link primary,
              // Info needs z-20 to stay clickable above it; when Info is
              // primary (no action), it carries the stretched-link itself.
              className={`-mr-3 -mt-3 grid place-items-center w-12 h-12 rounded-full text-muted hover:text-indigo-700 hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors ${
                isLearnMorePrimary ? stretchClass : 'relative z-20'
              }`}
            >
              <Info size={14} />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-sans font-semibold text-display-md leading-none text-ink tabular-nums">
            {animatedValue}
          </span>
          <span className="text-caption text-muted font-medium">
            {marker.unit}
          </span>
          {trendIcon && delta && (
            <span
              className={`inline-flex items-center gap-0.5 text-caption font-bold tabular-nums ${trendToneCls}`}
              title={
                prev !== undefined
                  ? `Previously ${prev} ${marker.unit}`
                  : undefined
              }
            >
              {trendIcon}
              {delta}
            </span>
          )}
        </div>

        {/* Pulsing status indicator + label */}
        <div
          className={`mt-2 inline-flex self-start items-center gap-1.5 px-2 h-5 rounded-full text-micro font-bold uppercase tracking-widest ${c.bg} ${c.text}`}
        >
          {marker.status === 'critical' ? (
            // Critical gets an alert glyph instead of the pulsing dot —
            // the "alert-icon adjacent" treatment statusColor documents
            // but the card never rendered. Weight + meaning (an icon a
            // colour-blind user also reads), not an alarmist red glow.
            <AlertTriangle size={11} strokeWidth={2.75} aria-hidden />
          ) : (
            <span className="relative grid place-items-center w-1.5 h-1.5">
              <span
                className={`absolute inset-0 rounded-full ${c.dot} opacity-60 motion-safe:animate-ping`}
              />
              <span className={`relative w-1.5 h-1.5 rounded-full ${c.dot}`} />
            </span>
          )}
          {c.label}
        </div>

        {/* Range bar — where the value sits vs the healthy band. The band
            is the green segment; the dot is this reading, coloured by
            status. Turns a bare number into a positional read. */}
        {hasRange && (
          <div className="mt-3.5">
            <div className="relative h-2 rounded-full bg-line/50">
              <div
                className="absolute inset-y-0 rounded-full bg-good/25"
                style={{ left: `${bandLeft}%`, right: `${100 - bandRight}%` }}
                aria-hidden
              />
              <div
                className={`absolute top-1/2 w-3 h-3 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-surface ${c.dot}`}
                style={{ left: `${valuePos}%` }}
                aria-hidden
              />
            </div>
            {/* Labels pinned to the band edges (33% / 66%), not the bar
                extremes — so each number sits directly under the healthy
                boundary it names. "healthy" centres between them. */}
            <div className="relative mt-1.5 h-3.5 text-micro text-muted tabular-nums">
              <span
                className="absolute -translate-x-1/2"
                style={{ left: `${bandLeft}%` }}
              >
                {marker.min}
              </span>
              <span
                className="absolute -translate-x-1/2 text-good-ink font-medium normal-case tracking-normal"
                style={{ left: `${(bandLeft + bandRight) / 2}%` }}
              >
                healthy
              </span>
              <span
                className="absolute -translate-x-1/2"
                style={{ left: `${bandRight}%` }}
              >
                {marker.max}
              </span>
            </div>
          </div>
        )}

        {/* Plain-English explanation. Shown on the hero card (the single
            "one to focus on") so the reader gets the *why* in context, not
            via a hunt for the (i). Deliberately OFF in the 12-card grid
            (showExplanation defaults false): a paragraph on every card
            there would turn a scannable list into a wall of text, so those
            cards defer context to the LearnMoreModal. */}
        {showExplanation && marker.plain && (
          <p className="mt-3 text-caption text-ink-soft leading-relaxed">
            {marker.plain}
          </p>
        )}

        {actionLabel &&
          (onAction ? (
            <button
              type="button"
              onClick={onAction}
              // When this button is the primary action, its ::after
              // pseudo-element stretches over the entire card so any
              // click on the card body activates it. Without z-10 the
              // ::after sits below other in-card content; with it the
              // pseudo covers everything except the Info button (z-20).
              className={`mt-4 inline-flex items-center gap-1 text-caption font-semibold text-indigo-700 hover:text-indigo-800 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm ${
                isActionPrimary ? stretchClass : ''
              }`}
            >
              {actionLabel}
              <ArrowRight size={12} />
            </button>
          ) : (
            <div className="mt-4 inline-flex items-center gap-1 text-caption font-medium text-muted self-start">
              <span aria-hidden>·</span>
              {actionLabel}
            </div>
          ))}
      </div>
    </motion.div>
  );
}
