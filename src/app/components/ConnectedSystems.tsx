import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { BodySystem, BodySystemId, SystemStatus } from '../clinical';

/**
 * The Health Map — ForMen's signature.
 *
 * The manifestation of the one idea: a man's body isn't a pile of separate
 * lab values, it's one connected system, regulated from the hormonal hub
 * (the science: testosterone behaves as a network hub). Tapping a system
 * teaches the connection — it highlights the link to the hub and shows the
 * cited, GENERAL reason the two relate, and dims the rest.
 *
 * Deliberately NOT claimed: a personal causal story ("your metabolism is
 * pulling down your recovery") or direct per-user cross-links between
 * organs. One report can't prove that (First-Impression Contract §3: the
 * engine must be able to say "these are separate"), and a generative
 * "living blob" would be decoration, not understanding. The map shows where
 * findings sit, which system to begin with, and established associations —
 * it never fabricates a ripple.
 *
 * Presentational only; the model lives in clinical/bodySystems. Motion runs
 * under the app-wide reducedMotion="user" cascade.
 */

type Props = {
  systems: BodySystem[];
  headline: string;
  story: string | null;
  onSelectSystem?: (id: BodySystemId) => void;
};

/* Status palette — RED IS RESERVED for critical; concern is amber so the
   map doesn't read as one big alarm. */
const STATUS: Record<
  SystemStatus,
  { ring: string; dot: string; caption: string }
> = {
  good: { ring: 'border-good/50 bg-good-soft/30', dot: 'bg-good', caption: 'On track' },
  attention: {
    ring: 'border-attention/50 bg-attention-soft/30',
    dot: 'bg-attention',
    caption: 'Keep an eye',
  },
  concern: {
    // De-escalated colour (amber, not red) but the canonical WORD — the rest
    // of the app says "Needs care" for this tier; the map must not invent a
    // softer synonym. (Vocabulary glossary: one word, one meaning.)
    ring: 'border-attention/60 bg-attention-soft/40',
    dot: 'bg-attention',
    caption: 'Needs care',
  },
  critical: {
    ring: 'border-concern/70 bg-concern-soft/50',
    dot: 'bg-concern',
    caption: 'See a doctor',
  },
  unmeasured: {
    ring: 'border-line bg-canvas/40',
    dot: 'bg-muted/40',
    caption: 'No markers yet',
  },
};

const RANK: Record<SystemStatus, number> = {
  unmeasured: -1,
  good: 0,
  attention: 1,
  concern: 2,
  critical: 3,
};

// Spokes on a circle around the hub (50,50). Diagonal start (an X, not a +).
const R = 34;
const ANGLES = [-45, 45, 135, 225];
const pointAt = (angle: number) => ({
  x: 50 + R * Math.cos((angle * Math.PI) / 180),
  y: 50 + R * Math.sin((angle * Math.PI) / 180),
});

// A gently bowed connector reads more organic than a ruler-straight line.
// Alternating bow direction keeps the web from looking machine-perfect.
function curvePath(angle: number, sign: number): string {
  const p = pointAt(angle);
  const mx = (50 + p.x) / 2;
  const my = (50 + p.y) / 2;
  const dx = p.x - 50;
  const dy = p.y - 50;
  const len = Math.hypot(dx, dy) || 1;
  const off = 6 * sign;
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M 50 50 Q ${cx} ${cy} ${p.x} ${p.y}`;
}

function lineStyle(status: SystemStatus): { cls: string; w: number } {
  if (status === 'critical') return { cls: 'stroke-concern/60', w: 1.6 };
  if (status === 'concern') return { cls: 'stroke-attention/60', w: 1.2 };
  return { cls: 'stroke-ink/12', w: 0.7 };
}

export default function ConnectedSystems({
  systems,
  headline,
  story,
  onSelectSystem,
}: Props) {
  const hub = systems.find((s) => s.hub);
  const spokes = systems.filter((s) => !s.hub).slice(0, ANGLES.length);
  const [selectedId, setSelectedId] = useState<BodySystemId | null>(null);
  if (!hub) return null;

  const hubUnmeasured = hub.status === 'unmeasured';
  const selected = spokes.find((s) => s.id === selectedId) ?? null;

  // The single most-pressing system — "start here" — so priority is visible
  // before reading, instead of four equal-weight nodes. Null when all calm.
  const measured = systems.filter((s) => s.status !== 'unmeasured');
  const lead =
    measured.length > 0
      ? measured.reduce((w, s) =>
          RANK[s.status] > RANK[w.status] ||
          (RANK[s.status] === RANK[w.status] && s.flaggedCount > w.flaggedCount)
            ? s
            : w,
        )
      : null;
  const leadId = lead && lead.status !== 'good' ? lead.id : null;

  const nodeSub = (s: BodySystem) => s.topFlaggedMarker ?? STATUS[s.status].caption;

  return (
    <section
      aria-label="Your Health Map — your body as one connected system"
      className="rounded-[20px] border border-line/70 bg-surface/70 px-5 py-9 sm:px-10 sm:py-12"
    >
      <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700">
        Your Health Map
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="mt-1.5 font-display text-display-md leading-[1.25] text-balance text-ink max-w-xl"
      >
        {headline}
      </motion.p>

      <div className="relative mx-auto mt-8 aspect-square w-full max-w-[440px] sm:max-w-[560px]">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {spokes.map((s, i) => {
            const isSel = s.id === selectedId;
            const base = lineStyle(s.status);
            const cls = isSel
              ? 'stroke-indigo-500/80'
              : selectedId
                ? 'stroke-ink/8'
                : base.cls;
            const w = isSel ? 2 : base.w;
            return (
              <motion.path
                key={s.id}
                d={curvePath(ANGLES[i], i % 2 === 0 ? 1 : -1)}
                fill="none"
                className={cls}
                strokeWidth={w}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.55 + i * 0.12 }}
              />
            );
          })}
        </svg>

        {/* Hub — the hormonal axis everything is regulated from. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.5 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div
            className={`grid place-items-center w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 text-center shadow-soft px-3 ${
              hubUnmeasured ? 'border-line bg-canvas/40' : STATUS[hub.status].ring
            } ${leadId === hub.id ? 'ring-2 ring-indigo-400/70' : ''}`}
          >
            <div>
              {leadId === hub.id && (
                <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 mb-0.5">
                  Start here
                </div>
              )}
              <div className="font-display text-body-lg leading-tight text-ink">
                {hub.label}
              </div>
              <div className="mt-1 text-micro leading-snug text-ink-soft">
                {hubUnmeasured ? 'Not measured here' : nodeSub(hub)}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Spokes. Tap teaches the connection; the lead system stands out. */}
        {spokes.map((s, i) => {
          const p = pointAt(ANGLES[i]);
          const st = STATUS[s.status];
          const clickable = !!onSelectSystem && s.markerCount > 0;
          const isSel = s.id === selectedId;
          const isLead = s.id === leadId;
          const dim = selectedId && !isSel;
          return (
            <motion.button
              key={s.id}
              type="button"
              disabled={!clickable}
              onClick={() => setSelectedId(isSel ? null : s.id)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: dim ? 0.4 : 1, scale: isLead && !dim ? 1.05 : 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.65 + i * 0.12 }}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-[116px] sm:w-[132px] rounded-2xl border px-2.5 py-2 text-center transition-transform ${st.ring} ${
                isSel ? 'ring-2 ring-indigo-400/70' : ''
              } ${isLead ? 'shadow-pop ring-2 ring-indigo-400/60' : ''} ${
                clickable
                  ? 'cursor-pointer hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60'
                  : 'cursor-default'
              }`}
            >
              {isLead && (
                <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 mb-0.5">
                  Start here
                </div>
              )}
              <div className="text-caption font-semibold leading-tight text-ink">
                {s.label}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-micro text-ink-soft">
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                <span className="truncate max-w-[88px]">{nodeSub(s)}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Caption area — teaches on selection, reassures by default. */}
      {selected ? (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-7 max-w-xl rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3"
        >
          <div className="text-caption font-semibold text-ink">
            {selected.label}
            {selected.topFlaggedMarker ? ` · ${selected.topFlaggedMarker}` : ''}
          </div>
          {selected.link && (
            <p className="mt-1 text-caption leading-snug text-ink-soft">
              <span className="font-medium text-ink-soft">Why it connects:</span>{' '}
              {selected.link}
            </p>
          )}
          {onSelectSystem && selected.markerCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectSystem(selected.id)}
              className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
            >
              View {selected.markerCount} marker
              {selected.markerCount === 1 ? '' : 's'} <ChevronRight size={14} />
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.15 }}
          className="mt-7 max-w-xl space-y-1.5"
        >
          <p className="text-micro text-muted leading-snug">
            {hubUnmeasured
              ? 'Hormones would sit at the centre — today’s map is based on the systems you measured. Tap a system to see how it connects.'
              : 'Hormones sit at the centre because testosterone influences every other system. Tap a system to see how it connects.'}
          </p>
          {story && (
            <p className="text-body-sm leading-relaxed text-ink-soft text-balance">
              {story}
            </p>
          )}
        </motion.div>
      )}
    </section>
  );
}
