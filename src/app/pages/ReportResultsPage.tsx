import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BiomarkerBar from '../components/BiomarkerBar';
import BottomNav from '../components/BottomNav';
import StatusKey from '../components/StatusKey';
import { Reveal } from './landing/shared';
import { useIsMdUp } from '../hooks/useMediaQuery';
import { useNavigation, useQuiz, useReports } from '../AppContext';
import {
  markerContextNote,
  reportProvenanceNote,
  buildBodySystems,
  connectedStoryHeadline,
  healthStorySentence,
  explainFinding,
  explainChange,
  type BodySystemId,
} from '../clinical';
import ConnectedSystems from '../components/ConnectedSystems';
import FindingExplanation from '../components/FindingExplanation';
import MarkerSheet from '../components/MarkerSheet';
import ReportAboutPanel from '../components/ReportAboutPanel';
import {
  biomarkersByCategory,
  bottomLineFor,
  categories,
  statusColor,
  STATUS_FILTER_OPTIONS,
  summarizeStatuses,
  type Biomarker,
  type StatusFilterId,
} from '../data/biomarkers';
import { findReport } from '../data/reports';

type Filter = StatusFilterId;

export default function ReportResultsPage({
  reportId,
  view,
}: {
  reportId: string;
  view?: 'details';
}) {
  const { reports } = useReports();
  const { navigate } = useNavigation();
  // Progressive disclosure: the calm Overview (default) vs. the full marker
  // explorer ('details' → /reports/:id/markers). Same component; the URL
  // picks the layer. Same page-key means no remount between them, so a tap
  // on a Health Map system can deep-scroll into the details view.
  const isDetails = view === 'details';
  const { quiz } = useQuiz();
  // findReport falls back to the curated sample-reports list, so links
  // like /results/rep-001 keep working even though the user's locker
  // starts empty.
  const report = findReport(reports, reportId);
  // Ready reports in the user's locker (newest first) — powers the quick
  // switcher so moving between reports is one tap from inside a report,
  // instead of back → Home → Reports tab → tap.
  const readyReports = useMemo(
    () =>
      reports
        .filter((r) => r.status === 'ready')
        // ISO date strings sort chronologically; newest first.
        .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '')),
    [reports],
  );
  // Single source of truth for the md+ layout switch. Mirrors the
  // BottomNav pattern: viewport-class branches mount different DOM
  // subtrees, instead of shipping both and hiding one with `md:hidden`
  // / `hidden md:block`. The Deep Dives card and the desktop sidebar
  // both consume this so we never pay the DOM + event-listener cost
  // for the invisible variant.
  const isMdUp = useIsMdUp();
  const [filter, setFilter] = useState<Filter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Hooks must be called unconditionally — derive everything off an empty
  // biomarker list when the report isn't found, then render the "not found"
  // view below. This keeps hook order stable across renders.
  const biomarkers = report?.biomarkers ?? [];
  // Status filtering only earns its screen space on a dense report. On a
  // short panel (a lipid or thyroid check) the collapse-by-default category
  // cards are enough — a row of filter pills there reads as admin chrome,
  // not part of the narrative. Threshold: keep it hidden until ~9+ markers.
  const showStatusFilter = biomarkers.length > 8;

  const filtered = useMemo(() => {
    return biomarkers.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (activeCategory !== 'all' && m.category !== activeCategory)
        return false;
      return true;
    });
  }, [biomarkers, filter, activeCategory]);

  const summary = useMemo(() => summarizeStatuses(biomarkers), [biomarkers]);

  const bottomLine = useMemo(() => bottomLineFor(biomarkers), [biomarkers]);

  // "How sure are you?" — the worried-human's 4th question, answered once
  // here rather than card by card. Clean reads get a quiet affirmation;
  // unclear photo scans get an up-front heads-up that ties to the inline
  // per-card flags below.
  const provenance = useMemo(
    () => reportProvenanceNote(biomarkers),
    [biomarkers],
  );

  // The signature "Connected Systems" model — the report's markers folded
  // into the five men's-health systems, hormonal hub at the centre.
  const bodySystems = useMemo(() => buildBodySystems(biomarkers), [biomarkers]);
  const storyHeadline = useMemo(
    () => connectedStoryHeadline(bodySystems),
    [bodySystems],
  );
  const systemStory = useMemo(
    () => healthStorySentence(bodySystems),
    [bodySystems],
  );
  // The core experience: the four-question, person-first explanation.
  const explanation = useMemo(
    () => explainFinding(biomarkers, quiz),
    [biomarkers, quiz],
  );
  // The longitudinal twin — "what changed since last time" — when this
  // report carries history from a prior one. Leads when present.
  const change = useMemo(() => explainChange(biomarkers, quiz), [biomarkers, quiz]);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  // Mobile marker detail opens in a focused sheet rather than expanding the
  // whole list inline (functional audit #6).
  const [sheetMarker, setSheetMarker] = useState<Biomarker | null>(null);

  const groups = useMemo(() => biomarkersByCategory(filtered), [filtered]);
  const presentCategoryIds = useMemo(
    () => new Set(biomarkers.map((m) => m.category)),
    [biomarkers],
  );

  const deepDives = useMemo(
    () =>
      biomarkers.filter((m) => m.problemId && m.status !== 'good').slice(0, 4),
    [biomarkers],
  );

  // The single most-pressing flagged marker — powers the closing "what
  // now" step so the page ends on a concrete action, not a stop.
  const topFlagged = useMemo(() => {
    const rank: Record<string, number> = {
      critical: 3,
      concern: 2,
      attention: 1,
    };
    const flagged = biomarkers.filter((m) => m.status !== 'good');
    return flagged.length
      ? flagged.reduce((worst, m) =>
          (rank[m.status] ?? 0) > (rank[worst.status] ?? 0) ? m : worst,
        )
      : null;
  }, [biomarkers]);

  // The open marker's same-SYSTEM companions (the Health Map system it
  // belongs to, minus itself) — shown in the sheet as "connected markers"
  // so a reading is never seen in isolation. Same-system co-occurrence,
  // never a fabricated causal claim (mirrors explainFinding's honesty rail).
  const sheetRelated = useMemo(() => {
    if (!sheetMarker) return null;
    const sys = bodySystems.find((s) =>
      s.categories.includes(sheetMarker.category),
    );
    if (!sys) return null;
    const markers = biomarkers.filter(
      (m) => m.id !== sheetMarker.id && sys.categories.includes(m.category),
    );
    return markers.length ? { markers, systemLabel: sys.label } : null;
  }, [sheetMarker, bodySystems, biomarkers]);

  /** Per-category expansion. Everything starts COLLAPSED — the calm read.
   *  The verdict, the one-thing explanation, and the Health Map already
   *  surface what matters up top; the full marker list is reference detail,
   *  there on a tap, not a wall the user has to scroll past. Collapsed
   *  headers still show status + counts, so nothing flagged is hidden — it's
   *  just not shouting. (A stressed user shouldn't land in a 47-row dump.)
   *  Local state per visit; resets on navigation (pageKey remount). */
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleCategory = (id: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  /** Filtering ("Needs care", "On track") or picking a single category
   *  is an explicit "show me this" intent — force-expand every visible
   *  category so the markers the user asked to see are actually
   *  rendered. The toggle is only meaningful when neither filter is
   *  set, so we hide the chevron in those cases too. */
  const filtersAreNarrowing = filter !== 'all' || activeCategory !== 'all';
  const isCategoryOpen = (id: string) =>
    filtersAreNarrowing || expandedCategoryIds.has(id);

  // The systems map as navigation: tapping a system opens its categories
  // and scrolls to the first present one — "the story drives navigation"
  // instead of leaving the user to scroll-hunt for the section.
  const handleSelectSystem = useCallback(
    (id: BodySystemId) => {
      const sys = bodySystems.find((s) => s.id === id);
      if (!sys) return;
      setExpandedCategoryIds((prev) => {
        const next = new Set(prev);
        sys.categories.forEach((c) => next.add(c));
        return next;
      });
      const firstPresent = sys.categories.find((c) =>
        presentCategoryIds.has(c),
      );
      if (firstPresent) setScrollTarget(`system-cat-${firstPresent}`);
      // From the Overview, tapping a system on the Health Map is a
      // navigation into the detail — go to the markers view (the scroll
      // target + expansion above persist across the mode switch, so the
      // details view lands already scrolled to that system and glowing).
      if (!isDetails) {
        navigate({ type: 'results', reportId, view: 'details' });
      }
    },
    [bodySystems, presentCategoryIds, isDetails, navigate, reportId],
  );
  // The system section that should glow once, right after the map scrolls
  // to it — the visual "the map pointed me here" handoff.
  const [glowCategoryId, setGlowCategoryId] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollTarget) return;
    document
      .getElementById(scrollTarget)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // scrollTarget is `system-cat-<categoryId>` — pull the category id back
    // out so the destination section can bloom once on arrival.
    const catId = scrollTarget.replace(/^system-cat-/, '');
    setGlowCategoryId(catId);
    setScrollTarget(null);
    const t = window.setTimeout(() => setGlowCategoryId(null), 1700);
    return () => clearTimeout(t);
  }, [scrollTarget]);

  // Ref-based dedup so a double-tap on the download button doesn't
  // produce two PDFs while the lazy chunk is still resolving.
  const pdfBusyRef = useRef(false);
  const handleDownload = async () => {
    if (!report || pdfBusyRef.current) return;
    pdfBusyRef.current = true;
    try {
      // Lazy import — jspdf + its peer html2canvas add ~400KB to the
      // bundle, and most sessions never hit the download button. Keep
      // it out of the main chunk; load only on first click.
      const { generateReportPdf } = await import('../services/reportPdf');
      generateReportPdf(report);
    } finally {
      pdfBusyRef.current = false;
    }
  };

  if (!report) {
    return (
      <div className="min-h-dvh flex flex-col bg-canvas">
        <Header variant="page" title="Report not found" />
        {/* Centered in the available viewport — without flex-1, this short
            "not found" message floats near the top of a tall screen with
            empty grey scroll below. */}
        <div className="flex-1 grid place-items-center px-6 py-10">
          <div className="text-center max-w-md">
            <h1 className="font-display text-display-md leading-tight">
              We couldn’t find that report.
            </h1>
            <p className="mt-3 text-body-sm text-ink-soft leading-relaxed">
              It may have been removed, or the link may be out of date. Head
              back to your dashboard to pick another one.
            </p>
            <Button className="mt-6" onClick={() => navigate({ type: 'home' })}>
              Back to dashboard
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header
        variant="page"
        title={report.name}
        subtitle={`${report.uploadedOn} · ${report.lab}`}
        rightSlot={
          <button
            onClick={handleDownload}
            className="grid place-items-center w-12 h-12 -mr-2 rounded-full hover:bg-indigo-50 text-indigo-700 no-print"
            aria-label="Download as PDF"
            title="Download as PDF"
          >
            <Download size={18} />
          </button>
        }
      />

      {/* ===== OVERVIEW — the calm "am I okay?" layer (default) ===== */}
      {!isDetails && (
        <>
      {/* Report switcher — one tap between your reports, so you never have
          to go back out to the locker. Only when there's more than one. */}
      {readyReports.length > 1 && (
        <Container size="wide" className="pt-4 no-print">
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 pb-0.5">
            {readyReports.map((r) => {
              const active = r.id === reportId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    active
                      ? undefined
                      : navigate({ type: 'results', reportId: r.id })
                  }
                  aria-current={active ? 'true' : undefined}
                  className={`shrink-0 inline-flex items-center min-h-11 px-4 rounded-full text-caption font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                    active
                      ? 'bg-indigo-600 text-on-primary shadow-soft'
                      : 'bg-surface border border-line text-ink-soft hover:border-indigo-300'
                  }`}
                >
                  {r.uploadedOn}
                </button>
              );
            })}
          </div>
        </Container>
      )}
      {/* The Bottom Line — full-width hero */}
      <Container size="wide" className="pt-5 md:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            raised
            className="bg-surface border border-line/70 text-ink relative overflow-hidden !p-5 sm:!p-6 lg:!p-8"
          >
            {/* Single-column layout. The 1/3 column on the right used
                to carry three display-md count tiles (good / attention
                / concern) — that's three large numbers competing with
                the bottom-line prose for focal weight on a card whose
                only job is to deliver one summary. Counts still live
                here, now as a small dot strip beneath the prose:
                supporting metadata, not a parallel focal point. */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <Pill tone="indigo" size="sm">
                  The Bottom Line
                </Pill>
                <span className="text-micro uppercase tracking-label font-bold text-muted">
                  {report.uploadedOn}
                </span>
              </div>

              <p className="mt-4 font-display text-display-md leading-[1.2] text-balance">
                {bottomLine}
              </p>

              {/* Orienting line — relax (or get the right urgency) before
                  reading a word, plus an honest reading-time estimate. */}
              <p className="mt-3 text-caption text-ink-soft">
                {summary.critical > 0
                  ? 'One result needs attention today — start with the flagged items.'
                  : 'Nothing here needs same-day attention.'}
                <span className="text-muted">
                  {' '}· about {Math.max(2, Math.round(biomarkers.length * 0.25))}{' '}
                  min to read
                </span>
              </p>

              {/* Status-count signal. Kept the inline dot+number+label
                  pattern (integrates with the gold hero's text-indigo-900
                  treatment) but dropped the "N on track" branch and
                  hide the whole row when nothing is flagged.
                  Why not a single Pill atom: a `tone="concern"` Pill
                  renders bg-concern-soft (light red) on top of bg-gold-500,
                  and the two warm-ish wash colors clash. Inline dots
                  in the existing dark-text-on-gold register read as
                  metadata on the hero — not a second focal element.
                  Drop reason: the old strip broadcast all three status
                  buckets in parallel with the headline + the per-marker
                  pills further down. Three encodings of one axis →
                  Von Restorff fails. "12 on track" alongside a
                  triumphant headline reads like a participation trophy
                  and dilutes the flagged counts when they exist. */}
              {(summary.needCare > 0 || summary.attention > 0) && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption font-semibold text-ink-soft no-print">
                  {summary.needCare > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full bg-concern"
                        aria-hidden
                      />
                      <span className="tabular-nums">{summary.needCare}</span>
                      <span>
                        {summary.needCare === 1 ? 'needs' : 'need'} care
                      </span>
                    </span>
                  )}
                  {summary.attention > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full bg-attention"
                        aria-hidden
                      />
                      <span className="tabular-nums">{summary.attention}</span>
                      <span>to watch</span>
                    </span>
                  )}
                </div>
              )}

              {/* Data-provenance line — "how sure are you?" answered once.
                  Quiet for a clean read; amber-tinted when some photo
                  scans need a double-check (mirrors the per-card flag
                  colour below). */}
              {provenance && (
                <p
                  className={`mt-4 text-caption leading-snug ${
                    provenance.tone === 'flagged'
                      ? 'text-attention-ink font-medium'
                      : 'text-ink-soft'
                  }`}
                >
                  {provenance.text}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 no-print">
                <Button
                  variant="secondary"
                  size="sm"
                  leading={<Download size={14} />}
                  onClick={handleDownload}
                >
                  Download as PDF
                </Button>
                {/* Share button removed — the URL doesn't carry the
                    report data (reports live in localStorage on this
                    device), so a "share" produced a link that resolved
                    to the curated sample report or a not-found page
                    on the recipient's side. Send the PDF instead;
                    Download as PDF is the legitimate share path. */}
              </div>
            </div>
          </Card>
        </motion.div>
      </Container>

      {/* Mobile-only "Suggested deep dives" — promoted above the marker
          categories so the action items sit directly under the Bottom
          Line, before the reference data. Desktop has the same content
          in the sticky sidebar (always visible while scrolling).
          Previously both blocks shipped to the DOM with `md:hidden` /
          `hidden md:block` deciding which was visible — same JSX
          shipped twice. Now we mount exactly one tree based on the
          `useIsMdUp` viewport check (the BottomNav pattern), so the
          invisible variant doesn't cost DOM + event-listener overhead. */}
      {/* ONE explanation, not two. A returning user gets the journey ("what
          changed since last time"); a first-timer gets the current-state
          read. Showing both stacked two four-beat blocks before the user even
          reached a marker — too long. Pick the one that fits. */}
      {(change ?? explanation) && (
        <Container size="wide" className="mt-10 md:mt-14">
          <FindingExplanation
            data={(change ?? explanation)!}
            eyebrow={change ? 'Since your last test' : undefined}
          />
        </Container>
      )}

      {/* Signature moment — "your body as one connected system". Leads the
          body of the report, right under the Bottom Line. Built on the same
          markers, it reframes the wall of values as one story before the
          user scrolls into the per-marker detail. (Home is the eventual
          stage for this; it's the other agent's lane right now, so it lives
          on the report first.) */}
      {biomarkers.length > 0 && (
        <Container size="wide" className="mt-8 md:mt-12">
          {/* The real, interactive Connected Systems map. The signature
              report→map MORPH deliberately lives ONLY on the Health Map
              page arrival (first-visit cinematic) — replaying it mid-scroll
              here gated the content the user was scrolling toward and
              diluted the signature. The earned interaction on the report is
              tap-a-node → scroll + glow, not an entrance animation. */}
          <ConnectedSystems
            systems={bodySystems}
            headline={storyHeadline}
            story={systemStory}
            onSelectSystem={handleSelectSystem}
          />
        </Container>
      )}

      {!isMdUp && deepDives.length > 0 && (
        <Container size="wide" className="mt-6 no-print">
          <div className="font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
            Suggested deep dives
          </div>
          <h2 className="font-display text-display-md leading-tight mt-1">
            What I’d look at first
          </h2>

          <div className="mt-4 grid gap-3">
            {deepDives.slice(0, 3).map((m) => {
              const c = statusColor(m.status);
              return (
                <Card
                  key={m.id}
                  interactive
                  onClick={() =>
                    navigate({ type: 'problem', problemId: m.problemId! })
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-micro uppercase tracking-label font-bold text-muted">
                        {m.name}
                      </div>
                      <div className="font-semibold leading-tight mt-0.5">
                        {m.status === 'critical'
                          ? 'Same-day medical attention is appropriate'
                          : m.status === 'concern'
                            ? 'Action plan + retest cadence'
                            : 'See what to tweak this month'}
                      </div>
                      <div
                        className={`text-caption mt-1 ${c.textOnSurface} font-bold uppercase tracking-widest`}
                      >
                        {c.label}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted" />
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      )}

      {/* Bridge to the full data — the single calm handoff from
          "understand" to "inspect". 95% of readers never need to scroll
          every marker; this is the door for those who do. */}
      <Container size="wide" className="mt-8">
        <button
          type="button"
          onClick={() =>
            navigate({ type: 'results', reportId, view: 'details' })
          }
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-left shadow-soft hover:border-indigo-300 transition-colors no-print"
        >
          <div className="min-w-0">
            <div className="font-display text-body-lg leading-tight text-ink">
              View all {biomarkers.length} results
            </div>
            <div className="text-caption text-muted mt-0.5">
              Every marker we read, grouped by category.
            </div>
          </div>
          <ChevronRight size={20} className="text-indigo-700 shrink-0" />
        </button>
      </Container>

      {/* Destination — the "what now" close. Lives here (out of the marker
          explorer) so the Overview ends on one clear next action. */}
      <Container size="wide" className="mt-6">
        <Card className="bg-indigo-50/60 border-indigo-100 no-print">
          <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700">
            What now
          </div>
          {topFlagged ? (
            <>
              <h2 className="font-display text-display-md leading-tight mt-1.5 text-balance">
                Start with {topFlagged.name}.
              </h2>
              <p className="mt-2 text-body-sm text-ink-soft max-w-xl">
                It’s the one result worth a closer look. Open it to see what it
                means and what to do — then take a summary to your doctor to
                talk it through.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-display-md leading-tight mt-1.5 text-balance">
                You’re all set.
              </h2>
              <p className="mt-2 text-body-sm text-ink-soft max-w-xl">
                Everything we read is in range. Keep the basics dialled in,
                re-test in 6–12 months, and save a copy for your records.
              </p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2.5">
            {topFlagged && (
              <Button
                variant="primary"
                size="sm"
                trailing={<ChevronRight size={15} />}
                onClick={() =>
                  topFlagged.problemId
                    ? navigate({
                        type: 'problem',
                        problemId: topFlagged.problemId,
                      })
                    : setSheetMarker(topFlagged)
                }
              >
                Review {topFlagged.name}
              </Button>
            )}
            <Button
              variant={topFlagged ? 'secondary' : 'primary'}
              size="sm"
              leading={<Download size={14} />}
              onClick={handleDownload}
            >
              Save a summary for your doctor
            </Button>
          </div>
        </Card>
      </Container>
        </>
      )}

      {/* ===== DETAILED RESULTS — the "inspect the data" layer ===== */}
      {isDetails && (
        <>
      <Container size="wide" className="pt-4 md:pt-6">
        <button
          type="button"
          onClick={() => navigate({ type: 'results', reportId })}
          className="inline-flex items-center gap-1 -ml-1 px-1 min-h-11 text-caption font-semibold text-indigo-700 hover:text-indigo-900 no-print"
        >
          <ChevronLeft size={16} /> Back to overview
        </button>
        <h1 className="font-display text-display-md leading-tight mt-1 text-balance">
          All results
        </h1>
        <p className="text-caption text-muted mt-1">
          {biomarkers.length} markers we read, grouped by category. Tap any one
          for the detail.
        </p>
      </Container>

      {/* Body: 2-col on md — left biomarkers, right sticky filters + deep dives */}
      <Container size="wide" className="mt-6 md:mt-8">
        {/* Colour key — this page is the most status-dense surface, so the
            green/amber/red language is defined right where the markers are. */}
        <StatusKey className="mb-4" />
        <div className="grid md:grid-cols-12 gap-6 md:gap-8">
          {/* LEFT — Biomarker groups.
              min-w-0: a grid item defaults to min-width:auto, so the
              horizontal-scroll filter strip (`w-max` row inside
              `overflow-x-auto`) would force this column wider than the
              mobile viewport — pushing the whole page to ~547px on a
              393px screen and clipping content on the right. min-w-0 lets
              the column shrink to its track so the strip scrolls inside
              its own bounds instead of blowing out the layout. */}
          <main className="md:col-span-8 min-w-0">
            {/* "Not a diagnosis" disclaimer used to sit here, above the
                filters and markers. Demoted to a footnote below the
                marker list — the message is necessary, but blocking
                the data the user came for with a re-read-it-every-time
                banner inverts progressive disclosure. The disclaimer
                belongs adjacent to the data it disclaims, not gating
                access to it. */}

            {/* Mobile/tablet status filter strip. The matching CATEGORY
                chip strip used to sit below this — now removed: once
                category cards collapse-by-default, tapping a category
                header serves the same "focus on this category" role
                the chip strip did, without the parallel scroll
                surface. Two stacked horizontal scrollers became one;
                ~25 lines of duplicate affordance gone. Desktop keeps
                the category list in the sticky sidebar where space is
                cheap. */}
            {showStatusFilter && (
              <div className="md:hidden no-print">
                <div className="overflow-x-auto scrollbar-none -mx-5 px-5">
                  <div className="flex gap-2 w-max">
                    {STATUS_FILTER_OPTIONS.map((f) => {
                      const active = filter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`px-4 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
                            active
                              ? 'bg-indigo-600 text-on-primary shadow-soft'
                              : 'bg-surface border border-line text-ink-soft hover:border-indigo-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {groups.length === 0 ? (
              <Card className="text-center !py-10 mt-4 md:mt-0">
                <div className="font-display text-display-md">
                  Nothing in that bucket.
                </div>
                <p className="text-caption text-ink-soft mt-1">
                  Try a different filter.
                </p>
              </Card>
            ) : (
              // Single Reveal at the marker-zone level. The previous
              // implementation gave EACH category card its own
              // motion.div initial/animate — on a 5-8 category report
              // that meant 5-8 parallel fade-ups firing on first paint,
              // plus the Bottom Line hero's own transition. The brain
              // can't decide where to settle when that many things
              // arrive simultaneously. One sectional Reveal lets the
              // marker zone enter as a single chunk and inherits the
              // app-level MotionConfig reducedMotion="user" cascade
              // automatically.
              <Reveal className="mt-4 md:mt-0">
                <div className="grid gap-4">
                  {groups.map(({ category, markers }) => {
                    // Collapsed categories hide the BiomarkerBar list to
                    // keep the report scannable. The header still carries
                    // the actionable info — emoji + name + status-count
                    // dots — so a user can see at a glance "this category
                    // has 1 concern and 2 in range" without opening it.
                    // Default-open: any category with a concern marker
                    // (set in expandedCategoryIds at mount). Default-
                    // closed: everything else.
                    const open = isCategoryOpen(category.id);
                    const counts = {
                      // Critical rolls up into the concern count for the
                      // header dot row — the category-card header dots are
                      // a coarse signal; per-marker rendering inside the
                      // panel still distinguishes critical from concern.
                      concern: markers.filter(
                        (m) =>
                          m.status === 'critical' || m.status === 'concern',
                      ).length,
                      attention: markers.filter((m) => m.status === 'attention')
                        .length,
                      good: markers.filter((m) => m.status === 'good').length,
                    };
                    return (
                      <div
                        key={category.id}
                        id={`system-cat-${category.id}`}
                        className={
                          glowCategoryId === category.id
                            ? 'marker-focus-glow rounded-[20px]'
                            : undefined
                        }
                      >
                        <Card padded={false}>
                          <button
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            disabled={filtersAreNarrowing}
                            aria-expanded={open}
                            aria-controls={`category-panel-${category.id}`}
                            className={`w-full px-5 pt-5 pb-4 flex items-center gap-3 text-left transition-colors ${
                              open ? 'border-b border-line' : ''
                            } ${
                              filtersAreNarrowing
                                ? 'cursor-default'
                                : 'hover:bg-canvas/40'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-body-lg leading-tight">
                                {category.name}
                              </div>
                              {/* Status-count dots replace the category
                                description here. The description
                                ("Hormones, thyroid, sex drive" etc.)
                                was descriptive but not informative —
                                the dots tell the user what to do at
                                a glance, which is the job of the
                                collapsed header. */}
                              <div className="mt-1 inline-flex items-center gap-3 text-caption text-ink-soft">
                                {counts.concern > 0 && (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-concern">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-concern"
                                      aria-hidden
                                    />
                                    {counts.concern}
                                    <span className="sr-only"> need care</span>
                                  </span>
                                )}
                                {counts.attention > 0 && (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-attention">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-attention"
                                      aria-hidden
                                    />
                                    {counts.attention}
                                    <span className="sr-only"> to watch</span>
                                  </span>
                                )}
                                {counts.good > 0 && (
                                  <span className="inline-flex items-center gap-1.5 text-ink-soft">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-good"
                                      aria-hidden
                                    />
                                    {counts.good}
                                    <span className="sr-only"> healthy</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {filtersAreNarrowing ? (
                              // When the user is filtering (status or
                              // single-category), all visible categories
                              // are forced-open and the chevron toggle
                              // is meaningless. Show the marker count
                              // pill instead.
                              <Pill tone="neutral" size="sm">
                                {markers.length}
                              </Pill>
                            ) : (
                              <ChevronDown
                                size={20}
                                className={`text-muted shrink-0 transition-transform duration-200 ${
                                  open ? 'rotate-180' : ''
                                }`}
                                aria-hidden
                              />
                            )}
                          </button>
                          {open && (
                            <div
                              id={`category-panel-${category.id}`}
                              className="divide-y divide-line/70"
                            >
                              {markers.map((m) => (
                                <BiomarkerBar
                                  key={m.id}
                                  marker={m}
                                  compact={!isMdUp}
                                  contextNote={markerContextNote(m, quiz)}
                                  onClick={
                                    !isMdUp
                                      ? () => setSheetMarker(m)
                                      : m.problemId
                                        ? () =>
                                            navigate({
                                              type: 'problem',
                                              problemId: m.problemId!,
                                            })
                                        : undefined
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            )}
            {/* The mid-page "Download report as PDF" button used to sit
                here. Removed: the Header's Download icon and the Bottom
                Line's dark Download CTA already cover this action from
                two positionally useful spots. A third button buys no
                capability — it only adds a competing CTA below the
                action items. */}

            {/* "Not a diagnosis" footnote. This block used to sit at
                the TOP of the marker zone, blocking the data on every
                visit. Moved here so it reads as a closing footnote
                next to the data it disclaims — the user gets the
                clinical context after they've absorbed the actual
                values, not before. Same atoms (rounded box + Info
                icon + text-caption), same wording, demoted position. */}
            <div className="mt-6 rounded-xl bg-indigo-50/50 border border-indigo-100 p-3 flex items-start gap-2.5 print-shadow-none">
              <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-caption text-indigo-900 leading-snug">
                <strong>Not a diagnosis.</strong> We translate your report, but
                you should always consult a doctor before acting on these
                results.
              </p>
            </div>

            <ReportAboutPanel hasCritical={summary.critical > 0} />
          </main>

          {/* RIGHT — Sticky sidebar (filters + deep dives). Mounted only
              when the viewport is md+; the mobile filter strip and the
              mobile Deep Dives block carry the same affordances on
              narrower screens. The `md:col-span-4` keeps the grid track
              correct when this aside is present; on mobile the aside is
              absent, the main column naturally spans full width. */}
          {isMdUp && (
            <aside className="md:col-span-4 no-print">
              <div className="sticky top-24 grid gap-5">
                <Card padded={false} className="overflow-hidden">
                  {/* Status filter — only on a dense report (see
                      showStatusFilter). On a short panel it read as admin
                      chrome; the Categories chooser below is enough. */}
                  {showStatusFilter && (
                    <>
                      <div className="px-5 pt-5 pb-3 border-b border-line">
                        <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
                          Filter
                        </div>
                        <div className="font-display text-body mt-1">
                          Refine view
                        </div>
                      </div>
                      <div className="p-4 flex flex-wrap gap-1.5">
                        {STATUS_FILTER_OPTIONS.map((f) => {
                          const active = filter === f.id;
                          return (
                            <button
                              key={f.id}
                              onClick={() => setFilter(f.id)}
                              aria-pressed={active}
                              className={`inline-flex items-center px-3 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
                                active
                                  ? 'bg-indigo-600 text-on-primary shadow-soft'
                                  : 'bg-surface border border-line text-ink-soft hover:border-indigo-300'
                              }`}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="px-5 pt-4 pb-3 border-t border-line">
                    <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
                      Categories
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                    <CategoryChip
                      label="All"
                      active={activeCategory === 'all'}
                      onClick={() => setActiveCategory('all')}
                    />
                    {categories
                      .filter((c) => presentCategoryIds.has(c.id))
                      .map((c) => (
                        <CategoryChip
                          key={c.id}
                          label={c.name}
                          active={activeCategory === c.id}
                          onClick={() => setActiveCategory(c.id)}
                        />
                      ))}
                  </div>
                </Card>

                {deepDives.length > 0 && (
                  <Card padded={false}>
                    <div className="px-5 pt-5 pb-3 border-b border-line">
                      <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
                        Suggested deep dives
                      </div>
                      <div className="font-display text-body mt-1">
                        What to look at first
                      </div>
                    </div>
                    <div className="divide-y divide-line/70">
                      {deepDives.map((m) => {
                        const c = statusColor(m.status);
                        return (
                          <button
                            key={m.id}
                            onClick={() =>
                              navigate({
                                type: 'problem',
                                problemId: m.problemId!,
                              })
                            }
                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-canvas/60 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-micro uppercase tracking-label font-bold text-muted truncate">
                                {m.name}
                              </div>
                              <div
                                className={`text-caption mt-0.5 ${c.textOnSurface} font-bold uppercase tracking-widest`}
                              >
                                {c.label}
                              </div>
                            </div>
                            <ChevronRight
                              size={16}
                              className="text-muted shrink-0"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Mobile-only "Suggested deep dives" used to live here at the
            bottom of the Container. It's been moved up to sit directly
            under the Bottom Line — action items come before reference
            data in the read order. */}
      </Container>
        </>
      )}

      <BottomNav />

      {/* Mobile marker detail — focused sheet instead of inline scroll. */}
      <MarkerSheet
        marker={sheetMarker}
        contextNote={sheetMarker ? markerContextNote(sheetMarker, quiz) : null}
        related={sheetRelated}
        onSelectRelated={setSheetMarker}
        onClose={() => setSheetMarker(null)}
        onOpenProblem={
          sheetMarker?.problemId
            ? () => {
                const problemId = sheetMarker.problemId!;
                setSheetMarker(null);
                navigate({ type: 'problem', problemId });
              }
            : undefined
        }
      />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      // min-h-12 (48px) hit target — the visible chip stays compact but
      // taps don't miss on touch.
      className={`inline-flex items-center px-3 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-gold-500 text-indigo-900 border border-gold-500'
          : 'bg-surface border border-line text-ink-soft'
      }`}
    >
      {label}
    </button>
  );
}
