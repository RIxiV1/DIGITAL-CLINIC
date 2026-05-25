/**
 * Client-side persistence layer for the Digital Clinic.
 *
 * Adapted from the Lab Report Explainer's resultStore. Single namespace
 * ("dc_*"), JSON-safe wrappers, TTL-based cleanup, and persistent-storage
 * request to fight aggressive eviction (esp. iOS Safari).
 *
 * Everything is opt-in per key. Components don't need to know how
 * localStorage works — they just call save/load helpers below.
 */

const KEY_PREFIX = 'dc_';
export const REPORTS_KEY = `${KEY_PREFIX}reports`;
const QUIZ_KEY = `${KEY_PREFIX}quiz`;
const QUIZ_COMPLETE_KEY = `${KEY_PREFIX}quizComplete`;
const PENDING_CONFIRM_KEY = `${KEY_PREFIX}pendingConfirm`;

/** Reports older than this get cleaned up on next app load. 6 months. */
const REPORT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Tiny JSON-safe wrappers — callers don't repeat try/catch boilerplate */
/* ------------------------------------------------------------------ */

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, storage disabled, etc. — silently no-op so the app
    // keeps working even if persistence fails.
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Typed per-domain accessors                                          */
/* ------------------------------------------------------------------ */

type StoredReports<T> = { savedAt: string; reports: T[] };

export function loadReports<T>(): T[] {
  const stored = readJSON<StoredReports<T> | null>(REPORTS_KEY, null);
  if (!stored || !Array.isArray(stored.reports)) return [];
  return stored.reports;
}

/**
 * Persist the reports list. Returns true on success, false when
 * localStorage is unavailable / disabled / out of quota. Callers should
 * treat `false` as "your changes only live in memory" and surface a
 * warning — silent loss on tab-close is the worst failure mode.
 */
export function saveReports<T>(reports: T[]): boolean {
  return writeJSON(REPORTS_KEY, {
    savedAt: new Date().toISOString(),
    reports,
  });
}

export function loadQuiz<T>(): T | null {
  return readJSON<T | null>(QUIZ_KEY, null);
}

export function saveQuiz<T>(quiz: T): void {
  writeJSON(QUIZ_KEY, quiz);
}

export function loadQuizComplete(): boolean {
  return readJSON<boolean>(QUIZ_COMPLETE_KEY, false);
}

export function saveQuizComplete(complete: boolean): void {
  writeJSON(QUIZ_COMPLETE_KEY, complete);
}


/* ------------------------------------------------------------------ */
/* Pending-confirm record                                              */
/*                                                                      */
/* When the parser finishes a real extraction, ProcessingPage hands     */
/* control to the user via the ConfirmExtractedValuesView for them to   */
/* verify the values before we commit the report. That confirm state    */
/* used to live only in component-local state — so if the user          */
/* navigated away (browser back, etc.) and then returned to             */
/* /processing, the page would remount with a fresh `pendingConfirm`    */
/* of null, the file would already be consumed from the module-level    */
/* `pendingUpload` bridge, and the user would see a "There was nothing  */
/* to parse" error instead of their actual extracted values.            */
/*                                                                      */
/* Persisting the confirm record fixes that: ProcessingPage checks for  */
/* a stored confirm matching the current processingId on mount and      */
/* restores the view without re-parsing. Cleared on confirm/reject.     */
/* ------------------------------------------------------------------ */

export type PendingConfirmRecord<TBiomarker> = {
  /** Id of the placeholder Report this confirm corresponds to. */
  processingId: string;
  fileName: string;
  biomarkers: TBiomarker[];
  rawText?: string;
  unrecognizedRows?: string[];
  ignoredCategory?: 'viral' | 'imaging' | 'physical-exam';
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
};

export function savePendingConfirm<T>(record: PendingConfirmRecord<T>): void {
  writeJSON(PENDING_CONFIRM_KEY, record);
}

export function loadPendingConfirm<T>(): PendingConfirmRecord<T> | null {
  return readJSON<PendingConfirmRecord<T> | null>(PENDING_CONFIRM_KEY, null);
}

export function clearPendingConfirm(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_CONFIRM_KEY);
  } catch {
    // storage disabled — no-op
  }
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                          */
/* ------------------------------------------------------------------ */

/**
 * Structural shape used by the per-report TTL filter. Real Reports
 * carry more fields; we only need these to decide expiry, so a narrow
 * type keeps the persistence layer decoupled from the Report type.
 */
type ExpirableReport = {
  uploadedAt?: string;
  isSample?: boolean;
};

/**
 * Pure filter: returns the subset of reports that haven't aged past
 * REPORT_TTL_MS, plus the count pruned. Exposed for testing without
 * touching localStorage.
 *
 * Rules:
 *   - Sample reports (isSample) never expire — they're shipped with
 *     the app, not user data.
 *   - Reports without an ISO uploadedAt are kept. The display-only
 *     uploadedOn string is intentionally not parsed (fragile across
 *     locales). Legacy reports predating the uploadedAt field are a
 *     closed set; we err on "keep" rather than risk silent data loss.
 *   - Reports with a malformed uploadedAt are kept for the same reason.
 */
export function pruneExpiredReports<T extends ExpirableReport>(
  reports: T[],
  now: number = Date.now(),
): { kept: T[]; pruned: number } {
  const kept = reports.filter((r) => {
    if (r.isSample) return true;
    if (!r.uploadedAt) return true;
    const ts = Date.parse(r.uploadedAt);
    if (Number.isNaN(ts)) return true;
    return now - ts <= REPORT_TTL_MS;
  });
  return { kept, pruned: reports.length - kept.length };
}

/**
 * Prunes expired reports from localStorage in place. Per-report TTL,
 * not whole-blob — touching one report no longer extends every other
 * report's lifetime by rewriting savedAt. Called once on app boot.
 * Failures are swallowed silently so a corrupt entry can't brick the
 * app on launch.
 *
 * Returns the count of pruned reports.
 */
export function cleanupExpiredReports(now: number = Date.now()): number {
  const stored = readJSON<StoredReports<ExpirableReport> | null>(
    REPORTS_KEY,
    null,
  );
  if (!stored || !Array.isArray(stored.reports)) return 0;
  const { kept, pruned } = pruneExpiredReports(stored.reports, now);
  if (pruned > 0) {
    writeJSON(REPORTS_KEY, { savedAt: stored.savedAt, reports: kept });
  }
  return pruned;
}

/**
 * Removes any persisted reports stuck in `status: 'processing'` that
 * have NO paired pendingConfirm record. The parser's File handoff lives
 * in module state, so a tab close mid-parse leaves the placeholder in
 * localStorage but the File gone — which would render as "There was
 * nothing to parse" on next visit.
 *
 * Exception: when a parse already succeeded and the user closed the tab
 * mid-confirm-view, the matching pendingConfirm record carries all the
 * data needed for ProcessingPage to restore the confirm view without
 * re-parsing. Keep that one report so the restore path can find it.
 *
 * Called once on app boot, BEFORE loadReports, so orphans never reach
 * UI state. Returns the count of reports cleaned up.
 */
export function cleanupOrphanProcessing(): number {
  const stored = readJSON<StoredReports<{ status?: string; id?: string }> | null>(
    REPORTS_KEY,
    null,
  );
  if (!stored || !Array.isArray(stored.reports)) return 0;
  const pending = readJSON<{ processingId?: string } | null>(
    PENDING_CONFIRM_KEY,
    null,
  );
  const keepId = pending?.processingId;
  const kept = stored.reports.filter(
    (r) =>
      r?.status !== 'processing' ||
      (keepId !== undefined && r?.id === keepId),
  );
  if (kept.length === stored.reports.length) return 0;
  writeJSON(REPORTS_KEY, { savedAt: stored.savedAt, reports: kept });
  return stored.reports.length - kept.length;
}

/** Per-prefix summary for the Profile "My data" panel. */
export function getStorageStats() {
  if (typeof window === 'undefined') {
    return { keyCount: 0, approxBytes: 0, oldestDate: null as Date | null };
  }
  let keyCount = 0;
  let approxBytes = 0;
  let oldestTs = Infinity;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      keyCount += 1;
      const raw = window.localStorage.getItem(key) ?? '';
      // UTF-16 in-memory ≈ 2 bytes per char
      approxBytes += (key.length + raw.length) * 2;
      try {
        const ts = Date.parse(JSON.parse(raw)?.savedAt ?? '');
        if (!Number.isNaN(ts) && ts < oldestTs) oldestTs = ts;
      } catch {
        // not a savedAt-shaped entry — fine
      }
    }
  } catch {
    // localStorage unavailable
  }
  return {
    keyCount,
    approxBytes,
    oldestDate: oldestTs === Infinity ? null : new Date(oldestTs),
  };
}

/**
 * Snapshot of every dc_* key in localStorage, suitable for export. We
 * try to JSON-decode each value so the exported file is one nested
 * object (not a map of stringified JSON), but fall back to the raw
 * string when decoding fails — better to export-as-string than to drop
 * data we don't recognise.
 */
export function exportAllData(): {
  exportedAt: string;
  /** Schema version so a future restore path can branch on the shape. */
  schema: number;
  entries: Record<string, unknown>;
} {
  const entries: Record<string, unknown> = {};
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(KEY_PREFIX)) continue;
        const raw = window.localStorage.getItem(key);
        if (raw == null) continue;
        try {
          entries[key] = JSON.parse(raw);
        } catch {
          entries[key] = raw;
        }
      }
    } catch {
      // localStorage unavailable — return what we have so far.
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    schema: 1,
    entries,
  };
}

/** Removes every dc_* key from localStorage. Used by Profile › My data. */
export function wipeAllData(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Asks the browser to mark this origin's storage as "persistent" so it
 * survives aggressive cache-eviction. Idempotent. Browsers decide
 * whether to grant — Chrome/Edge silently allow based on engagement,
 * Firefox may prompt. Without this, a user's reports could vanish
 * before the 6-month TTL even fires.
 */
export async function requestStoragePersistence(): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage?.persist &&
      !(await navigator.storage.persisted())
    ) {
      await navigator.storage.persist();
    }
  } catch {
    // API unavailable — no-op
  }
}
