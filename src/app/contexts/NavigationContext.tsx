import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  useLocation,
  useNavigate as useRouterNavigate,
} from 'react-router-dom';
import type { Page } from './types';
import { assertNever } from '../utils/assertNever';

/* ================================================================== */
/* Public type + context                                                */
/*                                                                      */
/* Engine swap: this used to drive window.history directly via a hand-  */
/* rolled URL serializer + popstate handler. It's now backed by         */
/* react-router-dom (BrowserRouter lives in AppContext.tsx). The        */
/* external API — useNavigation().{page, navigate, replace, back} — is  */
/* deliberately unchanged so every consumer page keeps working without  */
/* edits. Page objects translate to clean paths (`/reports/abc`) instead*/
/* of the old `?page=results&id=abc` query format. No backwards-compat  */
/* shim because there are no production users with bookmarked URLs yet. */
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
/* Page <-> URL path mapping                                            */
/* ================================================================== */

/**
 * Encode a Page into a URL path. Landing collapses to '/' so the root
 * URL stays clean; everything else gets a named path.
 *
 * `assertNever` on the default branch is the type-system safety net:
 * adding a new Page variant without updating this switch becomes a
 * compile-time error rather than a silent fallthrough.
 */
export function pageToPath(page: Page): string {
  switch (page.type) {
    case 'landing':
      return '/';
    case 'quiz':
      return '/quiz';
    case 'recommendedTests':
      return '/tests';
    case 'home':
      return '/dashboard';
    case 'upload':
      return '/upload';
    case 'processing':
      return '/processing';
    case 'manualEntry':
      return '/manual-entry';
    case 'profile':
      return '/profile';
    case 'results':
      return `/reports/${encodeURIComponent(page.reportId)}`;
    case 'problem':
      return `/topics/${encodeURIComponent(page.problemId)}`;
    default:
      return assertNever(page);
  }
}

/**
 * Parse a URL path back into a Page. Returns landing for any unknown
 * path so refreshes on legacy / malformed URLs don't crash the app.
 *
 * The minimal LandingPage variant lives at `/minimal` but routes to the
 * same `landing` Page type — the variant is selected by reading
 * useLocation().pathname directly in LandingPage, not by branching the
 * Page union.
 */
export function pathToPage(pathname: string): Page {
  // Strip trailing slash and lowercase the leading segment for forgiving
  // matches like "/Quiz" or "/quiz/".
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';

  // Exact-match routes first.
  switch (path) {
    case '/':
    case '/minimal':
      return { type: 'landing' };
    case '/quiz':
      return { type: 'quiz' };
    case '/tests':
      return { type: 'recommendedTests' };
    case '/dashboard':
      return { type: 'home' };
    case '/upload':
      return { type: 'upload' };
    case '/processing':
      return { type: 'processing' };
    case '/manual-entry':
      return { type: 'manualEntry' };
    case '/profile':
      return { type: 'profile' };
  }

  // Parameterised routes.
  const reportMatch = path.match(/^\/reports\/([^/]+)$/);
  if (reportMatch) {
    return { type: 'results', reportId: decodeURIComponent(reportMatch[1]) };
  }
  const topicMatch = path.match(/^\/topics\/([^/]+)$/);
  if (topicMatch) {
    return { type: 'problem', problemId: decodeURIComponent(topicMatch[1]) };
  }

  // Anything else falls back to landing.
  return { type: 'landing' };
}

export function pageEquals(a: Page | null | undefined, b: Page): boolean {
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

/* ================================================================== */
/* Provider                                                             */
/* ================================================================== */

export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routerNavigate = useRouterNavigate();

  // `page` is derived from the URL — single source of truth. The
  // previous engine maintained `page` state separately and synced it
  // back to history; this version inverts that, so back/forward and
  // direct URL entry naturally produce the right page without any
  // popstate handling at all.
  const page = useMemo<Page>(() => pathToPage(location.pathname), [location.pathname]);

  // Session-start sentinel. react-router stamps every history entry
  // with a `location.key`; the very first one is "default". We capture
  // it on mount and compare against it in back() to decide whether
  // we're at the user's initial entry into the app (no history to go
  // back to → fall back to home) or somewhere deeper (let the browser
  // handle it).
  //
  // Was a historyRef stack that only pushed on our own navigate() —
  // any browser-driven back/forward desynced it from reality, so the
  // "fallback to home" branch fired prematurely after a few cycles of
  // browser navigation, teleporting users to the dashboard when they
  // expected to step back one page. The location.key approach uses
  // the browser's own bookkeeping as the source of truth and stays
  // in sync regardless of how navigation was triggered.
  const sessionStartKeyRef = useRef(location.key);
  // Mirror page changes so navigate()'s "did the page actually change"
  // check has a stable comparison source.
  const lastPageRef = useRef<Page>(page);

  /* Scroll-to-top on every page change. Without this, the browser
   * preserves the previous page's scroll position — so clicking
   * "Go to my dashboard" from the bottom of a long RecommendedTestsPage
   * dumps you at the bottom of the shorter HomePage, looking at blank
   * space below the content (which looks like a "white screen" bug). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [page]);

  useEffect(() => {
    lastPageRef.current = page;
  }, [page]);

  const navigate = useCallback(
    (next: Page) => {
      if (pageEquals(lastPageRef.current, next)) return;
      routerNavigate(pageToPath(next));
    },
    [routerNavigate],
  );

  const replace = useCallback(
    (next: Page) => {
      if (pageEquals(lastPageRef.current, next)) return;
      // replace() doesn't add a breadcrumb — it rewrites the current
      // entry, same as react-router's { replace: true } option.
      routerNavigate(pageToPath(next), { replace: true });
    },
    [routerNavigate],
  );

  /**
   * back() — defers to the browser unless we're sitting on the session-
   * start entry, in which case we fall back to home. The browser keeps
   * its own history bookkeeping (including any forward/back the user
   * did via the browser chrome), so this stays correct across cross-
   * tab restores, bfcache resumes, and arbitrary browser navigation.
   *
   * "Session start" = the location.key snapshotted at NavigationProvider
   * mount. If the user is still there, they have nowhere to step back
   * to inside the app — landing them on home is the universally-useful
   * destination. For a deep-link entry (/reports/abc), home is still
   * better than launching the user out of the SPA via window.history.
   */
  const back = useCallback(() => {
    if (location.key === sessionStartKeyRef.current) {
      routerNavigate(pageToPath({ type: 'home' }));
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, [location.key, routerNavigate]);

  const value = useMemo<NavigationValue>(
    // `history` exposed for any future callers that want to read the
    // depth — kept as an empty array now that the internal ref is
    // gone. Consumers don't appear to read it today; tracking it again
    // would mean re-introducing the desync the location.key fix just
    // eliminated.
    () => ({ page, history: [], navigate, replace, back }),
    [page, navigate, replace, back],
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
