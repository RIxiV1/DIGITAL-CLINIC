import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import { Reveal } from './shared';

export default function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <div className="relative mx-auto w-full max-w-5xl rounded-[32px] bg-blue-600 text-on-primary overflow-hidden shadow-blue">
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />
            <div className="relative px-5 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20 text-center">
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur text-caption font-bold uppercase tracking-label">
                <Sparkles size={11} /> Free during MVP
              </span>
              <h2 className="font-sans font-bold text-display-md sm:text-display-lg md:text-display-xl leading-[1.05] tracking-tight mt-5 text-balance max-w-[22ch] mx-auto">
                See what your hormones are telling you.
              </h2>
              <p className="mt-5 text-body md:text-body-lg leading-relaxed text-blue-100 max-w-[42ch] mx-auto text-pretty">
                3 minutes. One clear picture.
              </p>

              <div className="mt-8 sm:mt-9 flex justify-center">
                <button
                  onClick={onStart}
                  style={{ height: 56 }}
                  className="inline-flex items-center justify-center gap-2 px-7 rounded-full bg-surface text-blue-700 hover:bg-blue-50/10 text-body font-semibold shadow-clinical-lg transition-colors w-full sm:w-auto"
                >
                  Start the assessment
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-6 text-caption text-blue-100 inline-flex items-center gap-1.5">
                <Lock size={12} />
                Anonymous ID. No email or phone required. Your data stays yours.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
