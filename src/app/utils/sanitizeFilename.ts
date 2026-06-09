/**
 * Strip Unicode characters that have no business in a filename:
 *
 *   - C0 control chars (U+0000–U+001F): nulls, escape sequences, BEL
 *   - DEL + C1 controls (U+007F–U+009F)
 *   - Zero-width spaces / joiners / BOM (U+200B–U+200D, U+FEFF)
 *   - Bidi controls (U+202A–U+202E, U+2066–U+2069) — these are the
 *     spooky ones: a file named "report‮gnp.pdf" displays as
 *     "reportfdp.gnp" in the locker, which is visually deceptive
 *   - HTML-suspicious chars (`<`, `>`, `"`, `'`, backtick) — React
 *     escapes these today, but stripping at the gate is defence in
 *     depth: any future careless `dangerouslySetInnerHTML` won't be
 *     turning a filename into a script tag
 *
 * Also collapses runs of whitespace into a single space (multi-line
 * filenames are confusing in the locker) and caps the length at
 * `maxLength` (default 200) so a malicious / absurd filename can't
 * chew through localStorage quota.
 *
 * Falls back to 'report' when the sanitized name is empty.
 *
 * Implementation builds the regex from \u-escaped string literals so
 * the source survives copy-paste, line-ending normalization, and
 * pasted console output without silently breaking — putting literal
 * control characters into source code is a recipe for invisible
 * corruption.
 */
// eslint-disable-next-line no-control-regex
const STRIP_PATTERN = new RegExp(
  '[' +
    '\\u0000-\\u001F' + // C0 controls
    '\\u007F-\\u009F' + // DEL + C1 controls
    '\\u200B-\\u200D' + // zero-width space / joiners
    '\\u202A-\\u202E' + // bidi embeds + RTL/LTR overrides
    '\\u2066-\\u2069' + // bidi isolates
    '\\uFEFF' + // BOM / ZWNBSP
    '<>"\'`' + // HTML-suspicious chars (defence in depth)
    ']',
  'g',
);

export function sanitizeFilename(name: string, maxLength = 200): string {
  const cleaned = name.replace(STRIP_PATTERN, '').replace(/\s+/g, ' ').trim();
  const truncated = cleaned.slice(0, maxLength);
  return truncated || 'report';
}
