import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'gold' | 'dark';
// Size scale, rough heights:
//   sm — 44px (touch-target minimum; was 36px before the a11y bump)
//   md — 44px
//   lg — 56px
//   xl — 50px, matches the landing hero — kept distinct from lg so
//        the hero CTA can stop hand-rolling its own button with
//        style={{ height: 50 }}.
type Size = 'sm' | 'md' | 'lg' | 'xl';
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

/* Variant → class map. Two rules consistent across every variant:
 *
 *  1.  No hardcoded `text-white` on a dynamic background. The fill
 *      tokens (bg-primary-*, bg-gold-*, bg-surface) re-bind between
 *      themes, so we pair them with the matching `on-*` text token:
 *      `text-on-primary` flips white→deep-navy as the bg flips
 *      saturated-blue→pastel-blue, and the button keeps AA in both.
 *
 *  2.  No literal hex backgrounds (`bg-[#0F1422]`) — every fill
 *      resolves through a semantic token so the dark theme can re-bind
 *      it. The `dark` variant previously used `#0F1422` (deep navy);
 *      it now uses `bg-ink` which IS that color in light, and inverts
 *      to a near-white in dark — pairing with `text-canvas` to keep
 *      the visual register ("ink on canvas") consistent across themes. */
const variantClasses: Record<Variant, string> = {
  // Primary = the ONE terracotta accent (clay). Chrome (links, secondary,
  // nav) stays neutral stone via the primary-* alias; the CTA is where the
  // accent earns its keep. Flat — no glow (zero floating shadows).
  primary: 'bg-clay text-on-clay hover:bg-clay/90 active:bg-clay/85',
  dark: 'bg-ink text-canvas hover:opacity-90 shadow-soft',
  secondary:
    'bg-surface text-primary-700 hover:bg-primary-50 active:bg-primary-100 border border-line shadow-soft',
  gold: 'bg-gold-500 text-on-gold hover:bg-gold-400 active:bg-gold-600 shadow-soft',
  outline: 'border border-primary-600 text-primary-700 hover:bg-primary-50',
  ghost: 'text-primary-700 hover:bg-primary-50',
};

const sizeClasses: Record<Size, string> = {
  // sm bumped from h-9 (36px) to h-11 (44px) to meet the WCAG 2.5.5
  // 44×44 touch-target floor. Visual delta is small enough that the
  // few sm callers (table-action rows in DataPanelModal, etc.) are
  // happy with the new height; the wider hit area only helps.
  sm: 'h-11 px-4 text-caption',
  md: 'h-11 px-5 text-body-sm',
  lg: 'h-14 px-6 text-body',
  xl: 'h-[50px] px-6 text-body',
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
