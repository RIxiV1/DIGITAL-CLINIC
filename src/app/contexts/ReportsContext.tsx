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
  cleanupExpiredReports,
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
};

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  // Initial state pulls from localStorage if anything is there; otherwise
  // falls back to initialReports (currently empty). Stale entries are
  // pruned first so a corrupted save doesn't haunt forever.
  const [reports, setReports] = useState<Report[]>(() => {
    if (typeof window === 'undefined') return initialReports;
    cleanupExpiredReports();
    const persisted = loadReports<Report>();
    if (persisted.length > 0) return persisted;
    return initialReports;
  });

  // Skip persistence on the initial render (which would overwrite the
  // localStorage we just loaded). Save on every subsequent change.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Best-effort ask for persistent storage on first mount so reports
      // don't get evicted by aggressive browsers (esp. iOS Safari).
      void requestStoragePersistence();
      return;
    }
    saveReports(reports);
  }, [reports]);

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
    () => ({ reports, addReport, markReportReady, removeReport }),
    [reports, addReport, markReportReady, removeReport],
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
