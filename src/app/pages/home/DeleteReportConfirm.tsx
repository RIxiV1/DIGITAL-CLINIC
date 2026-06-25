import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import Button from '../../components/Button';
import { useModalA11y } from '../../utils/useModalA11y';
import type { Report } from '../../data/reports';

/* ------------------------------------------------------------------ */
/* Per-report delete confirmation                                       */
/*                                                                      */
/* Lives at the page level (one modal at a time) so destruction-of-data */
/* is uniformly Esc/click-out dismissable and shares the focus-trap +   */
/* scroll-lock contract with the rest of the app's modals.              */
/* ------------------------------------------------------------------ */

export default function DeleteReportConfirm({
  report,
  onCancel,
  onConfirm,
}: {
  report: Report | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useModalA11y({
    open: !!report,
    cardRef,
    onClose: onCancel,
  });

  return (
    <AnimatePresence>
      {report && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4"
          role="presentation"
        >
          <motion.div
            ref={cardRef}
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-sm bg-surface rounded-3xl shadow-pop border border-line p-5"
          >
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-11 h-11 rounded-2xl bg-concern-soft text-concern shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-body-lg leading-tight text-ink"
                >
                  Delete this report?
                </h2>
                <p className="mt-1.5 text-caption text-ink-soft leading-relaxed break-words">
                  <span className="font-semibold text-ink">{report.name}</span>{' '}
                  ({report.lab}) will be removed from your locker. This can’t be
                  undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onCancel}
                responsiveFullWidth
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={onConfirm}
                responsiveFullWidth
                className="!bg-concern hover:!bg-concern/90"
                leading={<Trash2 size={14} />}
              >
                Delete report
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
