import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronRight,
  CircleDot,
  Droplet,
  FlaskConical,
  Lock,
  Sparkles,
} from 'lucide-react';
import { fadeUp, stagger } from './shared';

export default function Hero({
  onStart,
  onSample,
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <section className="relative bg-white overflow-hidden">
      {/* Left blue accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 hidden lg:block" />

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 sm:pt-14 md:pt-20 pb-14 md:pb-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-12 gap-8 md:gap-12 items-end"
        >
          {/* LEFT — Headline + CTAs */}
          <div className="lg:col-span-6">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white border border-blue-100 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-blue-700 shadow-clinical">
                <span className="relative grid place-items-center w-3.5 h-3.5">
                  <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-blue-600" />
                </span>
                Men's Hormonal Health
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-sans font-bold text-[34px] sm:text-[44px] md:text-[52px] lg:text-[56px] leading-[1.06] tracking-[-0.025em] mt-5 text-ink text-balance"
            >
              Your hair loss, your fatigue, and your sex drive{' '}
              <span className="text-blue-700">might be the same problem.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-4 text-[15px] md:text-[17px] leading-relaxed text-ink-soft max-w-[40ch] text-pretty"
            >
              One hormonal system controls all three. Most Indian men have never
              had it tested.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3"
            >
              <button
                onClick={onStart}
                style={{ height: 50 }}
                className="group inline-flex items-center justify-center gap-2 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-semibold shadow-blue transition-all hover:-translate-y-0.5 w-full sm:w-auto"
              >
                Find out in 3 minutes
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
              <button
                onClick={onSample}
                className="inline-flex items-center justify-center gap-1.5 px-1 sm:px-2 text-[14px] font-semibold text-ink-soft hover:text-blue-700 transition-colors"
              >
                See a sample report
                <ChevronRight size={14} />
              </button>
            </motion.div>

            {/* Real credibility strip — no fake user counts */}
            <motion.div
              variants={fadeUp}
              className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-muted"
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
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <HeroVisual />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full max-w-[560px] mx-auto lg:mx-0 lg:ml-auto lg:-mb-20">
      {/* Founders / clinicians photo — WebP only (60 KB, universally
          supported in modern browsers). The PNG fallback got removed
          to keep /public lean. */}
      <img
        src="/hero-cover.webp"
        alt="ForMen · Digital Clinic clinicians"
        className="relative block w-full h-auto select-none pointer-events-none"
        draggable={false}
      />

      {/* Hormonal Health Map card — overlaps the photo. Previously had
          a y: [0, -5, 0] / 6s infinite float animation; removed because
          it read as "drifting / off-anchor" rather than the intended
          "gently floating overlay" cue. */}
      <div className="absolute left-0 sm:-left-4 bottom-[18%] sm:bottom-[22%] w-[78%] sm:w-[72%] rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden">
        {/* Mac-style window chrome */}
        <div className="px-3.5 py-2 border-b border-line/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
            <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
            <span className="w-2 h-2 rounded-full bg-[#28C840]" />
          </div>
          <div className="text-[10.5px] font-semibold text-ink">
            Hormonal health map
          </div>
          <div className="w-10" />
        </div>

        <div className="relative px-3.5 pt-3.5 pb-2.5">
          {/* Backbone axis line that visually connects the three icons */}
          <div className="absolute left-[23px] top-[32px] bottom-[50px] w-px bg-blue-200" />

          <div className="relative grid gap-1">
            <MapRow
              icon={<Sparkles size={10} className="text-blue-700" />}
              organ="Hypothalamus"
              hormone="GnRH"
            />
            <MapRow
              icon={<Droplet size={10} className="text-blue-700" />}
              organ="Pituitary gland"
              hormone="LH · FSH"
            />
            <MapRow
              icon={<CircleDot size={11} className="text-white" />}
              organ="Testes"
              hormone="Testosterone"
              highlighted
            />
          </div>

          <p className="mt-2.5 text-center font-sans text-[11.5px] font-semibold text-ink">
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
            ? 'bg-blue-600 ring-2 ring-white'
            : 'bg-white border border-blue-200'
        }`}
      >
        {icon}
      </div>
      <div
        className={`flex-1 rounded-lg px-2.5 py-1 ${
          highlighted ? 'bg-blue-600 text-white' : ''
        }`}
      >
        <div
          className={`text-[11.5px] font-semibold leading-tight ${
            highlighted ? 'text-white' : 'text-ink'
          }`}
        >
          {organ}
        </div>
        <div
          className={`text-[9.5px] font-bold uppercase tracking-[0.1em] leading-tight mt-0.5 ${
            highlighted ? 'text-blue-100' : 'text-blue-700'
          }`}
        >
          {hormone}
        </div>
      </div>
    </div>
  );
}
