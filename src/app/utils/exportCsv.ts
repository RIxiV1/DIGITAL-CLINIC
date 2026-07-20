import type { Report } from '../data/reports';

/**
 * RFC-4180 cell escaping: wrap a cell in double quotes when it contains a
 * comma, quote, CR, or LF, and double any embedded quotes. Without this a
 * lab name like "Thyrocare, Mumbai" would split into two columns.
 */
function csvCell(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADERS = [
  'Report',
  'Date',
  'Marker',
  'Value',
  'Unit',
  'Status',
  'Ref low',
  'Ref high',
] as const;

/**
 * Flatten every READY report's biomarkers into a spreadsheet-friendly CSV —
 * one row per marker.
 *
 * The companion to the existing JSON export: JSON is the full, loss-less
 * backup of the whole dc_* namespace (for re-import / archival); CSV is the
 * analysis view a user opens in Excel / Google Sheets / a personal tracker.
 * Data portability is the point — "your data, and you can actually take it
 * out" — which is the privacy-first promise made concrete.
 *
 * Built from the in-memory (already-decrypted) reports, so it exports readable
 * values even when the at-rest PIN lock is on (the caller is, by definition,
 * unlocked). CRLF line endings — the safest for Excel across platforms.
 */
export function reportsToCsv(reports: Report[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];
  for (const r of reports) {
    if (r.status !== 'ready') continue;
    for (const m of r.biomarkers) {
      lines.push(
        [
          csvCell(r.name),
          csvCell(r.uploadedAt ?? r.uploadedOn),
          csvCell(m.name),
          csvCell(m.value),
          csvCell(m.unit),
          csvCell(m.status),
          csvCell(m.labRefMin),
          csvCell(m.labRefMax),
        ].join(','),
      );
    }
  }
  return lines.join('\r\n');
}
