import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Plus, Search, Trash2, X } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Pill from '../../components/Pill';
import StatusBadge from '../../components/StatusBadge';
import { badgeFor, type Report } from '../../data/reports';
import type { LockerSort } from './types';

/* ------------------------------------------------------------------ */
/* LockerPane — body of the "Your reports" disclosure                   */
/*                                                                      */
/* Search + sort controls (only when 3+ reports) + the full grid of    */
/* report cards + the Upload action. The disclosure parent is the       */
/* open/close control, so this pane doesn't need its own collapse       */
/* affordance — when it renders, it renders ALL reports (no cap). The   */
/* previous "see all N reports / show fewer" buttons are gone.         */
/* ------------------------------------------------------------------ */

export default function LockerPane({
  reports,
  displayedReports,
  lockerQuery,
  setLockerQuery,
  lockerSort,
  setLockerSort,
  onUpload,
  onOpenReport,
  onDeleteReport,
}: {
  reports: Report[];
  displayedReports: Report[];
  lockerQuery: string;
  setLockerQuery: (v: string) => void;
  lockerSort: LockerSort;
  setLockerSort: (v: LockerSort) => void;
  onUpload: () => void;
  onOpenReport: (r: Report) => void;
  onDeleteReport: (id: string) => void;
}) {
  // Surface the search + sort row only when the locker holds enough
  // reports to need them. Below 3, the chrome is louder than the
  // content it would control.
  const showControls = reports.length >= 3;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-caption text-muted">
          {reports.length} {reports.length === 1 ? 'report' : 'reports'} on file
        </div>
        <button
          type="button"
          onClick={onUpload}
          aria-label="Upload a new report"
          className="inline-flex items-center justify-center gap-1.5 min-h-12 h-12 w-12 sm:w-auto px-0 sm:px-4 rounded-full bg-indigo-600 text-on-primary text-caption font-semibold shadow-soft hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Upload</span>
        </button>
      </div>

      {showControls && (
        <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              value={lockerQuery}
              onChange={(e) => setLockerQuery(e.target.value)}
              placeholder="Search by filename or lab…"
              aria-label="Filter reports"
              className="w-full h-10 pl-9 pr-9 rounded-full bg-surface border border-line text-caption placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            />
            <AnimatePresence initial={false}>
              {lockerQuery && (
                <motion.button
                  key="clear-locker-search"
                  type="button"
                  onClick={() => setLockerQuery('')}
                  aria-label="Clear search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full text-muted hover:text-ink hover:bg-canvas"
                >
                  <X size={12} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div
            role="radiogroup"
            aria-label="Sort reports"
            className="inline-flex p-0.5 rounded-full bg-surface border border-line text-caption font-semibold shrink-0"
          >
            {(
              [
                { id: 'newest', label: 'Newest' },
                { id: 'oldest', label: 'Oldest' },
                { id: 'lab', label: 'Lab' },
              ] as Array<{ id: LockerSort; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={lockerSort === opt.id}
                onClick={() => setLockerSort(opt.id)}
                className={`h-9 px-3.5 rounded-full transition-colors ${
                  lockerSort === opt.id
                    ? 'bg-indigo-600 text-on-primary'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayedReports.length === 0 ? (
        <Card className="text-center !py-8">
          <div className="text-caption text-ink-soft">
            No reports match{' '}
            <span className="font-semibold text-ink">"{lockerQuery}"</span>.
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => setLockerQuery('')}
          >
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {displayedReports.map((r) => (
            <div key={r.id} className="group min-w-0">
              <Card
                interactive
                onClick={() => onOpenReport(r)}
                className={`h-full ${
                  r.status === 'processing' ? 'animate-pulse-shimmer' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-ink truncate">
                        {r.name}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReport(r.id);
                        }}
                        aria-label={`Delete ${r.name}`}
                        title="Delete this report"
                        className="shrink-0 grid place-items-center w-11 h-11 -mr-2 rounded-full text-muted hover:text-concern hover:bg-concern-soft opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-concern/60"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="text-caption text-muted mt-1 flex items-center gap-1.5 min-w-0">
                      <span className="truncate min-w-0">
                        {r.uploadedOn} · {r.lab}
                      </span>
                      {r.isSample && (
                        <Pill tone="gold" size="sm" className="shrink-0">
                          Sample
                        </Pill>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={badgeFor(r)} />
                    </div>
                    {r.status === 'ready' && r.biomarkers.length > 0 && (
                      <div className="text-caption text-muted mt-0.5">
                        {r.biomarkers.length} marker
                        {r.biomarkers.length === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
