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

  // Trend stroke color picks up the marker status — concern is red, etc.
  const stroke =
    marker.status === 'concern'
      ? '#E11D48' // matches text-concern
      : marker.status === 'attention'
        ? '#D97706' // matches text-attention
        : '#16A34A'; // matches text-good

  const polyline = points
    .map((v, i) => `${i * stepX},${scaleY(v)}`)
    .join(' ');

  const lastX = (points.length - 1) * stepX;
  const lastY = scaleY(points[points.length - 1]);

  return (
    <svg
      role="img"
      aria-label={`${marker.name} trend over time`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      {/* Healthy range band */}
      <rect
        x={0}
        y={bandTop}
        width={width}
        height={Math.max(0, bandBottom - bandTop)}
        fill="rgb(22 163 74 / 0.10)"
      />
      {/* Trend line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End-point dot (current reading) */}
      <circle cx={lastX} cy={lastY} r={2.75} fill={stroke} />
    </svg>
  );
}
