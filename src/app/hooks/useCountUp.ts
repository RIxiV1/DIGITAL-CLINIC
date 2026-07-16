import { useEffect, useRef, useState } from 'react';

type Options = {
  /** Total animation duration in ms. Defaults to 450 — subtle and quick. */
  duration?: number;
  /** Decimal places preserved in the displayed value. */
  decimals?: number;
};

/**
 * Animates a number from 0 → target over a short duration.
 *
 * Honours `prefers-reduced-motion` — skips animation entirely if set,
 * because count-up effects can be disorienting for some users.
 *
 * Kept short (~450ms by default) so the user sees the real value fast.
 * Long count-ups feel showy and delay comprehension of what the number
 * actually is.
 */
export function useCountUp(target: number, opts: Options = {}): number {
  const { duration = 450, decimals = 0 } = opts;
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    // Skip the animation for users who prefer reduced motion.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }

    fromRef.current = 0;
    startRef.current = null;
    const factor = 10 ** decimals;

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic — quick start, gentle land
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(Math.round(next * factor) / factor);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals]);

  return value;
}
