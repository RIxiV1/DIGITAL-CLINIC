import { motion } from 'framer-motion';
import type { FindingExplanation as FindingExplanationData } from '../clinical';

/**
 * The four-question explanation — the product's core experience.
 *
 * Not cards, not a chart: a calm, human read that answers the four
 * questions a worried person actually asks, in order. Type-led on purpose —
 * the structure (the questions) is the interface. The goal is not "did they
 * understand the data" but "do they feel lighter than when they arrived"
 * (except a critical finding, which reads as urgency, not calm).
 */
export default function FindingExplanation({
  data,
  eyebrow = 'What this means for you',
}: {
  data: FindingExplanationData;
  /** Section label — e.g. "Since your last test" for the longitudinal read. */
  eyebrow?: string;
}) {
  const urgent = data.tone === 'urgent';
  return (
    <section aria-label={eyebrow}>
      <div className="text-micro font-bold uppercase tracking-eyebrow text-indigo-700">
        {eyebrow}
      </div>

      {/* The opener frames it as guidance, not diagnosis. */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`mt-3 font-display text-display-md leading-[1.3] text-balance max-w-2xl ${
          urgent ? 'text-concern-ink' : 'text-ink'
        }`}
      >
        {data.opener}
      </motion.p>

      {/* Borderless side-heads instead of hairline-divided rows: the label
          sits in a quiet left gutter, baseline-aligned to its answer, so the
          four beats read as one calm passage rather than a chopped list — and
          the label|value rhythm echoes the lab report the reading came from.
          A semantic <dl> (question → answer) is also the correct a11y shape.
          On mobile it stacks; the left gutter only appears at sm+. */}
      <dl className="mt-8 max-w-2xl flex flex-col gap-y-6">
        {data.beats.map((b) => (
          <div
            key={b.q}
            className="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-x-8 sm:items-baseline"
          >
            <dt
              className={`text-micro font-bold uppercase tracking-label leading-snug sm:text-right ${
                urgent ? 'text-concern' : 'text-indigo-700'
              }`}
            >
              {b.q}
            </dt>
            <dd className="mt-1.5 sm:mt-0 text-body leading-relaxed text-ink-soft text-pretty">
              {b.body}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
