import { motion, useReducedMotion } from 'framer-motion';

/**
 * ClinicalSpot — the product's empty / error / loading illustrations.
 *
 * ONE PROTAGONIST. Every state is the SAME sheet of paper, transformed —
 * scanned, folded, magnified, filed, cleared. The user subconsciously
 * follows one object through the whole experience, so the app feels like
 * a single world (the way Apple Health is rings and Levels is a glucose
 * graph). That recognition — "this is Digital Clinic" — is the signature.
 *
 * Design rails (the identity the user asked us to protect):
 *   - Objects, never people. Documents, a magnifier, a folder, a scanner —
 *     the vocabulary of a paper clinic chart. Nothing cartoonish.
 *   - Warm-paper palette, ink line-art, one restrained gold/indigo accent.
 *     Strokes are theme CSS vars, so dark mode recolours for free.
 *   - 100% inline SVG. The CSP blocks external hosts and the promise is
 *     "your report never leaves your device" — so art is BUNDLED, never
 *     fetched. Also why it's instant and offline.
 *   - Motion EXPLAINS the state, it doesn't decorate: the magnifier reads
 *     every line, the scanner sweeps the page, the check settles into
 *     place. All of it is disabled under prefers-reduced-motion — an
 *     anxious user on a budget phone gets a calm still image.
 */

export type ClinicalSpotName =
  | 'searching' // read every line, found no lab values (no-matches)
  | 'off-scope' // a real document, just a different kind (out-of-scope)
  | 'blank' // nothing readable came through (no-file / empty)
  | 'damaged' // the file wouldn't open (parser-error)
  | 'all-clear' // nothing needs attention / success
  | 'empty-tray' // no reports yet (empty dashboard)
  | 'scanning'; // reading your report (loading)

const INK = 'var(--color-ink-soft)';
const FAINT = 'var(--color-line)';
const GOLD = 'var(--color-gold-500)';
const ACCENT = 'var(--color-forest)'; // brand indigo #2D3B8E
const SURFACE = 'var(--color-surface)';
const CANVAS = 'var(--color-canvas)';

/* The protagonist. Identical geometry everywhere so it reads as one
   object changing — rounded sheet, indigo header block, ruled lines. */
function Sheet({ lines = 3 }: { lines?: number }) {
  return (
    <>
      <rect
        x="30"
        y="20"
        width="52"
        height="72"
        rx="6"
        fill={SURFACE}
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

function Art({ name, still }: { name: ClinicalSpotName; still: boolean }) {
  // A looping "draw" for path-based accents (heartbeat, checkmark). Still
  // mode renders them fully drawn.
  const draw = (delay = 0) =>
    still
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0.4 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            duration: 1.4,
            delay,
            repeat: Infinity,
            repeatDelay: 1.6,
            ease: 'easeInOut' as const,
          },
        };

  switch (name) {
    // The magnifier reads every line, left to right — "we read it all,
    // these just weren't lab values." Curiosity, not failure.
    case 'searching':
      return (
        <>
          <Sheet lines={3} />
          <motion.g
            animate={still ? undefined : { x: [-6, 8, -6], y: [0, -2, 0] }}
            transition={
              still
                ? undefined
                : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <circle cx="76" cy="72" r="16" fill={CANVAS} stroke={INK} strokeWidth="2.5" />
            <circle cx="76" cy="72" r="16" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.5" />
            <line x1="88" y1="84" x2="99" y2="95" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="76" cy="72" r="4" fill={GOLD} />
          </motion.g>
        </>
      );

    // The same sheet, but its content is a heartbeat trace — "a real
    // report, just a different kind than we read." The trace draws itself.
    case 'off-scope':
      return (
        <g transform="rotate(-7 56 56)">
          <Sheet lines={2} />
          <motion.polyline
            points="39,72 46,72 50,63 56,80 62,66 67,72 74,72"
            fill="none"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...draw()}
          />
        </g>
      );

    // The sheet, empty and outlined — "nothing came through yet." It
    // breathes gently: open and waiting, not broken.
    case 'blank':
      return (
        <>
          <motion.rect
            x="30"
            y="20"
            width="52"
            height="72"
            rx="6"
            fill={SURFACE}
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray="1 9"
            strokeLinecap="round"
            animate={still ? undefined : { opacity: [0.65, 1, 0.65] }}
            transition={
              still ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <line x1="47" y1="56" x2="65" y2="56" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <line x1="56" y1="47" x2="56" y2="65" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
        </>
      );

    // The sheet with a gently folded corner — "we couldn't open this one."
    // It tilts almost imperceptibly, like paper catching a draught.
    case 'damaged':
      return (
        <motion.g
          style={{ transformOrigin: '56px 56px' }}
          animate={still ? undefined : { rotate: [-1.4, 1.4, -1.4] }}
          transition={
            still ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <path
            d="M30 26 a6 6 0 0 1 6-6 h34 l12 12 v54 a6 6 0 0 1-6 6 H36 a6 6 0 0 1-6-6 Z"
            fill={SURFACE}
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M70 20 v6 a6 6 0 0 0 6 6 h6" fill={CANVAS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="41" y1="52" x2="71" y2="52" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <line x1="41" y1="63" x2="63" y2="63" stroke={FAINT} strokeWidth="3" strokeLinecap="round" />
          <circle cx="56" cy="78" r="3.5" fill={GOLD} />
        </motion.g>
      );

    // The sheet settles onto the desk, then a check draws on — reassurance,
    // earned. Used for success and "nothing needs attention."
    case 'all-clear':
      return (
        <motion.g
          initial={still ? false : { y: -7, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <Sheet lines={3} />
          <circle cx="78" cy="76" r="15" fill={CANVAS} stroke={ACCENT} strokeWidth="2.5" />
          <motion.path
            d="M71 76 l5 5 l9-11"
            fill="none"
            stroke={ACCENT}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: still ? 0 : 0.35, ease: 'easeOut' }}
          />
        </motion.g>
      );

    // The sheet slides down into an open folder — "filed, nothing lost."
    // For the empty archive it's the folder waiting for its first report.
    case 'empty-tray':
      return (
        <>
          <path
            d="M22 44 h20 l6 8 h28 a5 5 0 0 1 5 5 v27 a5 5 0 0 1-5 5 H27 a5 5 0 0 1-5-5 Z"
            fill={SURFACE}
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <line x1="40" y1="34" x2="72" y2="34" stroke={FAINT} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <circle cx="56" cy="70" r="4" fill={GOLD} />
        </>
      );

    // The scanner sweeps the sheet top to bottom — "reading your report,
    // right here." Waiting becomes proof of work.
    case 'scanning':
      return (
        <>
          <Sheet lines={3} />
          <motion.rect
            x="30"
            y="24"
            width="52"
            height="4"
            rx="2"
            fill={GOLD}
            opacity="0.9"
            animate={still ? undefined : { y: [0, 60, 0] }}
            transition={
              still ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }
          />
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
  const still = !!useReducedMotion();
  return (
    <div
      className={`grid place-items-center rounded-[28px] bg-indigo-50/50 ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.78}
        height={size * 0.78}
        viewBox="0 0 112 112"
        fill="none"
        role="presentation"
      >
        <Art name={name} still={still} />
      </svg>
    </div>
  );
}
