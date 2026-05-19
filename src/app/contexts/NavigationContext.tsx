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
import type { Page } from './types';

type NavigationValue = {
  page: Page;
  history: Page[];
  navigate: (page: Page) => void;
  replace: (page: Page) => void;
  back: () => void;
};

const NavigationContext = createContext<NavigationValue | null>(null);

/** Type guard for a Page object pulled out of history.state. */
function isPage(value: unknown): value is Page {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>({ type: 'landing' });
  const [history, setHistory] = useState<Page[]>([]);

  // Refs let navigate()/back() read the current page+history without
  // capturing them as callback dependencies (which would invalidate the
  // callback on every change). Updating a ref is not a state update, so
  // this is Strict-Mode-safe — unlike calling setState inside another
  // setState updater, which Strict Mode invokes twice in dev.
  const pageRef = useRef(page);
  const historyRef = useRef(history);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  /**
   * Browser-history integration so the back button doesn't exit the SPA.
   *
   * - On every navigate(), push the new page to window.history via
   *   pushState so the browser knows a back step exists.
   * - On every replace(), use replaceState — no new entry.
   * - On popstate (back/forward), read the page off e.state and
   *   sync our internal state with the browser.
   *
   * We anchor the initial state with a replaceState once on mount so
   * the very first back press has a real entry to land on.
   */
  useEffect(() => {
    // Anchor — only if the current history entry has no page state.
    if (
      typeof window !== 'undefined' &&
      (window.history.state == null ||
        !isPage((window.history.state as { page?: unknown } | null)?.page))
    ) {
      window.history.replaceState({ page: pageRef.current }, '');
    }

    const onPopState = (e: PopStateEvent) => {
      const candidate = (e.state as { page?: unknown } | null)?.page;
      if (isPage(candidate)) {
        // Sync our internal state to whatever entry the browser navigated
        // to. Pop one from our internal history stack so back() and the
        // browser back behave consistently.
        setPage(candidate);
        setHistory((h) => (h.length > 0 ? h.slice(0, -1) : h));
      } else {
        // Browser walked past our app's earliest entry — surface the
        // landing page rather than letting the user fall out.
        setPage({ type: 'landing' });
        setHistory([]);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Page) => {
    setHistory((h) => [...h, pageRef.current]);
    setPage(next);
    if (typeof window !== 'undefined') {
      window.history.pushState({ page: next }, '');
    }
  }, []);

  const replace = useCallback((next: Page) => {
    setPage(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState({ page: next }, '');
    }
  }, []);

  /**
   * back() defers to the browser. window.history.back() fires popstate,
   * which our handler above translates into state updates. This keeps
   * the internal history and the browser history strictly in sync — vs
   * the previous implementation which only mutated our internal stack
   * and left the browser stack alone (which is why hitting the browser
   * back button exited the app instead of stepping back inside it).
   */
  const back = useCallback(() => {
    if (historyRef.current.length === 0) return;
    if (typeof window !== 'undefined') window.history.back();
  }, []);

  const value = useMemo<NavigationValue>(
    () => ({ page, history, navigate, replace, back }),
    [page, history, navigate, replace, back],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
