import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Illustration from '../components/Illustration';
import ProgressRing from '../components/ProgressRing';
import StatusKey from '../components/StatusKey';
import { useNavigation, useReports } from '../AppContext';
import {
  biomarkersByCategory,
  bottomLineFor,
  getTrendTone,
  statusColor,
  summarizeStatuses,
  type Biomarker,
} from '../data/biomarkers';
import {
  getPrimaryReport,
  getSampleReportForDashboard,
} from '../data/reports';

/**
 * Health Map — the single, calm "whole body at a glance" overview, built
 * to be worth opening more than once.
 *
 * The earlier draft was a static reference table: a ragged wall of
 * cryptic marker chips, colour everywhere, nothing that rewarded a second
 * visit. This rebuild borrows the loop that makes Apple Health / Oura /
 * Function genuinely sticky — WITHOUT fabricating clinical data:
 *
 *   1. A number that grows. An Apple-style ring shows the share of
 *      markers on track. It's an honest metric (good / total) and it's
 *      the thing you come back to push upward.
 *   2. Movement. "↑ N improved since your last test" — computed from real
 *      history via getTrendTone. Seeing yourself get better is the hook,
 *      and it rewards the re-test loop the product depends on.
 *   3. Wins first, calm colour. Systems are sorted worst-first so the eye
 *      lands on what matters; on-track systems read quiet, not a green
 *      wall. Colour is reserved for status.
 *   4. Uniform, scannable cards. Each system is an OVERVIEW tile of fixed
 *      shape (icon, status, a slim on-track bar, counts) — never a dump
 *      of every marker. The full list lives one tap away in the report.
 *
 * Visual language is Apple Health's "Browse" (a line icon in a rounded
 * tile, a clear name, a chevron) over its "Summary" (big number, generous
 * whitespace, hairlines, restraint).
 *
 * Grouping uses biomarkersByCategory (the catalog's full 11-category
 * metadata), so EVERY system present in the report appears — unlike the
 * dashboard's 4-pathway Vitals Strip, which intentionally shows only the
 * four headline pathways.
 */

type SystemRollup = {
  critical: number;
  concern: number; // includes critical (mirrors the Vitals Strip rollup)
  attention: number;
  good: number;
  total: number;
  /** Worst status present — drives the card's accent + summary pill. */
  worst: Biomarker['status'];
};

export function rollup(markers: Biomarker[]): SystemRollup {
  const s = summarizeStatuses(markers);
  const worst: Biomarker['status'] =
    s.critical > 0
      ? 'critical'
      : s.concern > 0
        ? 'concern'
        : s.attention > 0
          ? 'attention'
          : 'good';
  return {
    critical: s.critical,
    // Collapse critical + concern into one "needs care" count, same as
    // the dashboard Vitals Strip — both read as red, see-a-doctor tiles.
    concern: s.critical + s.concern,
    attention: s.attention,
    good: s.good,
    total: s.total,
    worst,
  };
}

/** Short, honest summary text for a system's status pill. */
export function summaryText(r: SystemRollup): string {
  if (r.critical > 0) return 'See a doctor';
  if (r.concern > 0)
    return `${r.concern} ${r.concern === 1 ? 'needs' : 'need'} care`;
  if (r.attention > 0) return `${r.attention} to watch`;
  return 'Healthy';
}

/** Worst-first ordering so the eye lands on what matters. */
const SEVERITY: Record<Biomarker['status'], number> = {
  critical: 0,
  concern: 1,
  attention: 2,
  good: 3,
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HealthMapPage() {
  const { reports } = useReports();
  const { navigate } = useNavigation();

  const ready = useMemo(() => getPrimaryReport(reports), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);
  const summary = useMemo(() => summarizeStatuses(biomarkers), [biomarkers]);
  const bottomLine = useMemo(() => bottomLineFor(biomarkers), [biomarkers]);

  // Worst-first so flagged systems lead and on-track ones recede.
  const groups = useMemo(() => {
    return biomarkersByCategory(biomarkers)
      .map((g) => ({ ...g, r: rollup(g.markers) }))
      .sort((a, b) => SEVERITY[a.r.worst] - SEVERITY[b.r.worst]);
  }, [biomarkers]);

  // The number that grows: share of markers on track.
  const onTrackPct =
    summary.total > 0 ? Math.round((summary.good / summary.total) * 100) : 0;

  // Two-tone ring: the remainder is tinted by the worst status, not grey,
  // so the green share can't be misread as a passing grade.
  const ringTrack =
    summary.concern > 0 || summary.critical > 0
      ? 'stroke-concern/40'
      : summary.attention > 0
        ? 'stroke-attention/40'
        : 'stroke-line/50';

  // Movement since the last test — the come-back-and-check hook. Only
  // meaningful when markers carry history (a prior report was merged in).
  const movement = useMemo(() => {
    let improved = 0;
    let declined = 0;
    for (const m of biomarkers) {
      const tone = getTrendTone(m);
      if (tone === 'improving') improved++;
      else if (tone === 'declining') declined++;
    }
    return { improved, declined, any: improved + declined > 0 };
  }, [biomarkers]);

  // Encouraging-but-honest headline keyed off the worst status present.
  const headline =
    summary.critical > 0
      ? 'A few things need a doctor'
      : summary.concern > 0
        ? 'A handful of things to work on'
        : summary.attention > 0
          ? 'Looking good — a few to keep an eye on'
          : 'Everything’s healthy';

  /* ---- Empty state: no parsed report yet. ---- */
  if (!ready || biomarkers.length === 0) {
    return (
      <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
        <Header variant="page" title="Health Map" />
        <Container size="narrow" className="pt-10">
          <div className="flex flex-col items-center text-center gap-5">
            <Illustration
              src="/illustrations/empty-reports.svg"
              className="w-40 md:w-44 h-auto"
            />
            <div className="space-y-1.5">
              <h1 className="font-display text-display-md leading-tight">
                Your map starts with one report
              </h1>
              <p className="text-body-sm text-ink-soft max-w-sm">
                Upload a blood test and we’ll lay out every system — hormones,
                heart, thyroid, and the rest — on one calm screen, scored by
                what’s healthy and tracking how it moves over time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              <Button
                onClick={() => navigate({ type: 'upload' })}
                className="gap-1.5"
              >
                <Upload size={16} />
                Upload a report
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  navigate({
                    type: 'results',
                    reportId: getSampleReportForDashboard().id,
                  })
                }
              >
                See a sample first
              </Button>
            </div>
          </div>
        </Container>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Health Map" />

      {/* HERO — the score you come back to grow, plus movement since last
          test. Apple "Summary": a big ring, a confident headline, one
          honest line, and a celebratory/honest movement signal. */}
      <Container size="wide" className="pt-7 md:pt-9">
        <div className="rounded-3xl border border-line/70 bg-surface shadow-soft p-5 sm:p-6">
          <div className="flex items-center gap-5">
            <ProgressRing pct={onTrackPct} trackClass={ringTrack}>
              <div className="text-center leading-none">
                <span className="font-display text-display-sm text-ink">
                  {onTrackPct}
                </span>
                <span className="font-display text-caption text-muted align-top">
                  %
                </span>
                <div className="text-micro uppercase tracking-eyebrow font-bold text-muted mt-1">
                  in range
                </div>
              </div>
            </ProgressRing>
            <div className="min-w-0">
              <h1 className="font-display text-display-md sm:text-display-lg leading-tight tracking-tight">
                {headline}
              </h1>
              <p className="text-caption text-muted mt-1">
                {summary.good} of {summary.total} in a healthy range
              </p>
              {movement.any && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {movement.improved > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft text-good-ink px-2.5 h-7 text-caption font-semibold">
                      <TrendingUp size={14} />
                      {movement.improved} improved
                    </span>
                  )}
                  {movement.declined > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-concern-soft text-concern-ink px-2.5 h-7 text-caption font-semibold">
                      <TrendingDown size={14} />
                      {movement.declined} slipped
                    </span>
                  )}
                  <span className="text-micro text-muted">
                    since your last test
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* The honest plain-language line the report also leads with — so
              the map and the report tell one consistent story. */}
          <p className="text-body-sm text-ink-soft mt-4 leading-relaxed border-t border-line/60 pt-4">
            {bottomLine}
          </p>
        </div>

        <p className="text-caption text-muted mt-3">
          {summary.total} markers · {groups.length}{' '}
          {groups.length === 1 ? 'system' : 'systems'} · {ready.name} ·{' '}
          {ready.uploadedOn}
        </p>
        <StatusKey className="mt-3" />
        {/* Screening-indicator caveat — matches the dashboard + report
            page so the whole-body score isn't mistaken for a verdict. */}
        <p className="mt-2.5 text-micro text-muted leading-relaxed max-w-[68ch]">
          A screening summary of your lab values — not a diagnosis. Always
          confirm with a doctor before acting on it.
        </p>
      </Container>

      {/* Section label — grouped-list header, the iOS table idiom. */}
      <Container size="wide" className="mt-8 md:mt-10">
        <h2 className="text-micro uppercase tracking-eyebrow font-bold text-muted">
          Body systems · worst first
        </h2>
      </Container>

      {/* System grid — uniform overview tiles. Whole card taps through to
          the full report (the existing reference surface). */}
      <Container size="wide" className="mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
          {groups.map((g, i) => {
            const r = g.r;
            const c = statusColor(r.worst);
            const goodPct = r.total > 0 ? (r.good / r.total) * 100 : 0;
            return (
              <motion.button
                key={g.category.id}
                type="button"
                onClick={() => navigate({ type: 'results', reportId: ready.id })}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(i * 0.03, 0.2),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group h-full text-left bg-surface rounded-3xl border border-line/70 shadow-soft p-4 sm:p-5 transition-all hover:shadow-pop hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                {/* Header row — name + status · chevron. */}
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-body text-ink leading-tight truncate">
                      {g.category.name}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 text-caption font-semibold mt-0.5 ${c.textOnSurface}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {summaryText(r)}
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </div>

                {/* Slim on-track bar + count — a per-system mini-score that
                    keeps every card the same height and gives a number to
                    nudge upward. */}
                {/* Two-tone bar: green = the in-range share, the tinted
                    track = the share that needs a look. So "0 of 2" reads
                    as a full red bar, "8 of 8" as a full green one — no
                    ambiguous part-filled red. */}
                <div className="mt-4">
                  <div
                    className={`h-1.5 rounded-full overflow-hidden ${
                      r.worst === 'good' ? 'bg-line/60' : c.bg
                    }`}
                  >
                    <div
                      className="h-full rounded-full bg-good"
                      style={{ width: `${goodPct}%` }}
                    />
                  </div>
                  <div className="text-micro text-muted mt-2">
                    {r.good} of {r.total} in a healthy range
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Container>

      {/* Footer — gentle exit toward the detailed read + adding more data. */}
      <Container size="wide" className="mt-8 md:mt-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line/60 pt-6">
          <p className="text-caption text-ink-soft">
            Tap any system to open its full breakdown in your report.
          </p>
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ type: 'results', reportId: ready.id })}
            >
              Open full report
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ type: 'upload' })}
              className="gap-1.5"
            >
              <Upload size={15} />
              Add a report
            </Button>
          </div>
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}
