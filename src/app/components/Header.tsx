import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import Logo from './Logo';
import { useNavigation, type Page } from '../AppContext';
import { assertNever } from '../utils/assertNever';
import { useIsMdUp } from '../utils/useMediaQuery';

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
    case 'healthMap':
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

/* ------------------------------------------------------------------ */
/* Shared sub-pieces                                                    */
/*                                                                      */
/* Both shells previously hand-rolled their own logo button, their own  */
/* back-button block, and their own right-slot wrapper. Extracting      */
/* them here means a focus-ring tweak, a hover color shift, or an       */
/* aria-label change happens in one place instead of two — the audit    */
/* called the prior twin-shell "guaranteed to drift" precisely because  */
/* the pieces were inlined twice.                                       */
/* ------------------------------------------------------------------ */

function HomeLogoButton({ onNavigate }: { onNavigate: () => void }) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label="Go to your dashboard"
      className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      <Logo size="md" />
    </button>
  );
}

/** Back arrow — two visual sizes for the two shells. Mobile's larger
 *  hit area is for thumb reach; desktop's tighter button slots next to
 *  the page title inside the separator-bounded column. */
function BackArrow({
  onBack,
  size,
}: {
  onBack: () => void;
  size: 'lg' | 'sm';
}) {
  const isLg = size === 'lg';
  return (
    <button
      onClick={onBack}
      aria-label="Back"
      className={
        isLg
          ? 'grid place-items-center w-12 h-12 -ml-3 rounded-full hover:bg-indigo-50 text-indigo-700 transition-colors'
          : 'grid place-items-center w-8 h-8 rounded-full hover:bg-indigo-50 text-indigo-700'
      }
    >
      <ArrowLeft size={isLg ? 18 : 16} />
    </button>
  );
}

function DesktopNav({
  active,
  onNavigate,
}: {
  active: NavSlot['id'];
  onNavigate: (page: Page) => void;
}) {
  return (
    <nav className="flex items-center gap-7 text-caption">
      {NAV_SLOTS.map((slot) => {
        const isActive = slot.id === active;
        return (
          <button
            key={slot.id}
            onClick={() => onNavigate(slot.target)}
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
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/*                                                                      */
/* Two shells, mounted conditionally via useIsMdUp() so we don't pay    */
/* the DOM + event-listener cost for the invisible one (the previous   */
/* `flex md:hidden` / `hidden md:flex` pattern did). The structural     */
/* differences between shells are real:                                 */
/*   - mobile: single-row flex, big touch targets, no nav slots,        */
/*             back-button-inline-with-title for page variant           */
/*   - desktop: nav slots, separator-bounded title column, smaller      */
/*             icons, ml-auto rightSlot positioning                     */
/* …so we keep two render branches. What we DON'T keep is duplicated   */
/* sub-pieces — the logo button, the back arrow, the nav, and the      */
/* right-slot wrapper are all extracted above and called from both      */
/* branches, so a focus-style or aria-label tweak only needs to land   */
/* in one place.                                                        */
/* ------------------------------------------------------------------ */

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
  const isMdUp = useIsMdUp();
  // Logo on app screens goes HOME (the dashboard) — not the marketing
  // landing. Once you're inside the app, the logo is "take me to my home
  // base", and bouncing an engaged user to the sales page reads like a
  // logout. (The landing has its own TopNav; this Header never renders
  // there.)
  const goHome = () => navigate({ type: 'home' });

  // Container max-width ramp pulled one tier earlier — same shift
  // applied to components/Container.tsx so layout stays coherent
  // across the page. iPad portrait now reads as desktop.
  const widthCls =
    size === 'wide'
      ? 'max-w-md sm:max-w-3xl md:max-w-5xl lg:max-w-6xl'
      : 'max-w-md';

  // Translucent canvas + backdrop-blur so content below the sticky
  // header visibly fades behind it. We previously tried solid bg to
  // dodge a scroll-repaint cost on low-end Android, but the visual
  // tradeoff was too stark — the blurred-glass treatment is back.
  return (
    <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-md border-b border-line/70 no-print">
      <div
        className={`mx-auto w-full ${widthCls} px-4 sm:px-6 md:px-8 h-14 md:h-16 flex items-center ${
          isMdUp ? 'gap-8' : 'gap-2'
        }`}
      >
        {!isMdUp ? (
          /* ---------- Mobile shell ---------- */
          <>
            {variant === 'home' ? (
              <HomeLogoButton onNavigate={goHome} />
            ) : (
              <>
                <BackArrow onBack={handleBack} size="lg" />
                <div className="flex-1 min-w-0">
                  {title && (
                    <div className="font-display text-body text-ink leading-tight truncate">
                      {title}
                    </div>
                  )}
                  {subtitle && (
                    <div className="text-caption text-muted truncate">
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
          </>
        ) : (
          /* ---------- Desktop shell ---------- */
          <>
            <HomeLogoButton onNavigate={goHome} />
            <DesktopNav active={active} onNavigate={navigate} />
            {variant === 'page' && title && (
              <div className="flex items-center gap-2 pl-6 ml-auto border-l border-line/70 min-w-0">
                <BackArrow onBack={handleBack} size="sm" />
                <div className="min-w-0">
                  <div className="text-caption font-semibold text-ink truncate max-w-[40ch]">
                    {title}
                  </div>
                  {subtitle && (
                    <div className="text-micro text-muted truncate max-w-[50ch]">
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
          </>
        )}
      </div>
    </header>
  );
}
