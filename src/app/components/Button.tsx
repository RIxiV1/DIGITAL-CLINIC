import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'gold' | 'dark';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'pill' | 'rounded';

type Props = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  /** Full-width on every breakpoint. */
  fullWidth?: boolean;
  /** Full-width on small screens; shrinks to content width on lg+. */
  responsiveFullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo',
  /* Hardcoded near-black so the button stays dark with white text in
     BOTH themes — used on top of the gold Bottom Line card where the
     gold background never changes. Theme tokens would invert ink to
     light in dark mode and break the contrast. */
  dark:
    'bg-[#0F1422] text-white hover:bg-[#1F2433] active:bg-black shadow-soft',
  secondary:
    'bg-surface text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 border border-line shadow-soft',
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
  responsiveFullWidth,
  leading,
  trailing,
  className = '',
  children,
  type,
  ...rest
}: Props) {
  const widthCls = fullWidth
    ? 'w-full'
    : responsiveFullWidth
      ? 'w-full lg:w-auto'
      : '';
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      // Default to type="button" so a Button inside a <form> doesn't
      // accidentally submit it.
      type={type ?? 'button'}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${shapeClasses[shape]} ${widthCls} ${className}`}
      {...rest}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </motion.button>
  );
}
