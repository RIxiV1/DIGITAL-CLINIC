import { useNavigation, useQuiz, useReports } from '../AppContext';
import TopNav from './landing/TopNav';
import Hero from './landing/Hero';
import ConnectionSection from './landing/Connection';
import HowItWorks from './landing/HowItWorks';
import WhatYoullGet from './landing/WhatYoullGet';
import Credibility from './landing/Credibility';
import FinalCta from './landing/FinalCta';
import Footer from './landing/Footer';

export default function LandingPage() {
  const { navigate } = useNavigation();
  const { quiz } = useQuiz();
  const { reports } = useReports();
  const startQuiz = () => navigate({ type: 'quiz' });
  const viewSample = () => navigate({ type: 'results', reportId: 'rep-001' });

  // Only returning users (anyone who's started the quiz or uploaded a
  // report) get the Dashboard shortcut. Brand-new visitors have nothing
  // in the dashboard yet, so the link would just land them on the
  // "Upload your first report" empty state.
  const hasUserData =
    quiz.symptoms.length > 0 ||
    quiz.priorities.length > 0 ||
    !!quiz.age ||
    !!quiz.activity ||
    reports.length > 0;
  const goDashboard = hasUserData
    ? () => navigate({ type: 'home' })
    : undefined;

  return (
    <div className="min-h-dvh bg-white text-ink overflow-x-hidden">
      <TopNav
        onStart={startQuiz}
        onSample={viewSample}
        onDashboard={goDashboard}
      />
      <Hero onStart={startQuiz} onSample={viewSample} />
      <ConnectionSection onStart={startQuiz} />
      <HowItWorks />
      <WhatYoullGet />
      <Credibility />
      <FinalCta onStart={startQuiz} />
      <Footer />
    </div>
  );
}
