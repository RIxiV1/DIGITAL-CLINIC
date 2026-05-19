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
import { initialReports, type Report } from '../data/reports';
import {
  cleanupExpiredReports,
  loadReports,
  requestStoragePersistence,
  saveReports,
} from '../utils/persistence';

type ReportsValue = {
  reports: Report[];
  addReport: (report: Report) => void;
  markReportReady: (id: string) => void;
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

  const markReportReady = useCallback((id: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'ready', badge: 'analyzed' } : r,
      ),
    );
  }, []);

  const value = useMemo<ReportsValue>(
    () => ({ reports, addReport, markReportReady }),
    [reports, addReport, markReportReady],
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
