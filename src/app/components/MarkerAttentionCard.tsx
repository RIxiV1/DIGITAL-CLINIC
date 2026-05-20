import { ArrowRight, Info, TrendingDown, TrendingUp } from 'lucide-react';
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

type Props = {
  marker: Biomarker;
  onAction?: () => void;
  /** Click handler for the Info button — receives the event so the caller
   *  can capture currentTarget to restore focus when the modal closes. */
  onLearnMore?: (e: React.MouseEvent<HTMLButtonElement>) => void;
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
}: Props) {
  const c = statusColor(marker.status);
  const trend = getTrend(marker);
  const tone = getTrendTone(marker);
  const prev = getPreviousValue(marker);
  const delta = formatDelta(marker);

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

  // Edge bar colour mirrors the status — concern red, attention amber, etc.
  const edgeBarColor =
    marker.status === 'concern'
      ? 'bg-concern'
      : marker.status === 'attention'
        ? 'bg-attention'
        : 'bg-good';

  // Build the action label. problemId always wins if present — it points
  // at a real action plan inside the app.
  const actionLabel = (() => {
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

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative bg-surface border border-line/70 rounded-[18px] shadow-soft h-full flex overflow-hidden group"
    >
      {/* Status edge bar */}
      <div className={`w-1 ${edgeBarColor} shrink-0`} aria-hidden />

      <div className="flex-1 p-5 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted truncate">
              {marker.name}
            </div>
            {marker.simpleName && (
              <div className="text-[11.5px] text-ink-soft mt-0.5 truncate">
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
              className="-mr-1 -mt-1 grid place-items-center w-7 h-7 rounded-full text-muted hover:text-indigo-700 hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors"
            >
              <Info size={14} />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-[28px] leading-none text-ink tabular-nums">
            {animatedValue}
          </span>
          <span className="text-[12.5px] text-muted font-medium">
            {marker.unit}
          </span>
          {trendIcon && delta && (
            <span
              className={`inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums ${trendToneCls}`}
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
          className={`mt-2 inline-flex self-start items-center gap-1.5 px-2 h-5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${c.bg} ${c.text}`}
        >
          <span className="relative grid place-items-center w-1.5 h-1.5">
            <span
              className={`absolute inset-0 rounded-full ${c.dot} opacity-60 motion-safe:animate-ping`}
            />
            <span className={`relative w-1.5 h-1.5 rounded-full ${c.dot}`} />
          </span>
          {c.label}
        </div>

        <p className="mt-3 text-[12.5px] text-ink-soft leading-relaxed line-clamp-3">
          {marker.plain}
        </p>

        {actionLabel &&
          (onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-700 hover:text-indigo-800 self-start"
            >
              {actionLabel}
              <ArrowRight size={12} />
            </button>
          ) : (
            <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-muted self-start">
              <span aria-hidden>·</span>
              {actionLabel}
            </div>
          ))}
      </div>
    </motion.div>
  );
}
