import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Database, Download, Trash2, X } from 'lucide-react';
import Button from './Button';
import { useModalA11y } from '../utils/useModalA11y';
import {
  exportAllData,
  getStorageStats,
  wipeAllData,
} from '../utils/persistence';
import { clearPendingUpload } from '../services/api';
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
 * Accessibility — same guarantees as LearnMoreModal:
 *   - role="dialog" + aria-modal="true"
 *   - aria-labelledby targeting the heading
 *   - Esc closes (stopPropagation so a parent listener can't react)
 *   - Tab / Shift+Tab focus-trap that wraps inside the card
 *   - Initial focus lands on the close button
 *   - On close, focus returns to whichever element had it when the
 *     modal opened — caller doesn't have to track the trigger
 *   - Body scroll lock via ref-counted utility
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
  // Stats live in state (not derived on every render) so handleWipe
  // can refresh them after clearing storage. Previously the value
  // was frozen at open time, so post-wipe the download button still
  // saw the old keyCount and stayed enabled, downloading an empty
  // payload — a benign bug, but visibly inconsistent.
  const [stats, setStats] = useState<ReturnType<typeof getStorageStats> | null>(
    null,
  );
  useEffect(() => {
    if (open) setStats(getStorageStats());
    else setStats(null);
  }, [open]);

  // Esc + focus-trap + scroll lock + restore-focus, shared via useModalA11y.
  // Close button is the preferred landing spot (same as LearnMoreModal) so
  // Shift+Tab from the very first focusable wraps to the wipe button at
  // the end of the panel rather than escaping into the page beneath.
  useModalA11y({ open, cardRef, onClose, initialFocusRef: closeBtnRef });

  // Component-specific state reset when the modal closes — not part of
  // the shared a11y contract. Keeps the wipe-confirmation flow from
  // surviving across open cycles (you'd otherwise see the "are you sure"
  // step pre-armed the next time you opened the panel).
  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setWiped(false);
    }
  }, [open]);

  const handleWipe = () => {
    wipeAllData();
    // Also drop any in-flight File handoff held in module state — the
    // user just asked for "wipe everything" and a lingering pendingUpload
    // would survive otherwise (it doesn't live in localStorage).
    clearPendingUpload();
    setStats(getStorageStats());
    setWiped(true);
    setConfirming(false);
    onAfterWipe?.();
  };

  /** "Download my data" — round-trips the privacy story: the user owns
   *  their data, and they should be able to take it with them. We dump
   *  the entire dc_* namespace (reports, quiz answers, prefs) as a
   *  single JSON file. Filename includes the date for self-archival. */
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `digital-clinic-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on next tick so the browser has a chance to finalize the
    // download in single-threaded environments (Safari).
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
            className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop border border-line flex flex-col max-h-[85dvh] sm:max-h-[80dvh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line/70">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                <Database size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700 mb-0.5">
                  Privacy
                </div>
                <h2
                  id={titleId}
                  className="font-display text-display-md leading-tight text-ink"
                >
                  My data &amp; exports
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid place-items-center w-12 h-12 -mr-2 -mt-2 rounded-full hover:bg-canvas text-muted hover:text-ink transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <p className="text-caption leading-relaxed text-ink-soft">
                Everything in your Digital Clinic — reports, quiz answers,
                preferences — lives in your browser only. We don't store any of
                it on our servers.
              </p>

              {stats && (
                <div className="rounded-[14px] border border-line bg-canvas/60 divide-y divide-line/70">
                  <StatRow
                    label="Stored entries"
                    value={String(stats.keyCount)}
                  />
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

              {/* Download is always available — even after a wipe the
                  button still works (just exports an empty payload),
                  which is the right shape: never block the user from
                  taking their own data out. */}
              <Button
                size="md"
                variant="secondary"
                responsiveFullWidth
                leading={<Download size={14} />}
                onClick={handleDownload}
                disabled={stats?.keyCount === 0}
              >
                Download my data (JSON)
              </Button>

              {wiped ? (
                <div className="rounded-[14px] bg-good-soft border border-good/30 p-4 text-caption text-good leading-relaxed">
                  Everything's gone. Your browser storage is empty — refresh the
                  page to start fresh.
                </div>
              ) : confirming ? (
                <div className="rounded-[14px] bg-concern-soft border border-concern/30 p-4 space-y-3">
                  <div className="text-caption leading-relaxed text-ink">
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

              <p className="text-caption text-muted leading-relaxed">
                Inactive reports are auto-deleted after 6 months. Need a copy
                first? Use "Download as PDF" on any report.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-line/70 bg-canvas/40">
              <Button
                variant="primary"
                size="md"
                responsiveFullWidth
                onClick={onClose}
              >
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
      <span className="text-caption uppercase tracking-widest font-bold text-muted">
        {label}
      </span>
      <span className="font-display text-body-sm text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}
