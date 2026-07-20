import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import Button from './ui/Button';
import type { LearnMore } from '../data/markerInfo';
import type { BiomarkerStatus } from '../data/biomarkers';
import { useModalA11y } from '../hooks/useModalA11y';
import { EvidenceBadge, EvidenceLegend } from './EvidenceBadge';
import {
  evidenceForRecommendation,
  DECISION_PRINCIPLE,
  certaintyOfAction,
} from '../clinical';

type Props = {
  open: boolean;
  title: string;
  /** Optional eyebrow line shown above the title (e.g. test "short" tagline) */
  subtitle?: string;
  info: LearnMore | null;
  /** The marker's status. When flagged (not 'good'), the modal leads with
   *  a status-aware "What to do now" block — concrete next step + the
   *  improve steps — instead of burying the action under the educational
   *  sections. Omit (or 'good') to keep the education-first order. */
  status?: BiomarkerStatus;
  onClose: () => void;
};

/**
 * Generic Learn-More modal used by the Recommended Tests page (and reusable
 * elsewhere). Renders as a bottom sheet on mobile, a centered card on desktop.
 *
 * Accessibility guarantees this component owns end-to-end:
 *   - role="dialog" + aria-modal="true" so AT treats it as a discrete
 *     interactive layer
 *   - aria-labelledby pointing at the heading inside the card
 *   - Esc closes (and stops propagation so a parent listener can't
 *     react to the same Escape)
 *   - Tab/Shift+Tab focus-trap that wraps around the card boundary
 *   - On open: focuses the close button (a stable, predictable
 *     landing spot)
 *   - On close: restores focus to whichever element had it before the
 *     modal opened — the caller doesn't have to track the trigger.
 *   - Body scroll lock (ref-counted via acquireBodyScrollLock so
 *     stacked sheets remain consistent)
 */
export default function LearnMoreModal({
  open,
  title,
  subtitle,
  info,
  status,
  onClose,
}: Props) {
  const titleId = useId();
  // When the marker is flagged, lead with action. A calm, status-aware
  // next step (risk-communication: tell people what to DO, don't just
  // alarm them) sits above the concrete improve steps — surfaced first,
  // not buried under three paragraphs of education.
  const isFlagged =
    status === 'attention' || status === 'concern' || status === 'critical';
  // Q4 of the First-Impression Contract — radiate certainty about the
  // ACTION, not the diagnosis (certaintyOfAction).
  const next = certaintyOfAction({ status: status ?? 'good' });
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Esc + focus-trap + scroll lock + restore-focus, all shared with the
  // other modals via useModalA11y. The close button is the preferred
  // initial-focus target — a stable landing spot regardless of what's
  // inside the modal body.
  useModalA11y({ open, cardRef, onClose, initialFocusRef: closeBtnRef });

  return (
    <AnimatePresence>
      {open && info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 backdrop-blur-md p-0 sm:p-6"
          role="presentation"
        >
          <motion.div
            ref={cardRef}
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-md md:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[85dvh] sm:max-h-[80dvh] overflow-hidden"
          >
            {/* Header (sticky) */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line/70">
              <div className="flex-1 min-w-0">
                {subtitle && (
                  <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700 mb-1">
                    {subtitle}
                  </div>
                )}
                <h2
                  id={titleId}
                  className="font-display text-display-md leading-tight text-ink"
                >
                  {title}
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-12 h-12 -mr-2 -mt-2 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isFlagged && (
                <Section eyebrow="What to do now">
                  {/* The action, with a confidence chip ON THE ACTION — "we
                      may not be sure what this means, but we're sure what to
                      do." The chip is status-neutral indigo, so it reads as
                      confidence-in-advice, not a health verdict. */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body-sm font-semibold text-ink">
                        {next.action}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-micro font-semibold text-indigo-700">
                        High confidence
                      </span>
                    </div>
                    <p className="mt-1 text-caption leading-relaxed text-ink-soft">
                      {next.detail}
                    </p>
                  </div>
                  <ImproveList items={info.improve} />
                  {/* Decision aid (Persona 1 — the core gym user): answers
                      "so should I stop X?" with the only safe, correct
                      principle — don't decide off one marker — instead of
                      marker-specific instructions we can't responsibly give. */}
                  <p className="mt-3 text-caption leading-snug text-ink-soft border-l-2 border-l-indigo-300 pl-3">
                    {DECISION_PRINCIPLE}
                  </p>
                </Section>
              )}

              <Section eyebrow="What it measures">
                <p className="text-body-sm leading-relaxed text-ink-soft">
                  {info.measures}
                </p>
              </Section>

              <Section eyebrow="Why it matters">
                <p className="text-body-sm leading-relaxed text-ink-soft">
                  {info.importance}
                </p>
              </Section>

              <Section eyebrow="How it affects you" last={isFlagged}>
                <p className="text-body-sm leading-relaxed text-ink-soft">
                  {info.hormonalImpact}
                </p>
              </Section>

              {!isFlagged && (
                <Section eyebrow="Ways to improve" last>
                  <ImproveList items={info.improve} />
                </Section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-line/70 bg-canvas/40">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={onClose}
                className="sm:!w-auto sm:!ml-auto sm:block"
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImproveList({ items }: { items: string[] }) {
  const anyGraded = items.some((line) => evidenceForRecommendation(line));
  return (
    <>
      <ul className="grid gap-2">
        {items.map((line) => {
          const ev = evidenceForRecommendation(line);
          return (
            <li key={line} className="flex items-start gap-2.5">
              <CheckCircle2
                size={15}
                className="text-indigo-600 shrink-0 mt-0.5"
              />
              <span className="text-body-sm leading-relaxed text-ink-soft">
                {line}
                {ev && <EvidenceBadge match={ev} className="ml-2" />}
              </span>
            </li>
          );
        })}
      </ul>
      {/* Tier legend — shown only when something on this list is graded, so
          the labels never depend on a hover that doesn't exist on touch. */}
      {anyGraded && <EvidenceLegend className="mt-3" />}
    </>
  );
}

function Section({
  eyebrow,
  children,
  last,
}: {
  eyebrow: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? '' : 'mb-5 pb-5 border-b border-line/60'}>
      <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700 mb-2">
        {eyebrow}
      </div>
      {children}
    </section>
  );
}
