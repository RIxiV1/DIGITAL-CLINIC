import { motion } from 'framer-motion';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
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
    const handleClick = rest.onClick;
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: 'var(--shadow-pop)' }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`${base} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60`}
        {...(rest as any)}
        role="button"
        tabIndex={0}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (!handleClick) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).click();
          }
        }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={base} {...rest}>
      {children}
    </div>
  );
}
