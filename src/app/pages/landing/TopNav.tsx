import { ArrowRight, House } from 'lucide-react';
import Logo from '../../components/Logo';

export default function TopNav({
  onStart,
  onSample,
  onDashboard,
  variant = 'full',
}: {
  onStart: () => void;
  onSample: () => void;
  /** Optional — only passed for returning users (have quiz answers
   *  or reports). Renders a "Go to dashboard" button. New visitors
   *  don't see it because there's nothing in the dashboard yet. */
  onDashboard?: () => void;
  /** 'full' (default) shows the three hash anchors (#connection, #how,
   *  #report) — each maps to a real section id in the full LandingPage
   *  layout. 'minimal' hides them because the minimal LandingPage
   *  variant doesn't have those sections — clicking a hash anchor that
   *  doesn't exist silently no-ops, which is a small but real UX hole. */
  variant?: 'full' | 'minimal';
}) {
  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line/70">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="ForMen · Digital Clinic — back to top"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
        >
          <Logo />
        </button>
        {variant === 'full' && (
          <nav className="hidden md:flex items-center gap-7 text-caption text-ink-soft">
            <a href="#connection" className="hover:text-ink transition-colors">
              The connection
            </a>
            <a href="#how" className="hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#report" className="hover:text-ink transition-colors">
              What you’ll get
            </a>
          </nav>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onSample}
            className="hidden md:inline-flex items-center h-10 px-4 rounded-full text-caption font-semibold text-ink-soft hover:text-ink hover:bg-blue-50 transition-colors"
          >
            See a sample report
          </button>
          {/* Returning-user shortcut — only shown when there's actual
              data to land on. On mobile we hide "Find out in 2 min"
              when this button is present so the bar doesn't get crowded;
              desktop has room for both. */}
          {onDashboard && (
            <button
              onClick={onDashboard}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-on-primary text-caption font-semibold shadow-clinical transition-colors"
            >
              <House size={14} />
              Go to dashboard
            </button>
          )}
          <button
            onClick={onStart}
            className={`items-center gap-1.5 h-10 px-4 rounded-full text-caption font-semibold transition-colors ${
              onDashboard
                ? // Returning users — secondary styling, hidden on mobile to leave room
                  'hidden md:inline-flex border border-line text-ink-soft hover:text-ink hover:bg-blue-50'
                : // New users — primary CTA, always visible
                  'inline-flex bg-blue-600 hover:bg-blue-700 text-on-primary shadow-clinical'
            }`}
          >
            {onDashboard ? 'Retake the quiz' : 'Find out in 2 min'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
