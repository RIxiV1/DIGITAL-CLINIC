import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useNavigation, type Page } from './AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';
import LandingPage from './pages/LandingPage';
import { assertNever } from './utils/assertNever';
import { lazyWithReload } from './utils/lazyWithReload';

/* Lazy-loaded pages.
 *
 * LandingPage stays eager — it's the entry point for new visitors and
 * loading it from a chunk would add a visible flicker before the hero
 * paints. Everything else is route-split so first paint only ships the
 * landing surface + React + framer-motion. Each page becomes its own
 * Vite chunk fetched the first time a user navigates to it.
 *
 * lazyWithReload wraps React.lazy so a "stale-deploy" chunk fetch
 * failure (user had the app open when we shipped; old chunk URLs are
 * gone) triggers a hard reload instead of dumping the user on the
 * ErrorBoundary. See utils/lazyWithReload.ts for the guard logic. */
const QuizPage = lazyWithReload(() => import('./pages/QuizPage'));
const RecommendedTestsPage = lazyWithReload(
  () => import('./pages/RecommendedTestsPage'),
);
const HomePage = lazyWithReload(() => import('./pages/HomePage'));
const UploadPage = lazyWithReload(() => import('./pages/UploadPage'));
const ProcessingPage = lazyWithReload(() => import('./pages/ProcessingPage'));
const ManualEntryPage = lazyWithReload(() => import('./pages/ManualEntryPage'));
const ReportResultsPage = lazyWithReload(
  () => import('./pages/ReportResultsPage'),
);
const ProblemDetailPage = lazyWithReload(
  () => import('./pages/ProblemDetailPage'),
);
const ProfilePage = lazyWithReload(() => import('./pages/ProfilePage'));

function pageKey(p: Page): string {
  switch (p.type) {
    case 'results':
      return `results:${p.reportId}`;
    case 'problem':
      return `problem:${p.problemId}`;
    case 'landing':
    case 'quiz':
    case 'recommendedTests':
    case 'home':
    case 'upload':
    case 'processing':
    case 'manualEntry':
    case 'profile':
      return p.type;
    default:
      return assertNever(p);
  }
}

/** Pick the right skeleton variant for the page being loaded. Each
 *  variant approximates the destination's layout so users see "loading
 *  the dashboard" / "loading the results" instead of a generic gray
 *  block. Chunks are 5-25 KB, fallback typically shows for 30-150ms on
 *  a real connection. */
function fallbackForPage(p: Page) {
  switch (p.type) {
    case 'home':
      return <PageSkeleton variant="dashboard" />;
    case 'results':
      return <PageSkeleton variant="results" />;
    default:
      return <PageSkeleton />;
  }
}

function PageHost() {
  const { page } = useNavigation();

  let node: React.ReactNode = null;
  switch (page.type) {
    case 'landing':
      node = <LandingPage />;
      break;
    case 'quiz':
      node = <QuizPage />;
      break;
    case 'recommendedTests':
      node = <RecommendedTestsPage />;
      break;
    case 'home':
      node = <HomePage />;
      break;
    case 'upload':
      node = <UploadPage />;
      break;
    case 'processing':
      node = <ProcessingPage />;
      break;
    case 'manualEntry':
      node = <ManualEntryPage />;
      break;
    case 'results':
      node = <ReportResultsPage reportId={page.reportId} />;
      break;
    case 'problem':
      node = <ProblemDetailPage problemId={page.problemId} />;
      break;
    case 'profile':
      node = <ProfilePage />;
      break;
    default:
      assertNever(page);
  }

  return (
    <div className="min-h-dvh bg-canvas relative overflow-x-hidden">
      {/* Skip link — hidden until keyboard-focused, then slides into
          view so keyboard users can jump past the header / nav and
          land directly on page content. Without this every page tab
          starts at the logo and walks through the entire header before
          reaching anything actionable. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:px-4 focus-visible:h-11 focus-visible:inline-flex focus-visible:items-center focus-visible:rounded-full focus-visible:bg-blue-600 focus-visible:text-white focus-visible:text-[13px] focus-visible:font-semibold focus-visible:shadow-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
      >
        Skip to main content
      </a>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={pageKey(page)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-dvh w-full"
        >
          <Suspense fallback={fallbackForPage(page)}>
            <main id="main-content" tabIndex={-1} className="outline-none">
              {node}
            </main>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <PageHost />
      </AppProvider>
    </ErrorBoundary>
  );
}
