import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useNavigation, type Page } from './AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import { assertNever } from './utils/assertNever';

/* Lazy-loaded pages.
 *
 * LandingPage stays eager — it's the entry point for new visitors and
 * loading it from a chunk would add a visible flicker before the hero
 * paints. Everything else is route-split so first paint only ships the
 * landing surface + React + framer-motion. Each page becomes its own
 * Vite chunk fetched the first time a user navigates to it.
 *
 * The chunkNames are stable so Vite produces predictable filenames
 * (helps with CDN cache hits across deploys). */
const QuizPage = lazy(() =>
  import(/* webpackChunkName: "p-quiz" */ './pages/QuizPage'),
);
const RecommendedTestsPage = lazy(() =>
  import(/* webpackChunkName: "p-recommended" */ './pages/RecommendedTestsPage'),
);
const HomePage = lazy(() =>
  import(/* webpackChunkName: "p-home" */ './pages/HomePage'),
);
const UploadPage = lazy(() =>
  import(/* webpackChunkName: "p-upload" */ './pages/UploadPage'),
);
const ProcessingPage = lazy(() =>
  import(/* webpackChunkName: "p-processing" */ './pages/ProcessingPage'),
);
const ManualEntryPage = lazy(() =>
  import(/* webpackChunkName: "p-manual" */ './pages/ManualEntryPage'),
);
const ReportResultsPage = lazy(() =>
  import(/* webpackChunkName: "p-results" */ './pages/ReportResultsPage'),
);
const ProblemDetailPage = lazy(() =>
  import(/* webpackChunkName: "p-problem" */ './pages/ProblemDetailPage'),
);
const ProfilePage = lazy(() =>
  import(/* webpackChunkName: "p-profile" */ './pages/ProfilePage'),
);

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

/** Suspense fallback shown while a page chunk is being fetched. Matches
 *  the page background so there's no white flash; AnimatePresence's
 *  enter animation takes over the moment the chunk lands. Intentionally
 *  empty (no spinner) — the chunks are small enough that an indicator
 *  would render for ~30ms and just add visual noise. */
function PageFallback() {
  return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
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
      <AnimatePresence mode="popLayout">
        <motion.div
          key={pageKey(page)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-dvh w-full"
        >
          <Suspense fallback={<PageFallback />}>{node}</Suspense>
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
