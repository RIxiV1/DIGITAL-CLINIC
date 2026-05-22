/**
 * Top-level provider that wires up the three focused contexts:
 *   - NavigationContext: page, history, navigate/back/replace
 *   - QuizContext: quiz answers + hasCompletedQuiz + risk assessment
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
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { NavigationProvider } from './contexts/NavigationContext';
import { QuizProvider } from './contexts/QuizContext';
import { ReportsProvider } from './contexts/ReportsContext';

export type { Page, QuizAnswers } from './contexts/types';
export { useNavigation } from './contexts/NavigationContext';
export { useQuiz } from './contexts/QuizContext';
export { useReports } from './contexts/ReportsContext';

/**
 * Root provider stack. The optional `router` prop swaps the router
 * implementation — production uses BrowserRouter (real URLs), tests
 * pass a MemoryRouter so they can mount pages without a window.history
 * sync. Without this seam, the smoke tests in pages.smoke.test.tsx
 * would fail to mount the NavigationProvider's useLocation/useNavigate
 * hooks.
 */
export function AppProvider({
  children,
  router = 'browser',
  initialEntries,
}: {
  children: ReactNode;
  router?: 'browser' | 'memory';
  /** Only used when router === 'memory'. */
  initialEntries?: string[];
}) {
  const Router = router === 'memory' ? MemoryRouter : BrowserRouter;
  const routerProps = router === 'memory' ? { initialEntries } : {};
  return (
    <Router {...routerProps}>
      <NavigationProvider>
        <QuizProvider>
          <ReportsProvider>{children}</ReportsProvider>
        </QuizProvider>
      </NavigationProvider>
    </Router>
  );
}
