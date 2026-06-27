import { motion } from 'framer-motion';
import type { BodySystem, BodySystemId, SystemStatus } from '../clinical';

/**
 * ForMen's signature moment.
 *
 * Not a dashboard widget — the manifestation of the one idea: a man's body
 * isn't a pile of separate lab values, it's one connected system. The
 * philosophy line lands first; then the five systems connect THROUGH the
 * hormonal hub (the science: testosterone behaves as a network hub). The
 * point isn't to drill — it's to make the user feel their body as one thing.
 *
 * Presentational only — the model (buildBodySystems / connectedStoryHeadline
 * / healthStorySentence) is computed and tested in clinical/bodySystems.
 * All motion runs under the app-wide MotionConfig reducedMotion="user", so
 * it snaps for users who ask for less motion.
 */

type Props = {
  systems: BodySystem[];
  /** The one idea, against this report (connectedStoryHeadline). */
  headline: string;
  /** Reassurance-first story line (healthStorySentence); may be null. */
  story: string | null;
  onSelectSystem?: (id: BodySystemId) => void;
};

/* Node styling per status — status-bearing but calm. Unmeasured is
   deliberately faint + dashed: honest "we didn't see this" rather than a
   reassuring green. */
const STATUS: Record<
  SystemStatus,
  { ring: string; dot: string; caption: string }
> = {
  good: { ring: 'border-good/50 bg-good-soft/40', dot: 'bg-good', caption: 'On track' },
  attention: {
    ring: 'border-attention/50 bg-attention-soft/40',
    dot: 'bg-attention',
    caption: 'Keep an eye',
  },
  concern: {
    ring: 'border-concern/50 bg-concern-soft/40',
    dot: 'bg-concern',
    caption: 'Needs care',
  },
  critical: {
    ring: 'border-concern/70 bg-concern-soft/60',
    dot: 'bg-concern',
    caption: 'See a doctor',
  },
  unmeasured: {
    ring: 'border-dashed border-line bg-transparent',
    dot: 'bg-muted/40',
    caption: 'Not measured',
  },
};

// Spoke positions around the hub, in SVG/percent units (hub at 50,50).
// top · right · bottom · left — assigned in system order.
const R = 34;
const ANGLES = [-90, 0, 90, 180];
const pointAt = (angle: number) => ({
  x: 50 + R * Math.cos((angle * Math.PI) / 180),
  y: 50 + R * Math.sin((angle * Math.PI) / 180),
});

export default function ConnectedSystems({
  systems,
  headline,
  story,
  onSelectSystem,
}: Props) {
  const hub = systems.find((s) => s.hub);
  const spokes = systems.filter((s) => !s.hub).slice(0, ANGLES.length);
  if (!hub) return null;

  const hubStyle = STATUS[hub.status];

  return (
    <section
      aria-label="Your body as one connected system"
      className="rounded-[20px] border border-line/70 bg-surface/70 px-5 py-9 sm:px-10 sm:py-12"
    >
      {/* The idea, first. */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="font-display text-display-md leading-[1.25] text-balance text-ink max-w-xl"
      >
        {headline}
      </motion.p>

      {/* The system, connecting. */}
      <div className="relative mx-auto mt-8 aspect-square w-full max-w-[440px] sm:max-w-[560px]">
        {/* Connection lines — every spoke joins the hormonal hub. They draw
            in after the headline so the user watches the body 'connect'. */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {spokes.map((s, i) => {
            const p = pointAt(ANGLES[i]);
            const flagged = s.status === 'concern' || s.status === 'critical';
            return (
              <motion.line
                key={s.id}
                x1={50}
                y1={50}
                x2={p.x}
                y2={p.y}
                className={flagged ? 'stroke-concern/50' : 'stroke-ink/12'}
                strokeWidth={flagged ? 1.5 : 0.7}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 0.7,
                  ease: 'easeOut',
                  delay: 0.55 + i * 0.12,
                }}
              />
            );
          })}
        </svg>

        {/* Hub — the hormonal axis, the centre everything orbits. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.5 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div
            className={`grid place-items-center w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 text-center shadow-soft ${hubStyle.ring}`}
          >
            <div>
              <div className="text-micro font-bold uppercase tracking-label text-muted">
                Hub
              </div>
              <div className="font-display text-body-lg leading-tight text-ink mt-0.5">
                {hub.label}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-caption text-ink-soft">
                <span className={`w-1.5 h-1.5 rounded-full ${hubStyle.dot}`} />
                {hubStyle.caption}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Spokes — the other systems, each tethered to the hub. */}
        {spokes.map((s, i) => {
          const p = pointAt(ANGLES[i]);
          const st = STATUS[s.status];
          // Only systems that actually have markers are tappable — an
          // unmeasured system has nothing to navigate to.
          const clickable = !!onSelectSystem && s.markerCount > 0;
          const Tag = clickable ? motion.button : motion.div;
          return (
            <Tag
              key={s.id}
              {...(clickable
                ? { type: 'button', onClick: () => onSelectSystem!(s.id) }
                : {})}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 24,
                delay: 0.65 + i * 0.12,
              }}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-[116px] sm:w-[132px] rounded-2xl border px-2.5 py-2 text-center ${st.ring} ${
                clickable
                  ? 'cursor-pointer transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60'
                  : ''
              }`}
            >
              <div className="text-caption font-semibold leading-tight text-ink">
                {s.label}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-micro text-ink-soft">
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {s.status === 'concern' && s.flaggedCount > 0
                  ? `${s.flaggedCount} to review`
                  : st.caption}
              </div>
            </Tag>
          );
        })}
      </div>

      {/* The reassurance-first story line, last. */}
      {story && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.15 }}
          className="mt-7 text-body-sm leading-relaxed text-ink-soft text-balance max-w-xl"
        >
          {story}
        </motion.p>
      )}
    </section>
  );
}
