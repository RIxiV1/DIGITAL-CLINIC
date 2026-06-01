import { motion } from 'framer-motion';
import { useId } from 'react';
import type { Biomarker } from '../data/biomarkers';

type Props = {
  marker: Biomarker;
  width?: number;
  height?: number;
  className?: string;
};

/**
 * Renders a marker's history + current value as an inline SVG sparkline.
 * Shows the healthy-range band as a subtle green tint behind the line so
 * the viewer can read "is this inside the range" at a glance.
 *
 * No chart library — pure SVG, ~80 lines, tree-shakable.
 */
export default function Sparkline({
  marker,
  width = 120,
  height = 40,
  className = '',
}: Props) {
  const history = marker.history ?? [];
  const points = [...history.map((h) => h.value), marker.value];
  if (points.length < 2) return null;

  // Y-axis bounds: include all points + the healthy range so the band is
  // always visible. Pad by 8% so the line doesn't sit flush with the edges.
  const yMin = Math.min(...points, marker.min);
  const yMax = Math.max(...points, marker.max);
  const span = yMax - yMin || 1;
  const pad = span * 0.08;
  const lo = yMin - pad;
  const hi = yMax + pad;
  const scaleY = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const stepX = width / (points.length - 1);

  // Healthy range band — drawn behind the polyline.
  const bandTop = scaleY(marker.max);
  const bandBottom = scaleY(marker.min);

  // Trend stroke color picks up the marker status. Critical reuses the
  // concern color — the differentiation comes from copy + the per-tier
  // status pill on the dashboard, not the sparkline hue.
  const stroke =
    marker.status === 'critical' || marker.status === 'concern'
      ? '#E11D48' // matches text-concern
      : marker.status === 'attention'
        ? '#D97706' // matches text-attention
        : '#16A34A'; // matches text-good

  const polyline = points
    .map((v, i) => `${i * stepX},${scaleY(v)}`)
    .join(' ');

  const lastX = (points.length - 1) * stepX;
  const lastY = scaleY(points[points.length - 1]);

  const gradientId = useId();

  return (
    <svg
      role="img"
      aria-label={`${marker.name} trend over time`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      <defs>
        {/* Area-fill gradient under the polyline — same hue as the
            stroke, fading to transparent at the bottom. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Healthy range band */}
      <rect
        x={0}
        y={bandTop}
        width={width}
        height={Math.max(0, bandBottom - bandTop)}
        fill="rgb(22 163 74 / 0.14)"
      />

      {/* Area fill under the trend line — fades in after the line draws. */}
      <motion.polygon
        points={`0,${height} ${polyline} ${width},${height}`}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      />

      {/* Trend line — draws itself in on mount via pathLength. */}
      <motion.polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* End-point dot pops in after the line lands. */}
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={4}
        fill="var(--color-surface)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.6 }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill={stroke}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.65 }}
      />
    </svg>
  );
}
