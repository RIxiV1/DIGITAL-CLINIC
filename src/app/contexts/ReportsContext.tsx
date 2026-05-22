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
  requestStoragePersistence,
  saveReports,
} from '../utils/persistence';

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
};

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  // Initial state pulls from localStorage if anything is there; otherwise
  // falls back to initialReports (currently empty). Stale entries are
  // pruned first so a corrupted save doesn't haunt forever.
  const [reports, setReports] = useState<Report[]>(() => {
    if (typeof window === 'undefined') return initialReports;
    cleanupExpiredReports();
    // Drop reports stuck in 'processing' from a previous tab — the File
    // handle behind them is gone, so they'd render as a "nothing to parse"
    // error on first visit. See cleanupOrphanProcessing for the full story.
    cleanupOrphanProcessing();
    const persisted = loadReports<Report>();
    if (persisted.length > 0) return persisted;
    return initialReports;
  });

  const [saveError, setSaveError] = useState<'quota' | null>(null);
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
    const ok = saveReports(reports);
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
  }, [reports, saveError]);

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

  const markReportReady = useCallback(
    (id: string, patch?: Partial<Report>) => {
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
    },
    [],
  );

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo<ReportsValue>(
    () => ({
      reports,
      addReport,
      markReportReady,
      removeReport,
      saveError,
      dismissSaveError,
    }),
    [reports, addReport, markReportReady, removeReport, saveError, dismissSaveError],
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
