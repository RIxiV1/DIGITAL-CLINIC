import { sampleBiomarkers, type Biomarker } from './biomarkers';
import type { ReportBadge } from '../components/StatusBadge';

export type ReportStatus = 'processing' | 'ready';

export type Report = {
  id: string;
  name: string;
  lab: string;
  uploadedOn: string;
  status: ReportStatus;
  /** Optional override — defaults to derived from status. */
  badge?: ReportBadge;
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
    status: 'ready',
    badge: 'analyzed',
    biomarkers: sampleBiomarkers,
  },
  {
    id: 'rep-002',
    name: 'Hormone Panel',
    lab: 'SRL Diagnostics',
    uploadedOn: '04 Mar 2026',
    status: 'ready',
    badge: 'ready',
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

/** True if the report id refers to a curated sample (not user-uploaded). */
export function isSampleReport(id: string): boolean {
  return sampleReports.some((r) => r.id === id);
}

export function badgeFor(r: Report): ReportBadge {
  if (r.badge) return r.badge;
  if (r.status === 'processing') return 'processing';
  return 'analyzed';
}

export function makeReport(name: string): Report {
  return {
    id: `rep-${Math.random().toString(36).slice(2, 8)}`,
    name,
    lab: 'New upload',
    uploadedOn: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    status: 'processing',
    badge: 'processing',
    biomarkers: sampleBiomarkers,
  };
}
