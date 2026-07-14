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
  /** Big headline above the map. Omit to render just the visual (e.g. when an
   *  embedding surface like the landing owns the heading). */
  headline?: string;
  story: string | null;
  onSelectSystem?: (id: BodySystemId) => void;
  /** Suppress the "Your Health Map" eyebrow when the surrounding surface
   *  already labels the section. */
  hideEyebrow?: boolean;
  /** Show the colour key. Off by default (the report page has its own
   *  StatusKey); the landing turns it on so the map reads standalone. */
  showLegend?: boolean;
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
    // Concern's real colour (red), matching the report cards (statusColor →
    // bg-concern). Distinct from attention's amber, so "keep an eye" vs
    // "needs care" reads at a glance — and the map agrees with the cards.
    // (An earlier amber de-escalation had collapsed concern into attention.)
    ring: 'border-concern/50 bg-concern-soft/40',
    dot: 'bg-concern',
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

// Three colour families exist app-wide (green / amber / red); concern and
// critical share red, distinguished by the node's own label.
const LEGEND: { dot: string; label: string }[] = [
  { dot: 'bg-good', label: 'On track' },
  { dot: 'bg-attention', label: 'Keep an eye' },
  { dot: 'bg-concern', label: 'Needs care' },
];

export default function ConnectedSystems({
  systems,
  headline,
  story,
  onSelectSystem,
  hideEyebrow,
  showLegend,
}: Props) {
  const hub = systems.find((s) => s.hub);
  const [selectedId, setSelectedId] = useState<BodySystemId | null>(null);
  if (!hub) return null;

  const hubUnmeasured = hub.status === 'unmeasured';
  const selected = systems.find((s) => s.id === selectedId) ?? null;

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

  // Worst-first, unmeasured last — the reading order for a scannable list.
  const orderedSystems = [...systems].sort(
    (a, b) => RANK[b.status] - RANK[a.status] || b.flaggedCount - a.flaggedCount,
  );

  const nodeSub = (s: BodySystem) => s.topFlaggedMarker ?? STATUS[s.status].caption;

  return (
    <section
      aria-label="Your Health Map — your body as one connected system"
      className="rounded-[20px] border border-line/70 bg-surface/70 px-5 py-9 sm:px-10 sm:py-12"
    >
      {!hideEyebrow && (
        <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700">
          Your Health Map
        </div>
      )}
      {headline && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mt-1.5 font-display text-display-md leading-[1.25] text-balance text-ink max-w-xl"
        >
          {headline}
        </motion.p>
      )}

      {/* Systems, worst-first — a robust list that reads instantly on any
          phone. It replaced a hub-and-spoke SVG that kept colliding on narrow
          screens and added little the list doesn't: the same "by system"
          mental model, priority (Start here), status, and the driving marker,
          with none of the fragility. Tap → the system's markers (report) or
          the taught connection (landing). */}
      <div className="mt-6 grid gap-2">
        {orderedSystems.map((s) => {
          const st = STATUS[s.status];
          const isLead = s.id === leadId;
          const isSel = s.id === selectedId;
          const isUnmeasured = s.status === 'unmeasured';
          const clickable = s.markerCount > 0;
          return (
            <motion.button
              key={s.id}
              type="button"
              disabled={!clickable}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isUnmeasured ? 0.65 : 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={() =>
                onSelectSystem && clickable
                  ? onSelectSystem(s.id)
                  : setSelectedId(isSel ? null : s.id)
              }
              aria-current={isSel ? 'true' : undefined}
              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${st.ring} ${
                isUnmeasured ? 'border-dashed' : ''
              } ${isSel || isLead ? 'ring-2 ring-indigo-400/60' : ''} ${
                clickable
                  ? 'cursor-pointer hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60'
                  : 'cursor-default'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-body leading-tight text-ink truncate">
                    {s.label}
                  </span>
                  {isLead && (
                    <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-widest text-on-primary">
                      Start here
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-caption text-ink-soft truncate">
                  {isUnmeasured ? 'Not measured yet' : nodeSub(s)}
                  {!isUnmeasured && s.flaggedCount > 1
                    ? ` · +${s.flaggedCount - 1} more`
                    : ''}
                </div>
              </div>
              {clickable && (
                <ChevronRight
                  size={17}
                  className="text-muted shrink-0"
                  aria-hidden
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {showLegend && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-micro text-muted">
          {LEGEND.map(({ dot, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      )}

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
          </div>
          {selected.flaggedMarkers.length > 0 && (
            <div className="mt-0.5 text-caption text-ink-soft">
              <span className="font-medium text-ink-soft">
                {selected.flaggedMarkers.length === 1
                  ? 'Flagged here:'
                  : `${selected.flaggedMarkers.length} flagged here:`}
              </span>{' '}
              {selected.flaggedMarkers.join(', ')}
            </div>
          )}
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
              ? 'Your body works as one connected system, tied together by your hormones. This is what today’s report measured — tap a system to open it.'
              : 'Your body works as one connected system, tied together by your hormones. Tap a system to open its markers.'}
          </p>
          {story && (
            <p className="text-body-sm leading-relaxed text-ink-soft text-balance">
              {story}
            </p>
          )}
          {/* Completeness cue — turns a sparse map into a sense of progress.
              Only when at least one but not every system is measured. */}
          {measured.length > 0 && measured.length < systems.length && (
            <p className="!mt-3 inline-flex items-center gap-1.5 text-micro font-semibold text-indigo-700">
              <span className="tabular-nums">
                {measured.length} of {systems.length}
              </span>{' '}
              systems mapped — each report you add fills in more.
            </p>
          )}
        </motion.div>
      )}
    </section>
  );
}
