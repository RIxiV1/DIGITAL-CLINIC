import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import BiomarkerBar from './BiomarkerBar';
import { type Biomarker } from '../data/biomarkers';
import { useModalA11y } from '../utils/useModalA11y';

/**
 * Mobile marker detail as a focused slide-up sheet (functional audit #6).
 *
 * On a phone, expanding every marker inline turns the report into an
 * exhausting scroll. Instead the list shows compact cards; tapping one
 * opens THIS sheet with the full detail — range, trend, context, receipts —
 * one marker at a time, then back. That's how native health apps behave.
 *
 * It reuses BiomarkerBar in its full (non-compact) form, so there's exactly
 * one place that renders marker detail — the sheet is presentation, not a
 * second copy of the content. Accessibility (focus trap, Esc, restore-focus,
 * scroll lock) comes from the shared useModalA11y, same as LearnMoreModal.
 */

type Props = {
  marker: Biomarker | null;
  contextNote?: string | null;
  /** Jump to the full action plan (problem page), when the marker has one. */
  onOpenProblem?: () => void;
  onClose: () => void;
};

export default function MarkerSheet({
  marker,
  contextNote,
  onOpenProblem,
  onClose,
}: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useModalA11y({
    open: marker !== null,
    cardRef,
    onClose,
    initialFocusRef: closeBtnRef,
  });

  return (
    <AnimatePresence>
      {marker && (
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
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-md md:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[88dvh] sm:max-h-[82dvh] overflow-hidden"
          >
            {/* Header (sticky) */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-line/70">
              <h2
                id={titleId}
                className="flex-1 min-w-0 font-display text-body-lg leading-tight text-ink truncate"
              >
                {marker.name}
              </h2>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-11 h-11 -mr-1.5 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body — the one-and-only marker-detail renderer. */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <BiomarkerBar marker={marker} contextNote={contextNote} />
            </div>

            {/* Footer: jump to the full action plan when there is one. */}
            {marker.problemId && onOpenProblem && (
              <div className="px-5 py-3 border-t border-line/70 bg-canvas/40">
                <button
                  type="button"
                  onClick={onOpenProblem}
                  className="w-full inline-flex items-center justify-center gap-1 min-h-12 rounded-full bg-indigo-600 text-on-primary font-semibold text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  Open the action plan <ChevronRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
