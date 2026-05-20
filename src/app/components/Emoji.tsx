import type { ReactNode } from 'react';

type Props = {
  /** Plain-text label announced by screen readers in place of the emoji
   *  glyph (e.g. "fire" for 🔥, "lightning" for ⚡). Required — an
   *  unlabelled emoji is one of the most common AT failures. */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * Accessible emoji wrapper.
 *
 * Screen readers handle bare emoji inconsistently — some announce the
 * unicode name, some skip them entirely, some announce a generic
 * "graphic". Wrapping with `role="img"` + `aria-label` gives every AT
 * the same, controllable, human-readable substitute.
 */
export default function Emoji({ label, className, children }: Props) {
  return (
    <span role="img" aria-label={label} className={className}>
      {children}
    </span>
  );
}
