import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Adds a 1px top border. Use when the page beneath scrolls into the
   *  bar's area and the gradient fade alone doesn't separate them enough
   *  (e.g. long forms where the CTA sits on top of content rather than
   *  whitespace). Defaults to false. */
  bordered?: boolean;
  /** Swaps the default top-fading gradient for an opaque `bg-canvas`
   *  fill. The gradient is the right choice when content below scrolls
   *  through whitespace before reaching the bar — it fades the page
   *  INTO the bar instead of clipping with a hard edge. But on long
   *  form pages (ManualEntry, future settings screens) the bar sits
   *  on top of white input rows, and the gradient's transparent upper
   *  portion lets the content bleed through, making the CTA look like
   *  it's floating mid-page. `solid` swaps to a flat opaque
   *  background; pair with `bordered` for the clean-edge form-page
   *  treatment. Defaults to false. */
  solid?: boolean;
  /** "normal" → pt-4 pb-4 (~16px each), the standard one-button bar.
   *  "tall"   → pt-5 pb-5 (~20px each), used on screens with stacked
   *  buttons (Back + Skip + Continue) so a wrapped row still has air. */
  padding?: 'normal' | 'tall';
  className?: string;
};

/**
 * Fixed-position bottom container for sticky CTA bars. Used by the
 * Upload, Processing-confirm, ManualEntry, and Quiz pages — all four
 * inlined the same ~70-character class string before this was a
 * component, and the iOS safe-area-inset semantics were documented in
 * exactly zero of them.
 *
 * Layout choices baked in here:
 *   - `position: fixed` + bottom-0 + inset-x-0: pins to viewport.
 *   - z-30: above page content (z-0..z-20) but below modals (z-50).
 *   - bg gradient to transparent at the top (default): page content
 *     fades INTO the bar instead of getting clipped by a hard edge.
 *     Override with `solid` for form pages where the gradient bleed
 *     onto white content would feel wrong.
 *   - `safe-bottom` utility (`padding-bottom: env(safe-area-inset-bottom)`)
 *     adds inset on iPhones with a home-indicator chin. Without it, the
 *     CTA button sits half-under the chin on iPhone X+ devices.
 */
export default function StickyBottomBar({
  children,
  bordered = false,
  solid = false,
  padding = 'normal',
  className = '',
}: Props) {
  const padCls = padding === 'tall' ? 'pt-5 pb-5' : 'pt-4 pb-4';
  const borderCls = bordered ? 'border-t border-line/70' : '';
  const bgCls = solid
    ? 'bg-canvas'
    : 'bg-gradient-to-t from-canvas via-canvas/95 to-transparent';
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 ${bgCls} ${padCls} safe-bottom ${borderCls} ${className}`}
    >
      {children}
    </div>
  );
}
