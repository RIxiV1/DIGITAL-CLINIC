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

  const navigate = useCallback((next: Page) => {
    setHistory((h) => [...h, pageRef.current]);
    setPage(next);
  }, []);

  const replace = useCallback((next: Page) => {
    setPage(next);
  }, []);

  const back = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    // Both setters get called independently, each with a precomputed
    // value — neither is nested inside the other's updater.
    setPage(h[h.length - 1]);
    setHistory(h.slice(0, -1));
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
