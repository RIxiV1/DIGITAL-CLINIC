import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

/**
 * Offline indicator. Now that the service worker precaches the app shell,
 * the app genuinely keeps working with no network — but it never SAID so, so
 * a user who lost signal couldn't tell "loaded from cache" from "broken."
 *
 * The copy does double duty: it's a status ("you're offline") AND a privacy
 * reassurance ("your reports are safe on this device") — which is true
 * precisely because the data was never on a server. That's the product's
 * differentiator surfaced at the exact moment it matters.
 *
 * A full-width top strip (the conventional offline pattern) rather than a
 * bottom toast, so it never collides with the BottomNav. Enter-only fade to
 * match the app's page-transition pattern (no AnimatePresence — see App.tsx
 * for why exit animations are avoided app-wide); it unmounts instantly when
 * connectivity returns. role="status" + aria-live so it's announced.
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Re-sync in case connectivity changed between initial render and effect.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
      // bg-ink/text-canvas both rebind per theme, so the strip stays legible
      // in the warm-paper light world and the instrument-dark default alike.
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-ink text-canvas text-caption font-medium px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center"
    >
      <WifiOff size={14} className="shrink-0" aria-hidden />
      <span>You’re offline — your reports are safe on this device.</span>
    </motion.div>
  );
}
