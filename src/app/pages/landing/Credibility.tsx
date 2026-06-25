import { Reveal, SectionHeader } from './shared';

// "By the numbers" figures — recast from the old three-stat-card row (canonical
// template furniture) into a hairline data-strip: the big Instrument Serif
// numbers stay (an identity element), but the card fills, shadows, hover-lift
// and the clay accent-card are gone, and the source line becomes a mono
// caption — the same editorial/ledger voice as the verification_ledger beside
// it. Honest figures with their source named, not fabricated stats.
const STATS = [
  {
    big: '29%',
    line: 'of Indian men over 40 have an undiagnosed hormonal deficiency.',
    source: 'Cross-sectional studies on Indian male endocrine health',
  },
  {
    big: '2.2%',
    line: 'of Indian men have heard of andropause — the male equivalent of menopause.',
    source: 'Public-awareness surveys, urban India cohort',
  },
  {
    big: '12+',
    line: 'peer-reviewed studies inform the panels we recommend.',
    source: 'Hormonal screening · endocrine indices · risk stratification',
  },
];

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

        <Reveal>
          <div className="mt-12 md:mt-16 border-y border-line grid md:grid-cols-3">
            {STATS.map(({ big, line, source }, i) => (
              <div
                key={big}
                className={`py-7 md:py-8 md:px-8 first:md:pl-0 last:md:pr-0 ${
                  i > 0 ? 'border-t md:border-t-0 md:border-l border-line' : ''
                }`}
              >
                <div className="font-display text-display-xl leading-none tracking-tight text-ink">
                  {big}
                </div>
                <p className="mt-4 text-body md:text-body-lg leading-snug text-ink text-balance">
                  {line}
                </p>
                <p className="mt-5 pt-3 border-t border-line/60 text-[10px] font-mono uppercase tracking-widest text-muted leading-relaxed">
                  {source}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-10 max-w-2xl mx-auto text-center text-caption text-muted flex flex-col gap-2.5">
            <span>
              No testimonials, no fake user counts. Credibility comes from
              science and methodology — not staged quotes.
            </span>
            <span>
              And it’s a screening tool, not a diagnosis. It helps you
              understand your results and ask your doctor better questions — it
              doesn’t replace one. For anything urgent, see a doctor.
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

