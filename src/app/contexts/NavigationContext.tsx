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

  // Keep a ref to the current page so navigate() can read it without
  // capturing it as a dependency (which would re-create the callback on
  // every navigation). The ref is updated via the effect below — safe
  // under Strict Mode because writing to a ref is not a state update.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
