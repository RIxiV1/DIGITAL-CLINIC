import { useEffect, useState } from 'react';

/**
 * Subscribes to a media-query result. Returns `true` when the query
 * currently matches, `false` otherwise. SSR-safe (falls back to
 * `false` when window is unavailable, then corrects on mount).
 *
 * Used to swap whole DOM subtrees on viewport-class changes instead of
 * relying on Tailwind's `lg:hidden` / `hidden lg:flex` pattern, which
 * mounts both trees and pays the framer-motion / event-listener cost
 * for the invisible one.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync once in case the query changed between initial render and
    // this effect firing (StrictMode double-invoke, hydration, etc.).
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint — matches CSS `min-width: 768px`.
 *
 *  Was `useIsLgUp` (1024px). Bumping the gate down to `md` means iPad
 *  portrait (768px viewport) gets the desktop shell immediately
 *  instead of falling through to the mobile layout it doesn't need.
 *  The name change is deliberate: leaving "Lg" in the identifier
 *  while the underlying breakpoint moved would be a maintenance trap. */
export function useIsMdUp(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
