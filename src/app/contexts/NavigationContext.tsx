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
import { assertNever } from '../utils/assertNever';

/* ================================================================== */
/* Public type + context                                                */
/* ================================================================== */

type NavigationValue = {
  page: Page;
  history: Page[];
  navigate: (page: Page) => void;
  replace: (page: Page) => void;
  back: () => void;
};

const NavigationContext = createContext<NavigationValue | null>(null);

/* ================================================================== */
/* Pure helpers — Page <-> URL serialization                            */
/* ================================================================== */

/** Type guard for a Page object pulled out of history.state. */
function isPage(value: unknown): value is Page {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

/**
 * Deep equality for Page discriminated-union values. Used by the
 * pushState dedup guard so a rapid double-navigate-to-the-same-page
 * doesn't pollute browser history with duplicate entries.
 *
 * Covers the two shapes that carry an id: `results` and `problem`. The
 * other variants are atomic — same type = same page.
 */
function pageEquals(a: Page | null | undefined, b: Page): boolean {
  if (!a) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'results' && b.type === 'results') {
    return a.reportId === b.reportId;
  }
  if (a.type === 'problem' && b.type === 'problem') {
    return a.problemId === b.problemId;
  }
  return true;
}

/**
 * Encode a Page into a URL search string for deep linking.
 *   { type: 'home' }                        -> '?page=home'
 *   { type: 'results', reportId: 'r1' }     -> '?page=results&id=r1'
 *   { type: 'problem', problemId: 'low-t' } -> '?page=problem&id=low-t'
 *   { type: 'landing' }                     -> '' (clean root URL)
 *
 * `assertNever` on the default branch is the type-system safety net:
 * adding a new Page variant without updating this switch becomes a
 * compile-time error rather than a silent fallthrough.
 */
function pageToSearch(page: Page): string {
  switch (page.type) {
    case 'landing':
      return '';
    case 'results':
      return `?page=results&id=${encodeURIComponent(page.reportId)}`;
    case 'problem':
      return `?page=problem&id=${encodeURIComponent(page.problemId)}`;
    case 'quiz':
    case 'recommendedTests':
    case 'home':
    case 'upload':
    case 'processing':
    case 'manualEntry':
    case 'profile':
      return `?page=${page.type}`;
    default:
      return assertNever(page);
  }
}

/**
 * Parse a URL search string into a Page. Returns null if the URL
 * doesn't describe a known page (callers should fall back to landing).
 */
function searchToPage(search: string): Page | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const type = params.get('page');
  const id = params.get('id') ?? '';
  switch (type) {
    case 'landing':
      return { type: 'landing' };
    case 'quiz':
      return { type: 'quiz' };
    case 'recommendedTests':
      return { type: 'recommendedTests' };
    case 'home':
      return { type: 'home' };
    case 'upload':
      return { type: 'upload' };
    case 'processing':
      return { type: 'processing' };
    case 'manualEntry':
      return { type: 'manualEntry' };
    case 'profile':
      return { type: 'profile' };
    case 'results':
      return id ? { type: 'results', reportId: id } : null;
    case 'problem':
      return id ? { type: 'problem', problemId: id } : null;
    default:
      return null;
  }
}

/** Pathname + new search string, preserving any base path the app is
 *  mounted under (e.g. `/clinic/`). */
function pageUrl(page: Page): string {
  if (typeof window === 'undefined') return pageToSearch(page) || '/';
  return `${window.location.pathname}${pageToSearch(page)}`;
}

/** Read the current page out of `window.history.state` if it has one. */
function readCurrentHistoryPage(): Page | null {
  if (typeof window === 'undefined') return null;
  const stateRaw = window.history.state as { page?: unknown } | null;
  const candidate = stateRaw?.page;
  return isPage(candidate) ? candidate : null;
}

/* ================================================================== */
/* Provider                                                             */
/* ================================================================== */

export function NavigationProvider({ children }: { children: ReactNode }) {
  /* Bootstrap from the URL so a deep link like /?page=home lands on
   * home, refresh-safe. SSR-safe via the typeof-window guard. */
  const [page, setPage] = useState<Page>(() => {
    if (typeof window === 'undefined') return { type: 'landing' };
    return searchToPage(window.location.search) ?? { type: 'landing' };
  });
  const [history, setHistory] = useState<Page[]>([]);

  /* ---- Refs for closure-free reads ---------------------------------
   * navigate()/back() need the CURRENT page+history without listing
   * them as useCallback deps (which would invalidate the callback
   * every render). Mirroring state into refs lets the callbacks read
   * fresh values without re-creating themselves.
   *
   * Updating a ref is not a state update, so this is Strict-Mode-safe
   * — unlike calling setState inside another setState updater, which
   * Strict Mode invokes twice in dev. */
  const pageRef = useRef(page);
  const historyRef = useRef(history);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  /* ---- Popstate-reentry guard --------------------------------------
   * VULN 2 (popstate→pushState loop): the loop the brief describes
   * can't happen with this code shape — popstate just calls setPage,
   * not pushState. But this ref is a belt-and-braces guard against
   * any future regression where someone adds a reactive effect that
   * pushes history on state change: that effect can opt out by
   * checking this ref. The ref is set BEFORE we touch state inside
   * the popstate handler and cleared after the microtask drains. */
  const isHandlingPopstateRef = useRef(false);

  /**
   * Scroll-to-top on every page change. Without this, the browser
   * preserves the previous page's scroll position — so clicking
   * "Go to my dashboard" from the bottom of a long RecommendedTestsPage
   * dumps you at the bottom of the shorter HomePage, looking at blank
   * space below the content (which looks like a "white screen" bug).
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [page]);

  /**
   * Browser-history integration so back/forward AND refresh both work.
   *
   * - navigate() (below) pushes a new entry with the page encoded in
   *   BOTH history.state (fast re-hydration) AND the URL search params
   *   (deep linking + shareable URLs + refresh-safe).
   * - replace() (below) rewrites the current entry without adding a step.
   * - popstate (handler here) rehydrates from history.state if present,
   *   otherwise re-parses the URL search params (covers cases where
   *   state was serialized/lost — e.g., session restore).
   *
   * Anchor on mount: replace the current entry so the very first back
   * press has a real state object to read from, and normalize the URL
   * to match whatever page we booted into.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initial = pageRef.current;
    window.history.replaceState({ page: initial }, '', pageUrl(initial));

    const onPopState = (e: PopStateEvent) => {
      // Guard window — the imperative navigate()/replace() below check
      // this so they don't write to history while a popstate is being
      // processed.
      isHandlingPopstateRef.current = true;
      try {
        const fromState = (e.state as { page?: unknown } | null)?.page;
        const candidate: Page | null = isPage(fromState)
          ? fromState
          : searchToPage(window.location.search);
        if (candidate) {
          /* Sync our internal state to the entry the browser navigated
           * to. Pop one from our internal history stack so back() and
           * the browser back behave consistently. */
          setPage(candidate);
          setHistory((h) => (h.length > 0 ? h.slice(0, -1) : h));
        } else {
          /* Browser walked past our app's earliest entry — surface
           * landing rather than letting the user fall out of the SPA. */
          setPage({ type: 'landing' });
          setHistory([]);
        }
      } finally {
        // Drain through one microtask so any synchronous downstream
        // effects (e.g. memoized consumers) finish reading the guard
        // before we lower it.
        queueMicrotask(() => {
          isHandlingPopstateRef.current = false;
        });
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /**
   * Push a new entry into browser history — but only if it's NOT a
   * duplicate of what's already there. Dedup prevents rapid
   * double-navigate (e.g. nervous-tap mobile UX) from polluting the
   * back-button stack with identical entries, and prevents any future
   * reactive effect from accidentally double-pushing.
   *
   * VULN 2 hardening: verifies window.history.state before writing.
   */
  const pushHistoryEntry = useCallback((next: Page) => {
    if (typeof window === 'undefined') return;
    if (isHandlingPopstateRef.current) return; // don't fight the browser
    const current = readCurrentHistoryPage();
    if (pageEquals(current, next)) return; // already there
    window.history.pushState({ page: next }, '', pageUrl(next));
  }, []);

  /** Same idempotency check for replaceState. */
  const replaceHistoryEntry = useCallback((next: Page) => {
    if (typeof window === 'undefined') return;
    if (isHandlingPopstateRef.current) return;
    const current = readCurrentHistoryPage();
    if (pageEquals(current, next)) return;
    window.history.replaceState({ page: next }, '', pageUrl(next));
  }, []);

  /* ================================================================ */
  /* Public callbacks — all stable across renders via useCallback      */
  /* (VULN 1 hardening: consumers reading these via useNavigate()      */
  /* don't re-render when callbacks would otherwise be reference-      */
  /* different each cycle).                                            */
  /* ================================================================ */

  const navigate = useCallback(
    (next: Page) => {
      // Dedup at the state layer too — pushing the same page onto
      // history while we're already on it would re-render every
      // consumer for no reason.
      if (pageEquals(pageRef.current, next)) {
        pushHistoryEntry(next); // still no-op via dedup, but safe
        return;
      }
      setHistory((h) => [...h, pageRef.current]);
      setPage(next);
      pushHistoryEntry(next);
    },
    [pushHistoryEntry],
  );

  const replace = useCallback(
    (next: Page) => {
      if (!pageEquals(pageRef.current, next)) {
        setPage(next);
      }
      replaceHistoryEntry(next);
    },
    [replaceHistoryEntry],
  );

  /**
   * back() defers to the browser. window.history.back() fires popstate,
   * which our handler above translates into state updates. This keeps
   * the internal history and the browser history strictly in sync — vs
   * the previous implementation which only mutated our internal stack
   * and left the browser stack alone (which is why hitting the browser
   * back button exited the app instead of stepping back inside it).
   *
   * No-history fallback: when the user deep-linked into a "page"-variant
   * route (e.g. /?page=results&id=…) the internal history is empty.
   * The previous implementation was silent — clicking the back arrow
   * did nothing, which felt like a broken UI. Now we navigate(home) as
   * a sensible safety net so the Back arrow always has SOMEWHERE to go.
   */
  const back = useCallback(() => {
    if (historyRef.current.length === 0) {
      // No internal history — fall through to home.
      const home: Page = { type: 'home' };
      setPage(home);
      pushHistoryEntry(home);
      return;
    }
    if (typeof window !== 'undefined') window.history.back();
  }, [pushHistoryEntry]);

  /* VULN 1 fix (memoized provider value) — without this, every render
   * creates a new object identity for `value`, which would force every
   * useNavigation() consumer to re-render even when nothing they care
   * about changed. */
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
