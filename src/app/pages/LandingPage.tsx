import { useLocation } from 'react-router-dom';
import { useNavigation, useQuiz, useReports } from '../AppContext';
import TopNav from './landing/TopNav';
import Hero from './landing/Hero';
import ConnectionSection from './landing/Connection';
import HowItWorks from './landing/HowItWorks';
import WhatYoullGet from './landing/WhatYoullGet';
import Credibility from './landing/Credibility';
import HowWeAnalyze from './landing/HowWeAnalyze';
import Privacy from './landing/Privacy';
import FinalCta from './landing/FinalCta';
import Footer from './landing/Footer';
import MinimalWhy from './landing/MinimalWhy';

/**
 * Two variants, same Page type:
 *   - "/"         → full landing (8 sections, marketing surface)
 *   - "/minimal"  → trim landing (4 sections, conversion-focused)
 *
 * Why path-based rather than a URL param: it makes the variant
 * shareable (`/minimal` works in social previews), gives the team a
 * single owned URL to A/B against `/`, and avoids polluting all the
 * NavigationContext call sites with a `variant` field on the Page
 * type. The router maps both paths to { type: 'landing' }; we only
 * read pathname here, at the leaf, to pick which JSX to render.
 *
 * To run a real A/B: have the router serve `/` 50% of the time and
 * `/minimal` 50% (or do it at the edge in vercel.json with a rewrite +
 * cookie). Without that, the team can compare manually by sharing
 * either URL.
 */
export default function LandingPage() {
  const { navigate } = useNavigation();
  const { quiz } = useQuiz();
  const { reports } = useReports();
  const location = useLocation();
  const isMinimal = location.pathname === '/minimal';

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

  if (isMinimal) {
    return (
      <div className="min-h-dvh bg-canvas text-ink overflow-x-hidden">
        <TopNav
          variant="minimal"
          onStart={startQuiz}
          onSample={viewSample}
          onDashboard={goDashboard}
        />
        <Hero onStart={startQuiz} onSample={viewSample} />
        <MinimalWhy />
        <FinalCta onStart={startQuiz} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink overflow-x-hidden">
      <TopNav
        onStart={startQuiz}
        onSample={viewSample}
        onDashboard={goDashboard}
      />
      {/* Section order is convince-then-enable:
       *   Connection (the science) → Credibility (the receipts) →
       *   HowItWorks (the usage flow) → WhatYoullGet (the feature list).
       *
       * Pre-rebrand, HowItWorks sat right after Connection — the user
       * landed, saw the science, and was immediately walked through
       * usage steps for a product they hadn't decided to use yet.
       * Pulling Credibility up to sit adjacent to Connection makes the
       * science + the receipts read as one "why trust this" block
       * before the page asks for any action.  */}
      <Hero onStart={startQuiz} onSample={viewSample} />
      <ConnectionSection onStart={startQuiz} />
      <Credibility />
      <HowWeAnalyze />
      <Privacy />
      <HowItWorks />
      <WhatYoullGet />
      <FinalCta onStart={startQuiz} />
      <Footer />
    </div>
  );
}
