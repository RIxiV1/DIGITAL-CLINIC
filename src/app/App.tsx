import { Suspense } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { AppProvider, useNavigation, useReports, type Page } from './AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import PrivacyScreen from './components/PrivacyScreen';
import UnlockGate from './components/UnlockGate';
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
const HealthMapPage = lazyWithReload(() => import('./pages/HealthMapPage'));
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
    case 'healthMap':
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
    case 'healthMap':
      node = <HealthMapPage />;
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
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:px-4 focus-visible:h-11 focus-visible:inline-flex focus-visible:items-center focus-visible:rounded-full focus-visible:bg-blue-600 focus-visible:text-on-primary focus-visible:text-caption focus-visible:font-semibold focus-visible:shadow-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
      >
        Skip to main content
      </a>
      {/* Page transition: enter-only animation, no AnimatePresence.

          Why not AnimatePresence: this app's pages never reliably fired
          framer-motion's exit-complete callback, so the exiting page was
          never unmounted. Under mode="popLayout" that left a "ghost" of
          the previous page (a data-motion-pop-id node) absolutely
          positioned ON TOP of the live page — it intercepted pointer
          events (taps hit a dead overlay) and broke scrolling, most
          visibly after an in-app nav like Sign out where the tall exited
          page sat over the landing and made it feel like an unresponsive
          "infinite scroll". Under mode="wait" it was worse: the next page
          never mounted at all (URL changed, content stayed on the old
          page). Both failure modes traced to the same missing exit-
          complete.

          Keying the motion.div on the page identity makes React unmount
          the old page and mount the new one synchronously on every
          navigation — no ghost, content always swaps — while the keyed
          remount still replays the initial→animate enter fade. We drop
          the exit animation (the thing that never completed); the small
          y/opacity enter is enough to avoid a hard cut.

          Covered by a navigation DOM-leak test (mains/nav/node counts
          must stay flat across repeated in-app navigations).

          - min-h-dvh keeps the wrapper at viewport height so it doesn't
            visually collapse during the enter.
          - bg-canvas makes the wrapper opaque so the body never peeks
            through during the y-shift. */}
      <motion.div
        key={pageKey(page)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-dvh w-full bg-canvas"
      >
        <Suspense fallback={fallbackForPage(page)}>
          <main id="main-content" tabIndex={-1} className="outline-none">
            {node}
          </main>
        </Suspense>
      </motion.div>
    </div>
  );
}

/** Boot gate for the opt-in data lock. When a lock is armed and this
 *  session hasn't unlocked, show the PIN screen instead of the app — the
 *  reports stay encrypted and unread until the PIN is entered. */
function LockGate({ children }: { children: React.ReactNode }) {
  const { locked } = useReports();
  if (locked) return <UnlockGate />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* MotionConfig with reducedMotion="user" cascades the OS-level
       *  prefers-reduced-motion preference into every framer-motion
       *  child. With this, the page-level entry choreography (the
       *  PageHost page-enter motion.div + the dozen custom cubic-bezier
       *  transitions sprinkled across charts, sparklines, and the
       *  health ring) stops fighting users who explicitly asked for
       *  less motion. Animations don't disappear — duration collapses
       *  to 0 — so state transitions still fire, they just don't
       *  visibly choreograph.
       *
       *  Doing this at the root means every motion descendant inherits
       *  the behaviour without needing per-component useReducedMotion
       *  checks. Hero's mouse-spotlight already guards itself
       *  explicitly (event listener is the bigger cost there). */}
      <MotionConfig reducedMotion="user">
        <AppProvider>
          <LockGate>
            <PageHost />
            <PrivacyScreen />
          </LockGate>
        </AppProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
