import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Database, Trash2, X } from 'lucide-react';
import Button from './Button';
import { acquireBodyScrollLock } from '../utils/bodyScrollLock';
import { getStorageStats, wipeAllData } from '../utils/persistence';
import { formatBytes, formatDate } from '../utils/uiUtils';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful wipe so the page can reload state. */
  onAfterWipe?: () => void;
};

/**
 * Profile › "My data & exports" modal. Mirrors the Lab Report Explainer's
 * ManageDataPanel — surfaces what we have stored locally, when it was
 * last touched, and gives the user a one-button way to delete everything.
 *
 * Two-step confirmation on wipe so users can't nuke their reports
 * accidentally.
 */
export default function DataPanelModal({ open, onClose, onAfterWipe }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [wiped, setWiped] = useState(false);

  // Stats are computed on every open — quick, no need to cache.
  const stats = open ? getStorageStats() : null;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setWiped(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const release = acquireBodyScrollLock();
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      release();
      window.clearTimeout(id);
    };
  }, [open]);

  const handleWipe = () => {
    wipeAllData();
    setWiped(true);
    setConfirming(false);
    onAfterWipe?.();
  };

  return (
    <AnimatePresence>
      {open && (
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
            ref={cardRef}
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line/70">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                <Database size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700 mb-0.5">
                  Privacy
                </div>
                <h2
                  id={titleId}
                  className="font-display text-[20px] leading-tight text-ink"
                >
                  My data &amp; exports
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-9 h-9 -mr-1.5 -mt-1 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                Everything in your Digital Clinic — reports, quiz answers,
                preferences — lives in your browser only. We don't store any
                of it on our servers.
              </p>

              {stats && (
                <div className="rounded-[14px] border border-line bg-canvas/60 divide-y divide-line/70">
                  <StatRow label="Stored entries" value={String(stats.keyCount)} />
                  <StatRow
                    label="Approximate size"
                    value={formatBytes(stats.approxBytes)}
                  />
                  <StatRow
                    label="Oldest entry"
                    value={formatDate(stats.oldestDate)}
                  />
                </div>
              )}

              {wiped ? (
                <div className="rounded-[14px] bg-good-soft border border-good/30 p-4 text-[13px] text-good leading-relaxed">
                  Everything's gone. Your browser storage is empty —
                  refresh the page to start fresh.
                </div>
              ) : confirming ? (
                <div className="rounded-[14px] bg-concern-soft border border-concern/30 p-4 space-y-3">
                  <div className="text-[13.5px] leading-relaxed text-ink">
                    This deletes every report and quiz answer stored in this
                    browser. It can't be undone.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirming(false)}
                      responsiveFullWidth
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleWipe}
                      responsiveFullWidth
                      className="!bg-concern hover:!bg-concern/90"
                      leading={<Trash2 size={14} />}
                    >
                      Yes, delete everything
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="md"
                  variant="secondary"
                  responsiveFullWidth
                  leading={<Trash2 size={14} />}
                  onClick={() => setConfirming(true)}
                  className="!text-concern hover:!bg-concern-soft"
                >
                  Delete all my data
                </Button>
              )}

              <p className="text-[11px] text-muted leading-relaxed">
                Inactive reports are auto-deleted after 6 months. Need a
                copy first? Use "Download as PDF" on any report.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-line/70 bg-canvas/40">
              <Button variant="primary" size="md" responsiveFullWidth onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] uppercase tracking-[0.1em] font-bold text-muted">
        {label}
      </span>
      <span className="font-display text-[14px] text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}
