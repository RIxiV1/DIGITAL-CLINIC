import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { BodySystem, BodySystemId } from '../clinical/bodySystems';

/**
 * HealthMapMorph — the product's signature transition.
 *
 * The lab report the user has been reading FOLDS AWAY, and their body's
 * connected systems rise out of it around the hormonal hub. It's the one
 * moment that earns motion: it visually answers the core promise —
 * turning a sheet of lab values into an understandable picture of a
 * person. Continuity is the point (Apple's "objects persist"): it's the
 * SAME sheet followed from upload → scan → confirm → report, now becoming
 * the map.
 *
 * Honest, not decorative: the emerging nodes are the user's REAL systems
 * (buildBodySystems) coloured by their REAL status — never a canned
 * five-green demo. An all-clear panel morphs into an all-calm map; a
 * flagged one shows exactly where the attention is.
 *
 * Calm, not delight: slow easing, one clean sequence, a gentle settle —
 * no bounce, no sparkle. Fully skipped under prefers-reduced-motion
 * (onComplete fires immediately, so the real content shows at once).
 *
 * `variant`:
 *   - 'inline'    — a compact ~1.8s title sequence above the report's
 *                   Connected Systems section. Plays once on scroll-in.
 *   - 'cinematic' — a full first-visit intro on the Health Map page,
 *                   with captions narrating the four beats.
 */

const STATUS_FILL: Record<string, string> = {
  good: 'var(--color-good)',
  attention: 'var(--color-attention)',
  concern: 'var(--color-concern)',
  critical: 'var(--color-concern)',
  unmeasured: 'var(--color-line)',
};

const SHORT_LABEL: Record<BodySystemId, string> = {
  hormonal: 'Hormones',
  metabolic: 'Metabolic',
  heart: 'Heart',
  vitality: 'Vitality',
  filtration: 'Filtration',
};

// Four spoke anchors around the centre hub (viewBox 320×300, hub 160,150).
const SPOKES = [
  { x: 66, y: 74 },
  { x: 254, y: 74 },
  { x: 60, y: 226 },
  { x: 260, y: 226 },
];
const HUB = { x: 160, y: 150 };

const CAPTIONS = [
  'Your blood report',
  'What’s flagged',
  'Folding into systems',
  'Your body, connected',
];

export default function HealthMapMorph({
  systems,
  variant = 'inline',
  onComplete,
  className,
}: {
  systems: BodySystem[];
  variant?: 'inline' | 'cinematic';
  onComplete?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  const hub = systems.find((s) => s.hub) ?? systems[0];
  const spokes = systems.filter((s) => s.id !== hub?.id).slice(0, 4);
  const anyFlagged = systems.some(
    (s) => s.status === 'concern' || s.status === 'critical',
  );

  // Beat timings. Cinematic lingers; inline is brisk. Under reduced-motion
  // we skip straight to the finished map and report completion at once.
  useEffect(() => {
    if (reduce) {
      setStage(3);
      onComplete?.();
      return;
    }
    const cinematic = variant === 'cinematic';
    const beats = cinematic
      ? [
          [1, 900],
          [2, 2000],
          [3, 3000],
        ]
      : [
          [1, 450],
          [2, 1050],
          [3, 1650],
        ];
    const timers = beats.map(([n, t]) =>
      window.setTimeout(() => setStage(n), t),
    );
    const doneAt = (cinematic ? 3000 : 1650) + (cinematic ? 1400 : 900);
    timers.push(window.setTimeout(() => onComplete?.(), doneAt));
    return () => timers.forEach(clearTimeout);
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folded = stage >= 2;
  const risen = stage >= 3;
  const flaggedShown = stage >= 1;

  return (
    <div
      className={`grid place-items-center ${className ?? ''}`}
      aria-hidden
      style={{ perspective: 900 }}
    >
      <svg
        viewBox="0 0 320 300"
        fill="none"
        role="presentation"
        className="w-full"
        style={{ maxWidth: variant === 'cinematic' ? 420 : 320, overflow: 'visible' }}
      >
        {/* ── THE REPORT (protagonist) — folds away toward the hub ── */}
        <motion.g
          style={{ transformOrigin: '160px 150px', transformBox: 'fill-box' }}
          animate={
            folded
              ? { opacity: 0, scale: 0.68, rotateX: 78, y: -6 }
              : { opacity: 1, scale: 1, rotateX: 0, y: 0 }
          }
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="112" y="60" width="96" height="132" rx="9" fill="var(--color-surface)" stroke="var(--color-ink-soft)" strokeWidth="2.2" />
          <rect x="124" y="74" width="46" height="8" rx="4" fill="var(--color-forest)" opacity="0.85" />
          {[0, 1, 2, 3, 4].map((i) => {
            const flag = i === 0 || i === 2 || i === 4;
            return (
              <g key={i}>
                <line x1="124" y1={98 + i * 16} x2={i % 2 ? 180 : 190} y2={98 + i * 16} stroke="var(--color-line)" strokeWidth="4" strokeLinecap="round" />
                <motion.rect
                  x="184"
                  y={92 + i * 16}
                  width="14"
                  height="8"
                  rx="4"
                  animate={{
                    fill: flag && flaggedShown
                      ? i === 0 && anyFlagged
                        ? 'var(--color-attention)'
                        : 'var(--color-gold-500)'
                      : 'var(--color-line)',
                  }}
                  transition={{ duration: 0.4 }}
                />
              </g>
            );
          })}
        </motion.g>

        {/* ── THE MAP — links + nodes rise out of the fold ── */}
        {/* links */}
        {spokes.map((s, i) => (
          <motion.line
            key={`l-${s.id}`}
            x1={HUB.x}
            y1={HUB.y}
            x2={SPOKES[i].x}
            y2={SPOKES[i].y}
            stroke={STATUS_FILL[s.status] ?? 'var(--color-line)'}
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: risen ? 1 : 0, opacity: risen ? 0.9 : 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: risen ? 0.12 : 0 }}
          />
        ))}
        {/* spoke nodes */}
        {spokes.map((s, i) => (
          <motion.g
            key={`n-${s.id}`}
            style={{ transformOrigin: `${SPOKES[i].x}px ${SPOKES[i].y}px`, transformBox: 'fill-box' }}
            initial={false}
            animate={{ opacity: risen ? 1 : 0, scale: risen ? 1 : 0.2 }}
            transition={{ type: 'spring', stiffness: 210, damping: 18, delay: risen ? 0.18 + i * 0.06 : 0 }}
          >
            <circle cx={SPOKES[i].x} cy={SPOKES[i].y} r="22" fill="var(--color-surface)" stroke={STATUS_FILL[s.status] ?? 'var(--color-line)'} strokeWidth="2.4" />
            <text x={SPOKES[i].x} y={SPOKES[i].y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink)" style={{ fontFamily: 'inherit' }}>
              {SHORT_LABEL[s.id]}
            </text>
          </motion.g>
        ))}
        {/* hormonal hub */}
        <motion.g
          style={{ transformOrigin: '160px 150px', transformBox: 'fill-box' }}
          initial={false}
          animate={{ opacity: risen ? 1 : 0, scale: risen ? 1 : 0.2 }}
          transition={{ type: 'spring', stiffness: 210, damping: 18 }}
        >
          {!reduce && risen && (
            <motion.circle
              cx={HUB.x}
              cy={HUB.y}
              r="34"
              fill="var(--color-forest)"
              style={{ transformOrigin: '160px 150px', transformBox: 'fill-box' }}
              animate={{ opacity: [0.16, 0.04, 0.16], scale: [1, 1.25, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <circle cx={HUB.x} cy={HUB.y} r="32" fill="var(--color-forest)" />
          <text x={HUB.x} y={HUB.y - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" style={{ fontFamily: 'inherit' }}>
            Hormones
          </text>
          <text x={HUB.x} y={HUB.y + 12} textAnchor="middle" fontSize="8.5" fontWeight="500" fill="#dfe3f5" style={{ fontFamily: 'inherit' }}>
            the hub
          </text>
        </motion.g>
      </svg>

      {variant === 'cinematic' && !reduce && (
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-4 font-display italic text-body-lg text-ink-soft text-center"
        >
          {CAPTIONS[stage]}
        </motion.p>
      )}
    </div>
  );
}
