/**
 * Top-level provider that wires up the three focused contexts:
 *   - NavigationContext: page, history, navigate/back/replace
 *   - QuizContext: quiz answers + hasCompletedQuiz
 *   - ReportsContext: reports list + add/markReady
 *
 * Each consumer should import the hook for the slice it actually reads
 * (`useNavigation`, `useQuiz`, `useReports`) so a state change in one
 * slice doesn't re-render consumers of the other two.
 *
 * Types (`Page`, `QuizAnswers`) and the slice hooks are re-exported here
 * so the existing `from '../AppContext'` import paths keep working.
 */

import type { ReactNode } from 'react';
import { NavigationProvider } from './contexts/NavigationContext';
import { QuizProvider } from './contexts/QuizContext';
import { ReportsProvider } from './contexts/ReportsContext';
import { ThemeProvider } from './contexts/ThemeContext';

export type { Page, QuizAnswers } from './contexts/types';
export { useNavigation } from './contexts/NavigationContext';
export { useQuiz } from './contexts/QuizContext';
export { useReports } from './contexts/ReportsContext';
export { useTheme, type ThemeMode } from './contexts/ThemeContext';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NavigationProvider>
        <QuizProvider>
          <ReportsProvider>{children}</ReportsProvider>
        </QuizProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
}
