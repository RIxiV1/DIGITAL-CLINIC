import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initialReports, type Report } from '../data/reports';

type ReportsValue = {
  reports: Report[];
  addReport: (report: Report) => void;
  markReportReady: (id: string) => void;
};

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>(initialReports);

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
