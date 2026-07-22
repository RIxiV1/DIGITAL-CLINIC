import type { Report } from '../data/reports';
import type { BiomarkerStatus } from '../data/biomarkers';

/**
 * Plain-text, WhatsApp-friendly summary of a report + a `wa.me` deep link.
 *
 * Indian users live on WhatsApp, and "share with your doctor" is a real
 * flow — so alongside the PDF download we offer a text share. This is
 * user-initiated and privacy-safe: `wa.me` only PRE-FILLS the message;
 * nothing is sent until the user picks a recipient and taps send inside
 * WhatsApp. No account, no server, no data leaves except what the user
 * themselves forwards.
 *
 * Pure functions so the copy is unit-tested and can't silently drift.
 */

/** Worst-first, so the doctor sees the pressing items at the top. */
const STATUS_RANK: Record<BiomarkerStatus, number> = {
  critical: 0,
  concern: 1,
  attention: 2,
  good: 3,
};

/** A plain phrase per tier — NOT the UPPERCASE badge labels, which read
 *  oddly mid-sentence, and deliberately calm (this lands in a chat). */
const STATUS_PHRASE: Record<BiomarkerStatus, string> = {
  critical: 'see a doctor soon',
  concern: 'worth a check',
  attention: 'keep an eye',
  good: 'in range',
};

/** Cap the flagged list so a big panel doesn't produce a wall of text in a
 *  chat bubble; the count line still conveys the full picture. */
const MAX_FLAGGED_LINES = 15;

export function reportShareText(report: Report): string {
  const markers = report.biomarkers;
  const good = markers.filter((m) => m.status === 'good').length;
  const flagged = markers
    .filter((m) => m.status !== 'good')
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const lines: string[] = [];
  lines.push(`My blood test — ${report.name} (${report.uploadedOn})`);
  lines.push('');
  lines.push(`${good} of ${markers.length} markers in range.`);

  if (flagged.length > 0) {
    lines.push('');
    lines.push('To look at:');
    for (const m of flagged.slice(0, MAX_FLAGGED_LINES)) {
      const unit = m.unit ? ` ${m.unit}` : '';
      lines.push(`• ${m.name}: ${m.value}${unit} (${STATUS_PHRASE[m.status]})`);
    }
    if (flagged.length > MAX_FLAGGED_LINES) {
      lines.push(`…and ${flagged.length - MAX_FLAGGED_LINES} more.`);
    }
  }

  lines.push('');
  lines.push('A screening summary, not a diagnosis — please confirm with a doctor.');
  return lines.join('\n');
}

/** Build the `wa.me` deep link that opens WhatsApp with the text pre-filled.
 *  No phone number → the user picks the recipient in WhatsApp. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
