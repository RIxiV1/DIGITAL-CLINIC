import { CheckCircle2, Hourglass, Loader2, AlertTriangle } from 'lucide-react';

export type ReportBadge = 'analyzed' | 'ready' | 'processing' | 'attention';

type Props = {
  status: ReportBadge;
  className?: string;
};

const config: Record<
  ReportBadge,
  { label: string; classes: string; Icon: React.ElementType }
> = {
  analyzed: {
    label: 'ANALYZED',
    classes: 'bg-good-soft text-good',
    Icon: CheckCircle2,
  },
  ready: {
    label: 'READY',
    classes: 'bg-gold-100 text-gold-800',
    Icon: Hourglass,
  },
  processing: {
    label: 'PROCESSING',
    classes: 'bg-indigo-50 text-indigo-700',
    Icon: Loader2,
  },
  attention: {
    label: 'NEEDS REVIEW',
    classes: 'bg-concern-soft text-concern',
    Icon: AlertTriangle,
  },
};

export default function StatusBadge({ status, className = '' }: Props) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-micro font-bold uppercase tracking-[0.12em] ${c.classes} ${className}`}
    >
      <c.Icon
        size={11}
        strokeWidth={2.5}
        className={status === 'processing' ? 'animate-spin' : ''}
      />
      {c.label}
    </span>
  );
}
