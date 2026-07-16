import { Info, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react';
import {
  formatDelta,
  getPreviousValue,
  getTrajectory,
  getTrend,
  getTrendTone,
  type Biomarker,
} from '../data/biomarkers';
import Sparkline from './ui/Sparkline';

type Props = {
  marker: Biomarker;
  /** Upload date of the report this marker came from (ISO yyyy-mm-dd).
   *  Anchors the trajectory projection in real time; omit to hide it. */
  asOf?: string;
  /** Click handler for the Info button — receives the event so the caller
   *  can capture currentTarget to restore focus when the modal closes. */
  onLearnMore?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

/**
 * One row inside a pathway-grouped trends card (Zone 3 on the dashboard).
 * Shows: marker name • current value • delta vs previous • sparkline.
 */
export default function TrendRow({ marker, asOf, onLearnMore }: Props) {
  const trend = getTrend(marker);
  const tone = getTrendTone(marker);
  const prev = getPreviousValue(marker);
  const delta = formatDelta(marker);

  // Forward projection. Only surfaced when the marker is out of band and
  // either closing on it or drifting away — "within" / "holding" carry no
  // forward-looking news worth a line. The band label tracks which range
  // the projection targets (optimal sub-range vs healthy min/max) so the
  // copy never says "healthy" when it means the tighter optimal band.
  const trajectory = getTrajectory(marker, asOf);
  const hasOptimal =
    typeof marker.optimalMin === 'number' &&
    typeof marker.optimalMax === 'number';
  const bandLabel = hasOptimal ? 'optimal range' : 'healthy range';
  const showTrajectory =
    !!trajectory &&
    (trajectory.movement === 'toward' || trajectory.movement === 'away');

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
          <div className="text-caption font-semibold text-ink truncate">
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
          <div className="text-micro text-muted leading-tight truncate">
            {marker.simpleName}
          </div>
        )}
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-caption font-display text-ink tabular-nums">
            {marker.value}
          </span>
          <span className="text-micro text-muted">{marker.unit}</span>
          {delta && (
            <span
              className={`inline-flex items-center gap-0.5 text-micro font-bold tabular-nums ${toneCls}`}
              title={
                prev !== undefined ? `Was ${prev} ${marker.unit}` : undefined
              }
            >
              <Icon size={10} strokeWidth={2.5} />
              {delta}
            </span>
          )}
        </div>
        {showTrajectory && trajectory && (
          <div
            className={`mt-1 inline-flex items-center gap-1 text-micro font-semibold leading-tight ${
              trajectory.movement === 'toward' ? 'text-good' : 'text-concern'
            }`}
          >
            <Target size={10} strokeWidth={2.5} aria-hidden />
            <span>
              {trajectory.movement === 'toward'
                ? trajectory.monthsToTarget
                  ? `At this pace, in your ${bandLabel} in ~${trajectory.monthsToTarget} ${
                      trajectory.monthsToTarget === 1 ? 'month' : 'months'
                    }`
                  : `Trending toward your ${bandLabel}`
                : `Trending away from your ${bandLabel}`}
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Sparkline marker={marker} width={120} height={36} />
      </div>
    </div>
  );
}
