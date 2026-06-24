import { useState } from 'react';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** 'dark' = brand-coloured wordmark on transparent (default).
   *  'light' = inverted to white for dark backgrounds. */
  tone?: 'dark' | 'light';
};

/**
 * Brand wordmark — the stacked "for / — / men" mark.
 *
 * Loading strategy:
 *  - First tries /formen-logo.png from /public (drop your high-fidelity
 *    PNG there to use it everywhere).
 *  - If that 404s, falls back to an inline SVG wordmark in brand indigo
 *    using Georgia (system serif) — so the page never looks broken
 *    even before the PNG is uploaded.
 */
export default function Logo({ size = 'md', tone = 'dark' }: Props) {
  const [pngFailed, setPngFailed] = useState(false);

  const heightPx = size === 'sm' ? 28 : size === 'md' ? 36 : 48;
  // SVG fallback: `currentColor` so the wordmark inherits the ink tone of
  // its context (theme-adaptive) instead of the old baked-in brand indigo.
  const color = tone === 'dark' ? 'currentColor' : '#FFFFFF';

  if (pngFailed) {
    // Inline SVG wordmark fallback — same shape as the favicon.
    // viewBox is 80x80 so "men" at font-size 34 in Georgia doesn't
    // clip on the right edge (previously 64x64 was too narrow).
    const w = Math.round(heightPx * 1.0);
    return (
      <span
        className="inline-flex items-center align-middle select-none text-ink"
        aria-label="ForMen · Digital Clinic"
        style={{ width: w, height: heightPx }}
      >
        <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden>
          <text
            x="6"
            y="28"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="22"
            fontWeight="600"
            fill={color}
          >
            for
          </text>
          <rect x="6" y="32" width="28" height="3.5" rx="1.75" fill={color} />
          <text
            x="6"
            y="70"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="34"
            fontWeight="700"
            fill={color}
          >
            men
          </text>
        </svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center align-middle select-none"
      aria-label="ForMen · Digital Clinic"
    >
      <img
        src="/formen-logo.png"
        alt="ForMen"
        draggable={false}
        onError={() => setPngFailed(true)}
        style={{ height: heightPx }}
        className={`w-auto block ${tone === 'light' ? 'invert brightness-0' : 'logo-mark'}`}
      />
    </span>
  );
}
