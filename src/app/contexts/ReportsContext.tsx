import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  initialReports,
  mergeHistoryFromPriorReports,
  type Report,
} from '../data/reports';
import {
  REPORTS_KEY,
  cleanupExpiredReports,
  cleanupOrphanProcessing,
  loadReports,
  loadReportsMaybeEncrypted,
  reportsAreEncrypted,
  requestStoragePersistence,
  saveReportsMaybeEncrypted,
  wipeAllData,
} from '../utils/persistence';
import {
  clearLockMeta,
  enableLock as dataEnableLock,
  getSessionKey,
  isLockEnabled,
  isUnlocked,
  unlock as dataUnlock,
} from '../utils/dataLock';

type ReportsValue = {
  reports: Report[];
  addReport: (report: Report) => void;
  /** Mark a processing report as ready. The optional `patch` lets the
   *  parser swap in extracted biomarkers (and any other fields that
   *  weren't known when the placeholder report was created in
   *  UploadPage). status + badge are always set to ready/analyzed
   *  regardless of patch contents. */
  markReportReady: (id: string, patch?: Partial<Report>) => void;
  /** Delete a report by id. Used by ProcessingPage to roll back the
   *  placeholder report when extraction fails — without this, a failed
   *  upload would leave a forever-"processing" entry in the locker. */
  removeReport: (id: string) => void;
  /** Non-null when the last write to localStorage failed (quota
   *  exceeded, storage disabled, private mode). UI surfaces should
   *  show a persistent warning while set, because the user's reports
   *  only live in memory until this clears. */
  saveError: 'quota' | null;
  /** Manually dismisses the saveError banner. The user may want to
   *  acknowledge the warning without freeing space immediately. */
  dismissSaveError: () => void;

  /* ---- At-rest data lock (opt-in) ---- */
  /** True when a lock is set up but this session hasn't unlocked yet —
   *  the app shows the unlock gate instead of content while true. */
  locked: boolean;
  /** True when a PIN lock is configured at all (independent of whether
   *  this session has unlocked). Drives the Profile toggle state. */
  lockEnabled: boolean;
  /** Try to unlock with a PIN; on success decrypts + loads reports and
   *  clears `locked`. Returns false on wrong PIN (state untouched). */
  unlock: (pin: string) => Promise<boolean>;
  /** Turn the lock on: derive a key from the PIN and re-encrypt the
   *  current reports at rest. The session stays usable; the gate only
   *  appears on the next cold load. */
  enableLock: (pin: string) => Promise<void>;
  /** Turn the lock off: rewrite reports as plaintext and drop the lock. */
  disableLock: () => Promise<void>;
  /** Forgot-PIN escape hatch: wipe all local data + the lock, start fresh. */
  wipeAndReset: () => void;
};

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  // Initial state pulls from localStorage if anything is there; otherwise
  // falls back to initialReports (currently empty). Stale entries are
  // pruned first so a corrupted save doesn't haunt forever.
  //
  // Both cleanups return `{ pruned, quotaError }` — if either tried to
  // write but couldn't (quota exceeded), we promote that into the
  // saveError state immediately so the banner appears on first paint
  // rather than only after the user's next write. Previously the
  // cleanup writes failed silently and the saveError flag only set on
  // the NEXT save attempt, which could be hours later.
  // Is the data lock armed at boot? When it is, the reports on disk are
  // ENCRYPTED — we must NOT run the synchronous cleanups or loadReports
  // against them (readValidated would treat the ciphertext envelope as
  // corrupt and wipe it). Instead we start gated: reports stay empty and
  // `locked` is true until the user enters their PIN (see `unlock`).
  const lockedAtBoot = typeof window !== 'undefined' && isLockEnabled();
  const [{ reports: initialBootstrapReports, initialSaveError }] = useState(
    () => {
      if (typeof window === 'undefined' || lockedAtBoot) {
        return {
          reports: [] as Report[],
          initialSaveError: null as 'quota' | null,
        };
      }
      const ttlResult = cleanupExpiredReports();
      // Drop reports stuck in 'processing' from a previous tab — the File
      // handle behind them is gone, so they'd render as a "nothing to parse"
      // error on first visit. See cleanupOrphanProcessing for the full story.
      const orphanResult = cleanupOrphanProcessing();
      const persisted = loadReports<Report>();
      const quotaError =
        ttlResult.quotaError || orphanResult.quotaError ? 'quota' : null;
      return {
        reports: persisted.length > 0 ? persisted : initialReports,
        initialSaveError: quotaError as 'quota' | null,
      };
    },
  );
  const [reports, setReports] = useState<Report[]>(initialBootstrapReports);
  // Gated until unlock when a lock is armed. `lockEnabled` tracks whether
  // a lock exists at all (for the Profile toggle) and is kept in React
  // state so enable/disable re-render consumers.
  const [locked, setLocked] = useState<boolean>(lockedAtBoot);
  const [lockEnabled, setLockEnabled] = useState<boolean>(
    typeof window !== 'undefined' && isLockEnabled(),
  );
  // Always-current reports, so the lock actions can read the latest list
  // without being re-created on every change.
  const reportsRef = useRef(reports);
  reportsRef.current = reports;

  const [saveError, setSaveError] = useState<'quota' | null>(initialSaveError);
  const dismissSaveError = useCallback(() => setSaveError(null), []);

  // Skip persistence on the initial render (which would overwrite the
  // localStorage we just loaded). Save on every subsequent change.
  const isFirstRender = useRef(true);
  // Set true when we're applying a cross-tab update so the resulting
  // setReports doesn't re-trigger the writeback effect and clobber the
  // other tab's value. Without this guard, every storage event would
  // ping-pong between tabs forever.
  const skipNextPersistRef = useRef(false);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Best-effort ask for persistent storage on first mount so reports
      // don't get evicted by aggressive browsers (esp. iOS Safari).
      void requestStoragePersistence();
      return;
    }
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    // While gated (lock armed, not yet unlocked) reports[] is empty and
    // does NOT reflect the user's data — writing now would clobber the
    // ciphertext at rest with an empty set. Never persist until unlocked.
    if (locked) return;
    // Encrypt at rest when the lock is on (a session key is present);
    // otherwise write plaintext. Async, so the quota check runs in .then.
    const key = isLockEnabled() ? getSessionKey() : null;
    void saveReportsMaybeEncrypted(reports, key).then((ok) => {
      if (!ok) {
        // Quota exceeded / storage disabled / private mode. The reports
        // list is intact in memory, but the next tab close wipes it
        // unless the user frees space. Surface this via the saveError
        // flag — a banner in HomePage reads it and warns the user.
        setSaveError('quota');
      } else if (saveError) {
        // Storage came back (user deleted some old reports / closed
        // private mode). Clear the banner.
        setSaveError(null);
      }
    });
  }, [reports, saveError, locked]);

  /* Cross-tab sync.
   *
   * Without this, two open tabs each hold their own in-memory copy of
   * reports[] and the second-to-write wins — silently overwriting any
   * upload made in the other tab. Listen for `storage` events on
   * dc_reports (only fires from OTHER tabs in the same origin), reload
   * from localStorage, and update state.
   *
   * `skipNextPersistRef` prevents the resulting state update from
   * writing back and re-emitting the event in a loop. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== REPORTS_KEY) return;
      if (reportsAreEncrypted()) {
        // Encrypted blob changed in another tab. If this tab is gated,
        // ignore it (we're showing the unlock screen anyway). If unlocked,
        // decrypt with our session key. Never fall through to the
        // plaintext loader — it returns [] for ciphertext and would blank
        // our in-memory reports.
        if (!isUnlocked()) return;
        void loadReportsMaybeEncrypted<Report>(getSessionKey()).then(
          (fresh) => {
            skipNextPersistRef.current = true;
            setReports(fresh);
          },
        );
        return;
      }
      // newValue is null when the key was removed (e.g. wipeAllData
      // from another tab) — treat that as "load empty".
      const fresh = loadReports<Report>();
      skipNextPersistRef.current = true;
      setReports(fresh);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addReport = useCallback((report: Report) => {
    setReports((prev) => [report, ...prev]);
  }, []);

  const markReportReady = useCallback((id: string, patch?: Partial<Report>) => {
    setReports((prev) => {
      // Merge history from prior ready reports into the new
      // biomarkers, if we're committing new biomarkers. Without this,
      // trend/delta surfaces are dark for users with only their own
      // data — see mergeHistoryFromPriorReports.
      const otherReady = prev.filter(
        (r) => r.id !== id && r.status === 'ready',
      );
      const mergedBiomarkers = patch?.biomarkers
        ? mergeHistoryFromPriorReports(patch.biomarkers, otherReady)
        : undefined;
      const effectivePatch: Partial<Report> = mergedBiomarkers
        ? { ...patch, biomarkers: mergedBiomarkers }
        : (patch ?? {});
      return prev.map((r) =>
        r.id === id
          ? { ...r, ...effectivePatch, status: 'ready', badge: 'analyzed' }
          : r,
      );
    });
  }, []);

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /* ---- Lock actions ---- */

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const ok = await dataUnlock(pin);
    if (!ok) return false;
    const loaded = await loadReportsMaybeEncrypted<Report>(getSessionKey());
    // We just read these from disk — don't let the resulting setReports
    // bounce straight back into a re-save.
    skipNextPersistRef.current = true;
    setReports(loaded);
    setLocked(false);
    return true;
  }, []);

  const enableLock = useCallback(async (pin: string): Promise<void> => {
    const key = await dataEnableLock(pin);
    // Re-encrypt the current reports immediately with the new key so the
    // at-rest copy matches the lock. The session stays unlocked.
    await saveReportsMaybeEncrypted(reportsRef.current, key);
    setLockEnabled(true);
  }, []);

  const disableLock = useCallback(async (): Promise<void> => {
    // Rewrite reports as plaintext, THEN drop the lock metadata + key.
    await saveReportsMaybeEncrypted(reportsRef.current, null);
    clearLockMeta();
    setLockEnabled(false);
    setLocked(false);
  }, []);

  const wipeAndReset = useCallback((): void => {
    // Forgot-PIN escape hatch. Clear all local data + the lock and start
    // from a clean, unlocked slate. Data is local-only and re-uploadable,
    // so this is the honest alternative to a permanent lockout.
    wipeAllData();
    clearLockMeta();
    skipNextPersistRef.current = true;
    setReports([]);
    setLockEnabled(false);
    setLocked(false);
  }, []);

  const value = useMemo<ReportsValue>(
    () => ({
      reports,
      addReport,
      markReportReady,
      removeReport,
      saveError,
      dismissSaveError,
      locked,
      lockEnabled,
      unlock,
      enableLock,
      disableLock,
      wipeAndReset,
    }),
    [
      reports,
      addReport,
      markReportReady,
      removeReport,
      saveError,
      dismissSaveError,
      locked,
      lockEnabled,
      unlock,
      enableLock,
      disableLock,
      wipeAndReset,
    ],
  );

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export function useReports(): ReportsValue {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports must be used within ReportsProvider');
  return ctx;
}
