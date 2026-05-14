import { motion } from 'framer-motion';
import type { HTMLAttributes, ReactNode } from 'react';

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
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: 'var(--shadow-pop)' }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`${base} cursor-pointer`}
        {...(rest as any)}
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
