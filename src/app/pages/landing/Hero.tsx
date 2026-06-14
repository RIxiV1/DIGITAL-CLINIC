import { type ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight,
  ChevronRight,
  CircleDot,
  Droplet,
  FlaskConical,
  Lock,
  Sparkles,
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
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-surface border border-blue-100 text-caption font-semibold uppercase tracking-label text-blue-700 shadow-clinical">
                <span className="relative grid place-items-center w-3.5 h-3.5">
                  <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-blue-600" />
                </span>
                Men's Hormonal Health
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-sans font-bold text-display-lg sm:text-display-xl leading-[1.06] tracking-tight mt-5 text-ink text-balance"
            >
              Your hair loss, your fatigue, and your sex drive{' '}
              {/* Single gradient accent — used exactly once, on the
                  payoff phrase of the headline. Blue-700 → blue-500 →
                  gold-600 mirrors the brand stack (clinical blue
                  anchor + premium gold edge) and gives the headline a
                  visual hierarchy boost without resorting to a second
                  color or a heavier weight. Repeating this treatment
                  on every heading is the slop the user warned about
                  — keep it scarce. */}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, var(--color-blue-700) 0%, var(--color-blue-500) 55%, var(--color-gold-600) 100%)',
                }}
              >
                might be the same problem.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-4 text-body md:text-body-lg leading-relaxed text-ink-soft max-w-[40ch] text-pretty"
            >
              You’re not alone, and you’re not broken. One hormonal system
              quietly drives all three — answer a few private questions for a
              clear, science-backed read on what’s going on. No account, no
              judgment.
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
                className="w-full sm:w-auto shadow-blue"
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
  // Mouse-tracking spotlight on the Hormonal Health Map card below.
  // Two motion values store the cursor's position relative to the
  // card; useMotionTemplate builds the radial-gradient CSS string,
  // and the motion.div's `style={{ background }}` subscribes via
  // framer-motion's signal graph. The component itself does NOT
  // re-render on each mousemove — that's the win over a raw
  // onMouseMove → setState pattern, which would force a React render
  // ~60 times a second for the duration of any cursor sweep. (The
  // DOM still gets a style mutation per frame; that work happens on
  // the compositor, not the React tree.)
  //
  // Disabled entirely when prefers-reduced-motion is set — the
  // listener is gone, the overlay isn't rendered. Users who opt out
  // of motion don't get a moving glow they didn't ask for.
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(240px circle at ${mouseX}px ${mouseY}px, rgba(0, 102, 204, 0.14), transparent 65%)`;
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - r.left);
    mouseY.set(e.clientY - r.top);
  };

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

      {/* Hormonal Health Map card — overlaps the photo. Depicts a
          "window-chrome" mockup of the in-app hormonal-axis visual,
          like a screenshot pasted onto the hero. */}
      <div
        onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
        className="group absolute left-0 sm:-left-4 bottom-[18%] sm:bottom-[22%] w-[78%] sm:w-[72%] rounded-2xl bg-surface border border-line shadow-clinical-lg overflow-hidden"
      >
        {/* Spotlight overlay. Pointer-events-none so it never blocks
            interaction; opacity gated by the parent's :hover (via
            Tailwind's group-hover) so the glow only appears when the
            cursor is over the card — no React state involved. */}
        {!prefersReducedMotion && (
          <motion.div
            aria-hidden
            style={{ background: spotlight }}
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {/* Mac-style window chrome */}
        <div className="px-3.5 py-2 border-b border-line/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
            <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
            <span className="w-2 h-2 rounded-full bg-[#28C840]" />
          </div>
          <div className="text-micro font-semibold text-ink">
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
