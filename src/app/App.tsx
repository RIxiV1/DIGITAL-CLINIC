import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useNavigation, type Page } from './AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import QuizPage from './pages/QuizPage';
import RecommendedTestsPage from './pages/RecommendedTestsPage';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import ReportResultsPage from './pages/ReportResultsPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import ProfilePage from './pages/ProfilePage';
import { assertNever } from './utils/assertNever';

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
    case 'profile':
      return p.type;
    default:
      return assertNever(p);
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
    <div className="min-h-screen bg-canvas relative overflow-x-hidden">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={pageKey(page)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen w-full"
        >
          {node}
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
