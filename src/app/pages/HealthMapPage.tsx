import { useMemo } from 'react';
import { Check, ChevronRight, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import Button from '../components/Button';
import Container from '../components/Container';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
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
  getCombinedSnapshot,
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

/**
 * Encouraging-but-honest hero headline, keyed off BOTH the worst status
 * present AND its count — so a single flagged marker doesn't read as "a
 * handful of things to work on" while the body line says "one thing to
 * act on". bottomLineFor (the body) is already count-aware; this keeps
 * the headline consistent with it. Pure + exported so the count logic is
 * unit-tested (this is the second count-mismatch copy bug of this class).
 */
export function healthMapHeadline(s: {
  critical: number;
  concern: number;
  attention: number;
}): string {
  if (s.critical > 0) {
    return s.critical === 1
      ? 'One thing needs a doctor'
      : 'A few things need a doctor';
  }
  if (s.concern > 0) {
    return s.concern === 1
      ? 'Just one thing to work on'
      : 'A handful of things to work on';
  }
  if (s.attention > 0) {
    return s.attention === 1
      ? 'Looking good — one to keep an eye on'
      : 'Looking good — a few to keep an eye on';
  }
  return 'Everything’s healthy';
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
  // Whole-body view: union markers across ALL the user's reports (latest
  // value per marker), not just the single most-comprehensive panel — so
  // a CBC and a separate fertility/hormone panel each contribute their
  // systems here, matching the "every system on one screen" promise.
  const snap = useMemo(() => getCombinedSnapshot(reports), [reports]);
  const biomarkers = snap.biomarkers;
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

  // Encouraging-but-honest headline keyed off the worst status AND count.
  const headline = healthMapHeadline(summary);

  /* ---- Empty state: no parsed report yet. ---- */
  if (!ready || biomarkers.length === 0) {
    // Empty state as a calm readiness checklist, NOT a cartoon: a firm
    // serif headline + a clean hairline list of the systems we'll map once
    // a report is added. Structural look, but PLAIN words — anyone reads it.
    const PIPELINE: { req: string; status: string }[] = [
      { req: 'Blood count', status: 'Not added yet' },
      { req: 'Hormones', status: 'Not added yet' },
      { req: 'Sugar & metabolism', status: 'Not added yet' },
      { req: 'Thyroid', status: 'Not added yet' },
    ];
    return (
      <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
        <Header variant="page" title="Health Map" />
        <Container size="narrow" className="pt-10 md:pt-12">
          {/* Focal block — plain, in Instrument Serif. */}
          <h1 className="font-display text-4xl md:text-5xl leading-[1.04] tracking-tight text-balance max-w-[15ch]">
            Nothing on your map yet.
          </h1>
          <p className="mt-4 text-body-sm text-ink-soft leading-relaxed max-w-md">
            Add a blood test and we’ll lay every system out on one screen — what’s
            healthy, and how it changes each time you test.
          </p>

          {/* Systems list — a clean hairline 3-col grid. Plain labels. */}
          <div className="mt-8 border-[0.5px] border-line rounded-md overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 sm:gap-x-5 px-3.5 py-2 border-b-[0.5px] border-line text-micro uppercase tracking-widest font-semibold text-muted">
              <span>What we’ll map</span>
              <span>Status</span>
              <span className="text-right">Add</span>
            </div>
            {PIPELINE.map((row) => (
              <div
                key={row.req}
                className="grid grid-cols-[1fr_auto_auto] gap-x-3 sm:gap-x-5 items-center px-3.5 py-3 border-b-[0.5px] border-line last:border-b-0"
              >
                <span className="text-caption font-semibold text-ink-soft truncate">
                  {row.req}
                </span>
                <span className="text-micro text-muted">{row.status}</span>
                <button
                  type="button"
                  onClick={() => navigate({ type: 'upload' })}
                  className="text-caption font-semibold text-forest hover:opacity-70 transition-opacity duration-150 text-right focus-visible:outline-none focus-visible:underline"
                >
                  Add →
                </button>
              </div>
            ))}
          </div>

          {/* Primary actions — kept as real 44px controls below the matrix. */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
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

          {/* Footer line — plain, reassuring, India-privacy relevant. */}
          <div className="mt-10 font-mono text-[10px] uppercase tracking-widest text-muted">
            Runs on your phone · nothing is uploaded
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
        {/* Warm "paper" spotlight — same focal surface as the dashboard
            hero: flat, hairline, no ring/glow. Big Instrument Serif score +
            a split meter (in-range vs to-review) instead of the activity
            ring, so the two heroes speak one language. */}
        <div className="rounded-lg border border-paper-line bg-paper text-paper-ink p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="order-2 md:order-1 flex-1 min-w-0">
              <h1 className="font-display text-display-md sm:text-display-lg leading-tight tracking-tight text-paper-ink">
                {headline}
              </h1>
              <p className="text-caption text-paper-soft mt-1.5">
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
                  <span className="text-micro text-paper-soft">
                    since your last test
                  </span>
                </div>
              )}
            </div>
            <div className="order-1 md:order-2 shrink-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[3.5rem] md:text-[4rem] leading-none text-paper-ink">
                  {onTrackPct}
                </span>
                <span className="font-display text-2xl text-paper-soft">%</span>
              </div>
              <div className="text-micro uppercase tracking-eyebrow font-semibold text-paper-soft mt-1.5">
                in range
              </div>
              <div
                role="img"
                aria-label={`${summary.good} of ${summary.total} markers in range`}
                className="mt-3 flex h-2 w-44 overflow-hidden rounded-full border border-paper-line"
              >
                <div className="h-full bg-forest" style={{ width: `${onTrackPct}%` }} />
                <div className="h-full w-[2px] shrink-0 bg-paper" aria-hidden />
                <div className="h-full flex-1 bg-clay" />
              </div>
            </div>
          </div>

          {/* The honest plain-language line the report also leads with — so
              the map and the report tell one consistent story. */}
          <p className="text-body-sm text-paper-ink/80 mt-6 leading-relaxed border-t border-paper-line pt-5">
            {bottomLine}
          </p>
        </div>

        <p className="text-caption text-muted mt-3">
          {summary.total} markers · {groups.length}{' '}
          {groups.length === 1 ? 'system' : 'systems'} ·{' '}
          {snap.reportCount > 1
            ? `across ${snap.reportCount} reports`
            : ready.name}{' '}
          · {snap.latestUploadedOn ?? ready.uploadedOn}
        </p>
        <StatusKey className="mt-3" />
        {/* Screening-indicator caveat — matches the dashboard + report
            page so the whole-body score isn't mistaken for a verdict. */}
        <p className="mt-2.5 text-micro text-muted leading-relaxed max-w-[68ch]">
          A screening summary of your lab values — not a diagnosis. Always
          confirm with a doctor before acting on it.
        </p>
      </Container>

      {/* Body systems — SEVERITY-RANKED, not a uniform grid. Systems that
          need action get real estate AND surface their flagged markers
          inline (no tap needed to see what's wrong); "watch" collapses to
          one-line rows; healthy systems compress into a single calm strip.
          Reads like a triage ledger: act-on first, reassurance last. */}
      {(() => {
        const SEV: Record<Biomarker['status'], number> = {
          critical: 0,
          concern: 1,
          attention: 2,
          good: 3,
        };
        const needs = groups.filter(
          (g) => g.r.worst === 'critical' || g.r.worst === 'concern',
        );
        const watch = groups.filter((g) => g.r.worst === 'attention');
        const clear = groups.filter((g) => g.r.worst === 'good');
        const reportFor = (g: (typeof groups)[number]) =>
          snap.sourceReportId[g.markers[0]?.id] ?? ready.id;

        return (
          <>
            {needs.length > 0 && (
              <Container size="wide" className="mt-8 md:mt-10">
                <h2 className="text-micro uppercase tracking-eyebrow font-bold text-concern-ink mb-3">
                  Needs a look
                </h2>
                <div className="grid gap-3">
                  {needs.map((g) => {
                    const flagged = g.markers
                      .filter(
                        (m) =>
                          m.status === 'critical' || m.status === 'concern',
                      )
                      .sort((a, b) => SEV[a.status] - SEV[b.status]);
                    const shown = flagged.slice(0, 3);
                    const more = flagged.length - shown.length;
                    return (
                      <div
                        key={g.category.id}
                        className="rounded-lg border border-line bg-surface overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            navigate({
                              type: 'results',
                              reportId: reportFor(g),
                            })
                          }
                          className="group w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-line text-left transition-colors hover:bg-canvas/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                        >
                          <span className="font-display text-body-lg text-ink">
                            {g.category.name}
                          </span>
                          <span className="flex items-center gap-2 text-caption font-semibold text-concern-ink">
                            {summaryText(g.r)}
                            <ChevronRight
                              size={16}
                              className="text-muted transition-transform group-hover:translate-x-0.5"
                            />
                          </span>
                        </button>
                        <div className="divide-y divide-line">
                          {shown.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                            >
                              <span className="min-w-0 truncate">
                                <span className="text-caption font-semibold text-ink">
                                  {m.name}
                                </span>
                                {m.simpleName && (
                                  <span className="text-micro text-muted ml-2">
                                    {m.simpleName}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 inline-flex items-baseline gap-2">
                                <span className="font-sans font-semibold text-caption tabular-nums text-ink">
                                  {m.value}
                                  <span className="text-micro text-muted font-normal ml-0.5">
                                    {m.unit}
                                  </span>
                                </span>
                                <span
                                  className={`self-center w-1.5 h-1.5 rounded-full ${statusColor(m.status).dot}`}
                                  aria-hidden
                                />
                              </span>
                            </div>
                          ))}
                          {more > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate({
                                  type: 'results',
                                  reportId: reportFor(g),
                                })
                              }
                              className="w-full text-left px-4 py-2.5 text-caption font-semibold text-forest hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:underline"
                            >
                              +{more} more →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Container>
            )}

            {watch.length > 0 && (
              <Container size="wide" className="mt-6">
                <h2 className="text-micro uppercase tracking-eyebrow font-bold text-attention-ink mb-3">
                  Keep an eye
                </h2>
                <div className="rounded-lg border border-line overflow-hidden bg-surface">
                  {watch.map((g) => (
                    <button
                      key={g.category.id}
                      type="button"
                      onClick={() =>
                        navigate({ type: 'results', reportId: reportFor(g) })
                      }
                      className="group w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-line last:border-b-0 text-left transition-colors hover:bg-canvas/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                    >
                      <span className="font-display text-body text-ink">
                        {g.category.name}
                      </span>
                      <span className="flex items-center gap-2 text-caption font-semibold text-attention-ink">
                        {summaryText(g.r)}
                        <ChevronRight size={16} className="text-muted" />
                      </span>
                    </button>
                  ))}
                </div>
              </Container>
            )}

            {clear.length > 0 && (
              <Container size="wide" className="mt-6">
                <h2 className="text-micro uppercase tracking-eyebrow font-bold text-muted mb-3">
                  All clear
                </h2>
                <div className="flex flex-wrap gap-2">
                  {clear.map((g) => (
                    <button
                      key={g.category.id}
                      type="button"
                      onClick={() =>
                        navigate({ type: 'results', reportId: reportFor(g) })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 h-9 text-caption text-ink-soft transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                    >
                      <Check size={13} className="text-good" />
                      {g.category.name}
                    </button>
                  ))}
                </div>
              </Container>
            )}
          </>
        );
      })()}

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
