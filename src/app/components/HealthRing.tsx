import { motion } from 'framer-motion';
import { useMemo } from 'react';

type Props = {
  good: number;
  attention: number;
  concern: number;
  size?: number;
  /** Stroke thickness in pixels (visible width of the ring). */
  thickness?: number;
  /** 'card' (default) for ink/muted text. 'onDark' for white text when
   *  the ring sits on a gradient hero. */
  tone?: 'card' | 'onDark';
  className?: string;
};

/**
 * A radial ring split into three arcs that show the actual marker
 * breakdown — green = on track, amber = needs a look, red = needs care.
 * No invented composite "Health Score" — the arcs literally encode
 * good/attention/concern as proportions of the total. Centre label
 * shows "good of total" so the meaning is verifiable at a glance.
 *
 * Built as one SVG with three stroke-dasharray segments that animate in
 * sequentially on mount via framer-motion.
 */
export default function HealthRing({
  good,
  attention,
  concern,
  size = 168,
  thickness = 14,
  tone = 'card',
  className = '',
}: Props) {
  const total = good + attention + concern;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Avoid divide-by-zero when there are no markers — show an empty ring.
  const safeTotal = total === 0 ? 1 : total;

  // Compute arc lengths. Tiny epsilon when a segment is 0 so the dash
  // gap calculation is well-defined.
  const segments = useMemo(
    () => [
      {
        key: 'good',
        value: good,
        length: (good / safeTotal) * circumference,
        color: 'var(--color-good)',
      },
      {
        key: 'attention',
        value: attention,
        length: (attention / safeTotal) * circumference,
        color: 'var(--color-attention)',
      },
      {
        key: 'concern',
        value: concern,
        length: (concern / safeTotal) * circumference,
        color: 'var(--color-concern)',
      },
    ],
    [good, attention, concern, safeTotal, circumference],
  );

  // Each segment starts where the previous one ended.
  let cumulative = 0;
  const offsets = segments.map((s) => {
    const start = cumulative;
    cumulative += s.length;
    return start;
  });

  const cx = size / 2;
  const cy = size / 2;

  const primaryTextCls = tone === 'onDark' ? 'text-white' : 'text-ink';
  const subTextCls = tone === 'onDark' ? 'text-white/75' : 'text-muted';
  const trackStroke = tone === 'onDark' ? 'rgba(255,255,255,0.18)' : 'var(--color-line)';

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${good} of ${total} markers on track`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track — neutral background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackStroke}
          strokeWidth={thickness}
        />

        {/* Three coloured arcs, each starting where the previous ended */}
        {segments.map((seg, i) => {
          if (seg.value === 0) return null;
          return (
            <motion.circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${seg.length} ${circumference}`}
              initial={{ strokeDashoffset: -circumference }}
              animate={{ strokeDashoffset: -offsets[i] }}
              transition={{
                duration: 0.9,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.1 + i * 0.15,
              }}
            />
          );
        })}
      </svg>

      {/* Centre label — actual count, not a synthetic score */}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={`font-display text-[36px] leading-none tabular-nums ${primaryTextCls}`}
          >
            {good}
          </div>
          <div
            className={`text-[10px] uppercase tracking-[0.16em] font-bold mt-1 ${subTextCls}`}
          >
            of {total} on track
          </div>
        </div>
      </div>
    </div>
  );
}
