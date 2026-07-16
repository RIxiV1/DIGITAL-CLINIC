import type { ReactNode } from 'react';

type Tone =
  | 'good'
  | 'attention'
  | 'concern'
  | 'indigo'
  | 'gold'
  | 'neutral'
  | 'dark';

/* Tone → class map. Two refinements vs. the previous version:
 *
 *  1. Status tones (`good` / `attention` / `concern`) use the AA-tuned
 *     `text-*-ink` variants instead of the vivid `text-*` fills. The
 *     vivid hues read at ~3:1 on the matching `*-soft` background —
 *     below the WCAG AA 4.5:1 floor for body text. The `*-ink` tokens
 *     are darker on light theme (passing AA on light soft) and lighter
 *     on dark theme (passing AA on dark soft), so AA holds in both.
 *
 *  2. The `dark` tone (filled dark pill) uses `text-canvas` for its
 *     foreground, NOT a literal `text-white`. In light theme
 *     text-canvas is near-white and reads identically to before; in
 *     dark theme the `bg-ink` background inverts to light, and
 *     text-canvas inverts to dark navy in lockstep — the pill stays
 *     "ink-on-canvas" instead of "white-on-light". */
const toneClasses: Record<Tone, string> = {
  good: 'bg-good-soft text-good-ink',
  attention: 'bg-attention-soft text-attention-ink',
  concern: 'bg-concern-soft text-concern-ink',
  indigo: 'bg-indigo-50 text-indigo-700',
  gold: 'bg-gold-100 text-gold-800',
  neutral: 'bg-canvas text-ink-soft border border-line/80',
  dark: 'bg-ink text-canvas',
};

const dotClasses: Record<Tone, string> = {
  good: 'bg-good',
  attention: 'bg-attention',
  concern: 'bg-concern',
  indigo: 'bg-indigo-600',
  gold: 'bg-gold-500',
  neutral: 'bg-muted',
  dark: 'bg-gold-500',
};

export default function Pill({
  children,
  tone = 'neutral',
  className = '',
  dot = false,
  size = 'md',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  // sm was 20px tall — fine for pure ornament, but the moment any
  // sm pill becomes a clickable filter chip it's well under the 44×44
  // touch-target floor. Bumped to 24px (h-6) so decorative pills
  // breathe and any future-clickable variant has somewhere reasonable
  // to grow from (callers can apply min-h-12 + flex sleeves to opt in
  // to a fully tappable variant).
  const sizeCls =
    size === 'sm' ? 'px-2 h-6 text-micro' : 'px-2.5 h-7 text-caption';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeCls} ${toneClasses[tone]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[tone]}`} />
      )}
      {children}
    </span>
  );
}
