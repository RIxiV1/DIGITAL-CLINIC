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
import type { QuizAnswers } from './types';
import {
  loadQuiz,
  loadQuizComplete,
  saveQuiz,
  saveQuizComplete,
} from '../utils/persistence';

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
  // Hydrate from localStorage on first mount so a returning user sees
  // their quiz answers preserved across sessions.
  const [quiz, setQuizState] = useState<QuizAnswers>(() => {
    const persisted = loadQuiz<QuizAnswers>();
    if (persisted && typeof persisted === 'object') {
      // Defensive merge — persisted state might be from an older schema
      // missing the arrays we now require.
      return {
        ...emptyQuiz,
        ...persisted,
        priorities: Array.isArray(persisted.priorities)
          ? persisted.priorities
          : [],
        symptoms: Array.isArray(persisted.symptoms) ? persisted.symptoms : [],
      };
    }
    return emptyQuiz;
  });
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean>(
    () => loadQuizComplete(),
  );

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

  // Persist on every change (skipping the first render so we don't
  // overwrite the freshly-hydrated localStorage).
  const firstQuiz = useRef(true);
  useEffect(() => {
    if (firstQuiz.current) {
      firstQuiz.current = false;
      return;
    }
    saveQuiz(quiz);
  }, [quiz]);

  const firstComplete = useRef(true);
  useEffect(() => {
    if (firstComplete.current) {
      firstComplete.current = false;
      return;
    }
    saveQuizComplete(hasCompletedQuiz);
  }, [hasCompletedQuiz]);

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
