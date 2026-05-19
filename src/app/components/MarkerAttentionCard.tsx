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

type Props = {
  marker: Biomarker;
  onAction?: () => void;
  /** Click handler for the Info button — receives the event so the caller
   *  can capture currentTarget to restore focus when the modal closes. */
  onLearnMore?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

/**
 * The card for Zone 2 ("Markers that need attention") on the dashboard.
 * Shows the value, the trend vs the previous reading, one short
 * action label, and a Learn-More info button (when marker info exists).
 *
 * Action labels are picked per the brief's rules:
 *   - concern + declining → "See an endocrinologist"
 *   - concern + stable    → "Retest in 90 days"
 *   - attention + any     → "Retest in 90 days"
 *   - improving           → "Keep doing what you're doing"
 *   - has problemId       → links to the action plan (overrides above)
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
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="bg-white border border-line/70 rounded-[18px] shadow-soft p-5 h-full flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted truncate">
          {marker.name}
        </div>
        {onLearnMore && (
          <button
            type="button"
            onClick={onLearnMore}
            aria-label={`Learn more about ${marker.name}`}
            title={`Learn more about ${marker.name}`}
            className="-mr-1 -mt-1 grid place-items-center w-7 h-7 rounded-full text-muted hover:text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors"
          >
            <Info size={14} />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[28px] leading-none text-ink">
          {marker.value}
        </span>
        <span className="text-[12.5px] text-muted font-medium">
          {marker.unit}
        </span>
        {trendIcon && delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums ${trendToneCls}`}
            title={prev !== undefined ? `Previously ${prev} ${marker.unit}` : undefined}
          >
            {trendIcon}
            {delta}
          </span>
        )}
      </div>

      <div
        className={`mt-2 inline-flex self-start items-center gap-1 px-1.5 h-4 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${c.bg} ${c.text}`}
      >
        <span className={`w-1 h-1 rounded-full ${c.dot}`} />
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
          // No action plan exists for this marker — render the label as
          // informational guidance, not as a button. Honesty over fake
          // affordance.
          <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-muted self-start">
            <span aria-hidden>·</span>
            {actionLabel}
          </div>
        ))}
    </motion.div>
  );
}
