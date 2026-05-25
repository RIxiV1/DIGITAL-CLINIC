import { CheckCircle2, FlaskConical, Microscope } from 'lucide-react';
import { Reveal } from './shared';

/**
 * Minimal "why this product" section — replaces the full Connection +
 * HowItWorks + WhatYoullGet stack in the LandingPage.minimal variant.
 *
 * Three bullets. No animation per bullet (the section-level Reveal
 * carries the entrance). No mockups, no cascade diagrams. The pitch is
 * the headline; this section is just close-the-deal trust signals.
 */
export default function MinimalWhy() {
  return (
    <section className="py-14 sm:py-18 md:py-22 bg-canvas">
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
        <Reveal>
          <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-eyebrow text-indigo-700">
            <span className="w-6 h-px bg-indigo-600" />
            What you get
          </div>
          <h2 className="font-sans font-bold text-display-md md:text-display-lg leading-[1.1] tracking-tight mt-3 text-balance">
            Plain English, the right tests, your data — yours.
          </h2>
        </Reveal>

        <div className="mt-8 grid gap-5">
          {ITEMS.map(({ Icon, title, body }) => (
            <Reveal key={title}>
              <div className="flex items-start gap-4 rounded-2xl bg-white border border-line p-5 shadow-clinical">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-ink text-body">
                    {title}
                  </div>
                  <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const ITEMS = [
  {
    Icon: FlaskConical,
    title: 'Tests picked for your symptoms.',
    body: 'Not the generic "men\'s wellness" combo every lab pushes — a personalised panel based on what you actually told us.',
  },
  {
    Icon: Microscope,
    title: 'Numbers translated into plain English.',
    body: 'Upload a lab report, we read it, you get what each value means for you. No more Googling "what is HbA1c."',
  },
  {
    Icon: CheckCircle2,
    title: 'Anonymous by default. Your data, your device.',
    body: 'No email needed. Nothing leaves your browser. Delete everything in one tap from Profile.',
  },
];
