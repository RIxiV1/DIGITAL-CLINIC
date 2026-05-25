import { motion } from 'framer-motion';
import { ClipboardList, Microscope, TrendingUp } from 'lucide-react';
import { Reveal, SectionHeader } from './shared';

export default function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="How it works"
            title={
              <>
                Find out what’s actually going on —{' '}
                <span className="text-blue-700 italic font-serif">
                  in 3 minutes.
                </span>
              </>
            }
            subtitle="Three honest steps. About three minutes total. You leave knowing which tests, which specialist, and what your symptoms might mean."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-5">
          <Reveal>
            <StepCard
              step="01"
              Icon={ClipboardList}
              title="Tell us what you’re experiencing"
              body="Hair changes, energy, sexual health, sleep, mood, weight — check everything that’s off. Takes 3 minutes."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <StepCard
              step="02"
              Icon={Microscope}
              title="Get your personalized hormonal health map"
              body="Which tests to run, which specialist to see, and what your symptoms might mean — explained in plain language."
              emphasized
            />
          </Reveal>
          <Reveal delay={0.16}>
            <StepCard
              step="03"
              Icon={TrendingUp}
              title="Store, track, share"
              body="Upload your reports. Track changes over time. Share a clean summary with your doctor."
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  Icon,
  title,
  body,
  emphasized,
}: {
  step: string;
  Icon: React.ElementType;
  title: string;
  body: string;
  emphasized?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`relative h-full rounded-2xl p-6 sm:p-7 md:p-8 border transition-all ${
        emphasized
          ? 'bg-blue-600 border-blue-600 text-white shadow-blue'
          : 'bg-white border-line shadow-clinical'
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid place-items-center w-12 h-12 rounded-2xl ${
            emphasized
              ? 'bg-white/15 text-blue-100'
              : 'bg-blue-50 text-blue-700 border border-blue-100'
          }`}
        >
          <Icon size={20} />
        </div>
        <span
          className={`font-semibold text-caption uppercase tracking-eyebrow ${
            emphasized ? 'text-blue-200' : 'text-muted'
          }`}
        >
          Step {step}
        </span>
      </div>
      <div
        className={`mt-6 font-sans font-bold text-display-md tracking-tight leading-snug ${
          emphasized ? 'text-white' : 'text-ink'
        }`}
      >
        {title}
      </div>
      <p
        className={`mt-3 text-body-sm leading-relaxed ${
          emphasized ? 'text-blue-100' : 'text-ink-soft'
        }`}
      >
        {body}
      </p>
    </motion.div>
  );
}
