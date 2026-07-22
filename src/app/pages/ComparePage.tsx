import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Container from '../components/ui/Container';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ClinicalSpot from '../components/ClinicalSpot';
import Sparkline from '../components/ui/Sparkline';
import { useNavigation, useReports } from '../AppContext';
import { sampleReports, type Report } from '../data/reports';
import { statusColor } from '../data/biomarkers';
import {
  compareReports,
  type MarkerComparison,
  type MarkerChange,
} from '../utils/compareReports';

/**
 * ComparePage — pick any two reports, see what moved between them.
 *
 * The dashboard tells a single marker's own history (its sparkline). This
 * is the deliberate side-by-side: two panels, every shared marker's
 * before → after, which way it went, and what's new or dropped. The URL
 * carries the pair (`/compare/:a/:b`) so a comparison is shareable and
 * survives a refresh; `/compare` alone picks the two most recent and
 * canonicalises the URL.
 *
 * Honesty rail (same as clinical/explainChange): two readings show a
 * DIRECTION, never a CAUSE — surfaced as a standing caveat, never as a
 * "because".
 */

/** Trim trailing zeros so 14.80 → 14.8 and 140.0 → 140. */
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

/** Signed delta, e.g. "+25" / "−0.4". Uses a real minus glyph. */
function fmtDelta(n: number): string {
  const rounded = Number(n.toFixed(2));
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${fmt(rounded)}` : `−${fmt(Math.abs(rounded))}`;
}

const CHANGE_LABEL: Record<MarkerChange, string> = {
  improved: 'Improved',
  worsened: 'Worsened',
  steady: 'Steady',
};

/** Tone class for a change — improved is green, worsened is red (never
 *  softened), steady is muted. */
function changeTone(change: MarkerChange): string {
  if (change === 'improved') return 'text-good';
  if (change === 'worsened') return 'text-concern';
  return 'text-muted';
}

/** A single before → after row. */
function ComparisonRow({ row }: { row: MarkerComparison }) {
  if (row.presence !== 'both') {
    const m = row.after ?? row.before!;
    const sc = statusColor(m.status);
    const tag = row.presence === 'onlyAfter' ? 'New' : 'Not re-measured';
    return (
      <div className="flex items-center gap-3 py-3 border-b border-line/60 last:border-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-caption font-semibold text-ink truncate">
            {row.name}
          </div>
          {row.simpleName && (
            <div className="text-micro text-muted leading-tight truncate">
              {row.simpleName}
            </div>
          )}
        </div>
        <div className="text-caption text-ink tabular-nums shrink-0">
          {fmt(m.value)} <span className="text-micro text-muted">{row.unit}</span>
        </div>
        <span className="shrink-0 text-micro font-semibold text-muted bg-canvas border border-line rounded-full px-2 py-0.5">
          {tag}
        </span>
      </div>
    );
  }

  const before = row.before!;
  const after = row.after!;
  const change = row.change!;
  const scBefore = statusColor(before.status);
  const scAfter = statusColor(after.status);
  const delta = row.deltaAbs ?? 0;
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const tone = changeTone(change);

  // A two-point before→after spark reinforces the delta visually. Built as a
  // synthetic marker (after + a single prior reading = the before value) so it
  // always has the ≥2 points Sparkline needs and its band/colour track the
  // after reading. Desktop-only — the mobile row already carries direction via
  // the status dots + delta arrow, and a fourth column would crowd 390px.
  const sparkMarker = { ...after, history: [{ date: '', value: before.value }] };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-line/60 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-caption font-semibold text-ink truncate">
          {row.name}
        </div>
        {row.simpleName && (
          <div className="text-micro text-muted leading-tight truncate">
            {row.simpleName}
          </div>
        )}
      </div>

      {/* before → after, each with its status dot so a tier crossing is
          visible at a glance. */}
      <div className="flex items-center gap-2 shrink-0 tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${scBefore.dot}`} aria-hidden />
          <span className="text-caption text-muted">{fmt(before.value)}</span>
        </span>
        <ArrowRight size={13} className="text-muted shrink-0" aria-hidden />
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${scAfter.dot}`} aria-hidden />
          <span className="text-caption font-display text-ink">
            {fmt(after.value)}
          </span>
        </span>
        <span className="text-micro text-muted">{row.unit}</span>
      </div>

      {/* Desktop-only before→after spark. */}
      <div className="hidden sm:block shrink-0" aria-hidden>
        <Sparkline marker={sparkMarker} width={64} height={26} />
      </div>

      {/* change chip: arrow shows which way the number moved; colour shows
          whether that's good, bad, or flat. */}
      <div
        className={`shrink-0 inline-flex items-center gap-1 text-micro font-bold tabular-nums w-[92px] justify-end ${tone}`}
        title={`${CHANGE_LABEL[change]} · was ${fmt(before.value)} ${row.unit}`}
      >
        <DeltaIcon size={12} strokeWidth={2.5} aria-hidden />
        <span>{fmtDelta(delta)}</span>
        <span className="hidden sm:inline text-muted font-semibold">
          {CHANGE_LABEL[change]}
        </span>
      </div>
    </div>
  );
}

export default function ComparePage({
  aId,
  bId,
}: {
  aId?: string;
  bId?: string;
}) {
  const { reports } = useReports();
  const { navigate, replace } = useNavigation();

  // Eligible = the user's own analyzed reports that carry markers. Fall
  // back to the curated samples only when there aren't two real ones —
  // that keeps `/compare` demoable (and honestly labelled) for a visitor
  // who hasn't uploaded a pair yet.
  const eligible = useMemo(
    () =>
      reports.filter((r) => r.status === 'ready' && r.biomarkers.length > 0),
    [reports],
  );
  const isDemo = eligible.length < 2;
  const pool: Report[] = isDemo ? sampleReports : eligible;

  // Two most recent, newest first — the sensible default pair.
  const byNewest = useMemo(
    () =>
      pool
        .slice()
        .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '')),
    [pool],
  );

  const selectedA = pool.find((r) => r.id === aId);
  const selectedB = pool.find((r) => r.id === bId);

  // Canonicalise the URL: land on `/compare` (or a stale/deleted id) and
  // we fill in the two most recent, then rewrite the address so it's
  // shareable and the pickers reflect it. replace() no-ops once the pair
  // is already canonical, so this doesn't loop.
  useEffect(() => {
    if (pool.length < 2) return;
    if (selectedA && selectedB && selectedA.id !== selectedB.id) return;
    replace({
      type: 'compare',
      aId: byNewest[0].id,
      bId: byNewest[1].id,
    });
  }, [pool.length, selectedA, selectedB, byNewest, replace]);

  const [showAll, setShowAll] = useState(false);

  const setPair = (nextA: string, nextB: string) =>
    replace({ type: 'compare', aId: nextA, bId: nextB });

  // ---- Not enough reports to compare at all ----
  if (pool.length < 2) {
    return (
      <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
        <Header variant="page" title="Compare reports" />
        <Container size="wide" className="pt-10">
          <div className="max-w-md">
            <ClinicalSpot name="empty-tray" size={96} className="mb-5" />
            <h1 className="font-display text-display-lg leading-[1.05] tracking-tight">
              You need two reports to compare.
            </h1>
            <p className="mt-3 text-body text-ink-soft leading-relaxed">
              Comparison lines up the same markers from two of your reports so
              you can see what moved. Upload one more and it’ll unlock here.
            </p>
            <button
              type="button"
              onClick={() => navigate({ type: 'upload' })}
              className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-indigo-600 text-on-primary text-caption font-semibold shadow-blue hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <Upload size={15} strokeWidth={2.5} aria-hidden />
              Upload a report
            </button>
          </div>
        </Container>
        <BottomNav />
      </div>
    );
  }

  // The pickers disable the option already chosen on the other side, so a
  // same-on-both state can only arise from a deep-linked `/compare/x/x` —
  // which the canonicalisation effect above heals on the next tick. Guard
  // the compare call so we never self-compare in that one-frame window.
  const distinctPair =
    !!selectedA && !!selectedB && selectedA.id !== selectedB.id;

  const cmp = distinctPair ? compareReports(selectedA!, selectedB!) : null;

  const changedRows = cmp
    ? cmp.rows.filter((r) => r.presence === 'both' && r.change !== 'steady')
    : [];
  const restRows = cmp
    ? cmp.rows.filter((r) => r.presence !== 'both' || r.change === 'steady')
    : [];

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Compare reports" />

      <Container size="wide" className="pt-6 md:pt-10">
        {isDemo && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-gold-100 text-gold-800 px-3 py-1.5 text-micro font-semibold">
            <Sparkles size={13} aria-hidden />
            Showing sample reports — upload two of your own to compare them here
          </div>
        )}

        {/* Pickers. Two plain selects; the comparator decides which is the
            older "before" from the upload dates, so order here doesn't
            matter. */}
        <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-4">
          <ReportPicker
            label="Report A"
            value={selectedA?.id ?? ''}
            options={pool}
            excludeId={selectedB?.id}
            onChange={(id) => setPair(id, selectedB?.id ?? byNewest[1].id)}
          />
          <div className="hidden sm:flex items-center justify-center pb-3 text-muted">
            <ArrowRight size={18} aria-hidden />
          </div>
          <ReportPicker
            label="Report B"
            value={selectedB?.id ?? ''}
            options={pool}
            excludeId={selectedA?.id}
            onChange={(id) => setPair(selectedA?.id ?? byNewest[0].id, id)}
          />
        </div>

        {cmp && (
          <>
            {/* Summary strip. before (older) → after (newer), with the
                headline counts. */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6"
            >
              <Card>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
                  <span className="font-semibold text-ink">
                    {cmp.before.name}
                  </span>
                  <span className="text-muted">({cmp.before.uploadedOn})</span>
                  <ArrowRight size={14} className="text-muted" aria-hidden />
                  <span className="font-semibold text-ink">
                    {cmp.after.name}
                  </span>
                  <span className="text-muted">({cmp.after.uploadedOn})</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <SummaryPill
                    tone="good"
                    count={cmp.improved}
                    label="improved"
                  />
                  <SummaryPill
                    tone="concern"
                    count={cmp.worsened}
                    label="worsened"
                  />
                  <SummaryPill tone="muted" count={cmp.steady} label="steady" />
                  {cmp.onlyAfter > 0 && (
                    <SummaryPill
                      tone="muted"
                      count={cmp.onlyAfter}
                      label="new"
                    />
                  )}
                </div>

                {/* The non-negotiable rail: a direction, never a cause. */}
                <p className="mt-4 text-caption text-ink-soft leading-relaxed max-w-2xl">
                  Two readings show a direction, not a reason — they can’t tell
                  you <span className="italic">why</span> something moved, or
                  that one change caused another. One lab day isn’t the whole
                  story; bring the flagged ones to your doctor.
                </p>
              </Card>
            </motion.div>

            {/* Changed markers — the headline. */}
            <section className="mt-6">
              <h2 className="text-micro uppercase tracking-eyebrow font-bold text-muted mb-2">
                What changed
              </h2>
              <Card padded={false} className="px-4 sm:px-5">
                {changedRows.length > 0 ? (
                  changedRows.map((row) => (
                    <ComparisonRow key={row.id} row={row} />
                  ))
                ) : (
                  <p className="py-6 text-caption text-ink-soft text-center">
                    No marker crossed into a different range between these two
                    reports.
                  </p>
                )}
              </Card>
            </section>

            {/* Everything else — steady markers + the presence-only rows —
                behind a disclosure so the calm view leads with the changes. */}
            {restRows.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                  className="inline-flex items-center gap-1 min-h-11 text-caption font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
                >
                  {showAll ? 'Hide' : 'Show'} {restRows.length} unchanged &
                  one-sided {restRows.length === 1 ? 'marker' : 'markers'}
                </button>
                {showAll && (
                  <Card padded={false} className="mt-3 px-4 sm:px-5">
                    {restRows.map((row) => (
                      <ComparisonRow key={row.id} row={row} />
                    ))}
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </Container>

      <BottomNav />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local sub-pieces                                                    */
/* ------------------------------------------------------------------ */

function ReportPicker({
  label,
  value,
  options,
  excludeId,
  onChange,
}: {
  label: string;
  value: string;
  options: Report[];
  /** The report chosen on the OTHER side — disabled here so the two
   *  pickers can never point at the same report. */
  excludeId?: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-micro uppercase tracking-eyebrow font-bold text-muted mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-lg bg-surface border border-line text-caption text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        {options.map((r) => (
          <option key={r.id} value={r.id} disabled={r.id === excludeId}>
            {r.name} · {r.uploadedOn}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryPill({
  tone,
  count,
  label,
}: {
  tone: 'good' | 'concern' | 'muted';
  count: number;
  label: string;
}) {
  const cls =
    tone === 'good'
      ? 'bg-good-soft text-good-ink'
      : tone === 'concern'
        ? 'bg-concern-soft text-concern-ink'
        : 'bg-canvas text-ink-soft border border-line';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${cls}`}
    >
      <span className="font-display tabular-nums">{count}</span>
      {label}
    </span>
  );
}
