import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import Button from './Button';
import type { LearnMore } from '../data/markerInfo';

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
 * Reuses the wrapper pattern from `QuizPage.ExitConfirm` for visual continuity.
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
  /**
   * Keep onClose in a ref so the scroll-lock effect doesn't tear down + re-set
   * up on every parent re-render (onClose is usually a new arrow function each
   * time). If we depended on onClose, repeated mount/unmount of the keydown
   * listener + repeated body.style mutations are needless churn — and on rare
   * timing edge-cases can leave body.overflow stuck at 'hidden'.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* Close on Escape + lock body scroll while open — depends ONLY on `open` */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* Focus the close button on open */
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 backdrop-blur-sm p-0 sm:p-6"
          role="presentation"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-md md:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
          >
            {/* Header (sticky) */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line/70">
              <div className="flex-1 min-w-0">
                {subtitle && (
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700 mb-1">
                    {subtitle}
                  </div>
                )}
                <h2
                  id={titleId}
                  className="font-display text-[20px] sm:text-[22px] leading-tight text-ink"
                >
                  {title}
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-9 h-9 -mr-1.5 -mt-1 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <Section eyebrow="What it measures">
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  {info.measures}
                </p>
              </Section>

              <Section eyebrow="Why it matters">
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  {info.importance}
                </p>
              </Section>

              <Section eyebrow="Hormonal impact">
                <p className="text-[14px] leading-relaxed text-ink-soft">
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
                      <span className="text-[14px] leading-relaxed text-ink-soft">
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
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700 mb-2">
        {eyebrow}
      </div>
      {children}
    </section>
  );
}
