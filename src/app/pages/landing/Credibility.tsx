import { motion } from 'framer-motion';
import { Reveal, SectionHeader } from './shared';

export default function Credibility() {
  return (
    <section id="science" className="py-16 sm:py-20 md:py-28 bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <Reveal>
            <SectionHeader
              eyebrow="The science"
              title="Built on research, backed by data."
              subtitle="Indian male hormonal health is barely talked about — and barely tested. The data is sobering."
            />
          </Reveal>
          <Reveal delay={0.1}>
            {/* Clinical Verification Ledger — replaces the stock research
                illustration. An asymmetric two-column hairline ledger of
                AUDITABLE vectors only. Every row is verified against the
                repo: reference-range bodies appear in src/app/data
                (WHO·ICMR·Endocrine Society), processing is on-device (no
                server), the gate is tsc + 604 tests, and CI (.github/
                workflows/ci.yml) runs it on every PR. No fabricated seals,
                registration numbers, or board memberships. */}
            <div className="w-full max-w-sm mx-auto md:ml-auto font-mono">
              <div className="text-[10px] uppercase tracking-widest text-clay mb-3">
                verification_ledger
              </div>
              <dl className="text-xs tracking-tight border-y-[0.5px] border-line divide-y-[0.5px] divide-line">
                {(
                  [
                    ['RANGE_SOURCE', 'WHO · ICMR · ENDOCRINE'],
                    ['DATA_RESIDENCY', 'ON_DEVICE'],
                    ['VALIDATION', 'TYPECHECK · 604_TESTS'],
                    ['INTEGRATION', 'CI_EVERY_PR'],
                    ['TESTIMONIALS', 'NONE'],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <dt className="uppercase text-muted whitespace-nowrap">
                      {k}
                    </dt>
                    <dd className="text-ink-soft text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-5">
          <Reveal>
            <StatCard
              big="29%"
              line="of Indian men over 40 have an undiagnosed hormonal deficiency."
              source="Cross-sectional studies on Indian male endocrine health"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <StatCard
              big="2.2%"
              line="of Indian men have heard of andropause — the male equivalent of menopause."
              source="Public-awareness surveys, urban India cohort"
              accent
            />
          </Reveal>
          <Reveal delay={0.16}>
            <StatCard
              big="12+"
              line="peer-reviewed studies inform the panels we recommend."
              source="Hormonal screening · endocrine indices · risk stratification"
            />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-10 flex items-center justify-center gap-2 text-caption text-muted text-center max-w-2xl mx-auto">
            <span>
              No testimonials, no fake user counts. Credibility comes from
              science and methodology — not staged quotes.
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatCard({
  big,
  line,
  source,
  accent,
}: {
  big: string;
  line: string;
  source: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`h-full rounded-lg p-7 md:p-8 border ${
        accent
          ? 'bg-clay border-clay text-on-clay'
          : 'bg-surface border-line'
      }`}
    >
      {/* The big overview number IS large enough for the editorial serif
          (brief: massive overview numbers in Instrument Serif). Small data
          values elsewhere stay in Inter tabular. */}
      <div
        className={`font-display text-display-xl leading-none tracking-tight ${
          accent ? 'text-on-clay' : 'text-ink'
        }`}
      >
        {big}
      </div>
      <p
        className={`mt-4 text-body md:text-body-lg leading-snug text-balance ${
          accent ? 'text-on-clay' : 'text-ink'
        }`}
      >
        {line}
      </p>
      <p
        className={`mt-5 pt-4 text-caption border-t leading-relaxed ${
          accent
            ? 'text-on-clay/80 border-on-clay/25'
            : 'text-muted border-line/80'
        }`}
      >
        {source}
      </p>
    </motion.div>
  );
}
