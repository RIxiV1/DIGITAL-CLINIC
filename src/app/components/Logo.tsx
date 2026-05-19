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
  const color = tone === 'dark' ? '#2D3B8E' : '#FFFFFF';

  if (pngFailed) {
    // Inline SVG wordmark fallback — same shape as the favicon.
    const w = Math.round(heightPx * 0.95);
    return (
      <span
        className="inline-flex items-center align-middle select-none"
        aria-label="ForMen · Digital Clinic"
        style={{ width: w, height: heightPx }}
      >
        <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
          <text
            x="4"
            y="26"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="22"
            fontWeight="600"
            fill={color}
          >
            for
          </text>
          <rect x="4" y="30" width="28" height="3.5" rx="1.75" fill={color} />
          <text
            x="4"
            y="60"
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
        className={`w-auto block ${tone === 'light' ? 'invert brightness-0' : ''}`}
      />
    </span>
  );
}
