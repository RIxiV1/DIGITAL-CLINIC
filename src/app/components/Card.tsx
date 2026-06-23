import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: ReactNode;
  padded?: boolean;
  raised?: boolean;
  interactive?: boolean;
};

export default function Card({
  children,
  padded = true,
  raised = false,
  interactive = false,
  className = '',
  onClick,
  ...rest
}: Props) {
  // Flat, editorial card framework: no drop shadow (the warm-identity
  // rollout banishes diffuse blurs), a single hairline border, and a
  // tight 8px radius. `raised` (modals / floats) earns a stronger
  // hairline instead of a shadow so it still separates from the page.
  const base = `bg-surface border ${raised ? 'border-line-strong' : 'border-line'} rounded-lg ${padded ? 'p-5' : ''} ${className}`;

  // Interactive + onClick → real <button>. The previous div-with-
  // role="button" + tabIndex={0} + hand-rolled keydown handler
  // "mostly works" — screen readers announce it as a button — but
  // native <button> elements have correct semantics out of the box,
  // automatically opt out of form submission via type="button", and
  // stay accessible in Windows High Contrast mode (which downgrades
  // unknown ARIA roles silently). Casting motion props through
  // `as any` because framer's HTMLMotionProps<'div'> and <'button'>
  // diverge on a few event handlers but we only need the shared
  // subset for our drag-out-of-the-div mount.
  if (interactive && typeof onClick === 'function') {
    return (
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`${base} cursor-pointer text-left w-full transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60`}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={onClick as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(rest as any)}
      >
        {children}
      </motion.button>
    );
  }

  // Non-clickable "interactive" Card (hover affordance, no action) and
  // the default decorative variant both render as a div.
  return (
    <motion.div className={base} onClick={onClick} {...rest}>
      {children}
    </motion.div>
  );
}
