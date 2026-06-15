import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  /** 0–100. The arc fills to this share of the ring. */
  pct: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  /** Center content. Defaults to "<pct>%". */
  children?: ReactNode;
  /** Arc colour token class (e.g. 'stroke-good'). Defaults to good. */
  arcClass?: string;
  /** Track (the un-filled remainder) colour. Pass a status tint (e.g.
   *  'stroke-concern/40') so the ring reads as an honest two-tone split —
   *  green = the in-range share, red = the share that needs attention —
   *  instead of a single green arc that looks like a passing grade.
   *  Defaults to a neutral hairline. */
  trackClass?: string;
};

/**
 * Apple-Activity-style progress ring. Pure SVG, no deps. The arc is the
 * filled share (`pct`); the track is the remainder. Animates the sweep
 * on mount; collapses to a static ring under reduced-motion via the
 * app-root MotionConfig. Shared by the dashboard hero and the Health Map
 * so the two surfaces speak one "score" language.
 */
export default function ProgressRing({
  pct,
  size = 96,
  stroke = 9,
  children,
  arcClass = 'stroke-good',
  trackClass = 'stroke-line/50',
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const offset = c * (1 - clamped / 100);
  return (
    <div
      className="relative grid place-items-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={arcClass}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children ?? (
          <span className="font-display text-display-sm leading-none text-ink">
            {clamped}%
          </span>
        )}
      </div>
    </div>
  );
}
