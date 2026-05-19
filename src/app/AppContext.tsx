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
import { initialReports, type Report } from './data/reports';

export type Page =
  | { type: 'landing' }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'home' }
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

  // Keep a ref to the current page so navigate() can read it without
  // capturing it as a dependency (and thus identity-flipping every change).
  // The ref is updated on every render via the effect below — Strict-Mode-safe
  // because writing to a ref is not a state update.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  /* Navigation — both state updaters are pure (no setState inside). */
  const navigate = useCallback((next: Page) => {
    setHistory((h) => [...h, pageRef.current]);
    setPage(next);
  }, []);

  const replace = useCallback((next: Page) => {
    setPage(next);
  }, []);

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setPage(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  /* Quiz — merge first, then derive hasCompletedQuiz off the next state
     via effect so we never set state inside another updater. */
  const setQuiz = useCallback((next: Partial<QuizAnswers>) => {
    setQuizState((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    if (quiz.age && quiz.activity && quiz.priorities.length > 0) {
      setHasCompletedQuiz(true);
    }
  }, [quiz.age, quiz.activity, quiz.priorities.length]);

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
