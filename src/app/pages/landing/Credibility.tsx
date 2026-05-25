import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Reveal, SectionHeader } from './shared';

export default function Credibility() {
  return (
    <section id="science" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="The science"
            title={
              <>
                Built on research,{' '}
                <span className="text-blue-700">backed by data.</span>
              </>
            }
            subtitle="Indian male hormonal health is barely talked about — and barely tested. The data is sobering."
          />
        </Reveal>

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
            <Sparkles size={14} className="text-blue-600 shrink-0" />
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
      className={`h-full rounded-2xl p-7 md:p-8 border ${
        accent
          ? 'bg-blue-600 border-blue-600 text-white shadow-blue'
          : 'bg-white border-line shadow-clinical'
      }`}
    >
      <div
        className={`font-sans font-bold text-display-xl md:text-display-xl leading-none tracking-[-0.03em] ${
          accent ? 'text-white' : 'text-blue-700'
        }`}
      >
        {big}
      </div>
      <p
        className={`mt-4 text-body md:text-body-lg leading-snug text-balance ${
          accent ? 'text-white' : 'text-ink'
        }`}
      >
        {line}
      </p>
      <p
        className={`mt-5 pt-4 text-caption border-t leading-relaxed ${
          accent
            ? 'text-blue-100 border-blue-400/40'
            : 'text-muted border-line/80'
        }`}
      >
        {source}
      </p>
    </motion.div>
  );
}
