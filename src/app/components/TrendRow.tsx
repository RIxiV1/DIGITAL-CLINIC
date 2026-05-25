import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  formatDelta,
  getPreviousValue,
  getTrend,
  getTrendTone,
  type Biomarker,
} from '../data/biomarkers';
import Sparkline from './Sparkline';

type Props = {
  marker: Biomarker;
  /** Click handler for the Info button — receives the event so the caller
   *  can capture currentTarget to restore focus when the modal closes. */
  onLearnMore?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

/**
 * One row inside a pathway-grouped trends card (Zone 3 on the dashboard).
 * Shows: marker name • current value • delta vs previous • sparkline.
 */
export default function TrendRow({ marker, onLearnMore }: Props) {
  const trend = getTrend(marker);
  const tone = getTrendTone(marker);
  const prev = getPreviousValue(marker);
  const delta = formatDelta(marker);

  const Icon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const toneCls =
    tone === 'improving'
      ? 'text-good'
      : tone === 'declining'
        ? 'text-concern'
        : 'text-muted';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line/60 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-footnote font-semibold text-ink truncate">
            {marker.name}
          </div>
          {onLearnMore && (
            <button
              type="button"
              onClick={onLearnMore}
              aria-label={`Learn more about ${marker.name}`}
              title={`Learn more about ${marker.name}`}
              className="grid place-items-center w-5 h-5 rounded-full text-muted hover:text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-colors"
            >
              <Info size={11} />
            </button>
          )}
        </div>
        {marker.simpleName && (
          <div className="text-eyebrow text-muted leading-tight truncate">
            {marker.simpleName}
          </div>
        )}
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-meta font-display text-ink tabular-nums">
            {marker.value}
          </span>
          <span className="text-eyebrow text-muted">{marker.unit}</span>
          {delta && (
            <span
              className={`inline-flex items-center gap-0.5 text-eyebrow font-bold tabular-nums ${toneCls}`}
              title={prev !== undefined ? `Was ${prev} ${marker.unit}` : undefined}
            >
              <Icon size={10} strokeWidth={2.5} />
              {delta}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <Sparkline marker={marker} width={120} height={36} />
      </div>
    </div>
  );
}
