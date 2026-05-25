import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import Logo from './Logo';
import { useNavigation, type Page } from '../AppContext';
import { assertNever } from '../utils/assertNever';
import { useIsLgUp } from '../utils/useMediaQuery';

type Props = {
  variant?: 'home' | 'page';
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  size?: 'narrow' | 'wide';
};

type NavSlot = {
  id: 'home' | 'quiz' | 'profile';
  label: string;
  target: Page;
};

const NAV_SLOTS: NavSlot[] = [
  { id: 'home', label: 'Home', target: { type: 'home' } },
  { id: 'quiz', label: 'Quiz', target: { type: 'quiz' } },
  { id: 'profile', label: 'Profile', target: { type: 'profile' } },
];

function activeNavId(page: Page): NavSlot['id'] {
  switch (page.type) {
    case 'home':
    case 'upload':
    case 'processing':
    case 'manualEntry':
    case 'results':
    case 'problem':
      return 'home';
    case 'quiz':
    case 'recommendedTests':
      return 'quiz';
    case 'profile':
      return 'profile';
    case 'landing':
      return 'home';
    default:
      return assertNever(page);
  }
}

export default function Header({
  variant = 'home',
  title,
  subtitle,
  onBack,
  rightSlot,
  size = 'wide',
}: Props) {
  const { back, navigate, page } = useNavigation();
  const handleBack = onBack ?? back;
  const active = activeNavId(page);
  // Only one shell renders at a time — the previous `flex lg:hidden`
  // / `hidden lg:flex` pattern mounted both DOM trees and paid the
  // event-listener + framer-motion cost for the invisible one.
  const isLgUp = useIsLgUp();

  const widthCls =
    size === 'wide'
      ? 'max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl'
      : 'max-w-md';

  // Translucent canvas (bg-canvas/80) + backdrop-blur-md so content
  // below the sticky header visibly fades behind it instead of being
  // clipped by a hard edge. We previously tried solid bg-canvas to
  // dodge a scroll-repaint cost on low-end Android, but the visual
  // tradeoff was too stark — the blurred-glass treatment is back,
  // and the comment that lived here ("solid bg-canvas, no
  // backdrop-blur") has been removed because it contradicted the
  // actual className it sat above.
  return (
    <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-md border-b border-line/70 no-print">
      <div
        className={`mx-auto w-full ${widthCls} px-4 sm:px-6 lg:px-8 h-14 lg:h-16 flex items-center gap-2`}
      >
        {/* ---------- Mobile / tablet shell ---------- */}
        {!isLgUp && (
        <div className="flex items-center gap-2 w-full">
          {variant === 'home' ? (
            <button
              type="button"
              onClick={() => navigate({ type: 'landing' })}
              aria-label="ForMen homepage"
              className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <Logo size="md" />
            </button>
          ) : (
            <>
              <button
                onClick={handleBack}
                aria-label="Back"
                className="grid place-items-center w-12 h-12 -ml-3 rounded-full hover:bg-indigo-50 text-indigo-700 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                {title && (
                  <div className="font-display text-[15px] text-ink leading-tight truncate">
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="text-[11px] text-muted truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </>
          )}

          {variant === 'home' && <div className="flex-1" />}

          {rightSlot && (
            <div className="flex items-center gap-1.5">{rightSlot}</div>
          )}
        </div>
        )}

        {/* ---------- Desktop shell ---------- */}
        {isLgUp && (
        <div className="flex items-center gap-8 w-full">
          <button
            onClick={() => navigate({ type: 'landing' })}
            className="flex items-center"
            aria-label="ForMen homepage"
          >
            <Logo size="md" />
          </button>

          <nav className="flex items-center gap-7 text-[13.5px]">
            {NAV_SLOTS.map((slot) => {
              const isActive = slot.id === active;
              return (
                <button
                  key={slot.id}
                  onClick={() => navigate(slot.target)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative font-medium transition-colors ${
                    isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {slot.label}
                  {isActive && (
                    <span className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 w-7 h-[2px] rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {variant === 'page' && title && (
            <div className="flex items-center gap-2 pl-6 ml-auto border-l border-line/70 min-w-0">
              <button
                onClick={handleBack}
                aria-label="Back"
                className="grid place-items-center w-8 h-8 rounded-full hover:bg-indigo-50 text-indigo-700"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink truncate max-w-[40ch]">
                  {title}
                </div>
                {subtitle && (
                  <div className="text-[10.5px] text-muted truncate max-w-[50ch]">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
          )}

          {rightSlot && (
            <div
              className={`flex items-center gap-2 ${
                variant === 'page' && title ? '' : 'ml-auto'
              }`}
            >
              {rightSlot}
            </div>
          )}
        </div>
        )}
      </div>
    </header>
  );
}
