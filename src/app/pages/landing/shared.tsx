import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-[0.18em] text-blue-700">
        <span className="w-6 h-px bg-blue-600" />
        {eyebrow}
      </div>
      <h2 className="font-sans font-bold text-display-md sm:text-display-lg md:text-display-lg lg:text-display-xl leading-[1.08] tracking-[-0.025em] mt-3 text-balance">
        {title}
      </h2>
      <p className="mt-4 text-body sm:text-body md:text-body text-ink-soft leading-relaxed max-w-[44ch] text-pretty">
        {subtitle}
      </p>
    </div>
  );
}
