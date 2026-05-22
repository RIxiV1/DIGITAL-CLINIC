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
function pageToPath(page: Page): string {
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
function pathToPage(pathname: string): Page {
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

  // Internal history tracking — react-router doesn't expose history
  // length, but we need it for back()'s no-history fallback (deep-link
  // entry → "back" should still go somewhere sensible). We push onto
  // this stack on navigate() and pop on back(); replace() doesn't
  // affect it. This isn't 100% in sync with the browser stack (e.g.
  // we don't see forward navigations), but it's a safety net, not a
  // primary data structure.
  const historyRef = useRef<Page[]>([]);
  // Mirror page changes so popstate-driven navigation doesn't lose
  // the previous page when we later call back().
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

  // Track the previous-page→current-page transitions to keep our
  // internal stack in rough sync with the browser. Only push onto the
  // stack when the URL change wasn't initiated by our own navigate()
  // (which already pushed), and only when the page actually changed.
  // For now we rely on navigate() to maintain the stack explicitly and
  // skip the implicit-push path — simpler and correct for the back()
  // use case which only needs "do we have any breadcrumbs at all."
  useEffect(() => {
    lastPageRef.current = page;
  }, [page]);

  const navigate = useCallback(
    (next: Page) => {
      if (pageEquals(lastPageRef.current, next)) return;
      // Push current page onto our internal breadcrumb stack BEFORE the
      // URL change. back() consults this stack for its no-history-fall-
      // back-to-home decision.
      historyRef.current = [...historyRef.current, lastPageRef.current];
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
   * back() — defers to the browser when we have any history at all,
   * otherwise falls back to home. The browser knows about navigations
   * we caused AND any forward/back the user did, so this stays correct
   * across cross-tab restores and bfcache resumes.
   *
   * Deep-link no-history fallback: when a user lands on /reports/abc
   * via a shared link, the back arrow has nowhere to go — sending them
   * to landing would feel like ejecting them from the product. home is
   * the universally-useful destination.
   */
  const back = useCallback(() => {
    if (historyRef.current.length === 0) {
      routerNavigate(pageToPath({ type: 'home' }));
      return;
    }
    historyRef.current = historyRef.current.slice(0, -1);
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, [routerNavigate]);

  const value = useMemo<NavigationValue>(
    () => ({ page, history: historyRef.current, navigate, replace, back }),
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
