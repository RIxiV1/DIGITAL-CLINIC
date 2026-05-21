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
const REPORTS_KEY = `${KEY_PREFIX}reports`;
const QUIZ_KEY = `${KEY_PREFIX}quiz`;
const QUIZ_COMPLETE_KEY = `${KEY_PREFIX}quizComplete`;
const HISTORY_KEY = `${KEY_PREFIX}navHistory`;

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

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // no-op
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

export function saveReports<T>(reports: T[]): void {
  writeJSON(REPORTS_KEY, {
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

export function loadNavHistory<T>(): T[] {
  return readJSON<T[]>(HISTORY_KEY, []);
}

export function saveNavHistory<T>(history: T[]): void {
  writeJSON(HISTORY_KEY, history);
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                          */
/* ------------------------------------------------------------------ */

/**
 * Removes saved reports older than the TTL. Called once on app boot.
 * Failures are swallowed silently so a corrupt entry can't brick the
 * app on launch.
 */
export function cleanupExpiredReports(now: number = Date.now()): number {
  const stored = readJSON<StoredReports<unknown> | null>(REPORTS_KEY, null);
  if (!stored?.savedAt) return 0;
  const savedAt = Date.parse(stored.savedAt);
  if (Number.isNaN(savedAt)) return 0;
  if (now - savedAt > REPORT_TTL_MS) {
    removeKey(REPORTS_KEY);
    return 1;
  }
  return 0;
}

/**
 * Removes any persisted reports stuck in `status: 'processing'`. The
 * parser's File handoff lives in module state, so a tab close mid-flow
 * leaves the placeholder report in localStorage but the File gone —
 * which would render as "There was nothing to parse" on next visit.
 * Called once on app boot, BEFORE loadReports, so orphans never reach
 * UI state. Returns the count of reports cleaned up.
 */
export function cleanupOrphanProcessing(): number {
  const stored = readJSON<StoredReports<{ status?: string }> | null>(
    REPORTS_KEY,
    null,
  );
  if (!stored || !Array.isArray(stored.reports)) return 0;
  const kept = stored.reports.filter((r) => r?.status !== 'processing');
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
