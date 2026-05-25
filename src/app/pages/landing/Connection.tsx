import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
} from 'lucide-react';
import { Reveal, SectionHeader } from './shared';

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

export default function ConnectionSection({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <section
      id="connection"
      className="py-16 sm:py-20 md:py-28 bg-soft-blue-gradient"
    >
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
                <div className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-[0.16em] text-blue-700">
                  <span className="w-5 h-px bg-blue-600" /> Why it matters
                </div>
                <h3 className="font-sans font-bold text-h4 md:text-h3 tracking-[-0.01em] mt-3 text-ink">
                  You’ve been treating these separately.
                </h3>
                <p className="mt-3 text-ui-sm text-ink-soft leading-relaxed">
                  Hair clinic for the hair. Gym for the belly. A bad night
                  followed by another bad night. Each fix targeting one
                  symptom — none of them touching the source.
                </p>
                <ul className="mt-5 grid gap-2.5 text-meta">
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
                  className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-meta font-semibold shadow-clinical transition-colors"
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
export function ConnectionDiagram({ compact = false }: { compact?: boolean }) {
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
          <div className="text-eyebrow uppercase tracking-[0.22em] font-bold text-blue-700">
            Your hormone chain
          </div>
          <div className="text-footnote text-ink-soft font-medium">
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
        <span className="text-eyebrow uppercase tracking-[0.2em] font-bold text-blue-700 whitespace-nowrap">
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
            className="px-3 py-2.5 rounded-xl bg-white border border-line text-center font-semibold text-footnote text-ink shadow-clinical"
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
                className={`text-eyebrow-xs uppercase tracking-[0.22em] font-bold ${
                  isOutput ? 'text-blue-200' : 'text-blue-700'
                }`}
              >
                Stage {num}
              </div>
              <div
                className={`font-display text-ui-lg md:text-body-lg leading-tight mt-1 ${
                  isOutput ? 'text-white' : 'text-ink'
                }`}
              >
                {organ}
              </div>
            </div>
            {isOutput && (
              <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full bg-white/15 text-eyebrow-xs font-bold uppercase tracking-[0.14em] text-blue-100">
                Output
              </span>
            )}
          </div>

          <p
            className={`mt-2 text-footnote leading-relaxed ${
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
              className={`text-eyebrow-xs uppercase tracking-[0.18em] font-bold ${
                isOutput ? 'text-blue-200' : 'text-blue-700'
              }`}
            >
              {verb}
            </span>
            <span
              className={`font-sans font-bold text-ui md:text-ui-lg tracking-[-0.01em] ${
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
              <span className="text-eyebrow-xs uppercase tracking-[0.14em] font-bold text-blue-700">
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
                    className={`text-caption font-semibold leading-tight truncate ${
                      s.isOutput ? 'text-white' : 'text-ink'
                    }`}
                  >
                    {s.organ}
                  </div>
                  <div
                    className={`text-eyebrow-xs font-bold uppercase tracking-[0.1em] mt-0.5 truncate ${
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
        <span className="text-eyebrow-xs uppercase tracking-[0.14em] font-bold text-blue-700">
          Felt as
        </span>
        <span className="flex-1 h-px bg-blue-100" />
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {SYMPTOMS.slice(0, 5).map((label) => (
          <span
            key={label}
            className="text-eyebrow-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold"
          >
            {label}
          </span>
        ))}
        <span className="text-eyebrow-xs text-muted px-1 py-0.5">+ 3 more</span>
      </div>
    </div>
  );
}
