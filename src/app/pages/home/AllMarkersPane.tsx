import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import Card from '../../components/Card';
import MarkerAttentionCard from '../../components/MarkerAttentionCard';
import {
  STATUS_FILTER_OPTIONS,
  type Biomarker,
} from '../../data/biomarkers';
import { getMarkerInfo } from '../../data/markerInfo';
import type { StatusFilter } from './types';

export default function AllMarkersPane({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  isFiltering,
  totalMatches,
  totalMarkers,
  disclosedMarkers,
  onMarkerAction,
  openLearnMore,
  scopeLabel,
  onClearScope,
  flaggedCount,
}: {
  query: string;
  setQuery: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  isFiltering: boolean;
  totalMatches: number;
  totalMarkers: number;
  disclosedMarkers: Biomarker[];
  onMarkerAction: (m: Biomarker) => (() => void) | undefined;
  openLearnMore: (name: string) => (e: React.MouseEvent) => void;
  /** Pathway name when the pane was opened via a Vitals Strip tile —
   *  shown as a removable chip so the implicit scope is visible. */
  scopeLabel?: string;
  onClearScope: () => void;
  /** How many markers are flagged in this report — drives the idle
   *  empty-state copy when the hero already shows them all. */
  flaggedCount: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markers, goals, or tests"
            aria-label="Search markers, goals, or tests"
            className="w-full h-12 pl-10 pr-12 rounded-[14px] bg-canvas/70 border border-line text-body-sm placeholder:text-muted text-ink focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
          />
          <AnimatePresence initial={false}>
            {query && (
              <motion.button
                key="clear-marker-search"
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-12 h-12 rounded-full text-muted hover:text-ink"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pathway scope chip. Present when the pane was opened by tapping a
          Vitals Strip tile — makes the otherwise-invisible category scope
          explicit and removable, so the user isn't left wondering why only
          some markers show. */}
      {scopeLabel && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 pl-3 pr-1.5 h-8 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-caption font-semibold">
            {scopeLabel}
            <button
              type="button"
              onClick={onClearScope}
              aria-label={`Clear ${scopeLabel} filter`}
              className="grid place-items-center w-6 h-6 rounded-full hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* Bleed pattern: -mx-5 expands the scroll viewport past the
       *  Container's px-5 gutters so the leftmost pill aligns to the
       *  Container's outer left edge (rather than its inner content
       *  edge) and the row can scroll edge-to-edge. The matching px-5
       *  restores comfortable padding inside the scroll viewport for
       *  the first and last pills. ReportResultsPage's mobile filter
       *  strip uses the identical pattern — previously this one used
       *  `-mx-1 px-1` which was asymmetric with the parent Container
       *  and could let a long-label pill cause horizontal overflow
       *  on a narrow phone. */}
      <div className="mt-3 overflow-x-auto scrollbar-none -mx-5 px-5">
        <div className="flex gap-2 w-max">
          {STATUS_FILTER_OPTIONS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-4 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-600 text-on-primary shadow-soft'
                    : 'bg-canvas/70 border border-line text-ink-soft hover:border-indigo-300'
                }`}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {isFiltering && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 text-caption text-ink-soft"
        >
          {totalMatches === 0 ? (
            <span>No matches. Try a broader search.</span>
          ) : (
            <span>
              Showing{' '}
              <span className="font-semibold text-ink">{totalMatches}</span> of{' '}
              {totalMarkers} markers
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
              onClearScope();
            }}
            className="ml-2 text-indigo-700 font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {disclosedMarkers.length > 0 ? (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {disclosedMarkers.map((m) => (
            <div key={m.id} className="h-full">
              <MarkerAttentionCard
                marker={m}
                onAction={onMarkerAction(m)}
                onLearnMore={
                  getMarkerInfo(m.name) ? openLearnMore(m.name) : undefined
                }
              />
            </div>
          ))}
        </div>
      ) : isFiltering ? (
        <Card className="mt-4 text-center !py-8">
          <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
            <Search size={20} />
          </div>
          <div className="font-display text-body-lg">Nothing matched.</div>
          <p className="text-caption text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
            Try a different keyword, or switch the filter back to "All markers".
          </p>
        </Card>
      ) : (
        <Card className="mt-4 text-center !py-8">
          <div className="text-caption text-ink-soft leading-relaxed">
            {flaggedCount > 0
              ? 'Every flagged marker is shown up top. Switch the filter to "All markers" to browse the rest of this report.'
              : 'Everything looks healthy. Switch the filter to "All markers" to browse everything in this report.'}
          </div>
        </Card>
      )}
    </div>
  );
}
