import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { statusColor, type Biomarker } from '../data/biomarkers';

type Props = {
  marker: Biomarker;
  onClick?: () => void;
  compact?: boolean;
};

export default function BiomarkerBar({ marker, onClick, compact }: Props) {
  const colors = statusColor(marker.status);

  // Compute extended scale to keep the marker visible even at the edges.
  const lo = marker.min;
  const hi = marker.max;
  const span = hi - lo || 1;
  const pad = span * 0.18;
  const scaleLo = lo - pad;
  const scaleHi = hi + pad;
  const scaleSpan = scaleHi - scaleLo || 1;
  const clamp = (v: number) =>
    Math.max(scaleLo + 0.5, Math.min(scaleHi - 0.5, v));
  const dotPct = ((clamp(marker.value) - scaleLo) / scaleSpan) * 100;
  const rangeStartPct = ((lo - scaleLo) / scaleSpan) * 100;
  const rangeEndPct = ((hi - scaleLo) / scaleSpan) * 100;

  const direction = marker.direction ?? 'band';
  const gradientClass =
    direction === 'up'
      ? 'gradient-bar-up'
      : direction === 'down'
        ? 'gradient-bar-down'
        : 'gradient-bar-band';

  const Wrapper: any = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      onClick={onClick}
      whileHover={onClick ? { y: -1 } : undefined}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`w-full text-left rounded-[16px] ${compact ? 'p-4' : 'p-5'} transition-colors ${onClick ? 'hover:bg-canvas/60' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{marker.name}</div>
          <div className="mt-0.5 text-[11px] text-muted uppercase tracking-[0.08em]">
            Healthy range · {marker.min}–{marker.max} {marker.unit}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-[22px] leading-none text-ink">
            {marker.value}
            <span className="text-[12px] ml-1 text-muted font-sans font-medium">
              {marker.unit}
            </span>
          </div>
          <div
            className={`mt-1.5 inline-flex items-center gap-1 px-1.5 h-4 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${colors.bg} ${colors.text}`}
          >
            <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
            {colors.label}
          </div>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="mt-4 relative">
        <div
          className={`h-2.5 w-full rounded-full ${gradientClass} opacity-90`}
        />
        {/* Range bracket markers */}
        <div
          className="absolute -top-0.5 bottom-0 w-px bg-white/70"
          style={{ left: `${rangeStartPct}%` }}
          aria-hidden
        />
        <div
          className="absolute -top-0.5 bottom-0 w-px bg-white/70"
          style={{ left: `${rangeEndPct}%` }}
          aria-hidden
        />
        {/* Marker pointer */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${dotPct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-[2.5px] border-ink shadow-pop"
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        <span>Low</span>
        <span className="text-good">Optimal</span>
        <span>High</span>
      </div>

      {/* What this means */}
      {!compact && (
        <div className="mt-4 pt-4 border-t border-line/70">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
            What this means
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            {marker.plain}
          </p>
          {marker.problemId && onClick && (
            <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-700">
              Open the action plan <ChevronRight size={14} />
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}
