import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  Lock,
  Microscope,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useApp } from '../AppContext';

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
  const { navigate } = useApp();
  const startQuiz = () => navigate({ type: 'quiz' });
  const viewSample = () => navigate({ type: 'results', reportId: 'rep-001' });

  return (
    <div className="min-h-screen bg-white text-ink overflow-x-hidden">
      <TopNav onStart={startQuiz} onSample={viewSample} />
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
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-line/70">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 h-16 flex items-center justify-between">
        <Logo />
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
            See a sample
          </button>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold shadow-clinical transition-colors"
          >
            Find out in 3 min
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
    <section className="relative bg-hero-grid">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-12 sm:pt-16 md:pt-24 pb-16 md:pb-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-12 gap-10 md:gap-14 items-center"
        >
          {/* LEFT — Headline + CTAs */}
          <div className="lg:col-span-7">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white border border-blue-100 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-blue-700 shadow-clinical">
                <span className="relative grid place-items-center w-3.5 h-3.5">
                  <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-blue-600" />
                </span>
                Men’s Hormonal Health
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-sans font-bold text-[34px] sm:text-[44px] md:text-[56px] lg:text-[60px] leading-[1.04] tracking-[-0.025em] mt-5 text-ink text-balance"
            >
              Your hair loss, your fatigue, and your sex drive
              <span className="text-blue-700"> might be the same problem.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-[16px] md:text-[18px] leading-relaxed text-ink-soft max-w-[42ch] text-pretty"
            >
              One hormonal system controls all three. Most Indian men have never
              had it tested.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-7 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3"
            >
              <button
                onClick={onStart}
                style={{ height: 54 }}
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
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <FlaskConical size={13} className="text-blue-600" />
                Built on HPG-axis endocrinology
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600" />
                Anonymous ID · no email needed
              </span>
            </motion.div>
          </div>

          {/* RIGHT — Connection visual preview */}
          <motion.div variants={fadeUp} className="lg:col-span-5">
            <HeroVisual />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-blue-100/80 via-white to-blue-50 blur-2xl opacity-70 pointer-events-none" />
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-line/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="text-[11px] font-semibold text-muted">
            Hormonal health map
          </div>
          <div className="w-12" />
        </div>
        <div className="p-5">
          <ConnectionDiagram compact />
          <p className="mt-4 text-center font-sans text-[12.5px] font-semibold text-ink">
            One system. Eight signals.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SECTION 2 — The Connection (the central insight)                    */
/* ------------------------------------------------------------------ */

const SYMPTOMS: Array<{ label: string; angle: number }> = [
  { label: 'Hair loss', angle: -90 },
  { label: 'Low libido', angle: -45 },
  { label: 'Belly fat', angle: 0 },
  { label: 'Infertility', angle: 45 },
  { label: 'Low energy', angle: 90 },
  { label: 'ED', angle: 135 },
  { label: 'Poor sleep', angle: 180 },
  { label: 'Brain fog', angle: -135 },
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
            subtitle="The HPG axis — your body’s hormonal control loop — connects all of them. The Digital Clinic helps you understand yours."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <Reveal>
              <ConnectionDiagram />
            </Reveal>
          </div>

          <div className="lg:col-span-5">
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

function ConnectionDiagram({ compact = false }: { compact?: boolean }) {
  // Geometry tuned so the widest label ("Low libido" / "Low energy") still has
  // visual clearance from the container edge at every viewport — including
  // narrow phones (≥ 320px viewport → container ≈ 280px after page padding).
  // Hub is percentage-based so it scales with the wrapper, keeping the
  // hub-edge → spoke-start gap consistent on every breakpoint.
  const labelRadius = compact ? 38 : 36;
  const spokeStart = compact ? 18 : 17;
  const lineEndRadius = compact ? 27 : 25;
  const hubSizePct = compact ? 30 : 28;
  const labelTextCls = compact
    ? 'text-[10px]'
    : 'text-[11.5px] md:text-[12.5px]';
  const labelPadCls = compact ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const wrapperCls = compact
    ? 'aspect-square w-full max-w-[260px]'
    : 'aspect-square w-full max-w-[440px]';

  return (
    <div className={`relative mx-auto ${wrapperCls}`}>
      <span className="sr-only">
        Eight symptoms — hair loss, low libido, belly fat, infertility, low
        energy, erectile dysfunction, poor sleep, and brain fog — radiate from
        one central HPG-axis hub. They are signals from the same hormonal
        system.
      </span>
      {/* Spoke lines as SVG behind */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        aria-hidden
      >
        {SYMPTOMS.map((s, i) => {
          const rad = (s.angle * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * spokeStart;
          const y1 = 50 + Math.sin(rad) * spokeStart;
          const x2 = 50 + Math.cos(rad) * lineEndRadius;
          const y2 = 50 + Math.sin(rad) * lineEndRadius;
          return (
            <motion.line
              key={s.label}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgb(0,102,204)"
              strokeWidth="0.4"
              strokeDasharray="0.8 0.8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.7 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.06 }}
            />
          );
        })}
      </svg>

      {/* Hub — percentage-sized so the hub-to-spoke gap stays consistent */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full grid place-items-center text-white text-center shadow-blue"
        style={{
          width: `${hubSizePct}%`,
          height: `${hubSizePct}%`,
          background:
            'radial-gradient(120% 120% at 30% 20%, #3D95FF 0%, #0066CC 60%, #0052A3 100%)',
        }}
      >
        <div className="px-2">
          <div
            className={`font-sans font-bold leading-tight ${
              compact ? 'text-[11px]' : 'text-[13px] md:text-[15px]'
            }`}
          >
            Your hormones
          </div>
          <div
            className={`uppercase tracking-[0.16em] font-semibold mt-1 text-blue-100 ${
              compact ? 'text-[7px]' : 'text-[9px] md:text-[10px]'
            }`}
          >
            HPG axis
          </div>
        </div>
      </motion.div>

      {/* Symptom labels */}
      {SYMPTOMS.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const left = 50 + Math.cos(rad) * labelRadius;
        const top = 50 + Math.sin(rad) * labelRadius;
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.45,
              delay: 0.5 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ left: `${left}%`, top: `${top}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={`whitespace-nowrap rounded-full bg-white border border-blue-100 font-semibold text-ink shadow-clinical ${labelPadCls} ${labelTextCls}`}
            >
              {s.label}
            </div>
          </motion.div>
        );
      })}
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
                    className="hidden sm:inline-flex items-center gap-1 h-8 px-3 rounded-full bg-blue-50 text-blue-700 text-[12px] font-semibold hover:bg-blue-100"
                  >
                    Sample <ChevronRight size={12} />
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
                <span className="text-blue-700">not stock photos.</span>
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
              <FlaskConical size={12} /> Built on HPG-axis science
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
              <button onClick={onSample} className="hover:text-ink">
                Sample report
              </button>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Company</div>
          <ul className="space-y-2 text-ink-soft">
            <li>About</li>
            <li>Privacy</li>
            <li>Terms</li>
            <li>Contact</li>
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
