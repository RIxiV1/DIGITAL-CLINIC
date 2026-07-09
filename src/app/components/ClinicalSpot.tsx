import { motion, useReducedMotion } from 'framer-motion';

/**
 * ClinicalSpot — calm editorial spot illustrations for the product's
 * empty / error / loading states.
 *
 * Design rules (the identity the user asked us to protect):
 *   - Objects, never people. Documents, magnifiers, folders, trays,
 *     checkmarks — the vocabulary of a paper clinic chart, not doctors,
 *     hospitals, or mascots. Nothing playful or cartoonish.
 *   - Warm-paper palette: ink line-art on a soft tinted backdrop, one
 *     restrained gold/indigo accent. Reads as "medical, trustworthy,
 *     calm" at a glance — the illustration communicates the state
 *     BEFORE the headline is read.
 *   - 100% inline SVG. The CSP blocks every external host and the
 *     privacy promise is "your report never leaves your device" — so
 *     art is BUNDLED, never fetched. This is also why it's instant,
 *     offline, and recolours with the theme (strokes use theme CSS
 *     vars, so dark mode flips them for free).
 *   - Motion is a whisper: a slow vertical float on the accent group,
 *     disabled entirely under prefers-reduced-motion (anxious users on
 *     budget phones get a still image).
 *
 * These are spot illustrations (~112px), not hero art — they sit above
 * a headline and never compete with it.
 */

export type ClinicalSpotName =
  | 'searching' // read the file, found no lab values (no-matches)
  | 'off-scope' // a valid document, just not a lab panel (out-of-scope)
  | 'blank' // nothing readable came through (no-file / empty)
  | 'damaged' // the file wouldn't open (parser-error)
  | 'all-clear' // nothing needs attention / success
  | 'empty-tray'; // no reports yet (empty dashboard)

const INK = 'var(--color-ink-soft)';
const FAINT = 'var(--color-line)';
const GOLD = 'var(--color-gold-500)';
const ACCENT = 'var(--color-forest)'; // brand indigo #2D3B8E

/* A sheet of paper — the shared base for most spots. Rounded corners,
   a soft header block, ruled lines. Drawn once, reused. */
function Sheet({ lines = 3 }: { lines?: number }) {
  return (
    <>
      <rect
        x="30"
        y="20"
        width="52"
        height="72"
        rx="6"
        fill="var(--color-surface)"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect x="39" y="31" width="26" height="5" rx="2.5" fill={ACCENT} opacity="0.85" />
      {Array.from({ length: lines }).map((_, i) => (
        <line
          key={i}
          x1="39"
          y1={46 + i * 9}
          x2={i % 2 === 0 ? 73 : 63}
          y2={46 + i * 9}
          stroke={FAINT}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

function Art({ name }: { name: ClinicalSpotName }) {
  switch (name) {
    // Magnifier passing over a document — "we read every line, these
    // just weren't lab values". Curiosity, not failure.
    case 'searching':
      return (
        <>
          <Sheet lines={3} />
          <circle cx="76" cy="72" r="16" fill="var(--color-canvas)" stroke={INK} strokeWidth="2.5" />
          <circle cx="76" cy="72" r="16" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.5" />
          <line x1="88" y1="84" x2="99" y2="95" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="76" cy="72" r="4" fill={GOLD} />
        </>
      );

    // A document with a heartbeat trace — "this is a real report, just a
    // different kind than we read". Signals scope, never rejection.
    case 'off-scope':
      return (
        <>
          <g transform="rotate(-7 56 56)">
            <Sheet lines={2} />
            <polyline
              points="39,72 46,72 50,63 56,80 62,66 67,72 74,72"
              fill="none"
              stroke={GOLD}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      );

    // A blank page with a soft dashed outline — "nothing came through
    // yet". Open and waiting, not broken.
    case 'blank':
      return (
        <>
          <rect
            x="30"
            y="20"
            width="52"
            height="72"
            rx="6"
            fill="var(--color-surface)"
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray="1 9"
            strokeLinecap="round"
          />
          <line x1="47" y1="56" x2="65" y2="56" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <line x1="56" y1="47" x2="56" y2="65" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
        </>
      );

    // A page with a gently folded corner — "we couldn't open this one".
    // A dog-eared sheet, not a crash icon.
    case 'damaged':
      return (
        <>
          <path
            d="M30 26 a6 6 0 0 1 6-6 h34 l12 12 v54 a6 6 0 0 1-6 6 H36 a6 6 0 0 1-6-6 Z"
            fill="var(--color-surface)"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M70 20 v6 a6 6 0 0 0 6 6 h6" fill="var(--color-canvas)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="41" y1="52" x2="71" y2="52" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <line x1="41" y1="63" x2="63" y2="63" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <circle cx="56" cy="78" r="3.5" fill={GOLD} />
        </>
      );

    // A page with a soft check badge — reassurance. Used for success and
    // "nothing needs attention".
    case 'all-clear':
      return (
        <>
          <Sheet lines={3} />
          <circle cx="78" cy="76" r="15" fill="var(--color-canvas)" stroke={ACCENT} strokeWidth="2.5" />
          <path
            d="M71 76 l5 5 l9-11"
            fill="none"
            stroke={ACCENT}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );

    // An open folder, empty — "no reports here yet". Tidy and ready.
    case 'empty-tray':
      return (
        <>
          <path
            d="M22 44 h20 l6 8 h28 a5 5 0 0 1 5 5 v27 a5 5 0 0 1-5 5 H27 a5 5 0 0 1-5-5 Z"
            fill="var(--color-surface)"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <line x1="40" y1="34" x2="72" y2="34" stroke={FAINT} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <circle cx="56" cy="70" r="4" fill={GOLD} />
        </>
      );
  }
}

export default function ClinicalSpot({
  name,
  size = 112,
  className,
}: {
  name: ClinicalSpotName;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={`grid place-items-center rounded-[28px] bg-indigo-50/50 ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <motion.svg
        width={size * 0.78}
        height={size * 0.78}
        viewBox="0 0 112 112"
        fill="none"
        role="presentation"
        animate={reduce ? undefined : { y: [0, -3, 0] }}
        transition={reduce ? undefined : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Art name={name} />
      </motion.svg>
    </div>
  );
}
