/**
 * Client-side persistence layer for the Digital Clinic.
 *
 * Adapted from the Lab Report Explainer's resultStore. Single namespace
 * ("dc_*"), JSON-safe wrappers, TTL-based cleanup, and persistent-storage
 * request to fight aggressive eviction (esp. iOS Safari).
 *
 * Everything is opt-in per key. Components don't need to know how
 * localStorage works — they just call save/load helpers below.
 *
 * Every load path validates the persisted JSON against a zod schema and
 * returns the fallback when it doesn't match. localStorage is an
 * attacker-and-accident-controlled trust boundary (browser extensions,
 * past-buggy-version writes, hostile devtools sessions on shared
 * devices); without schema validation, a poisoned `dc_*` key crashes
 * the app on every load with no in-app recovery. The validation also
 * means a future catalog refactor that retires a Biomarker field
 * doesn't silently inject stale shapes into renders.
 */

import { z } from 'zod';
import { encryptString, decryptString } from './crypto';

const KEY_PREFIX = 'dc_';
export const REPORTS_KEY = `${KEY_PREFIX}reports`;
export const QUIZ_KEY = `${KEY_PREFIX}quiz`;
export const QUIZ_COMPLETE_KEY = `${KEY_PREFIX}quizComplete`;
const PENDING_CONFIRM_KEY = `${KEY_PREFIX}pendingConfirm`;
/** Catalog-version ack — the highest CATALOG_VERSION the user has seen
 *  and acknowledged. When the running app's CATALOG_VERSION exceeds
 *  this value AND the user has persisted reports stamped at an older
 *  version, the dashboard surfaces a one-time migration notice
 *  explaining why their trendlines may no longer merge cleanly. */
const CATALOG_ACK_KEY = `${KEY_PREFIX}catalogAck`;
/** Re-test nudge dismissal — stores the report id the user last
 *  dismissed the "time to re-test" banner for. The banner re-appears
 *  only when the latest real report's id differs (i.e. they've uploaded
 *  something newer since), so dismissing is sticky per report rather
 *  than per session. */
const RETEST_ACK_KEY = `${KEY_PREFIX}retestAck`;
/** User preference: when local lab-report parsing (Tesseract / pdfjs)
 *  fails on an image upload, should we auto-cascade to the Vision-LLM
 *  fallback (Pipeline 3 / Gemini) instead of stopping at the failure
 *  card and waiting for an explicit tap? Defaults true — opt-out, not
 *  opt-in. The cascade is gated by image MIME type only (we never
 *  cascade PDFs, which have text layers and stronger PHI signal).
 *  Surfaced as an inline disclosure + Cancel during the cascade so
 *  consent stays just-in-time. Profile → "AI auto-fallback" turns it
 *  off permanently for users who want zero implicit network egress. */
const AI_AUTO_FALLBACK_KEY = `${KEY_PREFIX}aiAutoFallback`;
const DISCREET_KEY = `${KEY_PREFIX}discreet`;

/** Color theme preference. Two values: 'dark' (the default — set on
 *  <html> by an inline bootstrap script in index.html before React
 *  mounts) or 'light' (explicit user opt-in via Profile toggle).
 *  System `prefers-color-scheme` is intentionally NOT consulted —
 *  the brand identity on first paint is dark regardless of OS pref. */
const THEME_KEY = `${KEY_PREFIX}theme`;

/** Reports older than this get cleaned up on next app load. 6 months. */
const REPORT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/** Maximum reports retained in persistence. Hard cap to prevent a
 *  long-running locker from chewing through localStorage quota — without
 *  this, a user who imports 50 historical PDFs hits the ~5 MB cap and
 *  every subsequent save silently fails. */
const MAX_REPORTS = 200;

/* ------------------------------------------------------------------ */
/* zod schemas for every dc_* shape — validation at the trust boundary  */
/* ------------------------------------------------------------------ */

/** Biomarker categories — must stay in sync with `BiomarkerCategoryId`
 *  in data/biomarkers.ts. Listed explicitly here (not imported) so the
 *  persistence layer doesn't pull the whole catalog into bundle paths
 *  that don't need it. Validation tolerates additions: an unknown
 *  category id in a persisted report fails the schema → fallback to
 *  empty state for that key, which is the safer posture than admitting
 *  unknown enums. */
const BiomarkerCategorySchema = z.enum([
  'hormones',
  'metabolic',
  'heart',
  'thyroid',
  'vitamins',
  'liver',
  'kidney',
  'blood',
  'fertility',
  'electrolytes',
  'inflammation',
]);

// MUST stay in sync with BiomarkerStatus in data/biomarkers.ts. Omitting
// 'critical' here was a silent data-loss bug: a report containing a panic
// value (glucose ≥250, HbA1c >10, …) saved fine, then failed validation
// on the next load and the WHOLE report was dropped — hitting exactly the
// users with the most urgent results.
const BiomarkerStatusSchema = z.enum([
  'good',
  'attention',
  'concern',
  'critical',
]);

const OptimalSourceSchema = z.object({
  // Cap raised to 500 so editorial growth (a longer citation, a
  // multi-author guideline title, an audience-qualifier appended to
  // the label by a future catalog edit) doesn't slip past the gate
  // and trip the validator on every user's reports. The previous 200
  // cap left ~100 chars of headroom over the longest catalog label
  // today — not enough.
  label: z.string().max(500),
  url: z.string().url().max(500).optional(),
  audience: z.string().max(100).optional(),
});

const BiomarkerReadingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite(),
});

const BiomarkerSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  simpleName: z.string().max(120).optional(),
  value: z.number().finite(),
  unit: z.string().max(40),
  min: z.number().finite(),
  max: z.number().finite(),
  optimalMin: z.number().finite().optional(),
  optimalMax: z.number().finite().optional(),
  optimalSource: OptimalSourceSchema.optional(),
  actionMin: z.number().finite().optional(),
  actionMax: z.number().finite().optional(),
  actionSource: OptimalSourceSchema.optional(),
  status: BiomarkerStatusSchema,
  category: BiomarkerCategorySchema,
  direction: z.enum(['band', 'up', 'down']).optional(),
  plain: z.string().max(2000),
  problemId: z.string().max(80).optional(),
  history: z.array(BiomarkerReadingSchema).max(50).optional(),
  /** Catalog version stamped at write time. Lets the history merger
   *  refuse to fuse old-schema readings with new-schema templates after
   *  a catalog rename (see [[reports-merge-history]]). Optional for
   *  backward compat with reports persisted before the field landed. */
  catalogVersion: z.number().int().nonnegative().optional(),
  /** Lab's printed reference range, captured at extraction time. Used
   *  for display alongside the catalog's healthy band. Optional. */
  labRefMin: z.number().finite().optional(),
  labRefMax: z.number().finite().optional(),
  /** Unit-reconciliation receipt — the lab's original printed value/unit,
   *  set only when the parser rescaled to canonical units. Display-only. */
  originalValue: z.number().finite().optional(),
  originalUnit: z.string().max(40).optional(),
  /** OCR confidence (0–100) for photo/scanned-PDF reads. Display-only. */
  ocrConfidence: z.number().finite().optional(),
  /** Clinical-critical cliff bounds, propagated from the catalog so the
   *  BiomarkerBar can scale its zones against the real same-day-care
   *  thresholds after a reload (otherwise the bar reverts to a span
   *  heuristic and a moderately-out-of-range value re-pegs to the end of
   *  the track). Optional — markers with no documented panic value omit
   *  them. */
  criticalLow: z.number().finite().optional(),
  criticalHigh: z.number().finite().optional(),
});

const ReportSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  lab: z.string().max(200),
  uploadedOn: z.string().max(40),
  uploadedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(['processing', 'ready']),
  badge: z.enum(['processing', 'ready', 'analyzed']).optional(),
  isSample: z.boolean().optional(),
  biomarkers: z.array(BiomarkerSchema).max(300),
});

/** Tolerant on the array fields: real users on prod can land in a
 *  partial-completion state (age + activity set, symptoms not yet
 *  picked) — making `priorities` / `symptoms` strictly required would
 *  fail validation on that legitimate shape, wipe dc_quiz, and lose
 *  the user's age + activity answers along with the missing arrays.
 *  `.catch([])` defaults the field to `[]` when it's absent OR
 *  malformed, preserving the rest of the object instead of nuking
 *  the whole record. */
const QuizAnswersSchema = z.object({
  age: z.string().max(40).optional(),
  activity: z.string().max(40).optional(),
  priorities: z.array(z.string().max(80)).max(40).catch([]),
  symptoms: z.array(z.string().max(80)).max(40).catch([]),
  // Same tolerant treatment as the other arrays: absent on quizzes
  // persisted before this field existed, so default to [] rather than
  // failing validation and wiping the whole record.
  comorbidities: z.array(z.string().max(80)).max(40).catch([]),
});

const QuizCompleteSchema = z.boolean();
const AiAutoFallbackSchema = z.boolean();
const DiscreetSchema = z.boolean();

const PendingConfirmSchema = z.object({
  processingId: z.string().min(1).max(80),
  fileName: z.string().min(1).max(400),
  biomarkers: z.array(BiomarkerSchema).max(300),
  rawText: z.string().max(200_000).optional(),
  unrecognizedRows: z.array(z.string().max(500)).max(50).optional(),
  ignoredCategory: z.enum(['viral', 'imaging', 'physical-exam']).optional(),
  ocrPagesAttempted: z.number().int().nonnegative().max(50).optional(),
  ocrPagesSkipped: z.number().int().nonnegative().max(50).optional(),
  ocrConfidence: z.number().min(0).max(100).optional(),
});

/* ------------------------------------------------------------------ */
/* Tiny JSON-safe wrappers — callers don't repeat try/catch boilerplate */
/* ------------------------------------------------------------------ */

function rawRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Read + zod-validate. On parse OR validation failure, the key is
 * cleared (so the app boots cleanly on the next mount) and the
 * fallback is returned. Logs a single warn so corruption is debuggable
 * without spamming the console on every read.
 */
function readValidated<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  const raw = rawRead(key);
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`persistence: ${key} contains non-JSON; clearing.`);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage disabled */
    }
    return fallback;
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.warn(
      `persistence: ${key} failed validation at`,
      result.error.issues.map((i) => i.path.join('.')).join(','),
      '— clearing.',
    );
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage disabled */
    }
    return fallback;
  }
  return result.data;
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

/**
 * Outer wrapper schema for the reports key — validates the envelope
 * shape (savedAt + reports array) but leaves each report as unknown
 * for tolerant per-report validation below. The previous all-or-
 * nothing version (`z.array(ReportSchema).max(MAX_REPORTS)`) would
 * fail the entire blob if a single biomarker overshot a string cap
 * or carried a field outside enum — wiping every report the user
 * owned for the sake of one bad entry.
 */
const StoredReportsEnvelopeSchema = z.object({
  savedAt: z.string(),
  reports: z.array(z.unknown()).max(MAX_REPORTS),
});

/**
 * Load reports with per-entry tolerance. Each Report is independently
 * validated; the good ones are kept and the bad ones are dropped with
 * a single console.warn so corruption is debuggable. This is the
 * crucial difference vs. readValidated()'s all-or-nothing posture:
 * persisted state surfaces ONE bad record at a time as the user
 * accumulates reports, and we shouldn't punish 50 good reports for
 * one schema violation.
 */
/** Per-entry tolerant validation shared by the plaintext and encrypted
 *  load paths — keep the good Reports, drop (and count) the bad. */
function validateReportArray<T>(candidates: unknown[]): T[] {
  const kept: T[] = [];
  let dropped = 0;
  for (const candidate of candidates) {
    const result = ReportSchema.safeParse(candidate);
    if (result.success) {
      kept.push(result.data as unknown as T);
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `persistence: dropped ${dropped} report${dropped === 1 ? '' : 's'} failing validation; ${kept.length} kept.`,
    );
  }
  return kept;
}

export function loadReports<T = z.infer<typeof ReportSchema>>(): T[] {
  // Safety: never run the plaintext path on ENCRYPTED data. readValidated
  // would see the `{enc}` envelope as schema-invalid and CLEAR the key —
  // silently destroying a locked user's reports. Any caller that hits
  // this while the lock is on (e.g. the cross-tab storage handler) just
  // gets [] and the ciphertext is left intact; the encrypted-aware
  // loadReportsMaybeEncrypted is the correct path when a key is available.
  if (reportsAreEncrypted()) return [];
  const envelope = readValidated(
    REPORTS_KEY,
    StoredReportsEnvelopeSchema,
    null as z.infer<typeof StoredReportsEnvelopeSchema> | null,
  );
  if (!envelope) return [];
  return validateReportArray<T>(envelope.reports);
}

/** Schema for the encrypted reports envelope written when the data lock
 *  is on: the reports ARRAY is JSON-encoded then AES-GCM sealed into
 *  `enc`; `savedAt` stays in the clear for cross-tab freshness checks. */
const EncryptedReportsEnvelopeSchema = z.object({
  savedAt: z.string(),
  enc: z.object({ iv: z.string(), data: z.string() }),
});

/** True when the stored reports blob is currently encrypted. Cheap sync
 *  check; used when migrating in/out of the locked state. */
export function reportsAreEncrypted(): boolean {
  const raw = rawRead(REPORTS_KEY);
  if (!raw) return false;
  try {
    return EncryptedReportsEnvelopeSchema.safeParse(JSON.parse(raw)).success;
  } catch {
    return false;
  }
}

/**
 * Load reports, transparently decrypting when the stored envelope is
 * encrypted. `key` (the dataLock session key) is required for the
 * encrypted path — without it, or on a decryption failure (wrong key /
 * corruption), returns []. Plaintext envelopes load exactly like
 * loadReports(), so this is safe to use on both locked and unlocked data.
 */
export async function loadReportsMaybeEncrypted<
  T = z.infer<typeof ReportSchema>,
>(key: CryptoKey | null): Promise<T[]> {
  const raw = rawRead(REPORTS_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const enc = EncryptedReportsEnvelopeSchema.safeParse(parsed);
  if (enc.success) {
    if (!key) return [];
    const plaintext = await decryptString(key, enc.data.enc);
    if (plaintext == null) return [];
    let arr: unknown;
    try {
      arr = JSON.parse(plaintext);
    } catch {
      return [];
    }
    return Array.isArray(arr) ? validateReportArray<T>(arr) : [];
  }
  return loadReports<T>();
}

/**
 * Persist reports, encrypting when a session `key` is present (lock on)
 * and writing plaintext otherwise. Mirrors saveReports' MAX_REPORTS cap +
 * boolean contract (false = write failed, only-in-memory).
 */
export async function saveReportsMaybeEncrypted<T>(
  reports: T[],
  key: CryptoKey | null,
): Promise<boolean> {
  const capped = reports.slice(0, MAX_REPORTS);
  if (!key) return saveReports(capped);
  try {
    const enc = await encryptString(key, JSON.stringify(capped));
    return writeJSON(REPORTS_KEY, { savedAt: new Date().toISOString(), enc });
  } catch {
    return false;
  }
}

/**
 * Persist the reports list. Returns true on success, false when
 * localStorage is unavailable / disabled / out of quota. Callers should
 * treat `false` as "your changes only live in memory" and surface a
 * warning — silent loss on tab-close is the worst failure mode.
 */
export function saveReports<T>(reports: T[]): boolean {
  // Hard cap — defense against runaway state (a future bug that
  // duplicates reports on every render would otherwise quietly chew
  // through quota until the next save fails). The slice is newest-first
  // because callers prepend (see ReportsContext.addReport).
  const capped = reports.slice(0, MAX_REPORTS);
  return writeJSON(REPORTS_KEY, {
    savedAt: new Date().toISOString(),
    reports: capped,
  });
}

export function loadQuiz<T = z.infer<typeof QuizAnswersSchema>>(): T | null {
  return readValidated(
    QUIZ_KEY,
    QuizAnswersSchema,
    null as z.infer<typeof QuizAnswersSchema> | null,
  ) as T | null;
}

export function saveQuiz<T>(quiz: T): void {
  writeJSON(QUIZ_KEY, quiz);
}

export function loadQuizComplete(): boolean {
  return readValidated(QUIZ_COMPLETE_KEY, QuizCompleteSchema, false);
}

export function saveQuizComplete(complete: boolean): void {
  writeJSON(QUIZ_COMPLETE_KEY, complete);
}

/* ------------------------------------------------------------------ */
/* AI auto-fallback preference                                          */
/*                                                                      */
/* Defaults to TRUE — when local parsing fails on an image upload, the */
/* AI parser kicks in automatically. Users who want zero implicit       */
/* network egress can flip this off in Profile.                         */
/* ------------------------------------------------------------------ */

export function loadAiAutoFallbackSetting(): boolean {
  return readValidated(AI_AUTO_FALLBACK_KEY, AiAutoFallbackSchema, true);
}

export function saveAiAutoFallbackSetting(enabled: boolean): void {
  writeJSON(AI_AUTO_FALLBACK_KEY, enabled);
}

/* ------------------------------------------------------------------ */
/* Discreet Mode preference                                            */
/*                                                                     */
/* Defaults to FALSE. When on, a privacy veil hides all content the    */
/* moment the app loses focus / is backgrounded (app switcher, glance  */
/* away) and lifts when the user returns — the "soundproof room"       */
/* promise for someone terrified a passer-by sees his screen.          */
/* ------------------------------------------------------------------- */

export function loadDiscreetMode(): boolean {
  return readValidated(DISCREET_KEY, DiscreetSchema, false);
}

export function saveDiscreetMode(enabled: boolean): void {
  writeJSON(DISCREET_KEY, enabled);
}

/* ------------------------------------------------------------------ */
/* Theme preference                                                     */
/*                                                                      */
/* Read directly via `localStorage` (no JSON envelope) because the      */
/* value is also consumed by an inline bootstrap script in index.html   */
/* that runs BEFORE this module is parsed. Both readers must agree on   */
/* the storage format; bare-string is the simplest coordination point.  */
/* ------------------------------------------------------------------- */

export type Theme = 'light' | 'dark';

export function loadTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    // Private mode / quota / disabled storage. Mirror the bootstrap
    // script's fallback so the React-controlled state matches what's
    // already on <html>.
    return 'dark';
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* swallow — best-effort persistence */
  }
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
/*                                                                      */
/* Validation note: this record short-circuits straight into the        */
/* dashboard's "your report" surface via markReportReady — without zod  */
/* validation, an attacker (or an old buggy build) writing to           */
/* dc_pendingConfirm could inject fabricated lab values labelled as the */
/* user's own. The schema below is enforced on read; load returns null  */
/* on any deviation, and ProcessingPage falls back to re-parsing.       */
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
  ocrConfidence?: number;
};

export function savePendingConfirm<T>(record: PendingConfirmRecord<T>): void {
  writeJSON(PENDING_CONFIRM_KEY, record);
}

export function loadPendingConfirm<
  T = z.infer<typeof BiomarkerSchema>,
>(): PendingConfirmRecord<T> | null {
  const result = readValidated(
    PENDING_CONFIRM_KEY,
    PendingConfirmSchema,
    null as z.infer<typeof PendingConfirmSchema> | null,
  );
  return result as unknown as PendingConfirmRecord<T> | null;
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
 *   - Date math anchors on UTC midnight so the 180-day boundary doesn't
 *     drift by ±24h based on the user's timezone. Previously
 *     `Date.parse('2025-12-04')` returned UTC midnight but
 *     `Date.now()` is timezone-sensitive — the inconsistency could
 *     prune a report a day early or late depending on tz at the
 *     boundary.
 */
export function pruneExpiredReports<T extends ExpirableReport>(
  reports: T[],
  now: number = Date.now(),
): { kept: T[]; pruned: number } {
  const kept = reports.filter((r) => {
    if (r.isSample) return true;
    if (!r.uploadedAt) return true;
    const ts = Date.parse(`${r.uploadedAt}T00:00:00Z`);
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
 * Returns `{ pruned, quotaError }`. Callers can promote `quotaError`
 * into a user-visible banner so the storage-full case isn't silent
 * (previously the cleanup write was ignored — the in-memory state
 * continued as if pruning had succeeded, and the next save error came
 * from an unrelated path).
 */
export function cleanupExpiredReports(now: number = Date.now()): {
  pruned: number;
  quotaError: boolean;
} {
  // Tolerant envelope-only validation — we don't want a single bad
  // biomarker to make the TTL cleanup skip itself entirely. The TTL
  // filter only needs the `uploadedAt` + `isSample` shape, both of
  // which we re-narrow inside pruneExpiredReports's filter.
  const stored = readValidated(
    REPORTS_KEY,
    StoredReportsEnvelopeSchema,
    null as z.infer<typeof StoredReportsEnvelopeSchema> | null,
  );
  if (!stored) return { pruned: 0, quotaError: false };
  const reports = stored.reports as ExpirableReport[];
  const { kept, pruned } = pruneExpiredReports(reports, now);
  if (pruned === 0) return { pruned: 0, quotaError: false };
  const ok = writeJSON(REPORTS_KEY, { savedAt: stored.savedAt, reports: kept });
  return { pruned, quotaError: !ok };
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
 * UI state. Returns `{ pruned, quotaError }` — see cleanupExpiredReports.
 */
export function cleanupOrphanProcessing(): {
  pruned: number;
  quotaError: boolean;
} {
  const stored = readValidated(
    REPORTS_KEY,
    StoredReportsEnvelopeSchema,
    null as z.infer<typeof StoredReportsEnvelopeSchema> | null,
  );
  if (!stored) return { pruned: 0, quotaError: false };
  const pending = readValidated(
    PENDING_CONFIRM_KEY,
    PendingConfirmSchema,
    null as z.infer<typeof PendingConfirmSchema> | null,
  );
  const keepId = pending?.processingId;
  // Narrow each candidate just enough to apply the status + id check.
  // We deliberately don't run ReportSchema here — orphan cleanup
  // should still work on records that are otherwise valid except for
  // an unrelated field (e.g. an out-of-bounds biomarker unit string).
  type Trimmed = { status?: string; id?: string };
  const candidates = stored.reports as Trimmed[];
  const kept = candidates.filter(
    (r) =>
      r?.status !== 'processing' || (keepId !== undefined && r?.id === keepId),
  );
  if (kept.length === candidates.length) {
    return { pruned: 0, quotaError: false };
  }
  const ok = writeJSON(REPORTS_KEY, { savedAt: stored.savedAt, reports: kept });
  return { pruned: candidates.length - kept.length, quotaError: !ok };
}

/** Per-prefix summary for the Profile "My data" panel.
 *
 *  Reads only the reports key for the savedAt timestamp — the previous
 *  implementation JSON.parsed every dc_* key on every Profile open to
 *  look for `.savedAt`, which meant parsing the entire reports blob
 *  (often 100KB+) just to read a four-char ISO date prefix. Now we
 *  pull only the reports key and substring-scan for `"savedAt":"…"`
 *  without parsing — same answer, an order of magnitude less work,
 *  and zero data exposure if a key gets poisoned. */
export function getStorageStats() {
  if (typeof window === 'undefined') {
    return { keyCount: 0, approxBytes: 0, oldestDate: null as Date | null };
  }
  let keyCount = 0;
  let approxBytes = 0;
  let oldestDate: Date | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      keyCount += 1;
      const raw = window.localStorage.getItem(key) ?? '';
      // UTF-16 in-memory ≈ 2 bytes per char
      approxBytes += (key.length + raw.length) * 2;
    }
    const reportsRaw = window.localStorage.getItem(REPORTS_KEY);
    if (reportsRaw) {
      const match = reportsRaw.match(/"savedAt"\s*:\s*"([^"]+)"/);
      if (match) {
        const ts = Date.parse(match[1]);
        if (!Number.isNaN(ts)) oldestDate = new Date(ts);
      }
    }
  } catch {
    // localStorage unavailable
  }
  return { keyCount, approxBytes, oldestDate };
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

/** Removes every dc_* key from localStorage. Used by Profile › My data,
 *  and by the ErrorBoundary's repeat-crash recovery path so a poisoned
 *  persistence record can't permanently brick the app. */
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

/* ------------------------------------------------------------------ */
/* Catalog-version acknowledgement                                     */
/* ------------------------------------------------------------------ */

const CatalogAckSchema = z.number().int().nonnegative();

/** The highest CATALOG_VERSION the user has acknowledged. Returns 0
 *  for fresh installs (and on any validation failure — the read path
 *  already clears poisoned keys before falling back). Caller compares
 *  against the running app's CATALOG_VERSION to decide whether to show
 *  the migration notice. */
export function loadCatalogAck(): number {
  return readValidated<number>(CATALOG_ACK_KEY, CatalogAckSchema, 0);
}

/** Persist that the user has seen the migration notice for the
 *  current CATALOG_VERSION. The notice won't appear again until a
 *  future version bump. */
export function saveCatalogAck(version: number): void {
  writeJSON(CATALOG_ACK_KEY, version);
}

/* ------------------------------------------------------------------ */
/* UI language preference                                              */
/* ------------------------------------------------------------------ */

const LANG_KEY = `${KEY_PREFIX}lang`;
/** Keep in sync with LangCode in i18n/translations.ts. Listed inline so
 *  persistence doesn't pull the i18n module into every load path. */
const LangSchema = z.enum(['en', 'hi', 'ta', 'te', 'bn', 'mr']);
type Lang = z.infer<typeof LangSchema>;

/** Selected UI language. Defaults to English (and on any validation
 *  failure — the read path clears poisoned keys before falling back). */
export function loadLang(): Lang {
  return readValidated<Lang>(LANG_KEY, LangSchema, 'en');
}

export function saveLang(lang: Lang): void {
  writeJSON(LANG_KEY, lang);
}

/* ------------------------------------------------------------------ */
/* Re-test nudge dismissal                                             */
/* ------------------------------------------------------------------ */

const RetestAckSchema = z.string().min(1).max(80);

/** The report id the user last dismissed the re-test banner for, or
 *  null for fresh installs / never-dismissed (and on validation
 *  failure — the read path clears poisoned keys before falling back). */
export function loadRetestDismissedReportId(): string | null {
  return readValidated<string | null>(RETEST_ACK_KEY, RetestAckSchema, null);
}

/** Remember that the user dismissed the re-test banner for this report,
 *  so it doesn't re-appear until they upload a newer one. */
export function saveRetestDismissedReportId(reportId: string): void {
  writeJSON(RETEST_ACK_KEY, reportId);
}
