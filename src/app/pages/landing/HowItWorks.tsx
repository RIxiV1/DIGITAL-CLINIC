import { Reveal, SectionHeader } from './shared';

/**
 * How it works — restructured from a 3-icon card grid into a single
 * Chronological Hairline Axis: one vertical rule threading three numbered
 * checkpoints. The markers are raw Instrument Serif numerals (low weight,
 * clay), with dense copy packed tight beneath — no stock illustration, no
 * lucide step-icons. The process itself is unchanged.
 */
const STEPS = [
  {
    step: '01',
    title: 'Tell us what you’re experiencing',
    body: 'Hair changes, energy, sexual health, sleep, mood, weight — flag everything that’s off. About a minute.',
  },
  {
    step: '02',
    title: 'Get your hormonal health map',
    body: 'Which tests to run, which specialist to see, and what your symptoms might mean — in plain language, not jargon.',
  },
  {
    step: '03',
    title: 'Store, track, share',
    body: 'Upload your reports, track changes over time, and hand your doctor a clean summary.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-20 md:py-28 bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
          <Reveal>
            <SectionHeader
              eyebrow="How it works"
              title="Find out what’s actually going on — in 2 minutes."
              subtitle="Three honest steps, about two minutes. You leave knowing which tests, which specialist, and what your symptoms might mean."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <ol className="border-l-[0.5px] border-line ml-3 pl-7 space-y-10 md:space-y-12">
              {STEPS.map((s) => (
                <li key={s.step} className="relative">
                  {/* Node dot riding the axis line. ring-4 ring-canvas
                      punches a clean gap in the rule behind it. */}
                  <span
                    aria-hidden
                    className="absolute -left-7 top-2.5 w-2 h-2 -translate-x-1/2 rounded-full bg-clay ring-4 ring-canvas"
                  />
                  <div className="font-display text-4xl md:text-5xl leading-none text-clay">
                    {s.step}
                  </div>
                  <h3 className="mt-3 font-sans font-bold text-body-lg leading-snug text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-body-sm text-ink-soft leading-relaxed max-w-md text-pretty">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
