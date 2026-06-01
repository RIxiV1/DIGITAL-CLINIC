import { House, ClipboardList, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigation, type Page } from '../AppContext';
import { assertNever } from '../utils/assertNever';
import { useIsMdUp } from '../utils/useMediaQuery';

type ItemId = 'home' | 'quiz' | 'profile';

type Item = {
  id: ItemId;
  label: string;
  page: Page;
  Icon: React.ElementType;
};

const items: Item[] = [
  { id: 'home', label: 'Home', page: { type: 'home' }, Icon: House },
  { id: 'quiz', label: 'Quiz', page: { type: 'quiz' }, Icon: ClipboardList },
  { id: 'profile', label: 'Profile', page: { type: 'profile' }, Icon: User },
];

function navIdFor(page: Page): ItemId {
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

export default function BottomNav() {
  const { page, replace } = useNavigation();
  // Skip mounting on lg+. The previous version used `md:hidden` to hide
  // the nav but still paid the DOM + framer-motion + event-listener cost
  // on desktops where it was never visible. Mirrors Header's
  // useIsMdUp-based gating, so both nav surfaces share one rule.
  //
  // We keep the `md:hidden` class on the <nav> too as a Tailwind belt
  // around the JS suspenders: if someone ever turns on SSR/SSG,
  // useIsMdUp returns false server-side and corrects on hydrate, which
  // would briefly render the nav on a desktop first paint. The CSS
  // gate hides it during that flash without waiting for JS.
  const isMdUp = useIsMdUp();
  if (isMdUp) return null;

  const activeId: ItemId = navIdFor(page);

  return (
    <nav className="md:hidden no-print sticky bottom-0 z-30 safe-bottom">
      <div className="mx-auto max-w-md px-5 pb-3 pt-2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent">
        <div className="bg-surface/85 backdrop-blur-md rounded-full border border-line/70 shadow-pop flex items-center p-1.5">
          {items.map(({ id, label, page: target, Icon }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                // Tab bars should replace, not push. The previous
                // navigate() call shoved a new history entry on every
                // tap, so a few cycles of Home → Quiz → Home → Quiz
                // turned the browser back button into a sequence of
                // tab-switch dismissals. Real apps' bottom nav swaps
                // routes in place — that's what replace() gives us.
                onClick={() => replace(target)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="relative flex-1 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-full"
              >
                <div className="relative flex flex-col items-center justify-center h-12 w-full">
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-indigo-600"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div
                    className={`relative flex flex-col items-center gap-0.5 ${
                      active ? 'text-white' : 'text-muted'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                    <span className="text-micro font-semibold">{label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
