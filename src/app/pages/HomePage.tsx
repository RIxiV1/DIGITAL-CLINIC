import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Info,
  Upload,
  X,
} from 'lucide-react';
import Card from '../components/ui/Card';
import ClinicalSpot from '../components/ClinicalSpot';
import Container from '../components/ui/Container';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import DashboardHeadline from '../components/DashboardHeadline';
import MarkerAttentionCard from '../components/MarkerAttentionCard';
import LearnMoreModal from '../components/LearnMoreModal';
import StatusKey from '../components/StatusKey';
import { useNavigation, useReports } from '../AppContext';
import { CATALOG_VERSION, type Biomarker } from '../data/biomarkers';
import {
  getCombinedSnapshot,
  getPrimaryReport,
  getRetestReminder,
  getSampleReportForDashboard,
} from '../data/reports';
import {
  loadCatalogAck,
  loadRetestDismissedReportId,
  saveCatalogAck,
  saveRetestDismissedReportId,
} from '../utils/persistence';
import { getMarkerInfo } from '../data/markerInfo';
// Extracted dashboard view components + shared types. This page was a
// ~1,600-line monolith; the Explore panes and the delete modal now live
// in ./home/*.
import type { LockerSort, StatusFilter } from './home/types';
import AllMarkersPane from './home/AllMarkersPane';
import TrendsPane from './home/TrendsPane';
import LockerPane from './home/LockerPane';
import DeleteReportConfirm from './home/DeleteReportConfirm';
import SectionHeading from './home/SectionHeading';
import { PATHWAYS } from './home/pathways';
import {
  filterAndSortReports,
  selectVisibleMarkers,
  rankFlaggedMarkers,
  selectDisclosedMarkers,
  groupTrendsByPathway,
  computePathwayVitals,
} from './home/dashboardModel';

// PATHWAYS lives in ./home/pathways now; re-exported so the existing
// HomePage.pathways.test.ts import (`{ PATHWAYS } from './HomePage'`) and
// any other consumer keep resolving unchanged.
export { PATHWAYS } from './home/pathways';

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
type ExploreTab = 'markers' | 'trends' | 'reports';

// How many flagged markers the Top Concern zone (2b) surfaces on first
// paint. Shared so the "All markers" pane can lead with the REST when
// idle — showing the same cards twice (hero + pane) read as a bug, and
// the "See N more flagged →" link promised "more", not "all over again".
const HERO_FLAG_COUNT = 3;

export default function HomePage() {
  const { reports, removeReport, saveError, dismissSaveError } = useReports();
  // Stable id base for associating the Explore toggle buttons with the
  // region they reveal (aria-controls / aria-labelledby).
  const exploreBaseId = useId();

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

  // Primary = the most comprehensive panel, not literally the newest
  // upload — kept for the empty-state gate, the "See all markers" CTA
  // target, and trend dating.
  const ready = useMemo(() => getPrimaryReport(reports), [reports]);
  // Score + markers are UNIONED across all reports (latest value per
  // marker), so a CBC + a separate hormone/fertility panel both count
  // toward the dashboard — matching the Health Map. Single-report users
  // get exactly their one report's markers (no change).
  const snap = useMemo(() => getCombinedSnapshot(reports), [reports]);
  const biomarkers = snap.biomarkers;

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

  // Banner priority queue. All three top-of-page banners could fire at
  // once for a returning user (storage failed + catalog bumped + report
  // aged out), stacking into a wall of admin notices that pushes the Top
  // Concern below the fold. Show only the highest-severity one; dismissing
  // it reveals the next on the following render (each still has its own
  // dismiss). Order: quota (data at risk now) > catalog (trendlines may be
  // missing readings) > retest (a gentle nudge).
  const activeBanner: 'quota' | 'catalog' | 'retest' | null =
    saveError === 'quota'
      ? 'quota'
      : showCatalogMigrationNotice
        ? 'catalog'
        : showRetestReminder && retestReminder
          ? 'retest'
          : null;

  /* ---- Locker controls — surfaced only when expanded AND 3+ reports.
   *      Showing a search box + sort group while only one card is
   *      visible would be controls louder than the content they control. */
  const [lockerQuery, setLockerQuery] = useState('');
  const [lockerSort, setLockerSort] = useState<LockerSort>('newest');
  const displayedReports = useMemo(
    () => filterAndSortReports(reports, lockerQuery, lockerSort),
    [reports, lockerQuery, lockerSort],
  );

  /* ---- Search + status filter. Drive the marker grid inside the
   *      "See all markers" disclosure. Live at page level so opening
   *      and closing the disclosure preserves typed queries. ---- */
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // Pathway scope — set when the user taps a Vitals Strip tile, which
  // opens the markers pane filtered to that pathway's categories. null =
  // no scope. Composes with the search query + status filter; shown as a
  // removable chip inside the pane so it's never a mystery filter.
  const [pathwayScope, setPathwayScope] = useState<string | null>(null);
  const scopeCategories = useMemo(
    () =>
      pathwayScope
        ? (PATHWAYS.find((p) => p.id === pathwayScope)?.categories ?? null)
        : null,
    [pathwayScope],
  );
  const scopeLabel = pathwayScope
    ? PATHWAYS.find((p) => p.id === pathwayScope)?.name
    : undefined;
  const deferredQuery = useDeferredValue(query);
  const trimmedQuery = deferredQuery.trim().toLowerCase();
  const isFiltering =
    trimmedQuery.length > 0 || statusFilter !== 'all' || pathwayScope !== null;

  const visibleMarkers = useMemo(
    () =>
      selectVisibleMarkers(
        biomarkers,
        trimmedQuery,
        statusFilter,
        scopeCategories,
      ),
    [biomarkers, trimmedQuery, statusFilter, scopeCategories],
  );

  /** All flagged markers (critical + concern + attention), sorted
   *  critical → concern → attention. Drives the top-concern hero
   *  (index 0) and the count in the "See N more flagged" link. */
  const flaggedMarkersAll = useMemo(
    () => rankFlaggedMarkers(biomarkers),
    [biomarkers],
  );

  /** Markers rendered inside the disclosure body.
   *  - When the user filters: honour the filter exactly (capped at 12).
   *  - When idle: show the flagged list. Opening the disclosure with
   *    nothing typed almost always means "what else is off?" — leading
   *    with flagged is the answer; on-track markers are a step further
   *    behind the "All markers" filter pill. */
  const disclosedMarkers = useMemo(
    () =>
      selectDisclosedMarkers({
        isFiltering,
        visibleMarkers,
        flaggedMarkersAll,
        biomarkers,
        heroFlagCount: HERO_FLAG_COUNT,
      }),
    [isFiltering, visibleMarkers, flaggedMarkersAll, biomarkers],
  );

  /** Trends grouped by pathway — body of the "Compare to your last
   *  report" disclosure. */
  const trendsByPathway = useMemo(
    () => groupTrendsByPathway(visibleMarkers, PATHWAYS),
    [visibleMarkers],
  );

  /** Vitals strip — one tile per pathway showing the worst status
   *  present in that pathway's markers ("1 needs care" / "1 borderline"
   *  / "On track"). Sits below the Top Concern as the dashboard's
   *  at-a-glance status board: four chunks, four glances, instead of
   *  re-scanning the marker grid. Filters out pathways with no markers
   *  in this report so an empty pathway doesn't render a "0 on track"
   *  tile that conveys nothing. */
  const pathwayVitals = useMemo(
    () => computePathwayVitals(biomarkers, PATHWAYS),
    [biomarkers],
  );

  /** Explore-section tab. The deep content (all markers / trends /
   *  reports) used to be three independent collapsible drawers; opening
   *  more than one stacked them into a page three screens tall. They're
   *  now one segmented control showing a single pane at a time. `null` =
   *  collapsed (the concise emotional-anchor first paint is preserved);
   *  tapping a chip opens its pane, tapping the open chip collapses. */
  const [activeTab, setActiveTab] = useState<ExploreTab | null>(null);

  /* Tapping a Vitals Strip tile opens the markers pane further down the
   * page; on a phone that expansion can land off-screen, reading as "the
   * tap did nothing". Set this flag on a tile tap and, once the pane has
   * rendered, glide it into view. Reduced-motion users get an instant
   * jump. Only fires for tile-driven opens, not every chip toggle. */
  const scrollExploreRef = useRef(false);
  useEffect(() => {
    if (!scrollExploreRef.current || !activeTab) return;
    scrollExploreRef.current = false;
    const el = document.getElementById(`${exploreBaseId}-panel`);
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [activeTab, exploreBaseId]);

  /* Learn More modal — shared across the top concern card, the
   * disclosure body's grid, and the trend rows. */
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openMarkerLM = openMarkerName
    ? (getMarkerInfo(openMarkerName) ?? null)
    : null;
  const openMarkerStatus = openMarkerName
    ? biomarkers.find((m) => m.name === openMarkerName)?.status
    : undefined;

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
  // Surface the worst few flags on first paint (boss card + up to two
  // more) instead of one card with everything else behind a drawer —
  // the dashboard should show what's off, not read empty when it isn't.
  const topFlagged = flaggedMarkersAll.slice(0, HERO_FLAG_COUNT);
  const moreFlaggedCount = Math.max(
    0,
    flaggedMarkersAll.length - topFlagged.length,
  );
  // Reassurance count for the "Where to start" section. Research on
  // abnormal-result communication (patient-portal studies) is consistent:
  // pairing the flagged markers with the in-range majority — and noting one
  // reading isn't the whole story — mitigates the alarm that a wall of
  // "flagged" items triggers. So we close the section with what's FINE, not
  // only what's off.
  const inRangeCount = biomarkers.filter((m) => m.status === 'good').length;
  const totalMatches = visibleMarkers.length;
  const hasAnyMarkers = biomarkers.length > 0;
  const hasTrends = trendsByPathway.length > 0;

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header
        variant="home"
        rightSlot={
          <button
            type="button"
            onClick={() => navigate({ type: 'upload' })}
            aria-label="Upload a report"
            className="inline-flex items-center gap-1.5 h-10 px-3.5 sm:px-4 rounded-full bg-indigo-600 text-on-primary text-caption font-semibold shadow-blue hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <Upload size={15} strokeWidth={2.5} aria-hidden />
            Upload
          </button>
        }
      />

      {/* Storage-quota warning. Set by ReportsContext when localStorage
          fails to persist (quota exceeded, private mode, storage
          disabled). Reports still work in memory, but a tab close wipes
          them — telling the user upfront is the only honest move. */}
      {activeBanner === 'quota' && (
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
              className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-concern hover:bg-concern/10"
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
      {activeBanner === 'retest' && retestReminder && (
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
              className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-indigo-700 hover:bg-indigo-100"
            >
              <X size={14} />
            </button>
          </div>
        </Container>
      )}

      {/* ZONE 1 · Headline */}
      <Container size="wide" className="pt-8 md:pt-14 relative">
        <DashboardHeadline
          markers={ready ? biomarkers : null}
          hasReport={!!ready}
          source={
            ready
              ? snap.reportCount > 1
                ? {
                    name: `your ${snap.reportCount} reports`,
                    uploadedOn: `latest ${snap.latestUploadedOn ?? ready.uploadedOn}`,
                  }
                : { name: ready.name, uploadedOn: ready.uploadedOn }
              : undefined
          }
          onPrimaryCTA={primaryCTA}
        />
        {ready && <StatusKey className="mt-3 px-1" />}
        {/* Screening-indicator caveat. The hero shows a prominent score
            ("100% on track" / "12 need care") a layperson could read as a
            verdict — so the score surfaces (here + the Health Map) carry
            the same "not a diagnosis" framing the report page does, kept
            to one quiet line. */}
        {ready && (
          <p className="mt-2.5 px-1 text-micro text-muted leading-relaxed max-w-[68ch]">
            A screening summary of your lab values — not a diagnosis. Always
            confirm with a doctor before acting on it.
          </p>
        )}
      </Container>

      {/* Catalog-migration notice. Surfaced once per CATALOG_VERSION bump
          for users whose persisted reports were stamped at an older version
          AND carry history. Rendered BELOW the hero deliberately: a frightened
          user must see their health summary first, and this is an informational
          note, not urgent (unlike the quota alert, which stays above). The copy
          is plain language — the versioning mechanics (marker id/unit shape,
          no cross-version fusion) live in the code, not in the user's face.
          Dismissible; ack persists across reloads. */}
      {activeBanner === 'catalog' && (
        <Container size="wide" className="pt-4">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl bg-surface border border-line px-4 py-3"
          >
            <Info
              size={18}
              className="shrink-0 mt-0.5 text-indigo-600"
              aria-hidden
            />
            <div className="flex-1 min-w-0 text-caption leading-relaxed text-ink">
              <div className="font-semibold text-ink">
                Some older trend points may be missing
              </div>
              <p className="mt-0.5 text-ink-soft">
                We changed how a few markers are measured, so some older readings
                don’t line up on the same trend line. Your past reports are safe
                and still open in full.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissCatalogNotice}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-muted hover:bg-canvas"
            >
              <X size={14} />
            </button>
          </div>
        </Container>
      )}

      {/* ZONE 2a · Empty-state preview. Replaces the entire top-concern
          + disclosures stack when there's no analyzed report — a focused
          "here's what you'll see once you upload" pitch instead of an
          empty dashboard chrome. Moved above Zone 2b so the JSX order
          mirrors what the user sees in each state. */}
      {!ready && reports.every((r) => r.status !== 'ready') && (
        <Container size="wide" className="mt-6 md:mt-8">
          {/* The empty archive as the protagonist folder — the same
              paper vocabulary as every other state, waiting for its
              first report. NOT a stock cartoon (the reason type carried
              this moment before): it's the product's own object, small,
              with the editorial serif still the anchor below it. */}
          <ClinicalSpot name="empty-tray" size={104} className="mb-5" />
          <div className="text-micro uppercase tracking-[0.2em] font-semibold text-muted">
            What you’ll see
          </div>
          <h2 className="font-display text-display-lg lg:text-display-xl leading-[1.05] tracking-tight mt-3 max-w-[20ch] text-balance">
            Your dashboard, once you upload.
          </h2>
          <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                title: 'Markers to act on first',
                copy: 'Anything outside the healthy range is pulled up top — concern, then attention.',
              },
              {
                title: 'Trends over time',
                copy: 'Each marker gets a sparkline once you have two or more reports.',
              },
              {
                title: 'A plan, not a panel',
                copy: 'Lab numbers translated into plain English — and what to do about them.',
              },
            ].map((s) => (
              <Card key={s.title}>
                <div className="font-display text-body leading-tight">
                  {s.title}
                </div>
                <p className="mt-1.5 text-caption text-ink-soft leading-relaxed">
                  {s.copy}
                </p>
              </Card>
            ))}
          </div>
          {reports.length === 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-caption text-ink-soft">
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 md:mt-20"
        >
          <Container size="wide">
          <SectionHeading
            eyebrow={
              topConcern.status === 'critical'
                ? 'Needs prompt attention'
                : 'Worth a look'
            }
            eyebrowTone={
              topConcern.status === 'critical' ? 'concern' : 'indigo'
            }
            title={
              topFlagged.length > 1 ? 'Where to start' : 'The one to focus on'
            }
          />
          {/* One grid for all surfaced flags so they share gutters + gaps
              exactly. The boss card (top concern, with its explanation)
              spans both columns; the next flags fill the 2-col grid below
              it, edges aligned to the same track. */}
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 h-full">
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
            {topFlagged.slice(1).map((m) => (
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
          {moreFlaggedCount > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setPathwayScope(null);
                  setActiveTab('markers');
                }}
                className="inline-flex items-center gap-1 min-h-11 text-caption font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
              >
                See {moreFlaggedCount} more flagged{' '}
                {moreFlaggedCount === 1 ? 'marker' : 'markers'} →
              </button>
            </div>
          )}
          {/* Reassurance close — pairs the flagged markers with the in-range
              majority so the section doesn't read as all-bad-news (anxiety
              mitigation, grounded in abnormal-result-communication research). */}
          {inRangeCount > 0 && (
            <p className="mt-4 text-caption text-ink-soft leading-relaxed max-w-2xl">
              The rest — {inRangeCount}{' '}
              {inRangeCount === 1 ? 'marker is' : 'markers are'} in range. One
              reading isn’t the whole story; bring the flagged ones to your
              doctor.
            </p>
          )}
          </Container>
        </motion.div>
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
        <Container size="wide" className="mt-6 md:mt-8">
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
                    ? `${p.attention} to watch`
                    : 'Healthy';
              const statusToneCls =
                p.concern > 0
                  ? 'text-concern'
                  : p.attention > 0
                    ? 'text-attention'
                    : 'text-good';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPathwayScope(p.id);
                    setActiveTab('markers');
                    scrollExploreRef.current = true;
                  }}
                  aria-label={`${p.name}: ${statusText} — view markers`}
                  className={`text-left bg-surface rounded-md border border-line border-l-4 ${borderCls} p-3 sm:p-3.5 transition-colors hover:bg-canvas/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60`}
                >
                  <div className="min-w-0">
                    <span className="text-micro uppercase tracking-eyebrow font-bold text-muted truncate">
                      {p.name}
                    </span>
                  </div>
                  <div
                    className={`font-semibold text-caption mt-1 ${statusToneCls}`}
                  >
                    {statusText}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Bridge to the full Health Map. The Vitals Strip above is the
              four-pathway teaser; this opens the calm whole-body overview
              (every system, not just the headline four). Sits right under
              the strip so the relationship reads "summary → full map". */}
          <button
            type="button"
            onClick={() => navigate({ type: 'healthMap' })}
            className="group mt-2.5 w-full flex items-center gap-2.5 rounded-md border border-line bg-surface/60 hover:bg-surface px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-caption font-semibold text-ink">
                See your full Health Map
              </span>
              <span className="block text-micro text-muted truncate">
                Every system on one calm screen
              </span>
            </span>
            <ChevronRight
              size={16}
              className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </Container>
      )}

      {/* ZONE 4 · Explore. The deep content — every marker, trends, and
          the report locker — used to be three independent drawers that
          stacked into a three-screen wall when more than one was open.
          They're now one segmented control showing a single pane at a
          time, so the page stays short and the sections stay discoverable.
          Collapsed by default to preserve the concise first paint. */}
      {ready &&
        (() => {
          const tabs: { id: ExploreTab; label: string }[] = [];
          if (hasAnyMarkers) tabs.push({ id: 'markers', label: 'All markers' });
          if (hasTrends) tabs.push({ id: 'trends', label: 'Trends' });
          if (reports.length > 0)
            tabs.push({ id: 'reports', label: 'Reports' });
          if (tabs.length === 0) return null;

          const active =
            activeTab && tabs.some((t) => t.id === activeTab)
              ? activeTab
              : null;

          // These chips are NOT an ARIA tab pattern: tapping the open
          // chip collapses the region, so at rest no chip is "selected"
          // — which would be invalid for role="tab" (a tablist must
          // always have a selected tab) and promises arrow-key navigation
          // the control doesn't implement. They're disclosure toggles, so
          // they carry aria-expanded + aria-controls and the revealed
          // panel is a labelled region pointing back at its opener.
          const panelId = `${exploreBaseId}-panel`;
          const chipId = (id: ExploreTab) => `${exploreBaseId}-${id}`;

          return (
            <Container size="wide" className="mt-6 md:mt-8">
              <h2
                id={`${exploreBaseId}-heading`}
                className="text-micro uppercase tracking-eyebrow font-bold text-muted mb-3"
              >
                Explore your data
              </h2>
              <div
                role="group"
                aria-labelledby={`${exploreBaseId}-heading`}
                className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-surface border border-line"
              >
                {tabs.map((t) => {
                  const isActive = t.id === active;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      id={chipId(t.id)}
                      aria-expanded={isActive}
                      aria-controls={isActive ? panelId : undefined}
                      // Tapping the open chip collapses it back to the
                      // concise view; tapping a closed one switches panes.
                      onClick={() =>
                        setActiveTab((prev) => (prev === t.id ? null : t.id))
                      }
                      className={`px-4 h-9 rounded-full text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                        isActive
                          ? 'bg-indigo-600 text-on-primary shadow-soft'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {active && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={chipId(active)}
                  className="mt-3 rounded-lg bg-surface border border-line overflow-hidden"
                >
                  <div className="p-4 sm:p-5">
                    {active === 'markers' && (
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
                        scopeLabel={scopeLabel}
                        onClearScope={() => setPathwayScope(null)}
                        flaggedCount={flaggedMarkersAll.length}
                      />
                    )}
                    {active === 'trends' && (
                      <TrendsPane
                        trendsByPathway={trendsByPathway}
                        asOf={ready?.uploadedAt}
                        openLearnMore={openLearnMore}
                      />
                    )}
                    {active === 'reports' && (
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
                            : // A 'processing' card visible in the locker is
                              // always stale — reaching the locker means the
                              // user left /processing, abandoning that parse
                              // (its single-use File is gone). Routing to
                              // /processing dead-ended on "nothing to parse";
                              // send them to /upload to retry instead.
                              navigate({ type: 'upload' })
                        }
                        onDeleteReport={(id) => setReportPendingDelete(id)}
                      />
                    )}
                  </div>
                </div>
              )}
            </Container>
          );
        })()}

      <BottomNav />

      <LearnMoreModal
        open={!!openMarkerLM}
        title={openMarkerName ?? ''}
        subtitle="Marker · Learn more"
        info={openMarkerLM}
        status={openMarkerStatus}
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
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

