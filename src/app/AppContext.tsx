import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initialReports, type Report } from './data/reports';

export type Page =
  | { type: 'landing' }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'home' }
  | { type: 'locker' }
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'results'; reportId: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' };

export type QuizAnswers = {
  age?: string;
  activity?: string;
  priorities: string[];
  symptoms: string[];
};

type AppState = {
  page: Page;
  history: Page[];
  quiz: QuizAnswers;
  reports: Report[];
  hasCompletedQuiz: boolean;
};

type AppContextValue = AppState & {
  navigate: (page: Page) => void;
  replace: (page: Page) => void;
  back: () => void;
  setQuiz: (next: Partial<QuizAnswers>) => void;
  resetQuiz: () => void;
  addReport: (report: Report) => void;
  markReportReady: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const emptyQuiz: QuizAnswers = {
  priorities: [],
  symptoms: [],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>({ type: 'landing' });
  const [history, setHistory] = useState<Page[]>([]);
  const [quiz, setQuizState] = useState<QuizAnswers>(emptyQuiz);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);

  const navigate = useCallback((next: Page) => {
    setPage((prev) => {
      setHistory((h) => [...h, prev]);
      return next;
    });
  }, []);

  const replace = useCallback((next: Page) => {
    setPage(next);
  }, []);

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setPage(prev);
      return h.slice(0, -1);
    });
  }, []);

  const setQuiz = useCallback((next: Partial<QuizAnswers>) => {
    setQuizState((prev) => {
      const merged = { ...prev, ...next };
      if (
        merged.age &&
        merged.activity &&
        merged.priorities.length > 0
      ) {
        setHasCompletedQuiz(true);
      }
      return merged;
    });
  }, []);

  const resetQuiz = useCallback(() => {
    setQuizState(emptyQuiz);
    setHasCompletedQuiz(false);
  }, []);

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

  const value = useMemo<AppContextValue>(
    () => ({
      page,
      history,
      quiz,
      reports,
      hasCompletedQuiz,
      navigate,
      replace,
      back,
      setQuiz,
      resetQuiz,
      addReport,
      markReportReady,
    }),
    [
      page,
      history,
      quiz,
      reports,
      hasCompletedQuiz,
      navigate,
      replace,
      back,
      setQuiz,
      resetQuiz,
      addReport,
      markReportReady,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
