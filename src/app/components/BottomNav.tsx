import { House, ClipboardList, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp, type Page } from '../AppContext';
import { assertNever } from '../utils/assertNever';

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
  const { page, navigate } = useApp();

  const activeId: ItemId = navIdFor(page);

  return (
    <nav className="lg:hidden no-print sticky bottom-0 z-30 safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 pt-2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent">
        <div className="bg-white/95 backdrop-blur rounded-full border border-line shadow-pop flex items-center p-1.5">
          {items.map(({ id, label, page: target, Icon }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => navigate(target)}
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
                    <span className="text-[10px] font-semibold">{label}</span>
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
