import type { ReactNode } from 'react';

type Tone =
  | 'good'
  | 'attention'
  | 'concern'
  | 'indigo'
  | 'gold'
  | 'neutral'
  | 'dark';

const toneClasses: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  attention: 'bg-attention-soft text-attention',
  concern: 'bg-concern-soft text-concern',
  indigo: 'bg-indigo-50 text-indigo-700',
  gold: 'bg-gold-100 text-gold-800',
  neutral: 'bg-canvas text-ink-soft border border-line/80',
  dark: 'bg-ink text-white',
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
  const sizeCls =
    size === 'sm' ? 'px-2 h-5 text-[10px]' : 'px-2.5 h-6 text-[11px]';
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
