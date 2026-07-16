import { motion } from 'framer-motion';
import { useId } from 'react';
import type { Biomarker } from '../../data/biomarkers';

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

  // Y-axis is driven by the DATA, not the healthy band. The old version
  // forced the axis to span the full band (Math.min(...points, marker.min)
  // / ...marker.max); when every reading sat outside the band that crushed
  // the line into an edge-hugging sliver and the area-fill rendered as a
  // solid block. Scaling to the readings (plus padding) keeps the line the
  // dominant, readable element however far out of range the values are.
  const dataMin = Math.min(...points);
  const dataMax = Math.max(...points);
  // Flat series (all readings equal) has zero span — fall back to a small
  // non-zero range so the line lands mid-height instead of dividing by 0.
  const span = dataMax - dataMin || Math.max(1, Math.abs(dataMax) * 0.1);
  const pad = span * 0.18;
  const lo = dataMin - pad;
  const hi = dataMax + pad;
  const scaleY = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const stepX = width / (points.length - 1);

  // Healthy-range band — drawn behind the polyline, CLAMPED to the
  // viewport so a band lying largely or wholly outside the data axis can't
  // fill the frame. When the band is entirely off-screen (every reading is
  // outside it) the rect collapses to zero height and the sparkline is
  // just the trend line — the adjacent "trending toward / away" copy
  // carries the range relationship.
  const clampY = (y: number) => Math.max(0, Math.min(height, y));
  const bandTop = clampY(scaleY(marker.max));
  const bandBottom = clampY(scaleY(marker.min));
  const bandHeight = Math.max(0, bandBottom - bandTop);

  // Trend stroke color picks up the marker status. Critical reuses the
  // concern color — the differentiation comes from copy + the per-tier
  // status pill on the dashboard, not the sparkline hue.
  const stroke =
    marker.status === 'critical' || marker.status === 'concern'
      ? '#E11D48' // matches text-concern
      : marker.status === 'attention'
        ? '#D97706' // matches text-attention
        : '#16A34A'; // matches text-good

  const polyline = points.map((v, i) => `${i * stepX},${scaleY(v)}`).join(' ');

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
        height={bandHeight}
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
