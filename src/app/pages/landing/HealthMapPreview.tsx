import { useMemo } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Button from '../../components/Button';
import ConnectedSystems from '../../components/ConnectedSystems';
import { buildBodySystems, healthStorySentence } from '../../clinical';
import { sampleBiomarkers } from '../../data/biomarkers';
import { Reveal } from './shared';

/**
 * Landing section that SHOWS the signature instead of describing it. The
 * rest of the landing talks about "one connected system"; this renders the
 * real in-app Health Map (the same ConnectedSystems component) on a real
 * sample report, so the promise matches the product.
 *
 * Honesty: it's clearly framed as a SAMPLE (heading + the map's own
 * headline say so), so a first-time visitor never mistakes it for their own
 * data. Tapping a system teaches the cited connection — no navigation
 * needed here, which is exactly the interactive demo the landing wants.
 */
export default function HealthMapPreview({
  onStart,
  onSample,
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  const systems = useMemo(() => buildBodySystems(sampleBiomarkers), []);
  const story = useMemo(() => healthStorySentence(systems), [systems]);

  return (
    <section className="bg-canvas py-16 md:py-24 border-t border-line/60">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-eyebrow text-blue-700">
              <span className="w-6 h-px bg-blue-600" />
              The Health Map
            </div>
            <h2 className="font-sans font-bold text-display-md sm:text-display-lg leading-[1.08] tracking-tight mt-3 text-balance">
              Not a wall of numbers — your body as one connected system.
            </h2>
            <p className="mt-4 text-body text-ink-soft leading-relaxed max-w-[46ch] text-pretty">
              Upload a blood test and every marker sorts into the system it
              belongs to, with the one place to start highlighted. Tap a system
              to see how it connects. Here’s a real sample:
            </p>
          </div>

          <div className="mt-8">
            <ConnectedSystems
              systems={systems}
              headline="A sample report — sorted by system, not a list of values."
              story={story}
            />
          </div>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              size="lg"
              shape="pill"
              variant="primary"
              onClick={onStart}
              trailing={<ArrowRight size={16} />}
              className="w-full sm:w-auto"
            >
              Find out in 2 minutes
            </Button>
            <button
              onClick={onSample}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-2 text-body-sm font-semibold text-ink-soft hover:text-blue-700 transition-colors"
            >
              See the full sample report
              <ChevronRight size={14} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
