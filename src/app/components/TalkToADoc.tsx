import { motion } from 'framer-motion';
import { Stethoscope } from 'lucide-react';

type Props = {
  variant?: 'compact' | 'full';
  onClick?: () => void;
  className?: string;
};

export default function TalkToADoc({
  variant = 'compact',
  onClick,
  className = '',
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className={`group relative inline-flex items-center gap-2 h-10 pl-2 pr-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold transition-colors shadow-soft ${className}`}
    >
      <span className="relative grid place-items-center w-7 h-7 rounded-full bg-indigo-500/70 text-gold-300">
        <Stethoscope size={14} strokeWidth={2.25} />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-good ring-2 ring-indigo-600" />
      </span>
      {variant === 'full' ? (
        <span>Talk to a Doctor</span>
      ) : (
        <span className="whitespace-nowrap">Talk to a Doc</span>
      )}
    </motion.button>
  );
}
