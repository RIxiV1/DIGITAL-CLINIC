import { useReducedMotion } from 'framer-motion';

/**
 * The one shared "tactile press" micro-interaction, so every interactive
 * surface in the app responds to touch the same way — the DeepSeek/Kimi
 * feel where nothing you tap is dead. Returns framer-motion props to spread
 * onto a `motion.button` / `motion.a` (or any motion element).
 *
 * Two deliberate rules:
 *
 *  1. Reduced-motion aware. When the OS asks for reduced motion we drop the
 *     transforms entirely (callers keep their `transition-colors` hover/active
 *     classes, so those users still get a visible, non-moving response). We
 *     never animate against a stated accessibility preference.
 *
 *  2. Composite-only. Both `scale` and `y` are transforms — they stay on the
 *     GPU and never trigger layout/paint, so this is safe to put on dozens of
 *     elements (including budget Android, our India-first target) without jank.
 *
 * `lift` controls the hover elevation: on for buttons and cards (they read as
 * raised surfaces), off for text links and inline icon buttons (a 1px vertical
 * hop on a run of text looks twitchy — the colour shift is their hover cue).
 * The spring matches the Button atom exactly so a hand-rolled control and a
 * <Button> feel identical under the finger.
 */
export function usePressMotion({ lift = true }: { lift?: boolean } = {}) {
  const reduce = useReducedMotion();
  return {
    whileTap: reduce ? undefined : { scale: 0.97 },
    whileHover: reduce || !lift ? undefined : { y: -1 },
    transition: { type: 'spring', stiffness: 420, damping: 24 },
  } as const;
}
