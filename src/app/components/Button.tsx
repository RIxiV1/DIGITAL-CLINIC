import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'gold' | 'dark';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'pill' | 'rounded';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo',
  dark:
    'bg-ink text-white hover:bg-ink-soft active:bg-black shadow-soft',
  secondary:
    'bg-white text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 border border-line shadow-soft',
  gold:
    'bg-gold-500 text-indigo-900 hover:bg-gold-400 active:bg-gold-600 shadow-soft',
  outline: 'border border-indigo-600 text-indigo-700 hover:bg-indigo-50',
  ghost: 'text-indigo-700 hover:bg-indigo-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-[14px]',
  lg: 'h-14 px-6 text-[15px]',
};

const shapeClasses: Record<Shape, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-[14px]',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  fullWidth,
  leading,
  trailing,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${shapeClasses[shape]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...(rest as any)}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </motion.button>
  );
}
