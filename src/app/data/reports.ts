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

export const initialReports: Report[] = [
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
