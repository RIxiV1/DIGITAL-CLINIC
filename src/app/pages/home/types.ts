import type { StatusFilterId } from '../../data/biomarkers';

/** Marker status filter on the dashboard "All markers" pane. Aliased to
 *  the catalog's StatusFilterId so the dashboard, results page, and any
 *  future filter surface share one vocabulary. */
export type StatusFilter = StatusFilterId;

/** Sort order for the report locker. */
export type LockerSort = 'newest' | 'oldest' | 'lab';
