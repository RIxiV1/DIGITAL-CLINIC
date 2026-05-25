import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, FileText, Plus, Search, Trash2, Upload, X } from 'lucide-react';
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
import { useModalA11y } from '../utils/useModalA11y';
import {
  getTrend,
  type Biomarker,
  type BiomarkerCategoryId,
  type BiomarkerStatus,
} from '../data/biomarkers';
import {
  badgeFor,
  getLatestReadyReport,
  getSampleReportForDashboard,
  type Report,
} from '../data/reports';
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
  const { reports, addReport, removeReport, saveError, dismissSaveError } = useReports();
  const { navigate } = useNavigation();

  /** Per-report delete dialog. State lives at the page level so the
   *  one-modal-at-a-time invariant is easy to enforce. `null` ⇒ closed,
   *  a report id ⇒ that row's confirm dialog is open. */
  const [reportPendingDelete, setReportPendingDelete] = useState<string | null>(null);

  /** Loads the curated sample report into the user's locker so the
   *  empty dashboard becomes a populated dashboard in one click — no
   *  upload required. Lets people see what the product actually does
   *  before doing the work of finding a real report. */
  const loadSampleData = () => {
    if (reports.some((r) => r.id === 'rep-001')) return;
    addReport(getSampleReportForDashboard());
  };

  // Use the uploadedAt-sorted helper so we agree with ProblemDetailPage
  // on "the user's latest report". Plain `find()` relies on array order,
  // which breaks when ProcessingPage's failure path prepends a sample
  // report to a locker that already has real uploads — the dashboard
  // would then show sample numbers labelled as the latest.
  const ready = useMemo(() => getLatestReadyReport(reports), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);

  /* ---- Locker controls — surfaced only when the user has 3+ reports.
   *      For a handful of reports the controls would be visual noise;
   *      once the locker starts feeling like a list, finding a specific
   *      one needs real affordance. ---- */
  const [lockerQuery, setLockerQuery] = useState('');
  const [lockerSort, setLockerSort] = useState<LockerSort>('newest');
  const showLockerControls = reports.length >= 3;
  const displayedReports = useMemo(() => {
    // Tokenized locker search — "thyrocare april" should match a report
    // named "April Comprehensive" from "Thyrocare · Mumbai" even though
    // the tokens straddle the name+lab boundary. Single-word queries
    // behave identically to the previous .includes(q) form.
    const tokens = lockerQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered =
      tokens.length > 0
        ? reports.filter((r) => {
            const haystack = `${r.name} ${r.lab}`.toLowerCase();
            return tokens.every((t) => haystack.includes(t));
          })
        : reports;
    // Index map captures original array position so when the primary
    // sort key (uploadedAt or lab) is missing or tied, we fall back to
    // newest-first (addReport prepends, so lower index = newer). Without
    // this, sort returned 0 for missing/equal dates and the browser's
    // stable-sort could still produce platform-dependent ordering.
    const indexById = new Map(reports.map((r, i) => [r.id, i]));
    const fallback = (a: Report, b: Report) =>
      (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    const sorted = [...filtered].sort((a, b) => {
      if (lockerSort === 'lab') {
        const cmp = a.lab.localeCompare(b.lab);
        return cmp !== 0 ? cmp : fallback(a, b);
      }
      const aKey = a.uploadedAt ?? '';
      const bKey = b.uploadedAt ?? '';
      if (!aKey || !bKey || aKey === bKey) return fallback(a, b);
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
    // Tokenized matching: split the query on whitespace and require every
    // token to hit somewhere in the marker's searchable fields. A flat
    // .includes(q) treats the query as a literal substring, so "D Vitamin"
    // would fail to match "Vitamin D (25-OH)" purely because of word
    // order. Tokenizing fixes that without changing single-word behaviour.
    const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
    return biomarkers.filter((m) => {
      let queryHit = true;
      if (tokens.length > 0) {
        const haystack = [
          m.name,
          m.simpleName ?? '',
          m.plain,
          m.category,
        ]
          .join(' ')
          .toLowerCase();
        queryHit = tokens.every((t) => haystack.includes(t));
      }
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

      {/* Storage-quota warning. Set by ReportsContext when localStorage
          fails to persist (quota exceeded, private mode, storage
          disabled). The reports list still works in memory, but a tab
          close wipes everything — telling the user upfront is the only
          honest move. */}
      {saveError === 'quota' && (
        <Container size="wide" className="pt-4">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl bg-concern-soft border border-concern/30 px-4 py-3"
          >
            <AlertTriangle
              size={18}
              className="text-concern shrink-0 mt-0.5"
              aria-hidden
            />
            <div className="flex-1 min-w-0 text-meta leading-relaxed text-ink">
              <div className="font-semibold text-concern">
                Your browser ran out of storage space.
              </div>
              <p className="mt-0.5 text-ink-soft">
                Your reports are still here for now, but closing this tab
                will lose them. Delete some old reports or download them
                as PDFs to free up space.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissSaveError}
              aria-label="Dismiss warning"
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-concern hover:bg-concern/10"
            >
              <X size={14} />
            </button>
          </div>
        </Container>
      )}

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
                  className="w-full h-12 pl-10 pr-12 rounded-[14px] bg-canvas/70 border border-line text-ui-sm placeholder:text-muted text-ink focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
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
                      className={`px-4 min-h-12 rounded-full text-footnote font-semibold whitespace-nowrap transition-colors ${
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
                className="mt-3 text-footnote text-ink-soft"
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
                  {attentionMarkers.map((m) => (
                    // Per-row stagger animation removed — see #6.7.
                    // Section-level Reveal anchors the visual entrance.
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
                  {trendsByPathway.map((group) => {
                    const borderClass =
                      group.id === 'hormonal'
                        ? 'border-l-4 border-l-attention'
                        : group.id === 'metabolic'
                        ? 'border-l-4 border-l-indigo-600'
                        : group.id === 'nutritional'
                        ? 'border-l-4 border-l-good'
                        : '';
                    return (
                      <div
                        key={group.id}
                        className={`rounded-[18px] bg-surface border border-line/70 ${borderClass} shadow-soft overflow-hidden`}
                      >
                      <div className="px-5 pt-5 pb-2 flex items-center gap-2">
                        <Emoji
                          label={`${group.name} pathway`}
                          className="text-body-lg leading-none"
                        >
                          {group.icon}
                        </Emoji>
                        <div className="text-eyebrow uppercase tracking-[0.16em] font-bold text-indigo-700">
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
                  );
                })}
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
            <div className="font-display text-h4">Nothing matched.</div>
            <p className="text-meta text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
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

      {/* "What you'll see once you upload" preview — fills the gap
          between the headline and the locker on tall viewports
          whenever there's no ready report to populate the dashboard.
          Gate is broader than `reports.length === 0` so the same
          preview also shows in the "only a processing entry exists"
          edge case (otherwise that user sees just headline + a
          shimmering locker card and a sea of grey). */}
      {!ready && reports.every((r) => r.status !== 'ready') && (
        <Container size="wide" className="mt-6 lg:mt-8">
          <Pill tone="indigo" size="sm">
            What you’ll see
          </Pill>
          <h2 className="font-display text-h3 lg:text-h2 leading-tight mt-2">
            Your dashboard, once you upload
          </h2>
          {/* sm:2 → md:3 ladder so a 700px portrait tablet doesn't
              crop the third card awkwardly. */}
          <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                icon: '🎯',
                label: 'Target',
                title: 'Markers to act on first',
                copy: 'Anything outside the healthy range is pulled up top — concern, then attention.',
              },
              {
                icon: '📈',
                label: 'Trend',
                title: 'Trends over time',
                copy: 'Each marker gets a sparkline once you have two or more reports.',
              },
              {
                icon: '🧭',
                label: 'Plan',
                title: 'A plan, not a panel',
                copy: 'Lab numbers translated into plain English — and what to do about them.',
              },
            ].map((s) => (
              <Card key={s.title}>
                <Emoji label={s.label} className="text-h3 leading-none">
                  {s.icon}
                </Emoji>
                <div className="font-display text-ui leading-tight mt-3">
                  {s.title}
                </div>
                <p className="mt-1.5 text-footnote text-ink-soft leading-relaxed">
                  {s.copy}
                </p>
              </Card>
            ))}
          </div>
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
              className="inline-flex items-center gap-1.5 min-h-12 h-12 px-4 rounded-full bg-indigo-600 text-white text-meta font-semibold shadow-soft hover:bg-indigo-700"
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
                className="w-full h-10 pl-9 pr-9 rounded-full bg-surface border border-line text-meta placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
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
              className="inline-flex p-0.5 rounded-full bg-surface border border-line text-footnote font-semibold shrink-0"
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
              <div className="font-display text-h4">No reports yet.</div>
              <p className="text-meta text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
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
              <div className="text-meta text-ink-soft">
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
            displayedReports.map((r) => (
              // Per-row stagger removed — see #6.7. Card's whileHover/
              // whileTap still provides interactive feel without the
              // mount-time cost.
              <div key={r.id} className="group">
                <Card
                  // interactive must mirror onClick — both ready and
                  // processing entries are clickable (one opens results,
                  // the other resumes the processing screen) and both
                  // need hover/focus states for keyboard a11y.
                  interactive
                  onClick={() =>
                    r.status === 'ready'
                      ? navigate({ type: 'results', reportId: r.id })
                      : navigate({ type: 'processing' })
                  }
                  className={`h-full ${r.status === 'processing' ? 'animate-pulse-shimmer' : ''}`}
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
                        {/* StatusBadge + trash share one cluster so the
                            delete affordance never absolute-positions on
                            top of the badge. On lg+ the trash sits hidden
                            until hover/focus-within; on mobile it's
                            persistent (no hover state). */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={badgeFor(r)} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportPendingDelete(r.id);
                            }}
                            aria-label={`Delete ${r.name}`}
                            title="Delete this report"
                            className="grid place-items-center w-7 h-7 rounded-full text-muted hover:text-concern hover:bg-concern-soft opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-concern/60"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="text-caption text-muted mt-1 flex items-center gap-1.5">
                        <span className="truncate">
                          {r.uploadedOn} · {r.lab}
                        </span>
                        {r.isSample && (
                          /* Demo data — never confuse the user about
                             which numbers are theirs vs the curated
                             example. Pill stays small so it doesn't
                             compete with the real report rows. */
                          <Pill tone="gold" size="sm" className="shrink-0">
                            Sample
                          </Pill>
                        )}
                      </div>
                      {/* Marker count — only on ready reports with values
                          extracted. Lets the user pick "the richer one"
                          when several reports are siblings rather than
                          opening each to count. */}
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

      <DeleteReportConfirm
        report={reports.find((r) => r.id === reportPendingDelete) ?? null}
        onCancel={() => setReportPendingDelete(null)}
        onConfirm={() => {
          if (reportPendingDelete) removeReport(reportPendingDelete);
          setReportPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-report delete confirmation                                       */
/*                                                                      */
/* Lives at the page level (one modal at a time) rather than on each    */
/* card so destruction-of-data is uniformly Esc/click-out dismissable   */
/* and shares the focus-trap + scroll-lock contract with the rest of    */
/* the app's modals. We mirror DataPanelModal's a11y wiring on purpose. */
/* ------------------------------------------------------------------ */

function DeleteReportConfirm({
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
    // No initialFocusRef — the hook lands on the first focusable in the
    // card, which is the Cancel button (the safe default for destructive
    // confirmations).
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
                <p className="mt-1.5 text-meta text-ink-soft leading-relaxed break-words">
                  <span className="font-semibold text-ink">{report.name}</span>
                  {' '}({report.lab}) will be removed from your locker. This
                  can’t be undone.
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
        <h2 className="font-display text-h3 lg:text-h2 leading-tight mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-meta text-ink-soft mt-1">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
