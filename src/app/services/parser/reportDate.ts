/**
 * Collection-date extraction.
 *
 * Every uploaded report was stamped with the date it was UPLOADED, which is
 * wrong in the one case that matters most: a new user backfilling the reports
 * they already have. All of them land on today, so `getTrajectory` sees a
 * zero-day span and every trend silently disappears — and worse, "latest
 * report" becomes whichever of the same-day uploads sorted last, so the
 * dashboard can headline a two-year-old value as current.
 *
 * The date is printed on the report. This reads it.
 *
 * Deliberately conservative: a WRONG date is worse than no date, because it
 * reorders the user's history and mislabels which reading is current. So this
 * requires an explicit collection/report label, validates hard, and returns
 * null on any doubt — the caller then keeps today's date, exactly as before.
 */

/** Only ever look at the head of the document. Collection dates are printed
 *  in the header block; scanning a 200 KB OCR blob to the end just adds
 *  chances to match a footer or a date inside a comment. */
const HEAD_CHARS = 20_000;

/** Reject anything older than this. Guards against a date-of-birth or a
 *  template's printed example leaking in. */
const MAX_AGE_YEARS = 30;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Labels that introduce a date, most-trustworthy first.
 *
 * Collection beats reporting because the physiology belongs to the moment
 * the blood was drawn, not to whenever the lab got round to printing. The
 * gap is routinely 1–3 days and occasionally weeks.
 *
 * Bare "Date:" is deliberately absent — it's as likely to introduce a date
 * of birth as a collection date, and a DOB would rewrite the user's history
 * to 1994.
 */
const DATE_LABELS: readonly { pattern: RegExp; priority: number }[] = [
  { pattern: /(?:sample|specimen)\s*(?:collected|collection|drawn)/i, priority: 0 },
  { pattern: /collect(?:ed|ion)\s*(?:on|date|date\s*&?\s*time|at)?/i, priority: 0 },
  { pattern: /\bdrawn\s*(?:on|at)?/i, priority: 0 },
  { pattern: /(?:sample|specimen)\s*date/i, priority: 0 },
  { pattern: /receiv(?:ed|ing)\s*(?:on|date)?/i, priority: 1 },
  { pattern: /registrat(?:ion|ed)\s*(?:on|date)?/i, priority: 1 },
  { pattern: /register(?:ed)?\s*(?:on|date)/i, priority: 1 },
  { pattern: /report(?:ed|ing)\s*(?:on|date)?/i, priority: 2 },
  { pattern: /(?:released|approved|printed)\s*(?:on|date)?/i, priority: 2 },
];

/** How far past a label to look for the date itself. Wide enough for
 *  "Collected On   :   12/04/2026", tight enough not to reach the next
 *  field on a flattened single-line layout. */
const LABEL_WINDOW = 44;

type Candidate = {
  iso: string;
  priority: number;
  /** True when the format named its month in words, so day/month order
   *  could not have been guessed wrong. Breaks ties within a priority. */
  unambiguous: boolean;
};

/** Expand a 2-digit year. Lab reports are contemporary documents, so the
 *  usual 70-pivot is safe and keeps "12-Apr-26" working. */
function expandYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

/**
 * Build an ISO date, verifying the calendar accepts it. Round-tripping
 * through Date catches 31 February and month 13 without a lookup table.
 */
function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * Parse the first date found in `window`, or null.
 *
 * Numeric day/month order is genuinely ambiguous ("04/12/2026"). Where the
 * digits settle it we use them; where they don't we read day-first, matching
 * the Indian and British convention this product is built for. A US report
 * dated 04/12 will be read as 4 December — which is why a month-NAME match
 * anywhere in the document wins over a numeric one, and why the whole thing
 * is only a sort key, never shown as clinical fact.
 */
function parseDateIn(window: string): { iso: string; unambiguous: boolean } | null {
  // ISO first — unambiguous by construction.
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(window);
  if (iso) {
    const out = toIso(+iso[1], +iso[2], +iso[3]);
    if (out) return { iso: out, unambiguous: true };
  }

  // "12-Apr-2026", "12 April 2026", "12/Apr/26"
  const dMonY =
    /(?<!\d)(\d{1,2})\s*[-/\s]\s*([A-Za-z]{3,9})\s*[-/\s,]\s*(\d{2,4})(?!\d)/.exec(
      window,
    );
  if (dMonY) {
    const m = MONTHS[dMonY[2].slice(0, 3).toLowerCase()];
    if (m) {
      const out = toIso(expandYear(+dMonY[3]), m, +dMonY[1]);
      if (out) return { iso: out, unambiguous: true };
    }
  }

  // "Apr 12, 2026"
  const monDY =
    /(?<![A-Za-z])([A-Za-z]{3,9})\s*[-/\s]\s*(\d{1,2})\s*[-/\s,]\s*(\d{2,4})(?!\d)/.exec(
      window,
    );
  if (monDY) {
    const m = MONTHS[monDY[1].slice(0, 3).toLowerCase()];
    if (m) {
      const out = toIso(expandYear(+monDY[3]), m, +monDY[2]);
      if (out) return { iso: out, unambiguous: true };
    }
  }

  // Pure numeric — the ambiguous family.
  const num =
    /(?<!\d)(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})(?!\d)/.exec(window);
  if (num) {
    const a = +num[1];
    const b = +num[2];
    const y = expandYear(+num[3]);
    // Let the digits disambiguate when they can; otherwise day-first.
    const dayFirst = a > 12 ? true : b > 12 ? false : true;
    const out = dayFirst ? toIso(y, b, a) : toIso(y, a, b);
    if (out) return { iso: out, unambiguous: a > 12 || b > 12 };
  }
  return null;
}

/**
 * Read the date this sample was collected, as ISO yyyy-mm-dd.
 *
 * Returns null unless a labelled, calendar-valid, plausibly-recent date is
 * found — the caller should fall back to the upload date rather than guess.
 *
 * `today` is injectable so the plausibility window is testable without
 * freezing the clock globally.
 */
export function extractCollectionDate(
  rawText: string,
  today: Date = new Date(),
): string | null {
  if (!rawText) return null;
  const head = rawText.slice(0, HEAD_CHARS).replace(/[ \t]+/g, ' ');

  // A collection can't be in the future; allow a day of timezone slop.
  const maxTs = today.getTime() + 24 * 60 * 60 * 1000;
  const minTs = Date.UTC(today.getUTCFullYear() - MAX_AGE_YEARS, 0, 1);

  const candidates: Candidate[] = [];
  for (const { pattern, priority } of DATE_LABELS) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const hit of head.matchAll(re)) {
      const from = (hit.index ?? 0) + hit[0].length;
      const parsed = parseDateIn(head.slice(from, from + LABEL_WINDOW));
      if (!parsed) continue;
      const ts = Date.parse(`${parsed.iso}T00:00:00Z`);
      if (Number.isNaN(ts) || ts > maxTs || ts < minTs) continue;
      candidates.push({ iso: parsed.iso, priority, unambiguous: parsed.unambiguous });
    }
  }
  if (candidates.length === 0) return null;

  // Best label wins; within a label, a month-name reading beats a guessed
  // day/month order; then the earliest date, which for a collection-vs-report
  // tie is the draw.
  candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      Number(b.unambiguous) - Number(a.unambiguous) ||
      a.iso.localeCompare(b.iso),
  );
  return candidates[0].iso;
}
