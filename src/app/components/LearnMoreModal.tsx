import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import Button from './Button';
import type { LearnMore } from '../data/markerInfo';
import { useModalA11y } from '../utils/useModalA11y';

type Props = {
  open: boolean;
  title: string;
  /** Optional eyebrow line shown above the title (e.g. test "short" tagline) */
  subtitle?: string;
  info: LearnMore | null;
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
  onClose,
}: Props) {
  const titleId = useId();
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

              <Section eyebrow="How it affects you">
                <p className="text-body-sm leading-relaxed text-ink-soft">
                  {info.hormonalImpact}
                </p>
              </Section>

              <Section eyebrow="Ways to improve" last>
                <ul className="grid gap-2">
                  {info.improve.map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={15}
                        className="text-indigo-600 shrink-0 mt-0.5"
                      />
                      <span className="text-body-sm leading-relaxed text-ink-soft">
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
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
