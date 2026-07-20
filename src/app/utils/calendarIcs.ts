/**
 * Client-side iCalendar (.ics) generation for the retest reminder.
 *
 * The dashboard nudges "it's been N months — most markers are worth
 * re-checking every 3–6 months," but a nudge you can't act on is easy to
 * ignore. This turns it into a real calendar entry (all-day event ~a week
 * out, with a day-before alarm) the user can drop into Google/Apple/Outlook.
 * Purely local — a downloaded file, no backend, no account — same as the
 * JSON/CSV exports.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYYMMDD in local time — for an all-day VALUE=DATE event. */
function dateOnly(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** YYYYMMDDTHHMMSSZ in UTC — for DTSTAMP. */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, newline. */
export function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1 line folding: no content line exceeds 75 octets; overflow
 *  continues on the next line prefixed with a single space. Content is ASCII
 *  here, so string length tracks octet count. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}

/** Small stable string hash → a deterministic UID per report, so re-adding
 *  updates the same calendar entry instead of creating a duplicate. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Build a .ics string for a "retest your blood work" reminder. `now` is
 * injectable for deterministic tests; defaults to the current time.
 */
export function retestReminderIcs(opts: {
  reportName: string;
  months: number;
  daysFromNow?: number;
  now?: Date;
}): string {
  const { reportName, months, daysFromNow = 7, now = new Date() } = opts;
  const start = new Date(now);
  start.setDate(start.getDate() + daysFromNow);
  const end = new Date(start);
  end.setDate(end.getDate() + 1); // DTEND is exclusive for all-day events

  const summary = 'Retest your blood work';
  const monthLabel = `${months} ${months === 1 ? 'month' : 'months'}`;
  const description =
    `It's been about ${monthLabel} since ${reportName}. ` +
    'Hormone and metabolic markers are worth re-checking every 3-6 months - ' +
    'book a fresh test, then upload it to see what changed.';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ForMen Digital Clinic//Retest reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:formen-retest-${hash(reportName)}@formen.co.in`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${dateOnly(start)}`,
    `DTEND;VALUE=DATE:${dateOnly(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // CRLF line separators per spec, after folding each content line.
  return lines.map(foldLine).join('\r\n');
}
