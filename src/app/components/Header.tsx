import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import Logo from './Logo';
import TalkToADoc from './TalkToADoc';
import { useApp } from '../AppContext';

type Props = {
  variant?: 'home' | 'page';
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  hideDoc?: boolean;
};

export default function Header({
  variant = 'home',
  title,
  subtitle,
  onBack,
  rightSlot,
  hideDoc,
}: Props) {
  const { back, navigate } = useApp();
  const handleBack = onBack ?? back;
  const handleDoc = () => navigate({ type: 'clinic' });

  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-line/70 no-print">
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 h-14 flex items-center gap-2">
        {variant === 'home' ? (
          <Logo size="md" />
        ) : (
          <>
            <button
              onClick={handleBack}
              aria-label="Back"
              className="grid place-items-center w-9 h-9 -ml-1.5 rounded-full hover:bg-indigo-50 text-indigo-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              {title && (
                <div className="font-display text-[15px] text-ink leading-tight truncate">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-[11px] text-muted truncate">
                  {subtitle}
                </div>
              )}
            </div>
          </>
        )}

        {variant === 'home' && <div className="flex-1" />}

        <div className="flex items-center gap-1.5">
          {rightSlot}
          {!hideDoc && <TalkToADoc onClick={handleDoc} />}
        </div>
      </div>
    </header>
  );
}
