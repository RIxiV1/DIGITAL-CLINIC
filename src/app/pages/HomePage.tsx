import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Pill from '../components/Pill';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import StatusBadge from '../components/StatusBadge';
import DashboardHeadline from '../components/DashboardHeadline';
import Illustration from '../components/Illustration';
import MarkerAttentionCard from '../components/MarkerAttentionCard';
import TrendRow from '../components/TrendRow';
import LearnMoreModal from '../components/LearnMoreModal';
import Emoji from '../components/Emoji';
import { useNavigation, useReports } from '../AppContext';
import { useModalA11y } from '../utils/useModalA11y';
import {
  CATALOG_VERSION,
  getTrend,
  STATUS_FILTER_OPTIONS,
  type Biomarker,
  type BiomarkerCategoryId,
  type StatusFilterId,
} from '../data/biomarkers';
import {
  badgeFor,
  getLatestReadyReport,
  getRetestReminder,
  getSampleReportForDashboard,
  type Report,
} from '../data/reports';
import {
  loadCatalogAck,
  loadRetestDismissedReportId,
  saveCatalogAck,
  saveRetestDismissedReportId,
} from '../utils/persistence';
import { getMarkerInfo } from '../data/markerInfo';

type StatusFilter = StatusFilterId;

// Filter labels are sourced from biomarkers.ts STATUS_FILTER_OPTIONS so
// the dashboard, the results page, and any future filter surface read
// the same vocabulary. "Worth a check-in / Borderline" replace the
// older "Needs care / Needs attention" — they describe the data class
// instead of issuing a triage verb, which reads better to anxious
// users browsing their own report.

/**
 * Dashboard (HomePage), restructured for information-architecture sanity.
 *
 * Previous layout dumped ~40 elements on the user's first paint —
 * headline + search + 4 filter pills + up to 6 attention cards + a
 * pathway-grouped trends bento + a locker grid + locker controls. For
 * an anxious health-data context, that's choice overload by the Iyengar
 * definition: too many decisions, surface skimmed, nothing acted on.
 *
 * The new structure shows ONE thing above the fold (the top concern)
 * and hides reference data behind progressive-disclosure affordances.
 * Data and routes are unchanged — only default visibility is. Power
 * users tap once to expand; first-time users see a single emotional
 * anchor plus the headline.
 *
 * Default-visible zones, top to bottom:
 *   1. Headline (data-driven, 4 states)
 *   2. Top concern  — one MarkerAttentionCard, the single most pressing
 *                     flag; carries a "See N more flagged →" link if
 *                     others exist
 *   3. Locker       — most recent report card only; "See all N reports
 *                     →" expands to the full grid + filter/sort
 *   4. Disclosures  — "See all markers" + "Compare to your last report",
 *                     both collapsed by default; each opens a body that
 *                     contains the search/filter pane or the trends pane
 *                     respectively
 *
 * Empty state (no analyzed report) replaces zones 2-4 with the original
 * "what you'll see" preview + sample-data affordance — no point hiding
 * disclosures behind drawers when there's nothing to disclose.
 */
type LockerSort = 'newest' | 'oldest' | 'lab';

export default function HomePage() {
  const { reports, removeReport, saveError, dismissSaveError } = useReports();

  /** Catalog-migration notice. Shown when:
   *    - The user has acknowledged an older CATALOG_VERSION than the
   *      one this build ships with (loadCatalogAck < CATALOG_VERSION).
   *    - AND at least one persisted report has biomarkers stamped at
   *      the older version (or no version) AND has a history field —
   *      meaning the trend merger would have skipped some readings on
   *      the version-mismatch gate.
   *  Dismissed by writing the current CATALOG_VERSION to dc_catalogAck
   *  so it doesn't re-appear until the next bump. */
  const [catalogNoticeDismissed, setCatalogNoticeDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return loadCatalogAck() >= CATALOG_VERSION;
  });
  const showCatalogMigrationNotice = useMemo(() => {
    if (catalogNoticeDismissed) return false;
    // Only show when the user actually has reports affected by the
    // version mismatch — fresh installs (no reports) get no banner.
    return reports.some((r) =>
      r.biomarkers.some(
        (b) =>
          (b.catalogVersion ?? 0) < CATALOG_VERSION &&
          b.history &&
          b.history.length > 0,
      ),
    );
  }, [catalogNoticeDismissed, reports]);
  const dismissCatalogNotice = () => {
    saveCatalogAck(CATALOG_VERSION);
    setCatalogNoticeDismissed(true);
  };
  const { navigate } = useNavigation();

  /** Per-report delete dialog. State lives at the page level so the
   *  one-modal-at-a-time invariant is easy to enforce. */
  const [reportPendingDelete, setReportPendingDelete] = useState<string | null>(
    null,
  );

  const loadSampleData = () => {
    // Navigate to the curated sample report directly. We deliberately
    // do NOT call addReport — that would persist the sample data
    // (testosterone 280 ng/dL, etc.) into the user's locker as if
    // they uploaded it. findReport(userReports, id) already falls
    // back to the curated sample pool, so navigation works without
    // any locker write.
    navigate({ type: 'results', reportId: getSampleReportForDashboard().id });
  };

  const ready = useMemo(() => getLatestReadyReport(reports), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);

  /* ---- Re-test nudge. Surfaced when the user's latest real report is
   *      older than RETEST_REMINDER_DAYS — the retention loop that turns
   *      a one-off upload into an ongoing habit. Dismissal is sticky per
   *      report id (persisted), so it stays gone until they upload a
   *      newer one. ---- */
  const retestReminder = useMemo(() => getRetestReminder(reports), [reports]);
  const [retestDismissedId, setRetestDismissedId] = useState<string | null>(
    () => loadRetestDismissedReportId(),
  );
  const showRetestReminder =
    !!retestReminder && retestDismissedId !== retestReminder.report.id;
  const dismissRetestReminder = () => {
    if (!retestReminder) return;
    saveRetestDismissedReportId(retestReminder.report.id);
    setRetestDismissedId(retestReminder.report.id);
  };

  /* ---- Locker controls — surfaced only when expanded AND 3+ reports.
   *      Showing a search box + sort group while only one card is
   *      visible would be controls louder than the content they control. */
  const [lockerQuery, setLockerQuery] = useState('');
  const [lockerSort, setLockerSort] = useState<LockerSort>('newest');
  const displayedReports = useMemo(() => {
    const tokens = lockerQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const filtered =
      tokens.length > 0
        ? reports.filter((r) => {
            const haystack = `${r.name} ${r.lab}`.toLowerCase();
            return tokens.every((t) => haystack.includes(t));
          })
        : reports;
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

  /* ---- Search + status filter. Drive the marker grid inside the
   *      "See all markers" disclosure. Live at page level so opening
   *      and closing the disclosure preserves typed queries. ---- */
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const trimmedQuery = deferredQuery.trim().toLowerCase();
  const isFiltering = trimmedQuery.length > 0 || statusFilter !== 'all';

  const visibleMarkers = useMemo(() => {
    const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
    return biomarkers.filter((m) => {
      let queryHit = true;
      if (tokens.length > 0) {
        const haystack = [m.name, m.simpleName ?? '', m.plain, m.category]
          .join(' ')
          .toLowerCase();
        queryHit = tokens.every((t) => haystack.includes(t));
      }
      const statusHit = statusFilter === 'all' || m.status === statusFilter;
      return queryHit && statusHit;
    });
  }, [biomarkers, trimmedQuery, statusFilter]);

  /** All flagged markers (critical + concern + attention), sorted
   *  critical → concern → attention. Drives the top-concern hero
   *  (index 0) and the count in the "See N more flagged" link. */
  const flaggedMarkersAll = useMemo(() => {
    const severityRank: Record<Biomarker['status'], number> = {
      critical: 0,
      concern: 1,
      attention: 2,
      good: 3,
    };
    return biomarkers
      .filter(
        (m) =>
          m.status === 'critical' ||
          m.status === 'concern' ||
          m.status === 'attention',
      )
      .sort((a, b) => severityRank[a.status] - severityRank[b.status]);
  }, [biomarkers]);

  /** Markers rendered inside the disclosure body.
   *  - When the user filters: honour the filter exactly (capped at 12).
   *  - When idle: show the flagged list. Opening the disclosure with
   *    nothing typed almost always means "what else is off?" — leading
   *    with flagged is the answer; on-track markers are a step further
   *    behind the "All markers" filter pill. */
  const disclosedMarkers = useMemo(() => {
    if (isFiltering) return visibleMarkers.slice(0, 12);
    return flaggedMarkersAll.slice(0, 12);
  }, [isFiltering, visibleMarkers, flaggedMarkersAll]);

  /** Trends grouped by pathway — body of the "Compare to your last
   *  report" disclosure. */
  const trendsByPathway = useMemo(() => {
    const withHistory = visibleMarkers.filter((m) => getTrend(m) !== null);
    return PATHWAYS.map((p) => ({
      ...p,
      markers: withHistory.filter((m) => p.categories.includes(m.category)),
    })).filter((p) => p.markers.length > 0);
  }, [visibleMarkers]);

  /** Vitals strip — one tile per pathway showing the worst status
   *  present in that pathway's markers ("1 needs care" / "1 borderline"
   *  / "On track"). Sits below the Top Concern as the dashboard's
   *  at-a-glance status board: four chunks, four glances, instead of
   *  re-scanning the marker grid. Filters out pathways with no markers
   *  in this report so an empty pathway doesn't render a "0 on track"
   *  tile that conveys nothing. */
  const pathwayVitals = useMemo(() => {
    return PATHWAYS.map((p) => {
      const markers = biomarkers.filter((m) =>
        p.categories.includes(m.category),
      );
      const critical = markers.filter((m) => m.status === 'critical').length;
      // "concern" tile sum collapses critical + concern into one count —
      // both surface as red tiles with see-a-doctor-priority framing.
      // Critical preserves its semantics via the separate `critical`
      // field so the strip can promote those tiles visually.
      const concern =
        critical + markers.filter((m) => m.status === 'concern').length;
      const attention = markers.filter((m) => m.status === 'attention').length;
      return { ...p, critical, concern, attention, total: markers.length };
    }).filter((p) => p.total > 0);
  }, [biomarkers]);

  /** Disclosure toggles. All three default to false — first paint is
   *  the emotional-anchor view (headline + top concern + vitals strip
   *  only). The locker became the third disclosure in this pass so the
   *  default view shows insight, not file-management chrome. */
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showReports, setShowReports] = useState(false);

  /* Learn More modal — shared across the top concern card, the
   * disclosure body's grid, and the trend rows. */
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openMarkerLM = openMarkerName
    ? (getMarkerInfo(openMarkerName) ?? null)
    : null;

  const openLearnMore = (name: string) => (e: React.MouseEvent) => {
    triggerRef.current = e.currentTarget as HTMLElement;
    setOpenMarkerName(name);
  };
  const closeLearnMore = () => {
    setOpenMarkerName(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const primaryCTA = () => {
    if (!ready) {
      navigate({ type: 'upload' });
      return;
    }
    navigate({ type: 'results', reportId: ready.id });
  };

  const onMarkerAction = (marker: Biomarker) =>
    marker.problemId
      ? () => navigate({ type: 'problem', problemId: marker.problemId! })
      : undefined;

  const topConcern = flaggedMarkersAll[0];
  const moreFlaggedCount = Math.max(0, flaggedMarkersAll.length - 1);
  const totalMatches = visibleMarkers.length;
  const hasAnyMarkers = biomarkers.length > 0;
  const hasTrends = trendsByPathway.length > 0;

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="home" />

      {/* Storage-quota warning. Set by ReportsContext when localStorage
          fails to persist (quota exceeded, private mode, storage
          disabled). Reports still work in memory, but a tab close wipes
          them — telling the user upfront is the only honest move. */}
      {/* Catalog-migration notice. Surfaced once per CATALOG_VERSION
          bump for users whose persisted reports were stamped at an
          older version AND carry history — those trendlines would
          otherwise drop a reading silently after the bump without
          explanation. Dismissible; ack persists across reloads. */}
      {showCatalogMigrationNotice && (
        <Container size="wide" className="pt-4">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 px-4 py-3"
          >
            <span
              aria-hidden
              role="img"
              className="text-body-lg leading-none mt-0.5"
            >
              ℹ️
            </span>
            <div className="flex-1 min-w-0 text-caption leading-relaxed text-ink">
              <div className="font-semibold text-indigo-900">
                We updated our biomarker catalog
              </div>
              <p className="mt-0.5 text-ink-soft">
                Some of your trendlines might be missing readings from older
                reports — that's because the marker shape (id or unit) changed
                between catalog versions, and we don't fuse readings across the
                change. Past reports are still in your locker; we just won't
                merge their history into a different-shaped marker.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissCatalogNotice}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-indigo-700 hover:bg-indigo-100"
            >
              <X size={14} />
            </button>
          </div>
        </Container>
      )}

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
            <div className="flex-1 min-w-0 text-caption leading-relaxed text-ink">
              <div className="font-semibold text-concern">
                Your browser ran out of storage space.
              </div>
              <p className="mt-0.5 text-ink-soft">
                Your reports are still here for now, but closing this tab will
                lose them. Delete some old reports or download them as PDFs to
                free up space.
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

      {/* Re-test nudge. Action-oriented (not just a notice): the user's
          latest real report has aged past the re-check window. Sits with
          the other top-of-page banners; dismissal is sticky per report
          id so it won't nag every load. */}
      {showRetestReminder && retestReminder && (
        <Container size="wide" className="pt-4">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 px-4 py-3"
          >
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
              <CalendarClock size={18} aria-hidden />
            </div>
            <div className="flex-1 min-w-0 text-caption leading-relaxed text-ink">
              <div className="font-semibold text-indigo-900">
                Time for a fresh reading?
              </div>
              <p className="mt-0.5 text-ink-soft">
                It’s been about {retestReminder.months}{' '}
                {retestReminder.months === 1 ? 'month' : 'months'} since{' '}
                <span className="font-medium text-ink">
                  {retestReminder.report.name}
                </span>
                . Most hormone and metabolic markers are worth re-checking every
                3–6 months to see whether your changes are working.
              </p>
              <button
                type="button"
                onClick={() => navigate({ type: 'upload' })}
                className="mt-2 inline-flex items-center min-h-11 font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
              >
                Upload a new report →
              </button>
            </div>
            <button
              type="button"
              onClick={dismissRetestReminder}
              aria-label="Dismiss re-test reminder"
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-indigo-700 hover:bg-indigo-100"
            >
              <X size={14} />
            </button>
          </div>
        </Container>
      )}

      {/* ZONE 1 · Headline */}
      <Container size="wide" className="pt-5 md:pt-8 relative">
        <DashboardHeadline
          markers={ready ? biomarkers : null}
          hasReport={!!ready}
          onPrimaryCTA={primaryCTA}
        />
      </Container>

      {/* ZONE 2a · Empty-state preview. Replaces the entire top-concern
          + disclosures stack when there's no analyzed report — a focused
          "here's what you'll see once you upload" pitch instead of an
          empty dashboard chrome. Moved above Zone 2b so the JSX order
          mirrors what the user sees in each state. */}
      {!ready && reports.every((r) => r.status !== 'ready') && (
        <Container size="wide" className="mt-6 md:mt-8">
          <Illustration
            src="/illustrations/empty-reports.svg"
            className="mx-auto mb-6 w-36 md:w-44 h-auto"
          />
          <Pill tone="indigo" size="sm">
            What you’ll see
          </Pill>
          <h2 className="font-display text-display-md leading-tight mt-2">
            Your dashboard, once you upload
          </h2>
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
                <Emoji label={s.label} className="text-display-md leading-none">
                  {s.icon}
                </Emoji>
                <div className="font-display text-body leading-tight mt-3">
                  {s.title}
                </div>
                <p className="mt-1.5 text-caption text-ink-soft leading-relaxed">
                  {s.copy}
                </p>
              </Card>
            ))}
          </div>
          {reports.length === 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-caption text-ink-soft">
              <span>No report on hand?</span>
              <button
                type="button"
                onClick={loadSampleData}
                className="inline-flex items-center min-h-11 font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
              >
                Load sample data instead
              </button>
            </div>
          )}
        </Container>
      )}

      {/* ZONE 2b · Top concern. Single full-width MarkerAttentionCard
          — the dashboard's emotional anchor. Shown only when there's
          a flagged marker; an all-green report skips this zone since
          the headline carries the message. */}
      {ready && topConcern && (
        <Container size="wide" className="mt-6 md:mt-8">
          <SectionHeading eyebrow="Worth a look" title="The one to focus on" />
          <div className="mt-4">
            <MarkerAttentionCard
              marker={topConcern}
              showExplanation
              onAction={onMarkerAction(topConcern)}
              onLearnMore={
                getMarkerInfo(topConcern.name)
                  ? openLearnMore(topConcern.name)
                  : undefined
              }
            />
          </div>
          {moreFlaggedCount > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowAllMarkers(true)}
                className="inline-flex items-center gap-1 min-h-11 text-caption font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
              >
                See {moreFlaggedCount} more flagged{' '}
                {moreFlaggedCount === 1 ? 'marker' : 'markers'} →
              </button>
            </div>
          )}
        </Container>
      )}

      {/* ZONE 2c · Vitals Strip. One tile per pathway showing the worst
          status present in that pathway's markers. Reads at-a-glance,
          left-to-right, as the dashboard's status board: hormones,
          metabolic, thyroid, nutritional. The Top Concern card answers
          "what's the single thing to act on"; this strip answers "are
          there issues elsewhere I should be aware of?". Filtered down
          to pathways that have any markers in this report so we don't
          render a "0 on track" tile for an absent pathway. */}
      {ready && pathwayVitals.length > 0 && (
        <Container size="wide" className="mt-5 md:mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {pathwayVitals.map((p) => {
              const borderCls =
                p.concern > 0
                  ? 'border-l-concern'
                  : p.attention > 0
                    ? 'border-l-attention'
                    : 'border-l-good';
              const statusText =
                p.concern > 0
                  ? `${p.concern} ${p.concern === 1 ? 'needs' : 'need'} care`
                  : p.attention > 0
                    ? `${p.attention} borderline`
                    : 'On track';
              const statusToneCls =
                p.concern > 0
                  ? 'text-concern'
                  : p.attention > 0
                    ? 'text-attention'
                    : 'text-good';
              return (
                <div
                  key={p.id}
                  className={`bg-surface rounded-[14px] border border-line/70 border-l-4 ${borderCls} shadow-soft p-3 sm:p-3.5`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Emoji
                      label={`${p.name} pathway`}
                      className="text-body-sm leading-none"
                    >
                      {p.icon}
                    </Emoji>
                    <span className="text-micro uppercase tracking-eyebrow font-bold text-muted truncate">
                      {p.name}
                    </span>
                  </div>
                  <div
                    className={`font-semibold text-caption mt-1 ${statusToneCls}`}
                  >
                    {statusText}
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      )}

      {/* ZONE 4 · Disclosures. Three collapsible drawers behind explicit
          user intent. All default-closed so first paint stays the
          emotional-anchor view (headline + top concern + vitals strip).
          Only render the disclosure container when there's at least one
          drawer with content. */}
      {ready && (hasAnyMarkers || hasTrends || reports.length > 0) && (
        <Container size="wide" className="mt-6 md:mt-8">
          <div className="grid gap-3">
            {hasAnyMarkers && (
              <Disclosure
                open={showAllMarkers}
                onToggle={() => setShowAllMarkers((v) => !v)}
                label={
                  showAllMarkers
                    ? 'Hide all markers'
                    : `See all ${biomarkers.length} markers`
                }
                hint={
                  showAllMarkers
                    ? undefined
                    : 'Search, filter, and browse everything'
                }
              >
                <AllMarkersPane
                  query={query}
                  setQuery={setQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  isFiltering={isFiltering}
                  totalMatches={totalMatches}
                  totalMarkers={biomarkers.length}
                  disclosedMarkers={disclosedMarkers}
                  onMarkerAction={onMarkerAction}
                  openLearnMore={openLearnMore}
                />
              </Disclosure>
            )}

            {hasTrends && (
              <Disclosure
                open={showTrends}
                onToggle={() => setShowTrends((v) => !v)}
                label={
                  showTrends ? 'Hide trends' : 'Compare to your last report'
                }
                hint={
                  showTrends
                    ? undefined
                    : `${trendsByPathway.reduce(
                        (sum, p) => sum + p.markers.length,
                        0,
                      )} markers with history`
                }
              >
                <TrendsPane
                  trendsByPathway={trendsByPathway}
                  asOf={ready?.uploadedAt}
                  openLearnMore={openLearnMore}
                />
              </Disclosure>
            )}

            {/* Reports disclosure — the file locker, now hidden behind a
                tap. Default view shows insight (headline + top concern
                + vitals strip), not file-management chrome. Opening
                this exposes the upload action, search/sort controls
                (when 3+ reports), and the full grid of reports. */}
            {reports.length > 0 && (
              <Disclosure
                open={showReports}
                onToggle={() => setShowReports((v) => !v)}
                label={showReports ? 'Hide reports' : `Your reports`}
                hint={
                  showReports
                    ? undefined
                    : `${reports.length} ${reports.length === 1 ? 'report' : 'reports'} · upload, search, delete`
                }
              >
                <LockerPane
                  reports={reports}
                  displayedReports={displayedReports}
                  lockerQuery={lockerQuery}
                  setLockerQuery={setLockerQuery}
                  lockerSort={lockerSort}
                  setLockerSort={setLockerSort}
                  onUpload={() => navigate({ type: 'upload' })}
                  onOpenReport={(r) =>
                    r.status === 'ready'
                      ? navigate({ type: 'results', reportId: r.id })
                      : navigate({ type: 'processing' })
                  }
                  onDeleteReport={(id) => setReportPendingDelete(id)}
                />
              </Disclosure>
            )}
          </div>
        </Container>
      )}

      <BottomNav />

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
/* Disclosure — the progressive-disclosure primitive used by Zone 4    */
/*                                                                      */
/* Renders a full-width card-like button as the trigger; expanded body  */
/* renders below. Chevron rotates 180° when open.                       */
/*                                                                      */
/* Earlier version animated `height: 0 → auto` via framer-motion.       */
/* Killed it because nesting motion children (MarkerAttentionCard,      */
/* TrendRow with their own whileHover / count-up animations) inside a   */
/* parent that's mid-height-animation created a layout-measurement race */
/* — the parent could end up measuring an unstable child height and     */
/* never settle, producing a page that visually "kept growing" as the   */
/* user scrolled past the disclosure. A simple conditional render with  */
/* a CSS-driven chevron rotation is jank-free and indistinguishable in  */
/* feel for the disclosure's actual job (revealing/hiding a panel).     */
/* ------------------------------------------------------------------ */

function Disclosure({
  open,
  onToggle,
  label,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] bg-surface border border-line/70 shadow-soft overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-canvas/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <div className="min-w-0">
          <div className="font-semibold text-body-sm text-ink">{label}</div>
          {hint && (
            <div className="text-caption text-muted mt-0.5 truncate">
              {hint}
            </div>
          )}
        </div>
        <span
          className={`grid place-items-center w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <ChevronDown size={16} />
        </span>
      </button>
      {open && (
        <div className="border-t border-line/70">
          <div className="p-4 sm:p-5">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AllMarkersPane — body of the "See all markers" disclosure           */
/*                                                                      */
/* Contains the search input, status filter pills, match-count live    */
/* region, and the marker grid. Lifted out of the main render so the    */
/* HomePage component stays under the cognitive limit too.              */
/* ------------------------------------------------------------------ */

function AllMarkersPane({
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
            Everything is on track. Switch the filter to "All markers" to browse
            everything in this report.
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TrendsPane — body of the "Compare to your last report" disclosure  */
/* Same pathway-grouped sparkline rows that used to sit always-on;    */
/* now rendered only when the parent disclosure is open.              */
/* ------------------------------------------------------------------ */

function TrendsPane({
  trendsByPathway,
  asOf,
  openLearnMore,
}: {
  trendsByPathway: Array<{
    id: string;
    name: string;
    icon: string;
    categories: BiomarkerCategoryId[];
    markers: Biomarker[];
  }>;
  asOf?: string;
  openLearnMore: (name: string) => (e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid gap-3">
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
            className={`rounded-[18px] bg-canvas/40 border border-line/70 ${borderClass} overflow-hidden`}
          >
            <div className="px-4 pt-4 pb-1 flex items-center gap-2">
              <Emoji
                label={`${group.name} pathway`}
                className="text-body-lg leading-none"
              >
                {group.icon}
              </Emoji>
              <div className="text-micro uppercase tracking-eyebrow font-bold text-indigo-700">
                {group.name}
              </div>
            </div>
            <div className="px-4 pb-2">
              {group.markers.map((m) => (
                <TrendRow
                  key={m.id}
                  marker={m}
                  asOf={asOf}
                  onLearnMore={
                    getMarkerInfo(m.name) ? openLearnMore(m.name) : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LockerPane — body of the "Your reports" disclosure                   */
/*                                                                      */
/* Search + sort controls (only when 3+ reports) + the full grid of    */
/* report cards + the Upload action. The disclosure parent is the       */
/* open/close control, so this pane doesn't need its own collapse       */
/* affordance — when it renders, it renders ALL reports (no cap). The   */
/* previous "see all N reports / show fewer" buttons are gone.         */
/* ------------------------------------------------------------------ */

function LockerPane({
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
            <div key={r.id} className="group">
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
                        className="shrink-0 grid place-items-center w-8 h-8 -mr-1 rounded-full text-muted hover:text-concern hover:bg-concern-soft opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-concern/60"
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

/* ------------------------------------------------------------------ */
/* Per-report delete confirmation                                       */
/*                                                                      */
/* Lives at the page level (one modal at a time) so destruction-of-data */
/* is uniformly Esc/click-out dismissable and shares the focus-trap +   */
/* scroll-lock contract with the rest of the app's modals.              */
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

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

type Pathway = {
  id: string;
  name: string;
  icon: string;
  categories: BiomarkerCategoryId[];
};

// Thyroid lifted out of "hormones" into its own pathway so the
// Vitals Strip can call out thyroid-specific status (TSH/T3/T4 act
// as their own clinical chunk in lab reports). Order is severity-
// adjacent: hormonal/metabolic/thyroid are the "system" reads;
// nutritional comes last because it's a lifestyle-adjacent fix.
const PATHWAYS: Pathway[] = [
  { id: 'hormonal', name: 'Hormonal', icon: '🔥', categories: ['hormones'] },
  {
    id: 'metabolic',
    name: 'Metabolic',
    icon: '⚡',
    categories: ['metabolic', 'heart'],
  },
  { id: 'thyroid', name: 'Thyroid', icon: '🦋', categories: ['thyroid'] },
  {
    id: 'nutritional',
    name: 'Nutritional',
    icon: '☀️',
    categories: ['vitamins'],
  },
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
        <h2 className="font-display text-display-md leading-tight mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-caption text-ink-soft mt-1">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
