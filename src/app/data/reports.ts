import {
  sampleBiomarkers,
  type Biomarker,
  type BiomarkerReading,
} from './biomarkers';
import type { ReportBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/uiUtils';

export type ReportStatus = 'processing' | 'ready';

export type Report = {
  id: string;
  name: string;
  lab: string;
  /** Display-formatted upload date (e.g. "12 Apr 2026"). */
  uploadedOn: string;
  /** ISO yyyy-mm-dd upload date — used for history-merge sorting and as
   *  the BiomarkerReading.date when this report's values become history
   *  for a future upload. Optional for legacy sample reports that
   *  predate the field. */
  uploadedAt?: string;
  status: ReportStatus;
  /** Optional override — defaults to derived from status. */
  badge?: ReportBadge;
  /** True for curated demo reports that ship with the app. Filters them
   *  out of history merging (otherwise a user who "Loads sample data"
   *  then uploads a real report would see the sample's values labeled as
   *  their own past history — a trust-killer). */
  isSample?: boolean;
  biomarkers: Biomarker[];
};

/**
 * Sample reports — kept separate from the user's locker so a fresh user
 * doesn't open the dashboard and see fake reports they never uploaded.
 * Accessible via the "See a sample report" / "Try a sample" CTAs on the
 * landing page and the empty-locker state.
 */
export const sampleReports: Report[] = [
  {
    id: 'rep-001',
    name: 'Comprehensive Health Check',
    lab: 'Thyrocare · Mumbai',
    uploadedOn: '12 Apr 2026',
    uploadedAt: '2026-04-12',
    status: 'ready',
    badge: 'analyzed',
    isSample: true,
    biomarkers: sampleBiomarkers,
  },
  {
    id: 'rep-002',
    name: 'Hormone Panel',
    lab: 'SRL Diagnostics',
    uploadedOn: '04 Mar 2026',
    uploadedAt: '2026-03-04',
    status: 'ready',
    badge: 'ready',
    isSample: true,
    biomarkers: sampleBiomarkers.filter((m) => m.category === 'hormones'),
  },
];

/**
 * Reports the user actually owns — starts empty until they upload one.
 * The dashboard reads from this and shows the empty-state CTA when
 * nothing is here.
 */
export const initialReports: Report[] = [];

/** Look up a report by id from the user's locker, falling back to the
 *  curated sample reports. Use this anywhere the UI navigates to a
 *  specific reportId — the sample report links keep working without
 *  cluttering the user's locker. */
export function findReport(
  userReports: Report[],
  id: string,
): Report | undefined {
  return userReports.find((r) => r.id === id) ?? sampleReports.find((r) => r.id === id);
}

/** Returns the first curated sample report — used by the "Load sample
 *  data into my dashboard" CTA on the empty-state dashboard so the user
 *  can see a populated dashboard without uploading anything. */
export function getSampleReportForDashboard(): Report {
  return sampleReports[0];
}

/**
 * Returns the user's most recent ready report — by uploadedAt when
 * available, falling back to array position (newest-first per addReport).
 *
 * **Sample-vs-real preference:** if the user has any real (non-sample)
 * ready report, sample reports are excluded entirely from the search.
 * Without this, the curated sample `rep-001` (uploadedAt 2026-04-12)
 * would outrank a real upload from earlier in 2026 just because its
 * canned date is newer, and the dashboard would render demo data
 * labelled as the user's latest. We only consider samples when the
 * user has nothing else (e.g. they clicked "Load sample data" on an
 * empty locker — the dashboard must surface SOMETHING).
 */
export function getLatestReadyReport(reports: Report[]): Report | undefined {
  const ready = reports.filter((r) => r.status === 'ready');
  if (ready.length === 0) return undefined;
  const real = ready.filter((r) => !r.isSample);
  const pool = real.length > 0 ? real : ready;
  // Prefer ISO-date sort when available, fall back to array order for
  // legacy reports that predate the uploadedAt field.
  const withDate = pool.filter((r) => r.uploadedAt);
  if (withDate.length === pool.length) {
    return withDate.reduce((latest, r) =>
      (latest.uploadedAt ?? '') >= (r.uploadedAt ?? '') ? latest : r,
    );
  }
  return pool[0];
}

export function badgeFor(r: Report): ReportBadge {
  if (r.badge) return r.badge;
  if (r.status === 'processing') return 'processing';
  return 'analyzed';
}

/**
 * Placeholder Report shown in the locker while parsing runs. Biomarkers
 * start as an empty array — NOT sampleBiomarkers. Seeding sample data
 * here was a real leak: any UI surface that renders the locker between
 * upload and confirm (or after a tab close mid-parse) would show the
 * user fake testosterone, fake LDL, etc. under their filename.
 *
 * markReportReady replaces these with real extracted biomarkers when the
 * user confirms; if extraction fails, the placeholder is removed
 * entirely (see ProcessingPage's failure path).
 */
export function makeReport(name: string): Report {
  const now = new Date();
  return {
    id: `rep-${Math.random().toString(36).slice(2, 8)}`,
    name,
    lab: 'New upload',
    uploadedOn: formatDate(now),
    uploadedAt: now.toISOString().slice(0, 10),
    status: 'processing',
    badge: 'processing',
    biomarkers: [],
  };
}

/**
 * Build per-biomarker history arrays by walking the user's prior ready
 * reports. For each new biomarker, find every prior report that had the
 * same template id, sort earliest → latest, and assign as `history`.
 *
 * Without this, every uploaded report renders in isolation: trend
 * sections and "down X since March" headlines are unreachable for users
 * who only have their own data (they previously worked only for the
 * curated sample report, where history is hardcoded).
 *
 * Pure function — doesn't mutate inputs. Returns a new array of
 * Biomarker objects with `history` populated where applicable.
 */
export function mergeHistoryFromPriorReports(
  newBiomarkers: Biomarker[],
  priorReports: Report[],
): Biomarker[] {
  // Only consider real, ready, dated reports. Curated demo reports
  // (isSample) are excluded — their values are illustrative, not the
  // user's actual past history, and labeling them as such would
  // produce a fake "Testosterone is up 50 since March" trend on the
  // user's first real upload after a "Load sample data" demo.
  const priorChrono = priorReports
    .filter((r) => r.status === 'ready' && r.uploadedAt && !r.isSample)
    .slice()
    .sort((a, b) => (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? ''));

  if (priorChrono.length === 0) return newBiomarkers;

  return newBiomarkers.map((m) => {
    const history: BiomarkerReading[] = [];
    for (const r of priorChrono) {
      const prior = r.biomarkers.find((b) => b.id === m.id);
      if (prior && r.uploadedAt) {
        history.push({ date: r.uploadedAt, value: prior.value });
      }
    }
    return history.length > 0 ? { ...m, history } : m;
  });
}
