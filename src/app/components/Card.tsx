import { motion, type HTMLMotionProps } from 'framer-motion';
import type { KeyboardEvent, ReactNode } from 'react';

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
  ...rest
}: Props) {
  const base = `bg-white border border-line/70 rounded-[20px] ${raised ? 'shadow-pop' : 'shadow-soft'} ${padded ? 'p-5' : ''} ${className}`;

  if (interactive) {
    const isButton = typeof rest.onClick === 'function';
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: 'var(--shadow-pop)' }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`${base} ${isButton ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60' : ''}`}
        role={isButton ? 'button' : undefined}
        tabIndex={isButton ? 0 : undefined}
        onKeyDown={
          isButton
            ? (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (e.currentTarget as HTMLDivElement).click();
                }
              }
            : undefined
        }
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div className={base} {...rest}>
      {children}
    </motion.div>
  );
}
