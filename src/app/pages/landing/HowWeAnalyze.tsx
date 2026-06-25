import { Reveal, SectionHeader } from './shared';

/**
 * "How we read your report" — the trust pillar the competitive set (Hims, Ro,
 * Marek) wins on, and the one this page was missing. It answers the unspoken
 * fear a man has before trusting a health app with his bloodwork:
 * "is an AI diagnosing my testosterone?"
 *
 * The honest answer is also the differentiator. Every claim here is true to the
 * code: status grading is DETERMINISTIC (statusForValue in src/app/data —
 * the same value always gets the same read), the reference ranges are cited
 * (WHO · ICMR · Endocrine Society), and the only AI anywhere is an optional,
 * consent-gated photo OCR fallback — never a chatbot forming an opinion about
 * your health. No fabricated "reviewed by doctors": authority comes from the
 * cited method and the honest boundary, not invented credentials.
 */
const PILLARS = [
  {
    tag: 'WHAT WE READ',
    title: 'The markers that matter',
    body: 'Total and free testosterone, SHBG, LH, TSH, vitamin D, HbA1c, lipids and a full blood count — the markers that actually explain men’s hormonal symptoms, pulled straight from your report.',
  },
  {
    tag: 'HOW WE GRADE IT',
    title: 'Fixed ranges, not a chatbot',
    body: 'Every value is checked against published reference ranges — WHO, ICMR and the Endocrine Society — the same way each time. If your lab printed its own range, we use that. It’s a medical catalog, not an AI guessing your health.',
  },
  {
    tag: 'WHAT WE DON’T DO',
    title: 'We organise, we don’t diagnose',
    body: 'No diagnosis, no prescriptions, no replacing your doctor. We turn your numbers into plain English so you walk into the appointment already knowing what to ask.',
  },
];

export default function HowWeAnalyze() {
  return (
    <section className="py-16 sm:py-20 md:py-28 bg-canvas border-t border-line/60">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="The method"
            title="How we actually read your report."
            subtitle="No guessing, and no chatbot deciding your health — here’s exactly what happens to your numbers."
          />
        </Reveal>

        <Reveal>
          <div className="mt-10 md:mt-14 border-y border-line grid md:grid-cols-3">
            {PILLARS.map(({ tag, title, body }, i) => (
              <div
                key={tag}
                className={`py-7 md:py-8 md:px-8 first:md:pl-0 last:md:pr-0 ${
                  i > 0 ? 'border-t md:border-t-0 md:border-l border-line' : ''
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-clay">
                  {tag}
                </div>
                <h3 className="mt-3 font-sans font-bold text-body-lg leading-snug text-ink">
                  {title}
                </h3>
                <p className="mt-2.5 text-body-sm text-ink-soft leading-relaxed text-pretty">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
