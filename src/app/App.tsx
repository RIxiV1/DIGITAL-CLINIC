import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp, type Page } from './AppContext';
import LandingPage from './pages/LandingPage';
import QuizPage from './pages/QuizPage';
import RecommendedTestsPage from './pages/RecommendedTestsPage';
import HomePage from './pages/HomePage';
import ReportLockerPage from './pages/ReportLockerPage';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import ReportResultsPage from './pages/ReportResultsPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import ClinicPage from './pages/ClinicPage';
import ProfilePage from './pages/ProfilePage';

function pageKey(p: Page) {
  switch (p.type) {
    case 'results':
      return `results:${p.reportId}`;
    case 'problem':
      return `problem:${p.problemId}`;
    default:
      return p.type;
  }
}

function PageHost() {
  const { page } = useApp();

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
    case 'locker':
      node = <ReportLockerPage />;
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
    case 'clinic':
      node = <ClinicPage />;
      break;
    case 'profile':
      node = <ProfilePage />;
      break;
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pageKey(page)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen"
        >
          {node}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <PageHost />
    </AppProvider>
  );
}
