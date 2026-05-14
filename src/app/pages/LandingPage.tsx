import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Brain,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  Lock,
  Microscope,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Stethoscope,
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

      <HowItWorks />

      <QuizPreview onStart={startQuiz} />

      <ReportPreview />

      <PdfFeature onSample={viewSample} />

      <Testimonials />

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
          <a href="#how" className="hover:text-ink transition-colors">
            How it works
          </a>
          <a href="#quiz" className="hover:text-ink transition-colors">
            The quiz
          </a>
          <a href="#report" className="hover:text-ink transition-colors">
            Your report
          </a>
          <a href="#trust" className="hover:text-ink transition-colors">
            Trust
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={onSample}
            className="hidden md:inline-flex items-center h-10 px-4 rounded-full text-[13px] font-semibold text-ink-soft hover:text-ink hover:bg-blue-50 transition-colors"
          >
            View Sample
          </button>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold shadow-clinical transition-colors"
          >
            Start Free
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* HERO                                                                */
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
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 sm:pt-14 md:pt-20 pb-14 sm:pb-16 md:pb-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
        >
          {/* LEFT — copy */}
          <div>
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white border border-blue-100 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-blue-700 shadow-clinical">
                <span className="relative grid place-items-center w-3.5 h-3.5">
                  <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-blue-600" />
                </span>
                AI-Powered Health Analysis
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-sans font-bold text-[34px] sm:text-[42px] md:text-[52px] lg:text-[60px] leading-[1.04] tracking-[-0.025em] mt-5 text-ink text-balance"
            >
              Understand Your Health
              <br className="hidden md:block" />{' '}
              <span className="text-blue-700">Before Symptoms</span> Become Problems.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-[15.5px] sm:text-[16px] md:text-[18px] leading-relaxed text-ink-soft max-w-[34rem] text-pretty"
            >
              Get personalized, clinically-backed health insights and
              recommended medical tests in minutes — without waiting weeks for
              a consult.
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
                Start Free Health Analysis
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
              <button
                onClick={onSample}
                style={{ height: 54 }}
                className="inline-flex items-center justify-center gap-2 px-6 rounded-full bg-white border border-line text-ink hover:border-blue-400 hover:text-blue-700 text-[15px] font-semibold shadow-clinical transition-all w-full sm:w-auto"
              >
                View Sample Report
              </button>
            </motion.div>

            {/* Inline doctor testimonial — trust hook directly under CTAs */}
            <motion.div
              variants={fadeUp}
              className="mt-8 rounded-2xl bg-white border border-line p-5 shadow-clinical max-w-[34rem]"
            >
              <div className="flex items-start gap-3">
                <DoctorAvatar initials="AV" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-[14.5px] leading-relaxed text-ink">
                    “Digital Clinic bridges the gap between curiosity and
                    clinical action.”
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[12px]">
                    <span className="font-semibold text-ink">
                      Dr. Aris Vance, MD
                    </span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">Preventive Medicine</span>
                    <BadgeCheck size={13} className="text-blue-600" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-blue-600" />
                Doctor-reviewed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600" />
                HIPAA-grade privacy
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={13} className="text-blue-600" />
                Free during MVP
              </span>
            </motion.div>
          </div>

          {/* RIGHT — Hero mockup */}
          <motion.div variants={fadeUp}>
            <HeroMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DoctorAvatar({ initials }: { initials: string }) {
  return (
    <div className="relative shrink-0">
      <div className="w-11 h-11 rounded-full grid place-items-center bg-blue-50 text-blue-700 font-semibold text-[14px] border border-blue-100">
        {initials}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-600 grid place-items-center ring-2 ring-white">
        <Stethoscope size={9} className="text-white" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HOW IT WORKS — 2 simple steps                                       */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="How it works"
            title="Get Your Health Analysis in 2 Simple Steps"
            subtitle="From phone-in-hand to a doctor-grade analysis — under five minutes."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 relative">
          {/* Connector line (md+) */}
          <div className="hidden md:block absolute top-1/2 left-[12%] right-[12%] h-px border-t-2 border-dashed border-blue-200/80 -translate-y-1/2 pointer-events-none" />

          <div className="grid md:grid-cols-2 gap-5 relative">
            <Reveal>
              <StepCard
                step="01"
                Icon={ClipboardList}
                title="Take the Guided Health Quiz"
                body="Answer tailored questions regarding your current symptoms, lifestyle habits, and medical history through an intuitive interface."
                bullets={[
                  'Adaptive, branching question flow',
                  'Skip anything you’d rather not share',
                  'About 2 minutes, on any device',
                ]}
              />
            </Reveal>
            <Reveal delay={0.08}>
              <StepCard
                step="02"
                Icon={Sparkles}
                title="Receive Your Personalized Insights"
                body="Instantly unlock an AI-synthesized health report outlining recommended clinical tests, risk indicators, and actionable next steps."
                bullets={[
                  'AI-synthesized · clinician-reviewed',
                  'Plain-English explanations',
                  'Specific, doable next steps',
                ]}
                emphasized
              />
            </Reveal>
          </div>
        </div>

        <Reveal>
          <div className="mt-12 flex items-center justify-center gap-2 text-[13px] text-muted">
            <BadgeCheck size={15} className="text-blue-600" />
            <span>Built with clinicians from AIIMS, Apollo and Cleveland Clinic.</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StepCard({
  step,
  Icon,
  title,
  body,
  bullets,
  emphasized,
}: {
  step: string;
  Icon: React.ElementType;
  title: string;
  body: string;
  bullets: string[];
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
        className={`mt-6 font-sans font-bold text-[22px] md:text-[24px] tracking-[-0.01em] leading-tight ${
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
      <ul className="mt-6 grid gap-2">
        {bullets.map((b) => (
          <li
            key={b}
            className={`flex items-center gap-2 text-[13.5px] ${
              emphasized ? 'text-blue-100' : 'text-ink-soft'
            }`}
          >
            <CheckCircle2
              size={15}
              className={emphasized ? 'text-blue-200' : 'text-blue-600'}
            />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* QUIZ PREVIEW — Active + Pending states                              */
/* ------------------------------------------------------------------ */

function QuizPreview({ onStart }: { onStart: () => void }) {
  return (
    <section id="quiz" className="py-16 sm:py-20 md:py-28 bg-soft-blue-gradient">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="The Quiz"
            title="A Seamless, Stress-Free Experience"
            subtitle="Three short sections, each built around the answers you’ve already given. Most users finish in under two minutes."
          />
        </Reveal>

        {/* Step indicator (mini progress shown above cards) */}
        <Reveal>
          <div className="mt-10 max-w-md mx-auto md:mx-0 flex items-center gap-2">
            <ProgressDot state="active" label="01" />
            <span className="flex-1 h-px border-t-2 border-dashed border-blue-200" />
            <ProgressDot state="pending" label="02" />
            <span className="flex-1 h-px border-t-2 border-dashed border-blue-200" />
            <ProgressDot state="pending" label="03" />
          </div>
        </Reveal>

        {/* Cards */}
        <div className="mt-6 md:mt-8 grid md:grid-cols-3 gap-5">
          <Reveal>
            <QuizCardActive />
          </Reveal>
          <Reveal delay={0.07}>
            <QuizCardPending
              number="02"
              Icon={Activity}
              title="Lifestyle & Habits"
              subtext="12 quick questions"
            />
          </Reveal>
          <Reveal delay={0.14}>
            <QuizCardPending
              number="03"
              Icon={HeartPulse}
              title="Medical Background"
              subtext="Family history & past labs"
            />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-10 text-center">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold shadow-clinical transition-colors"
            >
              Try the quiz now
              <ArrowRight size={14} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProgressDot({
  state,
  label,
}: {
  state: 'active' | 'pending' | 'done';
  label: string;
}) {
  if (state === 'active') {
    return (
      <span className="relative grid place-items-center w-8 h-8 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0 ring-4 ring-blue-100">
        {label}
        <span className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping" />
      </span>
    );
  }
  return (
    <span className="grid place-items-center w-8 h-8 rounded-full bg-white border border-blue-100 text-blue-400 text-[11px] font-bold shrink-0">
      {label}
    </span>
  );
}

function QuizCardActive() {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative h-full rounded-2xl bg-white border-2 border-blue-600 p-6 md:p-7 shadow-blue overflow-hidden"
    >
      <span className="absolute top-4 right-4 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.1em]">
        <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Active
      </span>

      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-11 h-11 rounded-2xl bg-blue-600 text-white">
          <HeartPulse size={18} />
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-blue-600">
            Section 01
          </span>
          <div className="font-sans font-bold text-[17px] tracking-[-0.01em] text-ink leading-tight">
            Symptoms &amp; Concerns
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        <ChecklistRow checked label="Fatigue" />
        <ChecklistRow label="Sleep Disruption" />
        <ChecklistRow checked label="Foggy Mind" />
        <ChecklistRow label="Frequent Headaches" />
      </div>

      <div className="mt-5 pt-4 border-t border-line/70 flex items-center justify-between text-[11.5px]">
        <span className="text-muted font-medium">2 of 4 selected</span>
        <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
          Continue <ChevronRight size={13} />
        </span>
      </div>
    </motion.div>
  );
}

function ChecklistRow({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={`flex items-center gap-3 h-11 px-3.5 rounded-xl border transition-colors ${
        checked
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-line hover:border-blue-200'
      }`}
    >
      {checked ? (
        <CheckSquare size={18} className="text-blue-600 shrink-0" strokeWidth={2.5} />
      ) : (
        <Square size={18} className="text-blue-200 shrink-0" strokeWidth={2.5} />
      )}
      <span
        className={`text-[13.5px] font-medium ${
          checked ? 'text-blue-700' : 'text-ink-soft'
        }`}
      >
        {label}
      </span>
    </motion.div>
  );
}

function QuizCardPending({
  number,
  Icon,
  title,
  subtext,
}: {
  number: string;
  Icon: React.ElementType;
  title: string;
  subtext: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative h-full rounded-2xl bg-white border border-line p-6 md:p-7 shadow-clinical"
    >
      <span className="absolute top-4 right-4 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-canvas border border-line text-muted text-[10px] font-bold uppercase tracking-[0.1em]">
        Pending
      </span>

      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-11 h-11 rounded-2xl bg-blue-50 text-blue-400 border border-blue-100">
          <Icon size={18} />
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted">
            Section {number}
          </span>
          <div className="font-sans font-bold text-[17px] tracking-[-0.01em] text-ink leading-tight">
            {title}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        <div className="h-11 rounded-xl bg-canvas border border-line/70 flex items-center px-3.5 gap-3">
          <Square size={18} className="text-blue-100 shrink-0" strokeWidth={2.5} />
          <div className="h-2.5 rounded-full bg-line w-3/4" />
        </div>
        <div className="h-11 rounded-xl bg-canvas border border-line/70 flex items-center px-3.5 gap-3">
          <Square size={18} className="text-blue-100 shrink-0" strokeWidth={2.5} />
          <div className="h-2.5 rounded-full bg-line w-2/3" />
        </div>
        <div className="h-11 rounded-xl bg-canvas border border-line/70 flex items-center px-3.5 gap-3">
          <Square size={18} className="text-blue-100 shrink-0" strokeWidth={2.5} />
          <div className="h-2.5 rounded-full bg-line w-1/2" />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line/70 text-[12px] text-muted font-medium">
        {subtext}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* REPORT PREVIEW — dashboard with "The Why"                           */
/* ------------------------------------------------------------------ */

function ReportPreview() {
  return (
    <section id="report" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="Your Report"
            title="Your Health, Translated into Plain English"
            subtitle="A clean, structured dashboard — not a wall of numbers. Every recommendation comes with a plain-language reason."
          />
        </Reveal>

        <div className="mt-12 md:mt-16">
          <Reveal>
            <ReportMockup />
          </Reveal>
        </div>

        <div className="mt-12 grid md:grid-cols-4 gap-5">
          {[
            {
              Icon: Sparkles,
              title: 'Analysis Summary',
              body: 'A clean score and status indicator — at-a-glance clarity.',
            },
            {
              Icon: Microscope,
              title: 'Recommended Tests',
              body: 'Specific panels tailored to your symptoms and history.',
            },
            {
              Icon: Brain,
              title: 'The "Why" Behind Each',
              body: 'A plain-English reason tied to your exact quiz inputs.',
            },
            {
              Icon: ShieldCheck,
              title: 'Risk Indicators',
              body: 'Clear, calibrated, non-alarmist — focus on what matters.',
            },
          ].map((row, i) => (
            <Reveal key={row.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl bg-white border border-line p-5 shadow-clinical">
                <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                  <row.Icon size={17} />
                </div>
                <div className="mt-4 font-sans font-semibold text-[14.5px] text-ink">
                  {row.title}
                </div>
                <p className="mt-1.5 text-[12.5px] text-ink-soft leading-relaxed">
                  {row.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-2 rounded-[24px] bg-gradient-to-br from-blue-100/70 via-white to-blue-50 blur-2xl opacity-60 pointer-events-none" />

      <div className="relative rounded-2xl bg-white border border-line shadow-clinical-lg overflow-hidden">
        {/* Top bar */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-line/70 bg-blue-50/40">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted">
            <span>Comprehensive Analysis</span>
            <span>·</span>
            <span>12 Apr 2026</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
              <BadgeCheck size={11} /> Doctor-reviewed
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-white border border-line text-blue-700">
              <Download size={13} />
            </span>
          </div>
        </div>

        <div className="p-5 md:p-7 grid lg:grid-cols-5 gap-5">
          {/* LEFT — Summary + Risk indicators */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary card */}
            <div className="rounded-2xl bg-blue-600 text-white p-5 shadow-clinical relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-400/30 blur-2xl" />
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                  Analysis Summary
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <Donut score={78} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                      Health Score
                    </div>
                    <div className="font-sans font-bold text-[26px] leading-none mt-1">
                      78<span className="text-blue-200 text-[14px]">/100</span>
                    </div>
                    <div className="text-[11.5px] text-blue-100 mt-1.5">
                      Mostly on track
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-blue-50">
                  Two markers to act on first — Vitamin D and LDL. Both are
                  reversible inside 12 weeks.
                </p>
              </div>
            </div>

            {/* Risk indicators */}
            <div className="rounded-2xl bg-white border border-line p-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                  Risk Indicators
                </div>
                <span className="text-[11px] text-muted font-medium">
                  3 areas
                </span>
              </div>
              <div className="mt-3 space-y-2.5">
                <RiskRow label="Cardiovascular" risk="Low" />
                <RiskRow label="Metabolic" risk="Moderate" />
                <RiskRow label="Nutritional (Vitamin D)" risk="Attention" />
              </div>
            </div>
          </div>

          {/* RIGHT — Recommended tests + Why column */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white border border-line p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                    Recommended Tests
                  </div>
                  <div className="font-sans font-semibold text-[15px] mt-1">
                    Four panels, ranked by impact
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 hidden sm:inline-flex items-center gap-1">
                  See all 6 <ChevronRight size={13} />
                </span>
              </div>

              <div className="mt-4 grid gap-2.5">
                <RecommendedTestRow
                  index="01"
                  name="Vitamin D3 & B12 Panel"
                  reason="Persistent fatigue + foggy mind noted in your quiz."
                  fasting={false}
                />
                <RecommendedTestRow
                  index="02"
                  name="Comprehensive Lipid Profile"
                  reason="Family history of cardiac events + sedentary lifestyle."
                  fasting
                />
                <RecommendedTestRow
                  index="03"
                  name="Thyroid Function (TSH · T3 · T4)"
                  reason="Unexplained weight retention + chronic low energy pattern."
                  fasting={false}
                />
                <RecommendedTestRow
                  index="04"
                  name="HbA1c & Fasting Insulin"
                  reason="Early markers of insulin resistance — caught reversibly."
                  fasting
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="absolute -right-3 -top-3 md:-right-5 md:-top-5 rounded-2xl bg-white border border-line shadow-clinical px-3 py-2 flex items-center gap-2"
      >
        <div className="grid place-items-center w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
          <BadgeCheck size={16} />
        </div>
        <div className="pr-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            Reviewed by
          </div>
          <div className="text-[12px] font-semibold">Dr. A. Vance, MD</div>
        </div>
      </motion.div>
    </div>
  );
}

function RecommendedTestRow({
  index,
  name,
  reason,
  fasting,
}: {
  index: string;
  name: string;
  reason: string;
  fasting: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas/40 p-3.5 flex items-start gap-3">
      <span className="grid place-items-center shrink-0 w-8 h-8 rounded-lg bg-white border border-blue-100 text-blue-700 font-mono text-[11px] font-bold">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans font-semibold text-[13.5px] text-ink">
            {name}
          </span>
          {fasting && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-[0.08em] border border-blue-100">
              Fasting
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-start gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-700 mt-0.5 shrink-0">
            Why
          </span>
          <span className="text-[12.5px] text-ink-soft leading-snug">
            {reason}
          </span>
        </div>
      </div>
    </div>
  );
}

function RiskRow({ label, risk }: { label: string; risk: string }) {
  const tone =
    risk === 'Low'
      ? { bar: 'bg-blue-600', tag: 'bg-blue-50 text-blue-700 border-blue-100' }
      : risk === 'Moderate'
        ? { bar: 'bg-attention', tag: 'bg-attention-soft text-attention border-attention-soft' }
        : {
            bar: 'bg-concern',
            tag: 'bg-concern-soft text-concern border-concern-soft',
          };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full ${tone.bar}`} />
        <span className="text-[13px] text-ink font-medium truncate">{label}</span>
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2 h-5 rounded-full border inline-flex items-center ${tone.tag}`}
      >
        {risk}
      </span>
    </div>
  );
}

function Donut({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="relative shrink-0">
      <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90">
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="7"
        />
        <motion.circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeDasharray={`${filled} ${c - filled}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          whileInView={{ strokeDasharray: `${filled} ${c - filled}` }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center text-white">
          <div className="font-sans font-bold text-[16px] leading-none">
            {score}
          </div>
          <div className="text-[8px] uppercase tracking-[0.14em] text-blue-100 mt-0.5">
            score
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HERO mockup (compact)                                               */
/* ------------------------------------------------------------------ */

function HeroMockup() {
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
            Your Health Report
          </div>
          <div className="w-12" />
        </div>

        <div className="p-5">
          <div className="rounded-2xl bg-blue-600 text-white p-4 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-blue-400/30 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <Donut score={78} />
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                  Health Score
                </div>
                <div className="font-sans font-bold text-[20px] mt-1 leading-none">
                  78<span className="text-blue-200 text-[12px]">/100</span>
                </div>
                <p className="mt-2 text-[11.5px] text-blue-50 leading-snug">
                  Mostly on track. Two actions priority.
                </p>
              </div>
            </div>
          </div>

          {/* Tests preview */}
          <div className="mt-4 grid gap-2">
            {[
              { name: 'Vitamin D3 & B12 Panel', tag: 'Fatigue' },
              { name: 'Lipid Profile', tag: 'Heart risk' },
              { name: 'Thyroid (TSH/T3/T4)', tag: 'Energy' },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.45 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line bg-white"
              >
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-100">
                  0{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink truncate">
                    {t.name}
                  </div>
                  <div className="text-[10.5px] text-muted">
                    Why: {t.tag} flagged in quiz
                  </div>
                </div>
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating reviewed badge */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="absolute -left-3 top-12 md:-left-6 rounded-2xl bg-white border border-line shadow-clinical-lg px-3 py-2 flex items-center gap-2"
      >
        <div className="grid place-items-center w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
          <BadgeCheck size={16} />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            Doctor-reviewed
          </div>
          <div className="text-[12px] font-semibold">Within 24 hours</div>
        </div>
      </motion.div>

      {/* Floating tests badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="absolute -right-3 -bottom-3 md:-right-6 md:-bottom-6 rounded-2xl bg-white border border-line shadow-clinical-lg px-4 py-3"
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          Recommended Next
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            6
          </span>
          <span className="font-semibold text-[13px]">clinical tests</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF FEATURE                                                         */
/* ------------------------------------------------------------------ */

function PdfFeature({ onSample }: { onSample: () => void }) {
  return (
    <section className="py-16 sm:py-20 md:py-28 bg-blue-50/40 border-y border-line/70">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-14 items-center">
        <Reveal className="md:col-span-7">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border border-blue-100 text-[11px] font-bold tracking-[0.14em] uppercase text-blue-700 shadow-clinical">
            <Download size={11} /> Portable & Shareable
          </span>
          <h2 className="font-sans font-bold text-[28px] sm:text-[32px] md:text-[38px] lg:text-[44px] leading-[1.06] tracking-[-0.025em] mt-4 text-balance">
            Take Your Data to Your Next Doctor’s Appointment.
          </h2>
          <p className="mt-5 text-[15px] sm:text-[16px] text-ink-soft leading-relaxed text-pretty max-w-[44ch]">
            Your data belongs to you. Export a beautifully formatted, clinically
            structured PDF report to share with your primary care physician or
            specialist.
          </p>

          <ul className="mt-7 grid gap-3">
            {[
              {
                Icon: FileText,
                title: 'Clinically structured layout',
                body: 'Organized the way doctors read — summary first, then evidence.',
              },
              {
                Icon: ShieldCheck,
                title: 'Yours, always',
                body: 'Encrypted at rest. Download or delete any time.',
              },
              {
                Icon: BadgeCheck,
                title: 'Doctor-ready',
                body: 'Brings the conversation forward — no time wasted on context.',
              },
            ].map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-blue-100 text-blue-700 shrink-0 shadow-clinical">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="font-semibold text-ink">{title}</div>
                  <div className="text-[13.5px] text-ink-soft leading-relaxed">
                    {body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.08} className="md:col-span-5">
          <PdfMicroCard onSample={onSample} />
        </Reveal>
      </div>
    </section>
  );
}

function PdfMicroCard({ onSample }: { onSample: () => void }) {
  return (
    <div className="relative max-w-sm mx-auto md:ml-auto md:mr-0">
      <motion.div
        animate={{ rotate: [-1, -2, -1], y: [0, -3, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-2xl bg-white border border-line shadow-clinical -rotate-2"
      />
      <div className="relative rounded-2xl bg-white border border-line shadow-clinical-lg p-5">
        <div className="flex items-start gap-3">
          <div className="relative grid place-items-center w-12 h-14 rounded-lg bg-blue-600 text-white shadow-clinical">
            <FileText size={20} />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm bg-white text-blue-700 border border-blue-100">
              PDF
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-sans font-semibold text-[13.5px] text-ink truncate">
              Health-Report-Apr-2026.pdf
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              12 pages · 482 KB · Doctor-ready
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 h-4 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[9.5px] font-bold uppercase tracking-[0.08em]">
              <CheckCircle2 size={10} /> Ready
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="h-2 rounded-full bg-line w-3/5" />
          <div className="h-1.5 rounded-full bg-line w-full" />
          <div className="h-1.5 rounded-full bg-line w-11/12" />
          <div className="h-1.5 rounded-full bg-line w-9/12" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[78, 62, 90].map((p, i) => (
            <div
              key={i}
              className="rounded-lg bg-blue-50/60 border border-blue-100 p-2"
            >
              <div className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-blue-700">
                Marker
              </div>
              <div className="font-sans font-bold text-[15px] mt-0.5 leading-none text-ink">
                {p}%
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onSample}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold shadow-clinical transition-colors"
        >
          <Download size={15} /> Download PDF
        </button>
      </div>

      {/* Folded corner */}
      <div className="absolute -right-2 -top-2 w-10 h-10 rounded-tr-2xl rounded-bl-xl bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 shadow-clinical" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TESTIMONIALS — only 2                                               */
/* ------------------------------------------------------------------ */

function Testimonials() {
  return (
    <section id="trust" className="py-16 sm:py-20 md:py-28 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <SectionHeader
            eyebrow="Trusted by patients & practitioners"
            title="The reactions speak for themselves."
            subtitle="From users who finally got clarity, and the clinicians who recommend the tool to their own patients."
          />
        </Reveal>

        <div className="mt-12 md:mt-16 grid md:grid-cols-2 gap-5">
          <Reveal>
            <TestimonialCard
              quote="Digital Clinic helped me identify exactly which blood panels to ask my doctor for. Saved me weeks of guesswork."
              initials="ST"
              name="Sarah T."
              role="Verified User"
              tagLabel="Verified User"
              accent="patient"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <TestimonialCard
              quote="As a practitioner, I love how this tool prepares patients with clear, organized data before they even step into my office."
              initials="ML"
              name="Dr. Marcus Lang, MD"
              role="Practicing Physician"
              tagLabel="Verified Clinician"
              accent="doctor"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  quote,
  initials,
  name,
  role,
  tagLabel,
  accent,
}: {
  quote: string;
  initials: string;
  name: string;
  role: string;
  tagLabel: string;
  accent: 'patient' | 'doctor';
}) {
  const isDoc = accent === 'doctor';
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="h-full rounded-2xl bg-white border border-line p-6 sm:p-7 md:p-8 shadow-clinical"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={13} className="fill-blue-600 text-blue-600" />
          ))}
        </div>
        <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-[0.1em]">
          <BadgeCheck size={11} /> {tagLabel}
        </span>
      </div>

      <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed text-ink text-pretty">
        “{quote}”
      </p>

      <div className="mt-6 pt-5 border-t border-line/70 flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-full grid place-items-center font-semibold text-[13px] border ${
            isDoc
              ? 'bg-blue-50 text-blue-700 border-blue-100'
              : 'bg-canvas text-ink-soft border-line'
          }`}
        >
          {initials}
        </div>
        <div>
          <div className="font-semibold text-[14px] text-ink">{name}</div>
          <div className="text-[12px] text-muted">{role}</div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* FINAL CTA                                                           */
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
                Get Personalized Health Insights Today.
              </h2>
              <p className="mt-5 text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed text-blue-100 max-w-[42ch] mx-auto text-pretty">
                Join thousands taking proactive control of their well-being.
              </p>

              <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={onStart}
                  style={{ height: 56 }}
                  className="inline-flex items-center justify-center gap-2 px-7 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-[15px] font-semibold shadow-clinical-lg transition-colors w-full sm:w-auto"
                >
                  Start Your Health Assessment
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-6 text-[12.5px] text-blue-100 inline-flex items-center gap-1.5">
                <Lock size={12} />
                Secure &amp; Private. Data encrypted.
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
            AI-powered, doctor-reviewed health analysis. Built for people who
            want to know — proactively.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={12} /> HIPAA-grade
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Encrypted
            </span>
          </div>
        </div>
        <div>
          <div className="font-semibold text-ink mb-3">Product</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#quiz" className="hover:text-ink">
                The quiz
              </a>
            </li>
            <li>
              <a href="#report" className="hover:text-ink">
                Your report
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
        <span>© {new Date().getFullYear()} Digital Clinic. All rights reserved.</span>
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
