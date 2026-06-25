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

        {/* Hairline manifest — not icon-cards. Matches the editorial idiom
            used across the full landing (WhatYoullGet / Privacy / Credibility);
            the lucide-square-in-a-shadow-card pattern was the stock
            generated-feature-list look removed everywhere else. */}
        <div className="mt-8 border-t border-line">
          {ITEMS.map(({ title, body }) => (
            <Reveal key={title}>
              <div className="py-5 border-b border-line">
                <div className="font-semibold text-ink text-body">{title}</div>
                <p className="mt-1 text-caption text-ink-soft leading-relaxed max-w-[60ch]">
                  {body}
                </p>
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
    title: 'Tests picked for your symptoms.',
    body: 'Not the generic "men\'s wellness" combo every lab pushes — a panel based on what you actually told us.',
  },
  {
    title: 'Numbers translated into plain English.',
    body: 'Upload a lab report, we read it, and you get what each value means for you. No more Googling "what is HbA1c."',
  },
  {
    title: 'Anonymous by default. Your data, your device.',
    body: 'No email needed. Nothing leaves your browser. Delete everything in one tap from Profile.',
  },
];
