import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { QuizAnswers } from './types';

type QuizValue = {
  quiz: QuizAnswers;
  hasCompletedQuiz: boolean;
  setQuiz: (next: Partial<QuizAnswers>) => void;
  resetQuiz: () => void;
};

const QuizContext = createContext<QuizValue | null>(null);

const emptyQuiz: QuizAnswers = {
  priorities: [],
  symptoms: [],
};

export function QuizProvider({ children }: { children: ReactNode }) {
  const [quiz, setQuizState] = useState<QuizAnswers>(emptyQuiz);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);

  const setQuiz = useCallback((next: Partial<QuizAnswers>) => {
    setQuizState((prev) => ({ ...prev, ...next }));
  }, []);

  // Derive completion off the next quiz state via effect so we never set
  // state inside another updater (Strict-Mode-safe).
  useEffect(() => {
    if (quiz.age && quiz.activity && quiz.priorities.length > 0) {
      setHasCompletedQuiz(true);
    }
  }, [quiz.age, quiz.activity, quiz.priorities.length]);

  const resetQuiz = useCallback(() => {
    setQuizState(emptyQuiz);
    setHasCompletedQuiz(false);
  }, []);

  const value = useMemo<QuizValue>(
    () => ({ quiz, hasCompletedQuiz, setQuiz, resetQuiz }),
    [quiz, hasCompletedQuiz, setQuiz, resetQuiz],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz(): QuizValue {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
}
