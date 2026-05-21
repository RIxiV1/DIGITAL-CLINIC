import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Upload, X } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Pill from '../components/Pill';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import StatusBadge from '../components/StatusBadge';
import DashboardHeadline from '../components/DashboardHeadline';
import MarkerAttentionCard from '../components/MarkerAttentionCard';
import TrendRow from '../components/TrendRow';
import LearnMoreModal from '../components/LearnMoreModal';
import Emoji from '../components/Emoji';
import { useNavigation, useReports } from '../AppContext';
import {
  getTrend,
  type Biomarker,
  type BiomarkerCategoryId,
  type BiomarkerStatus,
} from '../data/biomarkers';
import { badgeFor, getSampleReportForDashboard } from '../data/reports';
import { getMarkerInfo } from '../data/markerInfo';

type StatusFilter = 'all' | BiomarkerStatus;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All markers' },
  { id: 'concern', label: 'Needs care' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'good', label: 'On track' },
];

/**
 * Dashboard (HomePage) restructured per the dashboard brief.
 *
 * Four zones, top to bottom:
 *   1. Dynamic headline insight (data-driven, 4 states)
 *   2. Search/filter bar (controls Zones 3-4)
 *   3. Markers that need attention (red + amber, trend + action + LearnMore)
 *   4. Trends over time (sparklines grouped by pathway)
 *   5. The locker (upload + stored reports)
 */
type LockerSort = 'newest' | 'oldest' | 'lab';

export default function HomePage() {
  const { reports, addReport } = useReports();
  const { navigate } = useNavigation();

  /** Loads the curated sample report into the user's locker so the
   *  empty dashboard becomes a populated dashboard in one click — no
   *  upload required. Lets people see what the product actually does
   *  before doing the work of finding a real report. */
  const loadSampleData = () => {
    if (reports.some((r) => r.id === 'rep-001')) return;
    addReport(getSampleReportForDashboard());
  };

  const ready = useMemo(() => reports.find((r) => r.status === 'ready'), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);

  /* ---- Locker controls — surfaced only when the user has 3+ reports.
   *      For a handful of reports the controls would be visual noise;
   *      once the locker starts feeling like a list, finding a specific
   *      one needs real affordance. ---- */
  const [lockerQuery, setLockerQuery] = useState('');
  const [lockerSort, setLockerSort] = useState<LockerSort>('newest');
  const showLockerControls = reports.length >= 3;
  const displayedReports = useMemo(() => {
    const q = lockerQuery.trim().toLowerCase();
    const filtered = q
      ? reports.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.lab.toLowerCase().includes(q),
        )
      : reports;
    const sorted = [...filtered].sort((a, b) => {
      if (lockerSort === 'lab') return a.lab.localeCompare(b.lab);
      // For newest/oldest, prefer uploadedAt (ISO) when present, fall
      // back to original array position (newest-first per addReport).
      const aKey = a.uploadedAt ?? '';
      const bKey = b.uploadedAt ?? '';
      if (!aKey && !bKey) return 0;
      const cmp = aKey.localeCompare(bKey);
      return lockerSort === 'newest' ? -cmp : cmp;
    });
    return sorted;
  }, [reports, lockerQuery, lockerSort]);

  /* ---- Search + status filter ---- */
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // Deferred query keeps the input feel snappy on slower devices —
  // filtering happens against a slightly stale value while typing.
  const deferredQuery = useDeferredValue(query);
  const trimmedQuery = deferredQuery.trim().toLowerCase();
  const isFiltering = trimmedQuery.length > 0 || statusFilter !== 'all';

  const visibleMarkers = useMemo(() => {
    const q = trimmedQuery;
    return biomarkers.filter((m) => {
      const queryHit =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.simpleName?.toLowerCase().includes(q) ?? false) ||
        m.plain.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      const statusHit = statusFilter === 'all' || m.status === statusFilter;
      return queryHit && statusHit;
    });
  }, [biomarkers, trimmedQuery, statusFilter]);

  // Markers that need attention — red + amber, latest report only.
  // When filtering, the user is explicitly asking to see everything that
  // matches, so we drop the "attention only" gate.
  const attentionMarkers = useMemo(() => {
    if (isFiltering) return visibleMarkers.slice(0, 12);
    return visibleMarkers
      .filter((m) => m.status === 'concern' || m.status === 'attention')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'concern' ? -1 : 1;
        return 0;
      })
      .slice(0, 6);
  }, [visibleMarkers, isFiltering]);

  // Markers with trend data — group by pathway for Zone 3.
  const trendsByPathway = useMemo(() => {
    const withHistory = visibleMarkers.filter((m) => getTrend(m) !== null);
    return PATHWAYS.map((p) => ({
      ...p,
      markers: withHistory.filter((m) => p.categories.includes(m.category)),
    })).filter((p) => p.markers.length > 0);
  }, [visibleMarkers]);

  // Learn More modal state — shared across attention cards + trend rows.
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openMarkerLM = openMarkerName ? getMarkerInfo(openMarkerName) ?? null : null;

  const openLearnMore = (name: string) => (e: React.MouseEvent) => {
    triggerRef.current = e.currentTarget as HTMLElement;
    setOpenMarkerName(name);
  };
  const closeLearnMore = () => {
    setOpenMarkerName(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  // Primary CTA on the headline always lands on something useful.
  const primaryCTA = () => {
    if (!ready) {
      navigate({ type: 'upload' });
      return;
    }
    navigate({ type: 'results', reportId: ready.id });
  };

  // Per-marker action handler — only navigable when the marker has a
  // problemId (we have a real action plan to open). Otherwise the
  // action label renders as muted/informational text — no fake link
  // that promises a destination we don't have.
  const onMarkerAction = (marker: Biomarker) =>
    marker.problemId
      ? () => navigate({ type: 'problem', problemId: marker.problemId! })
      : undefined;

  const totalMatches = visibleMarkers.length;
  const hasAnyContent =
    attentionMarkers.length > 0 || trendsByPathway.length > 0;

  return (
    <div className="min-h-dvh pb-28 lg:pb-12 bg-canvas">
      <Header variant="home" />

      {/* ZONE 1 · Dynamic headline (with embedded health ring) */}
      <Container size="wide" className="pt-5 lg:pt-8 relative">
        <DashboardHeadline
          markers={ready ? biomarkers : null}
          hasReport={!!ready}
          onPrimaryCTA={primaryCTA}
        />
      </Container>

      {/* ZONE 2 · Search + filter. Only renders when there's a report to
          filter — pre-upload the user has nothing to look through. */}
      {ready && biomarkers.length > 0 && (
        <Container size="wide" className="mt-6 lg:mt-8">
          <div className="rounded-[18px] bg-surface border border-line/70 shadow-soft p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  // `type="text"` not "search" so WebKit doesn't render its
                  // own cancel button next to our custom one (which would
                  // be a double X in Safari/Chrome).
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markers, goals, or tests"
                  aria-label="Search markers, goals, or tests"
                  className="w-full h-12 pl-10 pr-12 rounded-[14px] bg-canvas/70 border border-line text-[14px] placeholder:text-muted text-ink focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-12 h-12 rounded-full text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto scrollbar-none -mx-1 px-1">
              <div className="flex gap-2 w-max">
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      // min-h-12 (48px) so the hit area meets the
                      // 48x48 touch-target rule even though the visible
                      // chip is compact.
                      className={`px-4 min-h-12 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white shadow-soft'
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

            {/* aria-live="polite" so AT users hear the count update as
                they type — without focus moving here. role="status"
                groups the message + clear button as a single update. */}
            {isFiltering && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 text-[12px] text-ink-soft"
              >
                {totalMatches === 0 ? (
                  <span>No matches. Try a broader search.</span>
                ) : (
                  <span>
                    Showing <span className="font-semibold text-ink">{totalMatches}</span>{' '}
                    of {biomarkers.length} markers
                  </span>
                )}
                {(query || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setStatusFilter('all');
                    }}
                    className="ml-2 text-indigo-700 font-semibold hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </Container>
      )}

      {/* BENTO ROW · Attention markers (left) + Trends (right) on lg+ */}
      {hasAnyContent && (
        <Container size="wide" className="mt-6 lg:mt-8">
          <div className="grid lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Attention block — col-span-7 on lg, full width otherwise */}
            {attentionMarkers.length > 0 && (
              <section
                className={`${
                  trendsByPathway.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                }`}
              >
                <SectionHeading
                  eyebrow={isFiltering ? 'Matching markers' : 'Needs attention'}
                  title={
                    isFiltering
                      ? 'What you searched for'
                      : 'Markers to act on first'
                  }
                />
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  {attentionMarkers.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                      className="h-full"
                    >
                      <MarkerAttentionCard
                        marker={m}
                        onAction={onMarkerAction(m)}
                        onLearnMore={
                          getMarkerInfo(m.name) ? openLearnMore(m.name) : undefined
                        }
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Trends block — col-span-5 on lg, stacks below on mobile */}
            {trendsByPathway.length > 0 && (
              <section
                className={`${
                  attentionMarkers.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
                }`}
              >
                <SectionHeading
                  eyebrow="Your trends"
                  title="How your numbers have moved"
                />
                <div className="mt-4 grid gap-3">
                  {trendsByPathway.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-[18px] bg-surface border border-line/70 shadow-soft overflow-hidden"
                    >
                      <div className="px-5 pt-5 pb-2 flex items-center gap-2">
                        <Emoji
                          label={`${group.name} pathway`}
                          className="text-[18px] leading-none"
                        >
                          {group.icon}
                        </Emoji>
                        <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-700">
                          {group.name}
                        </div>
                      </div>
                      <div className="px-5 pb-2">
                        {group.markers.map((m) => (
                          <TrendRow
                            key={m.id}
                            marker={m}
                            onLearnMore={
                              getMarkerInfo(m.name)
                                ? openLearnMore(m.name)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Container>
      )}

      {/* Empty state for filtered-to-nothing — distinct from the
          first-time-no-reports state below so the CTA makes sense. */}
      {ready && isFiltering && totalMatches === 0 && (
        <Container size="wide" className="mt-6">
          <Card className="text-center !py-10">
            <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
              <Search size={20} />
            </div>
            <div className="font-display text-[20px]">Nothing matched.</div>
            <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
              Try a different keyword (e.g. "vitamin", "sugar", "heart"), or
              switch the status filter back to "All markers".
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                size="md"
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear filters
              </Button>
            </div>
          </Card>
        </Container>
      )}

      {/* ZONE 4 · Your locker */}
      <Container size="wide" className="mt-6 lg:mt-8">
        <SectionHeading
          eyebrow="Your locker"
          title="All your reports, one place"
          rightSlot={
            <button
              type="button"
              onClick={() => navigate({ type: 'upload' })}
              className="inline-flex items-center gap-1.5 min-h-12 h-12 px-4 rounded-full bg-indigo-600 text-white text-[13px] font-semibold shadow-soft hover:bg-indigo-700"
            >
              <Plus size={14} /> Upload
            </button>
          }
        />

        {showLockerControls && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
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
                className="w-full h-10 pl-9 pr-9 rounded-full bg-surface border border-line text-[13.5px] placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              />
              {lockerQuery && (
                <button
                  type="button"
                  onClick={() => setLockerQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full text-muted hover:text-ink hover:bg-canvas"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Sort reports"
              className="inline-flex p-0.5 rounded-full bg-surface border border-line text-[12px] font-semibold shrink-0"
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
                      ? 'bg-indigo-600 text-white'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.length === 0 ? (
            <Card className="text-center !py-10 sm:col-span-2 lg:col-span-3">
              <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
                <FileText size={20} />
              </div>
              <div className="font-display text-[20px]">No reports yet.</div>
              <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
                Drop a report and we'll translate it into plain English — or open
                the sample first to see exactly what you'll get.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
                <Button
                  size="md"
                  onClick={() => navigate({ type: 'upload' })}
                  leading={<Upload size={14} />}
                >
                  Upload a report
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={loadSampleData}
                >
                  Load sample data
                </Button>
              </div>
            </Card>
          ) : displayedReports.length === 0 ? (
            <Card className="text-center !py-8 sm:col-span-2 lg:col-span-3">
              <div className="text-[13.5px] text-ink-soft">
                No reports match <span className="font-semibold text-ink">"{lockerQuery}"</span>.
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
            displayedReports.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
              >
                <Card
                  interactive={r.status === 'ready'}
                  onClick={() =>
                    r.status === 'ready'
                      ? navigate({ type: 'results', reportId: r.id })
                      : navigate({ type: 'processing' })
                  }
                  className="h-full"
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
                        <StatusBadge status={badgeFor(r)} />
                      </div>
                      <div className="text-[11px] text-muted mt-1">
                        {r.uploadedOn} · {r.lab}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </Container>

      <BottomNav />

      {/* Learn More modal — shared across Zone 2 and Zone 3 marker references */}
      <LearnMoreModal
        open={!!openMarkerLM}
        title={openMarkerName ?? ''}
        subtitle="Marker · Learn more"
        info={openMarkerLM}
        onClose={closeLearnMore}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

type Pathway = {
  id: string;
  name: string;
  icon: string;
  categories: BiomarkerCategoryId[];
};

/** Pathway grouping per the brief: Hormonal · Metabolic · Nutritional.
 *  Heart is folded into Metabolic since LDL is the man's primary
 *  metabolic-vascular risk signal, not a standalone pathway here. */
const PATHWAYS: Pathway[] = [
  { id: 'hormonal',    name: 'Hormonal',   icon: '🔥', categories: ['hormones'] },
  { id: 'metabolic',   name: 'Metabolic',  icon: '⚡', categories: ['metabolic', 'heart'] },
  { id: 'nutritional', name: 'Nutritional', icon: '☀️', categories: ['vitamins'] },
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  rightSlot,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <Pill tone="indigo" size="sm">
          {eyebrow}
        </Pill>
        <h2 className="font-display text-[22px] lg:text-[26px] leading-tight mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] text-ink-soft mt-1">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
