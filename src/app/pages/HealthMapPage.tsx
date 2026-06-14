import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Map as MapIcon, Upload } from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BottomNav from '../components/BottomNav';
import Emoji from '../components/Emoji';
import Illustration from '../components/Illustration';
import { useNavigation, useReports } from '../AppContext';
import {
  biomarkersByCategory,
  bottomLineFor,
  statusColor,
  summarizeStatuses,
  type Biomarker,
} from '../data/biomarkers';
import {
  getLatestReadyReport,
  getSampleReportForDashboard,
} from '../data/reports';

/**
 * Health Map — the single, calm "whole body at a glance" overview.
 *
 * The dashboard answers "what's the one thing to act on?"; the full
 * report answers "what did the lab measure?"; a problem page answers
 * "how do I fix this one thing?". None of them showed the *whole
 * picture* — every body system, its rolled-up status, in one quiet
 * screen. That's this page.
 *
 * It is deliberately an OVERVIEW, not a fourth detail view: each system
 * card rolls up the worst status across its markers and lists them, then
 * taps through to the full report (the existing reference surface) where
 * the per-category sections and BiomarkerBars already live. No new
 * detail UI is duplicated here.
 *
 * Grouping uses biomarkersByCategory (the catalog's full 11-category
 * metadata), so EVERY system present in the report appears — unlike the
 * dashboard's 4-pathway Vitals Strip, which intentionally shows only the
 * four headline pathways and silently omits liver/kidney/blood/etc.
 */

type SystemRollup = {
  critical: number;
  concern: number; // includes critical (mirrors the Vitals Strip rollup)
  attention: number;
  good: number;
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
    worst,
  };
}

/** Short, honest summary text for a system's status pill. */
export function summaryText(r: SystemRollup): string {
  if (r.critical > 0) return 'See a doctor';
  if (r.concern > 0)
    return `${r.concern} ${r.concern === 1 ? 'needs' : 'need'} care`;
  if (r.attention > 0) return `${r.attention} borderline`;
  return 'On track';
}

export default function HealthMapPage() {
  const { reports } = useReports();
  const { navigate } = useNavigation();

  const ready = useMemo(() => getLatestReadyReport(reports), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);
  const groups = useMemo(
    () => biomarkersByCategory(biomarkers),
    [biomarkers],
  );
  const summary = useMemo(() => summarizeStatuses(biomarkers), [biomarkers]);
  const bottomLine = useMemo(() => bottomLineFor(biomarkers), [biomarkers]);

  const flaggedSystems = useMemo(
    () =>
      groups.filter((g) => {
        const r = rollup(g.markers);
        return r.worst !== 'good';
      }).length,
    [groups],
  );

  /* ---- Empty state: no parsed report yet. Mirror the dashboard's calm
   *      "nothing to show, here's the way in" framing rather than a bare
   *      message — the map is only meaningful once there's data. ---- */
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
                heart, thyroid, and the rest — on one calm screen, colour-coded
                by what’s on track and what’s worth a look.
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

      {/* Intro — calm orientation, not an alarm. The bottom-line sentence
          is the same honest one-liner the report uses, so the map and the
          report tell one consistent story. */}
      <Container size="wide" className="pt-6 md:pt-8">
        <Pill tone={flaggedSystems > 0 ? 'concern' : 'good'} size="sm" dot>
          {flaggedSystems > 0
            ? `${flaggedSystems} ${
                flaggedSystems === 1 ? 'system' : 'systems'
              } worth a look`
            : 'Everything on track'}
        </Pill>
        <h1 className="font-display text-display-lg leading-tight mt-2 flex items-center gap-2">
          <MapIcon size={26} className="text-indigo-600 shrink-0" />
          Your Health Map
        </h1>
        <p className="text-body-sm text-ink-soft mt-1.5 max-w-2xl">
          {bottomLine}
        </p>
        <p className="text-caption text-muted mt-2">
          {summary.total} markers across {groups.length}{' '}
          {groups.length === 1 ? 'system' : 'systems'} · {ready.name} ·{' '}
          {ready.uploadedOn}
        </p>
      </Container>

      {/* System grid — one card per body system present in this report.
          Whole card is the tap target → the full report (the existing
          reference surface), so this stays an overview and never
          duplicates the report's detail rows. */}
      <Container size="wide" className="mt-5 md:mt-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g, i) => {
            const r = rollup(g.markers);
            const c = statusColor(r.worst);
            const accent =
              r.worst === 'good'
                ? 'border-l-good'
                : r.worst === 'attention'
                  ? 'border-l-attention'
                  : 'border-l-concern';
            return (
              <motion.button
                key={g.category.id}
                type="button"
                onClick={() =>
                  navigate({ type: 'results', reportId: ready.id })
                }
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(i * 0.03, 0.18),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`group text-left bg-surface rounded-2xl border border-line/70 border-l-4 ${accent} shadow-soft p-4 transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60`}
              >
                <div className="flex items-center gap-2">
                  <Emoji
                    label={`${g.category.name} system`}
                    className="text-body leading-none"
                  >
                    {g.category.icon}
                  </Emoji>
                  <span className="font-display text-body text-ink leading-tight truncate">
                    {g.category.name}
                  </span>
                  <ChevronRight
                    size={16}
                    className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-caption font-semibold ${c.textOnSurface}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {summaryText(r)}
                  </span>
                </div>

                {/* Marker chips — every marker in the system, tinted by its
                    own status, so the card reads as a tiny map of that
                    system rather than just a status badge. */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.markers.map((m) => {
                    const mc = statusColor(m.status);
                    return (
                      <span
                        key={m.id}
                        className={`inline-flex items-center gap-1 rounded-full px-2 h-6 text-micro font-medium ${mc.bg} ${mc.textOnSurface}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${mc.dot}`} />
                        {m.simpleName ?? m.name}
                      </span>
                    );
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>
      </Container>

      {/* Footer — gentle exit toward the detailed read + adding more data. */}
      <Container size="wide" className="mt-7 md:mt-9">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line/60 pt-5">
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
