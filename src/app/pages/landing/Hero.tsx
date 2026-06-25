import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  ChevronRight,
  CircleDot,
  Droplet,
  FlaskConical,
  Lock,
} from 'lucide-react';
import Button from '../../components/Button';
import { fadeUp, stagger } from './shared';

export default function Hero({
  onStart,
  onSample,
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <section id="connection" className="relative bg-canvas overflow-hidden">
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

          {/* RIGHT — Connection visual preview */}
          <motion.div variants={fadeUp} className="md:col-span-6">
            <HeroVisual />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  // No mouse-tracking spotlight. The previous version painted a radial
  // rgba(0,102,204,…) glow that tracked the cursor — a cold-cobalt halo
  // that survived the Ink & Clay rebrand and read as exactly the glow-SaaS
  // signal the design charter exists to avoid. The card stands on its own
  // structure (hairline border + elevation), no glow.
  return (
    <div className="relative w-full max-w-[560px] mx-auto md:mx-0 md:ml-auto lg:-mb-20">
      {/* Founders / clinicians photo — WebP only (60 KB, universally
          supported in modern browsers). The PNG fallback got removed
          to keep /public lean. */}
      <img
        src="/hero-cover.webp"
        alt="ForMen · Digital Clinic clinicians"
        className="relative block w-full h-auto select-none pointer-events-none"
        draggable={false}
      />

      {/* Hormonal Health Map card — overlaps the photo. A hairline-framed
          panel of the in-app hormonal-axis visual. The header is a mono
          label, NOT macOS traffic-light window chrome (the colored
          #FF5F57/#FEBC2E/#28C840 dots were the "look, an app screenshot"
          cliché). HPG_AXIS = the hypothalamic-pituitary-gonadal axis the
          three rows below actually depict. */}
      <div className="absolute left-0 sm:-left-4 bottom-[18%] sm:bottom-[22%] w-[78%] sm:w-[72%] rounded-2xl bg-surface border border-line shadow-clinical-lg overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-line/70 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink">
            hormonal_health_map
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            HPG_AXIS
          </span>
        </div>

        <div className="relative px-3.5 pt-3.5 pb-2.5">
          {/* Backbone axis line that visually connects the three icons */}
          <div className="absolute left-[23px] top-[32px] bottom-[50px] w-px bg-blue-200" />

          <div className="relative grid gap-1">
            <MapRow
              icon={<Brain size={10} className="text-blue-700" />}
              organ="Hypothalamus"
              hormone="GnRH"
            />
            <MapRow
              icon={<Droplet size={10} className="text-blue-700" />}
              organ="Pituitary gland"
              hormone="LH · FSH"
            />
            <MapRow
              icon={<CircleDot size={11} className="text-on-primary" />}
              organ="Testes"
              hormone="Testosterone"
              highlighted
            />
          </div>

          <p className="mt-2.5 text-center font-sans text-caption font-semibold text-ink">
            One system. Eight signals.
          </p>
        </div>
      </div>
    </div>
  );
}

function MapRow({
  icon,
  organ,
  hormone,
  highlighted,
}: {
  icon: ReactNode;
  organ: string;
  hormone: string;
  highlighted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${
          highlighted
            ? 'bg-blue-600 ring-2 ring-surface'
            : 'bg-surface border border-blue-200'
        }`}
      >
        {icon}
      </div>
      <div
        className={`flex-1 rounded-lg px-2.5 py-1 ${
          highlighted ? 'bg-blue-600 text-on-primary' : ''
        }`}
      >
        <div
          className={`text-caption font-semibold leading-tight ${
            highlighted ? 'text-inherit' : 'text-ink'
          }`}
        >
          {organ}
        </div>
        <div
          className={`text-micro font-bold uppercase tracking-widest leading-tight mt-0.5 ${
            highlighted ? 'text-inherit opacity-90' : 'text-blue-700'
          }`}
        >
          {hormone}
        </div>
      </div>
    </div>
  );
}
