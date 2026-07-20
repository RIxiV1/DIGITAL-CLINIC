import type { Biomarker, BiomarkerStatus } from '../data/biomarkers';
import type { Report } from '../data/reports';

/**
 * Compare two reports marker-by-marker — "what changed since last time",
 * but for any two reports the user picks, not just consecutive uploads.
 *
 * The dashboard already tells the single-timeline story (a marker's own
 * history sparkline). This is the deliberate side-by-side: pick report A
 * and report B, see every shared marker's before → after, which way it
 * moved, and what's new or dropped between the two panels. Pure data in →
 * data out so the page never re-implements the classification and it's
 * unit-tested in isolation.
 */

/** Which way a marker moved between the two reports. Classification leads
 *  with the clinical STATUS tier (a good→concern move is "worsened" no
 *  matter the raw number), and only falls back to the direction-aware
 *  numeric move when the tier held steady. */
export type MarkerChange = 'improved' | 'worsened' | 'steady';

export type MarkerComparison = {
  id: string;
  /** Clinical name — taken from whichever side has the marker. */
  name: string;
  simpleName?: string;
  unit: string;
  presence: 'both' | 'onlyBefore' | 'onlyAfter';
  before?: Biomarker;
  after?: Biomarker;
  /** Only set when presence === 'both'. */
  change?: MarkerChange;
  /** True when the status tier differs between the two readings. */
  statusChanged: boolean;
  /** after.value − before.value (both only). */
  deltaAbs?: number;
  /** Relative change vs the before value, as a signed percentage
   *  (both only, and only when before.value is non-zero). */
  deltaPct?: number;
};

export type ReportComparison = {
  /** The older of the two reports (the "before"). */
  before: Report;
  /** The newer of the two reports (the "after"). */
  after: Report;
  /** All markers across both reports, most-meaningful first:
   *  worsened → improved → steady → new-in-after → dropped-in-after. */
  rows: MarkerComparison[];
  improved: number;
  worsened: number;
  steady: number;
  /** Markers present only in the older report (not re-measured). */
  onlyBefore: number;
  /** Markers present only in the newer report (newly measured). */
  onlyAfter: number;
  /** Markers measured in both — the ones with a real before→after. */
  shared: number;
};

const STATUS_RANK: Record<BiomarkerStatus, number> = {
  good: 0,
  attention: 1,
  concern: 2,
  critical: 3,
};

/** The center of a marker's "best" band — the optimal sub-range when the
 *  catalog defines one, otherwise the healthy range. Used to decide which
 *  way a band-type marker moved when the status tier didn't change. */
function bandMidpoint(m: Biomarker): number {
  if (typeof m.optimalMin === 'number' && typeof m.optimalMax === 'number') {
    return (m.optimalMin + m.optimalMax) / 2;
  }
  return (m.min + m.max) / 2;
}

/**
 * Classify a before→after move. Status tier is authoritative: crossing to a
 * better tier is "improved", to a worse tier "worsened". When the tier holds,
 * fall back to the direction-aware numeric move — with a small relative
 * deadband so measurement noise reads as "steady" rather than a false trend.
 */
function classifyChange(before: Biomarker, after: Biomarker): MarkerChange {
  const rb = STATUS_RANK[before.status];
  const ra = STATUS_RANK[after.status];
  if (ra < rb) return 'improved';
  if (ra > rb) return 'worsened';

  const delta = after.value - before.value;
  const denom = Math.abs(before.value) || Math.abs(after.value) || 1;
  // <1% relative move within the same tier is noise, not a trend.
  if (Math.abs(delta) / denom < 0.01) return 'steady';

  const dir = after.direction ?? before.direction ?? 'band';
  if (dir === 'up') return delta > 0 ? 'improved' : 'worsened';
  if (dir === 'down') return delta < 0 ? 'improved' : 'worsened';

  // Band marker: closer to the middle of its best band is better.
  const mid = bandMidpoint(after);
  const distBefore = Math.abs(before.value - mid);
  const distAfter = Math.abs(after.value - mid);
  if (distAfter < distBefore) return 'improved';
  if (distAfter > distBefore) return 'worsened';
  return 'steady';
}

/** Sort bucket — lower sorts first. Worsened leads (the news that matters),
 *  then improved, then steady, then the presence-asymmetric rows. */
function bucket(row: MarkerComparison): number {
  if (row.presence === 'both') {
    if (row.change === 'worsened') return 0;
    if (row.change === 'improved') return 1;
    return 2; // steady
  }
  return row.presence === 'onlyAfter' ? 3 : 4;
}

/** Severity of a row, worst-first, for ordering within a bucket. Uses the
 *  after reading when present, else the before. */
function severity(row: MarkerComparison): number {
  const m = row.after ?? row.before;
  return m ? STATUS_RANK[m.status] : -1;
}

/**
 * Build the full side-by-side comparison of two reports. The two arguments
 * can be passed in any order — the older report (by uploadedAt) always
 * becomes `before`, the newer `after`, so the delta reads as a forward move
 * in time. Undated reports keep the given order. Pure; inputs untouched.
 */
export function compareReports(a: Report, b: Report): ReportComparison {
  // Older → before, newer → after. Ties / missing dates keep (a, b).
  const [before, after] =
    (a.uploadedAt ?? '') <= (b.uploadedAt ?? '') ? [a, b] : [b, a];

  const beforeById = new Map(before.biomarkers.map((m) => [m.id, m]));
  const afterById = new Map(after.biomarkers.map((m) => [m.id, m]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);

  const rows: MarkerComparison[] = [];
  for (const id of ids) {
    const mb = beforeById.get(id);
    const ma = afterById.get(id);
    const ref = ma ?? mb!; // at least one side has it (id came from a union)

    if (mb && ma) {
      const change = classifyChange(mb, ma);
      const deltaAbs = ma.value - mb.value;
      const deltaPct =
        mb.value !== 0 ? (deltaAbs / Math.abs(mb.value)) * 100 : undefined;
      rows.push({
        id,
        name: ref.name,
        simpleName: ref.simpleName,
        unit: ref.unit,
        presence: 'both',
        before: mb,
        after: ma,
        change,
        statusChanged: mb.status !== ma.status,
        deltaAbs,
        deltaPct,
      });
    } else {
      rows.push({
        id,
        name: ref.name,
        simpleName: ref.simpleName,
        unit: ref.unit,
        presence: ma ? 'onlyAfter' : 'onlyBefore',
        before: mb,
        after: ma,
        statusChanged: false,
      });
    }
  }

  rows.sort((x, y) => {
    const bx = bucket(x);
    const by = bucket(y);
    if (bx !== by) return bx - by;
    const sx = severity(x);
    const sy = severity(y);
    if (sx !== sy) return sy - sx; // worst status first within a bucket
    return x.name.localeCompare(y.name);
  });

  let improved = 0;
  let worsened = 0;
  let steady = 0;
  let onlyBefore = 0;
  let onlyAfter = 0;
  for (const r of rows) {
    if (r.presence === 'onlyBefore') onlyBefore += 1;
    else if (r.presence === 'onlyAfter') onlyAfter += 1;
    else if (r.change === 'improved') improved += 1;
    else if (r.change === 'worsened') worsened += 1;
    else steady += 1;
  }

  return {
    before,
    after,
    rows,
    improved,
    worsened,
    steady,
    onlyBefore,
    onlyAfter,
    shared: improved + worsened + steady,
  };
}
