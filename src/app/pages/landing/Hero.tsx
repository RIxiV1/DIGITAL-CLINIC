import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, FlaskConical, Lock } from 'lucide-react';
import Button from '../../components/Button';
import {
  sampleBiomarkers,
  statusColor,
  summarizeStatuses,
} from '../../data/biomarkers';
import { fadeUp, stagger } from './shared';

export default function Hero({
  onStart,
  onSample,
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <section id="top" className="relative bg-canvas overflow-hidden">
      {/* Left blue accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 hidden md:block" />

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 sm:pt-14 md:pt-20 pb-14 md:pb-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-12 gap-8 md:gap-12 items-end"
        >
          {/* LEFT — Headline + CTAs */}
          <div className="md:col-span-6">
            <motion.div variants={fadeUp}>
              {/* Micro-metric anchor — a hairline-bounded mono label card
                  (clay accent) replacing the old rounded "live dot" pill,
                  which read as generic SaaS chrome. Keeps the real product
                  framing rather than a placeholder slug. */}
              <span className="inline-flex items-center border-[0.5px] border-clay/40 rounded-sm px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-clay">
                [ MEN’S HORMONAL HEALTH // INDIA-FIRST ]
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display font-normal text-5xl md:text-7xl leading-[0.9] tracking-tighter mt-5 text-ink text-balance"
            >
              Your hair loss, your fatigue, and your sex drive{' '}
              {/* One solid accent on the payoff phrase — terracotta, not a
                  gradient. A massive single-weight Instrument Serif carries
                  the punch; the gradient-text trick read as tech-SaaS. */}
              <span className="text-clay">might be the same problem.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-body-lg leading-snug text-ink-soft max-w-[48ch] text-pretty"
            >
              One hormonal system quietly drives all three. Answer a few
              private questions to find out which tests you need — or upload a
              blood test you already have, and we’ll explain it in plain English.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3"
            >
              {/* Primary CTA — uses the shared Button atom (size="xl"
                  is the 50px hero height; shape="pill" matches the
                  landing's rounded-full vocabulary). Was previously a
                  hand-rolled <button> with style={{ height: 50 }} that
                  bypassed the design system entirely. */}
              <Button
                size="xl"
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
                className="inline-flex items-center justify-center gap-1.5 px-1 sm:px-2 h-11 text-body-sm font-semibold text-ink-soft hover:text-blue-700 transition-colors"
              >
                See a sample report
                <ChevronRight size={14} />
              </button>
            </motion.div>

            {/* Real credibility strip — no fake user counts */}
            <motion.div
              variants={fadeUp}
              className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-caption text-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <FlaskConical size={13} className="text-blue-600" />
                Grounded in men’s hormone science
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600" />
                Anonymous ID · no email needed
              </span>
            </motion.div>
          </div>

          {/* RIGHT — sample-report findings preview */}
          <motion.div variants={fadeUp} className="md:col-span-6">
            <HeroVisual onSample={onSample} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual({ onSample }: { onSample: () => void }) {
  // A peek at the actual product, from the SAMPLE report — real flagged
  // markers with their real tier labels, and an honest "N of M on track"
  // bar. Deliberately NOT a synthetic 0–100 "health score" (implies a
  // precision we don't have) and NOT fabricated severities. No glow; the
  // card stands on its hairline border + elevation.
  const flagged = sampleBiomarkers
    .filter((m) => m.status === 'concern' || m.status === 'critical')
    .slice(0, 3);
  const summary = summarizeStatuses(sampleBiomarkers);
  const total = sampleBiomarkers.length;
  // "In range" = everything not flagged for care. Counting only `good`
  // understated it ("8 of 17") and contradicted the report's "most looks
  // reassuring" — attention markers ARE inside the healthy range.
  const inRange = total - summary.needCare;
  const pct = total > 0 ? Math.round((inRange / total) * 100) : 0;

  return (
    <div className="relative w-full max-w-[560px] mx-auto md:mx-0 md:ml-auto lg:-mb-20">
      {/* Founders / clinicians photo — WebP only (60 KB). */}
      <img
        src="/hero-cover.webp"
        alt="ForMen · Digital Clinic clinicians"
        className="relative block w-full h-auto select-none pointer-events-none"
        draggable={false}
      />

      {/* Top-findings card — overlaps the photo. Shows what the product
          actually returns on a real sample, not an abstract diagram. */}
      <div className="absolute left-0 sm:-left-4 bottom-[16%] sm:bottom-[20%] w-[82%] sm:w-[74%] rounded-2xl bg-surface border border-line shadow-clinical-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line/70 flex items-center justify-between">
          {/* Labelled "Sample" so a first-time visitor never mistakes these
              for their own results or a real statistic. */}
          <span className="inline-flex items-center gap-2">
            <span className="text-caption font-semibold text-ink">
              Sample findings
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted border border-line rounded px-1 py-0.5 leading-none">
              Sample
            </span>
          </span>
          <button
            onClick={onSample}
            className="inline-flex items-center gap-0.5 text-micro font-semibold text-blue-700 hover:text-blue-800 transition-colors"
          >
            See full report <ChevronRight size={12} />
          </button>
        </div>

        <div className="px-4 py-3 grid gap-2">
          {flagged.map((m) => {
            const c = statusColor(m.status);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-caption text-ink truncate">
                  {m.name}
                </span>
                <span
                  className={`shrink-0 inline-flex items-center px-1.5 h-5 rounded-full text-micro font-bold uppercase tracking-widest ${c.bg} ${c.text}`}
                >
                  {c.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Honest summary — a count, not a synthetic score. */}
        <div className="px-4 pb-3 pt-2 border-t border-line/70">
          <div className="flex items-center justify-between text-micro mb-1.5">
            <span className="font-semibold text-ink-soft">In range</span>
            <span className="tabular-nums text-muted">
              {inRange} of {total} markers
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
            <div
              className="h-full rounded-full bg-good"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
