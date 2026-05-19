type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** 'dark' = brand indigo on a transparent background (default).
   *  'light' = white on a dark background (for indigo cards/heroes). */
  tone?: 'dark' | 'light';
};

/**
 * Brand wordmark — the stacked "for / — / men" mark in brand indigo.
 * Same visual as the favicon, rendered inline as SVG so it stays crisp
 * at every size and inherits the tone via CSS color.
 *
 * Uses Georgia (a serif that ships with every OS) so we don't depend on
 * a Google Font request to render the mark.
 */
export default function Logo({ size = 'md', tone = 'dark' }: Props) {
  // Square dimensions per size variant — kept compact so the mark sits
  // nicely in headers and on settings rows.
  const dim =
    size === 'sm'
      ? { w: 30, h: 32 }
      : size === 'md'
        ? { w: 38, h: 40 }
        : { w: 52, h: 56 };

  const color = tone === 'dark' ? '#2D3B8E' : '#FFFFFF';

  return (
    <span
      className="inline-block select-none align-middle"
      aria-label="ForMen · Digital Clinic"
      style={{ width: dim.w, height: dim.h }}
    >
      <svg
        viewBox="0 0 64 64"
        width="100%"
        height="100%"
        role="img"
        aria-hidden
      >
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
