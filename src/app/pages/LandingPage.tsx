import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Download,
  Droplet,
  FileText,
  FlaskConical,
  House,
  Lock,
  Microscope,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Logo from '../components/Logo';
import LegalModal, { type LegalKind } from '../components/LegalModal';
import { useNavigation, useQuiz, useReports } from '../AppContext';

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { navigate } = useNavigation();
  const { quiz } = useQuiz();
  const { reports } = useReports();
  const startQuiz = () => navigate({ type: 'quiz' });
  const viewSample = () => navigate({ type: 'results', reportId: 'rep-001' });

  // Only returning users (anyone who's started the quiz or uploaded a
  // report) get the Dashboard shortcut. Brand-new visitors have nothing
  // in the dashboard yet, so the link would just land them on the
  // "Upload your first report" empty state.
  const hasUserData =
    quiz.symptoms.length > 0 ||
    quiz.priorities.length > 0 ||
    !!quiz.age ||
    !!quiz.activity ||
    reports.length > 0;
  const goDashboard = hasUserData
    ? () => navigate({ type: 'home' })
    : undefined;

  return (
    <div className="min-h-dvh bg-white text-ink overflow-x-hidden">
      <TopNav
        onStart={startQuiz}
        onSample={viewSample}
        onDashboard={goDashboard}
      />
      <Hero onStart={startQuiz} onSample={viewSample} />
      <ConnectionSection onStart={startQuiz} />
      <HowItWorks />
      <WhatYoullGet onSample={viewSample} />
      <Credibility />
      <FinalCta onStart={startQuiz} />
      <Footer onSample={viewSample} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top navigation                                                      */
/* ------------------------------------------------------------------ */

function TopNav({
  onStart,
  onSample,
  onDashboard,
}: {
  onStart: () => void;
  onSample: () => void;
  /** Optional — only passed for returning users (have quiz answers
   *  or reports). Renders a "Go to dashboard" button. New visitors
   *  don't see it because there's nothing in the dashboard yet. */
  onDashboard?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-line/70">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="ForMen · Digital Clinic — back to top"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
        >
          <Logo />
        </button>
        <nav className="hidden md:flex items-center gap-7 text-[13.5px] text-ink-soft">
          <a href="#connection" className="hover:text-ink transition-colors">
            The connection
          </a>
          <a href="#how" className="hover:text-ink transition-colors">
            How it works
          </a>
          <a href="#report" className="hover:text-ink transition-colors">
            What you’ll get
          </a>
          <a href="#science" className="hover:text-ink transition-colors">
            Science
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={onSample}
            className="hidden md:inline-flex items-center h-10 px-4 rounded-full text-[13px] font-semibold text-ink-soft hover:text-ink hover:bg-blue-50 transition-colors"
          >
            See a sample report
          </button>
          {/* Returning-user shortcut — only shown when there's actual
              data to land on. On mobile we hide "Find out in 3 min"
              when this button is present so the bar doesn't get crowded;
              desktop has room for both. */}
          {onDashboard && (
            <button
              onClick={onDashboard}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold shadow-clinical transition-colors"
            >
              <House size={14} />
              Go to dashboard
            </button>
          )}
          <button
            onClick={onStart}
            className={`items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold transition-colors ${
              onDashboard
                ? // Returning users — secondary styling, hidden on mobile to leave room
                  'hidden md:inline-flex border border-line text-ink-soft hover:text-ink hover:bg-blue-50'
                : // New users — primary CTA, always visible
                  'inline-flex bg-blue-600 hover:bg-blue-700 text-white shadow-clinical'
            }`}
          >
            {onDashboard ? 'Retake the quiz' : 'Find out in 3 min'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* HERO — Option A: The Connection                                     */
/* ------------------------------------------------------------------ */

function Hero({
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

      {/* Floating Hormonal Health Map card — overlaps the photo */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-0 sm:-left-4 bottom-[18%] sm:bottom-[22%] w-[78%] sm:w-[72%] rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden"
      >
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
      </motion.div>
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

/* ------------------------------------------------------------------ */
/* SECTION 2 — The Connection (the central insight)                    */
/* ------------------------------------------------------------------ */

type Station = {
  num: string;
  organ: string;
  verb: string;
  hormone: string;
  sub: string;
  isOutput?: boolean;
};

const STATIONS: Station[] = [
  {
    num: '01',
    organ: 'Hypothalamus',
    verb: 'Secretes',
    hormone: 'GnRH',
    sub: 'The signal starts in your brain.',
  },
  {
    num: '02',
    organ: 'Pituitary gland',
    verb: 'Releases',
    hormone: 'LH · FSH',
    sub: 'Relays the signal to the testes.',
  },
  {
    num: '03',
    organ: 'Testes',
    verb: 'Produce',
    hormone: 'Testosterone',
    sub: 'The hormone that runs the show.',
    isOutput: true,
  },
];

const SYMPTOMS: string[] = [
  'Hair loss',
  'Low libido',
  'Belly fat',
  'Infertility',
  'Low energy',
  'ED',
  'Poor sleep',
  'Brain fog',
];

function ConnectionSection({ onStart }: { onStart: () => void }) {
  return (
    <section id="connection" className="py-16 sm:py-20 md:py-28 bg-soft-blue-gradient">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="The connection"
            title={
              <>
                These aren’t 8 problems.
                <br />
                <span className="text-blue-700">
                  They’re 8 signals from one system.
                </span>
              </>
            }
            subtitle="One system — your brain talking to your testes — runs all of them. The Digital Clinic shows you yours, in plain English."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-7">
            <Reveal>
              <ConnectionDiagram />
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <Reveal delay={0.1}>
              <div className="rounded-2xl bg-white border border-line shadow-clinical p-6 md:p-7">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
                  <span className="w-5 h-px bg-blue-600" /> Why it matters
                </div>
                <h3 className="font-sans font-bold text-[20px] md:text-[22px] tracking-[-0.01em] mt-3 text-ink">
                  You’ve been treating these separately.
                </h3>
                <p className="mt-3 text-[14.5px] text-ink-soft leading-relaxed">
                  Hair clinic for the hair. Gym for the belly. A bad night
                  followed by another bad night. Each fix targeting one
                  symptom — none of them touching the source.
                </p>
                <ul className="mt-5 grid gap-2.5 text-[13.5px]">
                  {[
                    'One bloodwork picture, not eight specialists.',
                    'Personalised to your symptoms, not a generic panel.',
                    'Plain English. Doctor-grade depth.',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className="text-blue-600 shrink-0 mt-0.5"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onStart}
                  className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13.5px] font-semibold shadow-clinical transition-colors"
                >
                  See what’s actually going on
                  <ArrowRight size={14} />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The HPG-axis cascade: a vertical three-station diagram showing how the
 * brain → pituitary → testes pipeline drives the symptoms men experience.
 * Replaces the previous radial "hub + spokes" treatment, which read as a
 * generic healthtech logo. This version actually teaches the science.
 */
function ConnectionDiagram({ compact = false }: { compact?: boolean }) {
  if (compact) return <CascadeCompact />;
  return <CascadeBig />;
}

function CascadeBig() {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <span className="sr-only">
        Your hormone system runs as a chain — brain signals trigger a relay
        gland, which tells your testes to produce testosterone. When any
        step is off-balance, it shows up as eight everyday symptoms — hair
        loss, low sex drive, belly fat, fertility problems, low energy,
        erection issues, poor sleep, and brain fog.
      </span>

      {/* Axis title strip */}
      <div className="flex items-center gap-3 mb-7">
        <div className="grid place-items-center w-8 h-8 rounded-xl bg-blue-600 text-white shrink-0 shadow-clinical">
          <FlaskConical size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-blue-700">
            Your hormone chain
          </div>
          <div className="text-[12.5px] text-ink-soft font-medium">
            Three glands. One signal that runs them all.
          </div>
        </div>
      </div>

      {/* The axis itself + stations branching to the right */}
      <div className="relative pl-[60px]">
        {/* Vertical gradient backbone */}
        <motion.div
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          className="absolute origin-top"
          style={{
            left: '23px',
            top: '8px',
            bottom: '8px',
            width: '3px',
            borderRadius: '999px',
            background:
              'linear-gradient(180deg, rgba(122,184,255,0.5) 0%, rgba(15,122,235,0.95) 55%, rgba(0,82,163,1) 100%)',
          }}
        />

        <div className="space-y-5">
          {STATIONS.map((s, i) => (
            <AxisStation
              key={s.num}
              station={s}
              showSignal={i < STATIONS.length - 1}
              delay={0.2 + i * 0.22}
            />
          ))}
        </div>
      </div>

      {/* Branching divider */}
      <div className="mt-8 flex items-center gap-3">
        <span className="flex-1 h-px bg-blue-200" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-700 whitespace-nowrap">
          When the axis is off — you feel it as
        </span>
        <span className="flex-1 h-px bg-blue-200" />
      </div>

      {/* Symptoms — 2 × 4 grid */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        {SYMPTOMS.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 1.2 + i * 0.05 }}
            className="px-3 py-2.5 rounded-xl bg-white border border-line text-center font-semibold text-[12.5px] text-ink shadow-clinical"
          >
            {label}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AxisStation({
  station,
  showSignal,
  delay,
}: {
  station: Station;
  showSignal: boolean;
  delay: number;
}) {
  const { num, organ, verb, hormone, sub, isOutput } = station;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Node on the axis (with organ glyph) */}
      <div
        className={`absolute -left-[60px] top-0.5 grid place-items-center w-12 h-12 rounded-full border-[2.5px] ${
          isOutput
            ? 'bg-blue-600 border-blue-600 text-white shadow-blue'
            : 'bg-white border-blue-500 text-blue-700 shadow-clinical'
        }`}
      >
        <OrganGlyph variant={num} />
      </div>

      {/* Station info card */}
      <div
        className={`relative rounded-2xl border p-4 md:p-5 overflow-hidden ${
          isOutput
            ? 'bg-blue-600 border-blue-600 text-white shadow-blue'
            : 'bg-white border-line shadow-clinical'
        }`}
      >
        {isOutput && (
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-400/30 blur-2xl pointer-events-none" />
        )}
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div
                className={`text-[9.5px] uppercase tracking-[0.22em] font-bold ${
                  isOutput ? 'text-blue-200' : 'text-blue-700'
                }`}
              >
                Stage {num}
              </div>
              <div
                className={`font-display text-[16px] md:text-[18px] leading-tight mt-1 ${
                  isOutput ? 'text-white' : 'text-ink'
                }`}
              >
                {organ}
              </div>
            </div>
            {isOutput && (
              <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full bg-white/15 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-100">
                Output
              </span>
            )}
          </div>

          <p
            className={`mt-2 text-[12.5px] leading-relaxed ${
              isOutput ? 'text-blue-100' : 'text-ink-soft'
            }`}
          >
            {sub}
          </p>

          <div
            className={`mt-3 pt-3 border-t flex items-baseline gap-2 ${
              isOutput ? 'border-white/15' : 'border-line/70'
            }`}
          >
            <span
              className={`text-[9px] uppercase tracking-[0.18em] font-bold ${
                isOutput ? 'text-blue-200' : 'text-blue-700'
              }`}
            >
              {verb}
            </span>
            <span
              className={`font-sans font-bold text-[15px] md:text-[16px] tracking-[-0.01em] ${
                isOutput ? 'text-white' : 'text-ink'
              }`}
            >
              {hormone}
            </span>
          </div>
        </div>
      </div>

      {/* Hormone signal floating between stations */}
      {showSignal && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: delay + 0.15 }}
          className="absolute -bottom-[14px] -left-[60px] z-10 flex items-center"
          style={{ width: '60px' }}
        >
          <div className="relative w-12 grid place-items-center">
            <div className="absolute left-1/2 -translate-x-1/2 w-px h-full" />
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-blue-200 shadow-clinical">
              <ChevronDown
                size={10}
                strokeWidth={2.5}
                className="text-blue-600"
              />
              <span className="text-[8.5px] uppercase tracking-[0.14em] font-bold text-blue-700">
                {hormone}
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Small abstract SVG glyphs for each gland. Not anatomically literal — just
 * iconographic enough to differentiate the three stations visually.
 * - Hypothalamus → a small "neural constellation" (signal-starter)
 * - Pituitary    → a droplet (the classic gland symbol)
 * - Testes       → two ovals
 */
function OrganGlyph({ variant }: { variant: string }) {
  switch (variant) {
    case '01':
      // Hypothalamus — neural constellation
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="w-5 h-5"
          aria-hidden
        >
          <path d="M7 9 L13 6 M13 6 L17 11 M17 11 L11 14 M11 14 L14 17 M7 9 L11 14" strokeOpacity="0.5" />
          <circle cx="7" cy="9" r="1.6" fill="currentColor" />
          <circle cx="13" cy="6" r="1.3" fill="currentColor" />
          <circle cx="17" cy="11" r="1.5" fill="currentColor" />
          <circle cx="11" cy="14" r="1.3" fill="currentColor" />
          <circle cx="14" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case '02':
      // Pituitary — droplet
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden
        >
          <path d="M12 3.5 C 8.5 9, 7 13, 7 15.5 A 5 5 0 0 0 17 15.5 C 17 13, 15.5 9, 12 3.5 Z" />
        </svg>
      );
    case '03':
      // Testes — two ovals
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden
        >
          <ellipse cx="8.5" cy="13" rx="3.4" ry="5" />
          <ellipse cx="15.5" cy="13" rx="3.4" ry="5" />
        </svg>
      );
    default:
      return null;
  }
}

function CascadeCompact() {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <span className="sr-only">
        A miniature view of the HPG axis cascade — hypothalamus → pituitary →
        testes — driving eight visible symptoms.
      </span>

      {/* Mini cascade with axis backbone */}
      <div className="relative pl-[40px]">
        {/* Backbone */}
        <motion.div
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute origin-top"
          style={{
            left: '15px',
            top: '6px',
            bottom: '6px',
            width: '2px',
            borderRadius: '999px',
            background:
              'linear-gradient(180deg, rgba(122,184,255,0.5) 0%, rgba(15,122,235,0.95) 60%, rgba(0,82,163,1) 100%)',
          }}
        />

        <div className="space-y-1.5">
          {STATIONS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.13 }}
              className="relative"
            >
              {/* Node */}
              <div
                className={`absolute -left-[40px] top-0.5 grid place-items-center w-8 h-8 rounded-full border-2 ${
                  s.isOutput
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-blue-500 text-blue-700'
                }`}
              >
                <div className="scale-[0.7]">
                  <OrganGlyph variant={s.num} />
                </div>
              </div>

              {/* Row */}
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                  s.isOutput
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-blue-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[11px] font-semibold leading-tight truncate ${
                      s.isOutput ? 'text-white' : 'text-ink'
                    }`}
                  >
                    {s.organ}
                  </div>
                  <div
                    className={`text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 truncate ${
                      s.isOutput ? 'text-blue-100' : 'text-blue-700'
                    }`}
                  >
                    {s.hormone}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* "Felt as" divider */}
      <div className="mt-3 flex items-center gap-2">
        <span className="flex-1 h-px bg-blue-100" />
        <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-blue-700">
          Felt as
        </span>
        <span className="flex-1 h-px bg-blue-100" />
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {SYMPTOMS.slice(0, 5).map((label) => (
          <span
            key={label}
            className="text-[9.5px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold"
          >
            {label}
          </span>
        ))}
        <span className="text-[9.5px] text-muted px-1 py-0.5">+ 3 more</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SECTION 3 — How It Works                                            */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="How it works"
            title={
              <>
                Find out what’s actually going on —{' '}
                <span className="text-blue-700 italic font-serif">
                  in 3 minutes.
                </span>
              </>
            }
            subtitle="Three honest steps. About three minutes total. You leave knowing which tests, which specialist, and what your symptoms might mean."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-5">
          <Reveal>
            <StepCard
              step="01"
              Icon={ClipboardList}
              title="Tell us what you’re experiencing"
              body="Hair changes, energy, sexual health, sleep, mood, weight — check everything that’s off. Takes 3 minutes."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <StepCard
              step="02"
              Icon={Microscope}
              title="Get your personalized hormonal health map"
              body="Which tests to run, which specialist to see, and what your symptoms might mean — explained in plain language."
              emphasized
            />
          </Reveal>
          <Reveal delay={0.16}>
            <StepCard
              step="03"
              Icon={TrendingUp}
              title="Store, track, share"
              body="Upload your reports. Track changes over time. Share a clean summary with your doctor."
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  Icon,
  title,
  body,
  emphasized,
}: {
  step: string;
  Icon: React.ElementType;
  title: string;
  body: string;
  emphasized?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`relative h-full rounded-2xl p-6 sm:p-7 md:p-8 border transition-all ${
        emphasized
          ? 'bg-blue-600 border-blue-600 text-white shadow-blue'
          : 'bg-white border-line shadow-clinical'
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid place-items-center w-12 h-12 rounded-2xl ${
            emphasized
              ? 'bg-white/15 text-blue-100'
              : 'bg-blue-50 text-blue-700 border border-blue-100'
          }`}
        >
          <Icon size={20} />
        </div>
        <span
          className={`font-semibold text-[12px] uppercase tracking-[0.18em] ${
            emphasized ? 'text-blue-200' : 'text-muted'
          }`}
        >
          Step {step}
        </span>
      </div>
      <div
        className={`mt-6 font-sans font-bold text-[20px] md:text-[22px] tracking-[-0.01em] leading-snug ${
          emphasized ? 'text-white' : 'text-ink'
        }`}
      >
        {title}
      </div>
      <p
        className={`mt-3 text-[14.5px] leading-relaxed ${
          emphasized ? 'text-blue-100' : 'text-ink-soft'
        }`}
      >
        {body}
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* SECTION 4 — What You'll Get  (with PDF folded in)                   */
/* ------------------------------------------------------------------ */

function WhatYoullGet({ onSample }: { onSample: () => void }) {
  return (
    <section id="report" className="py-16 sm:py-20 md:py-28 bg-blue-50/40 border-y border-line/70">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="What you’ll get"
            title="Reports you can actually understand."
            subtitle="No more Googling confusing medical terms. We break down your recommended tests and results into plain language."
          />
        </Reveal>

        <div className="mt-10 md:mt-14 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT — Doctor Summary mockup */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <Reveal>
              <DoctorSummaryMockup />
            </Reveal>
          </div>

          {/* RIGHT — Checklist */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <Reveal>
              <div className="grid gap-3">
                {[
                  {
                    Icon: FlaskConical,
                    title: 'Which hormones to test — and why',
                    body: 'Personalised panel. Not the generic "men’s wellness" combo every lab pushes.',
                  },
                  {
                    Icon: BookOpen,
                    title: 'What each result means for you specifically',
                    body: 'Your numbers, translated. Your symptoms, connected to the markers.',
                  },
                  {
                    Icon: Microscope,
                    title: 'Which specialist to see (and what to ask them)',
                    body: 'Endocrinologist, urologist, GP? The right person, the right questions.',
                  },
                  {
                    Icon: TrendingUp,
                    title: 'Trend tracking when you retest',
                    body: 'See whether what you’re doing is actually moving the needle.',
                  },
                  {
                    Icon: FileText,
                    title: 'A Doctor Summary you can print',
                    body: 'A clean one-page PDF you can hand to any clinician at any appointment.',
                  },
                ].map(({ Icon, title, body }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-2xl bg-white border border-line p-4 shadow-clinical"
                  >
                    <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                      <Icon size={17} />
                    </div>
                    <div>
                      <div className="font-semibold text-ink text-[14.5px]">
                        {title}
                      </div>
                      <div className="text-[13px] text-ink-soft leading-relaxed mt-0.5">
                        {body}
                      </div>
                    </div>
                  </div>
                ))}

                {/* PDF folded in as sub-feature */}
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white border border-blue-100 p-4 shadow-clinical">
                  <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-600 text-white shrink-0">
                    <Download size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink text-[14px]">
                      Your health data, always accessible
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5">
                      Download as PDF. Share with any doctor. Stored under your
                      anonymous ID.
                    </div>
                  </div>
                  <button
                    onClick={onSample}
                    className="hidden sm:inline-flex items-center gap-1 h-8 px-3 rounded-full bg-blue-50 text-blue-700 text-[12px] font-semibold hover:bg-blue-100 whitespace-nowrap"
                  >
                    See a sample report <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function DoctorSummaryMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-2 rounded-[24px] bg-gradient-to-br from-blue-100/70 via-white to-blue-50 blur-2xl opacity-60 pointer-events-none" />

      <div className="relative rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden">
        {/* Header — Doctor Summary */}
        <div className="px-5 md:px-6 py-4 border-b border-line bg-blue-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-blue-700">
              Doctor Summary · v1
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="font-sans font-bold text-[20px] tracking-[-0.01em]">
              Hormonal Health Snapshot
            </div>
            <div className="text-[11px] text-muted">Patient: FM-A284</div>
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            For: Endocrinologist · 12 Apr 2026 · 1 page
          </div>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 grid md:grid-cols-5 gap-5">
          {/* Left — Top-line read */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl bg-blue-600 text-white p-5 shadow-clinical relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-400/30 blur-2xl" />
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                  Top-line read
                </div>
                <p className="mt-2 font-sans font-semibold text-[15px] leading-snug">
                  Two hormone markers flagged — low free testosterone and
                  vitamin D. Likely connected to fatigue + low libido on
                  intake.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-line p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                Specialist
              </div>
              <div className="mt-2 flex items-start gap-2">
                <Microscope size={14} className="text-ink-soft mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Endocrinologist
                  </div>
                  <div className="text-[11.5px] text-ink-soft leading-snug mt-0.5">
                    Bring this page. Ask about retest in 8 weeks.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Recommended tests with The Why */}
          <div className="md:col-span-3">
            <div className="rounded-2xl bg-white border border-line p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                    Recommended tests
                  </div>
                  <div className="font-sans font-semibold text-[14.5px] mt-1">
                    4 panels — ranked by impact
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2.5">
                <TestRow
                  index="01"
                  name="Hormonal Panel — Total + Free Testosterone, SHBG, LH"
                  reason="Low libido + fatigue + thinning hair pattern."
                  flag="High"
                />
                <TestRow
                  index="02"
                  name="Vitamin D (25-OH) + B12"
                  reason="Energy and mood symptoms; deficiency common in India."
                  flag="High"
                />
                <TestRow
                  index="03"
                  name="Thyroid (TSH · T3 · T4)"
                  reason="Rule out thyroid contribution to fatigue + weight."
                  flag="Med"
                />
                <TestRow
                  index="04"
                  name="HbA1c + Fasting Insulin"
                  reason="Belly fat pattern — check insulin response early."
                  flag="Med"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer ribbon */}
        <div className="px-5 md:px-6 py-3 border-t border-line bg-blue-50/40 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} className="text-blue-600" />
            FM-A284 · Anonymous ID
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Download size={12} className="text-blue-600" />
            Print or save as PDF
          </span>
        </div>
      </div>
    </div>
  );
}

function TestRow({
  index,
  name,
  reason,
  flag,
}: {
  index: string;
  name: string;
  reason: string;
  flag: 'High' | 'Med' | 'Low';
}) {
  const flagTone =
    flag === 'High'
      ? 'bg-concern-soft text-concern border-concern-soft'
      : flag === 'Med'
        ? 'bg-attention-soft text-attention border-attention-soft'
        : 'bg-blue-50 text-blue-700 border-blue-100';
  return (
    <div className="rounded-xl border border-line bg-canvas/40 p-3 flex items-start gap-3">
      <span className="grid place-items-center shrink-0 w-7 h-7 rounded-lg bg-white border border-blue-100 text-blue-700 font-mono text-[10px] font-bold">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans font-semibold text-[13px] text-ink leading-snug">
            {name}
          </span>
          <span
            className={`text-[9.5px] font-bold uppercase tracking-[0.1em] px-1.5 h-4 rounded-full border inline-flex items-center shrink-0 ${flagTone}`}
          >
            {flag}
          </span>
        </div>
        <div className="mt-1 flex items-start gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-blue-700 mt-0.5 shrink-0">
            Why
          </span>
          <span className="text-[12px] text-ink-soft leading-snug">
            {reason}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SECTION 5 — Credibility                                             */
/* ------------------------------------------------------------------ */

function Credibility() {
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
          <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted text-center max-w-2xl mx-auto">
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
        className={`font-sans font-bold text-[56px] md:text-[64px] leading-none tracking-[-0.03em] ${
          accent ? 'text-white' : 'text-blue-700'
        }`}
      >
        {big}
      </div>
      <p
        className={`mt-4 text-[16px] md:text-[17px] leading-snug text-balance ${
          accent ? 'text-white' : 'text-ink'
        }`}
      >
        {line}
      </p>
      <p
        className={`mt-5 pt-4 text-[11.5px] border-t leading-relaxed ${
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

/* ------------------------------------------------------------------ */
/* SECTION 6 — Final CTA                                               */
/* ------------------------------------------------------------------ */

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-cta-gradient shadow-pop">
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />
            <div className="relative px-5 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20 text-center text-white">
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/15 backdrop-blur text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                <Sparkles size={11} /> Free during MVP
              </span>
              <h2 className="font-sans font-bold text-[30px] sm:text-[36px] md:text-[48px] lg:text-[56px] leading-[1.05] tracking-[-0.025em] mt-5 text-balance max-w-[22ch] mx-auto">
                See what your hormones are telling you.
              </h2>
              <p className="mt-5 text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed text-blue-100 max-w-[42ch] mx-auto text-pretty">
                3 minutes. One clear picture.
              </p>

              <div className="mt-8 sm:mt-9 flex justify-center">
                <button
                  onClick={onStart}
                  style={{ height: 56 }}
                  className="inline-flex items-center justify-center gap-2 px-7 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-[15px] font-semibold shadow-clinical-lg transition-colors w-full sm:w-auto"
                >
                  Start the assessment
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-6 text-[12.5px] text-blue-100 inline-flex items-center gap-1.5">
                <Lock size={12} />
                Anonymous ID. No email or phone required. Your data stays yours.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FOOTER                                                              */
/* ------------------------------------------------------------------ */

function Footer({ onSample }: { onSample: () => void }) {
  const [legal, setLegal] = useState<LegalKind | null>(null);
  return (
    <footer className="border-t border-line/70 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-[13px]">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-3 text-ink-soft max-w-xs leading-relaxed">
            Men’s hormonal health, finally explained. By ForMen.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Anonymous by default
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <FlaskConical size={12} /> Grounded in men’s hormone science
            </span>
          </div>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Product</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <a href="#connection" className="hover:text-ink">
                The connection
              </a>
            </li>
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#report" className="hover:text-ink">
                What you’ll get
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={onSample}
                className="hover:text-ink"
              >
                See a sample report
              </button>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Company</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <button
                type="button"
                onClick={() => setLegal('about')}
                className="hover:text-ink"
              >
                About
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('privacy')}
                className="hover:text-ink"
              >
                Privacy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('terms')}
                className="hover:text-ink"
              >
                Terms
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegal('contact')}
                className="hover:text-ink"
              >
                Contact
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 py-6 border-t border-line/70 text-[11.5px] text-muted flex flex-wrap items-center justify-between gap-3">
        <span>
          © {new Date().getFullYear()} ForMen · Digital Clinic. All rights
          reserved.
        </span>
        <span>Educational use only. Not a replacement for a doctor.</span>
      </div>
      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Shared section header                                               */
/* ------------------------------------------------------------------ */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
        <span className="w-6 h-px bg-blue-600" />
        {eyebrow}
      </div>
      <h2 className="font-sans font-bold text-[28px] sm:text-[32px] md:text-[40px] lg:text-[46px] leading-[1.08] tracking-[-0.025em] mt-3 text-balance">
        {title}
      </h2>
      <p className="mt-4 text-[15px] sm:text-[15.5px] md:text-[16.5px] text-ink-soft leading-relaxed max-w-[44ch] text-pretty">
        {subtitle}
      </p>
    </div>
  );
}
