import {
  getTrend,
  type Biomarker,
  type BiomarkerCategoryId,
} from '../../data/biomarkers';
import type { Report } from '../../data/reports';
import type { LockerSort, StatusFilter } from './types';
import type { Pathway } from './pathways';

/* ------------------------------------------------------------------ *
 * dashboardModel — the dashboard's PURE view-model derivations.
 *
 * Extracted out of HomePage so the logic that actually churns (filter,
 * sort, rank, group, vitals — the parts that change when clinical rules
 * or UX evolve) is unit-testable in isolation instead of buried inside a
 * 1,000-line component's useMemos. No React, no state, no I/O: every
 * function is f(inputs) -> output. HomePage's hooks now just call these.
 * ------------------------------------------------------------------ */

/** Locker grid: token-filter by name/lab, then sort. Ties (and the
 *  newest/oldest sort when dates are missing/equal) fall back to the
 *  reports' original array order so the result is stable. */
export function filterAndSortReports(
  reports: Report[],
  lockerQuery: string,
  lockerSort: LockerSort,
): Report[] {
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
  return [...filtered].sort((a, b) => {
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
}

/** The marker grid inside the "See all markers" disclosure: composes the
 *  free-text query, the status pill, and the (optional) pathway scope.
 *  `trimmedQuery` is the already-lowercased, already-trimmed query. */
export function selectVisibleMarkers(
  biomarkers: Biomarker[],
  trimmedQuery: string,
  statusFilter: StatusFilter,
  scopeCategories: BiomarkerCategoryId[] | null,
): Biomarker[] {
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
    const scopeHit = !scopeCategories || scopeCategories.includes(m.category);
    return queryHit && statusHit && scopeHit;
  });
}

/** All flagged markers (critical + concern + attention), sorted
 *  critical → concern → attention. Drives the top-concern hero (index 0)
 *  and the "See N more flagged" count. */
export function rankFlaggedMarkers(biomarkers: Biomarker[]): Biomarker[] {
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
}

/** Markers rendered inside the disclosure body.
 *  - Filtering: honour the filter exactly (capped at 12).
 *  - Idle: the Top Concern zone already shows the first `heroFlagCount`
 *    flagged markers, so lead with the REST; if there are none beyond the
 *    hero, fall back to on-track markers so the pane never dead-ends empty. */
export function selectDisclosedMarkers(args: {
  isFiltering: boolean;
  visibleMarkers: Biomarker[];
  flaggedMarkersAll: Biomarker[];
  biomarkers: Biomarker[];
  heroFlagCount: number;
}): Biomarker[] {
  const { isFiltering, visibleMarkers, flaggedMarkersAll, biomarkers, heroFlagCount } =
    args;
  if (isFiltering) return visibleMarkers.slice(0, 12);
  const overflowFlagged = flaggedMarkersAll.slice(
    heroFlagCount,
    heroFlagCount + 12,
  );
  if (overflowFlagged.length > 0) return overflowFlagged;
  return biomarkers.filter((m) => m.status === 'good').slice(0, 12);
}

/** Trends grouped by pathway — body of the "Compare to your last report"
 *  disclosure. Only markers with a computable trend, only non-empty
 *  pathways. */
export function groupTrendsByPathway(
  visibleMarkers: Biomarker[],
  pathways: Pathway[],
): Array<Pathway & { markers: Biomarker[] }> {
  const withHistory = visibleMarkers.filter((m) => getTrend(m) !== null);
  return pathways
    .map((p) => ({
      ...p,
      markers: withHistory.filter((m) => p.categories.includes(m.category)),
    }))
    .filter((p) => p.markers.length > 0);
}

/** Vitals strip — one tile per pathway with the worst status present.
 *  `concern` collapses critical + concern (both red, see-a-doctor framing);
 *  `critical` is kept separately so the strip can promote those tiles.
 *  Pathways with no markers in this report are dropped. */
export function computePathwayVitals(
  biomarkers: Biomarker[],
  pathways: Pathway[],
): Array<Pathway & {
  critical: number;
  concern: number;
  attention: number;
  total: number;
}> {
  return pathways
    .map((p) => {
      const markers = biomarkers.filter((m) =>
        p.categories.includes(m.category),
      );
      const critical = markers.filter((m) => m.status === 'critical').length;
      const concern =
        critical + markers.filter((m) => m.status === 'concern').length;
      const attention = markers.filter((m) => m.status === 'attention').length;
      return { ...p, critical, concern, attention, total: markers.length };
    })
    .filter((p) => p.total > 0);
}
