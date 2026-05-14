import { motion } from 'framer-motion';

type Props = {
  value: number;
  max?: number;
  className?: string;
  thickness?: 'thin' | 'thick';
  tone?: 'indigo' | 'gold' | 'good' | 'attention' | 'concern';
};

const toneClasses = {
  indigo: 'bg-indigo-600',
  gold: 'bg-gold-500',
  good: 'bg-good',
  attention: 'bg-attention',
  concern: 'bg-concern',
};

export default function ProgressBar({
  value,
  max = 100,
  className = '',
  thickness = 'thin',
  tone = 'indigo',
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-indigo-50 ${thickness === 'thin' ? 'h-1.5' : 'h-2.5'} ${className}`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${toneClasses[tone]}`}
      />
    </div>
  );
}
