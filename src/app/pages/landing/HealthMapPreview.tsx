import { useMemo } from 'react';
import { ArrowRight, ChevronRight, Check } from 'lucide-react';
import Button from '../../components/Button';
import ConnectedSystems from '../../components/ConnectedSystems';
import { buildBodySystems, healthStorySentence } from '../../clinical';
import { sampleBiomarkers } from '../../data/biomarkers';
import { Reveal } from './shared';

/**
 * Landing section that SHOWS the signature instead of describing it.
 *
 * Two-column on desktop (copy + benefits + CTA on the left, the real in-app
 * Health Map on the right), stacking cleanly on mobile — the standard
 * feature-section pattern: the copy says WHY, the visual proves it with the
 * actual interface. The map is the real ConnectedSystems component on a real
 * sample report, clearly labelled "Sample report" so a first-time visitor
 * never mistakes it for their own data. Tapping a system teaches the cited
 * connection (no navigation needed here — exactly the interactive demo a
 * landing wants).
 */
const BENEFITS = [
  'Systems, not a spreadsheet of values',
  'The one place to start, highlighted for you',
  'Tap any system to see how it connects',
];

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
    <section className="bg-canvas py-16 md:py-28 border-t border-line/60">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* LEFT — the why + CTA */}
          <Reveal>
            <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-eyebrow text-blue-700">
              <span className="w-6 h-px bg-blue-600" />
              The Health Map
            </div>
            <h2 className="mt-4 font-sans font-bold text-display-md sm:text-display-lg leading-[1.08] tracking-tight text-balance">
              Not a wall of numbers. Your body as one connected system.
            </h2>
            <p className="mt-5 text-body text-ink-soft leading-relaxed max-w-[46ch] text-pretty">
              Upload a blood test and every marker sorts into the system it
              belongs to. You understand your whole report in a minute — not an
              afternoon of Googling.
            </p>

            <ul className="mt-7 space-y-3 max-w-[42ch]">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-blue-100 shrink-0 mt-0.5">
                    <Check size={12} className="text-blue-700" strokeWidth={3} />
                  </span>
                  <span className="text-body-sm text-ink leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
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

          {/* RIGHT — the real Health Map, framed as a sample */}
          <Reveal delay={0.1}>
            <div className="text-micro font-bold uppercase tracking-eyebrow text-muted mb-2.5">
              Sample report
            </div>
            <ConnectedSystems systems={systems} story={story} hideEyebrow />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
