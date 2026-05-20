import { Monitor, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../AppContext';

/**
 * Tri-state theme toggle — click to cycle Light → Dark → System.
 * The active mode's icon animates in from the previous slot so the
 * transition feels intentional, not a snap.
 *
 * Sits in the page header. Always visible — theme is a setting people
 * adjust often, not something to bury in settings.
 */
export default function ThemeToggle() {
  const { mode, toggle } = useTheme();

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  const label =
    mode === 'light'
      ? 'Light theme · click for dark'
      : mode === 'dark'
        ? 'Dark theme · click for system'
        : 'System theme · click for light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="relative grid place-items-center w-9 h-9 rounded-full text-ink-soft hover:text-ink hover:bg-canvas/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 grid place-items-center"
        >
          <Icon size={16} strokeWidth={2.2} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
