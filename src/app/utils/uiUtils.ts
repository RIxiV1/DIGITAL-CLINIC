/**
 * Shared UI formatting helpers — ported from the Lab Report Explainer.
 *
 * Keeping these in one file means a brand-wide change (e.g. switching
 * locale, adjusting clinical precision) only touches one place.
 */

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * Renders a Date in the canonical en-IN form used everywhere in the
 * app: "16 Apr 2026". Returns an em-dash for null/undefined so the UI
 * can render the result directly without null-guards everywhere.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', DATE_OPTS);
}

/** "Today" in the same format. */
export function todayLabel(): string {
  return formatDate(new Date());
}

/**
 * Rounds clinical numbers to one decimal place to suppress OCR
 * artefacts like "7.707" while preserving meaningful precision.
 * Integers pass through untouched.
 */
export function displayValue(
  value: number | string | null | undefined,
): number | string {
  if (value === null || value === undefined) return '—';
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return value;
    n = parsed;
  }
  if (Number.isInteger(n)) return n;
  const decimalsStr = String(n).split('.')[1];
  const decimals = decimalsStr?.length ?? 0;
  return decimals > 1 ? Math.round(n * 10) / 10 : n;
}

/**
 * Human-friendly KB / MB rendering for the Profile "My data" panel.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
