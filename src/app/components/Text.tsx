import type { ElementType, ReactNode } from 'react';

/**
 * Typography atom.
 *
 * One component that consumes the 8 semantic type tokens declared in
 * src/index.css (--text-micro, --text-caption, --text-body-sm,
 * --text-body, --text-body-lg, --text-display-md, --text-display-lg,
 * --text-display-xl) and renders them through a polymorphic element.
 *
 * Why this exists:
 *   - Enforces the scale at write time. New code writes
 *     `<Text variant="body">…</Text>` instead of remembering whether
 *     "body" is `text-body`, `text-body-sm`, or `text-body-lg`. The
 *     TypeScript `Variant` union surfaces the legal options inline.
 *   - Centralizes the role-to-element mapping. We default `as` per
 *     variant (display sizes → <h1>/<h2>, captions → <span>) so the
 *     DOM picks up sensible semantics without each call site
 *     remembering. Callers can override with `as` for the rare cases
 *     that need a different element (e.g. a display-sized number
 *     inside a <div>).
 *   - Gives a single place to evolve typography defaults — adding
 *     letter-spacing or default line-heights per variant later flips
 *     this file, not 200+ call sites.
 *
 * What this is NOT:
 *   - Required for existing code. The 35 files migrated by the prior
 *     pass use bare `className="text-body"` strings; those keep
 *     working unchanged. <Text> is opt-in for new writes.
 *   - A wrapper around <p>/<h1>/<h2> with hardcoded margins. Layout
 *     belongs to the parent; Text only handles font size + a sensible
 *     element default.
 */

type Variant =
  | 'micro'
  | 'caption'
  | 'body-sm'
  | 'body'
  | 'body-lg'
  | 'display-md'
  | 'display-lg'
  | 'display-xl';

/** Default HTML element for each variant. Display sizes pick the
 *  heading level that usually surrounds them; body sizes default to
 *  <p>; caption / micro to <span>. Callers can override with `as`. */
const defaultElementByVariant: Record<Variant, ElementType> = {
  micro: 'span',
  caption: 'span',
  'body-sm': 'p',
  body: 'p',
  'body-lg': 'p',
  'display-md': 'h3',
  'display-lg': 'h2',
  'display-xl': 'h1',
};

type Props = {
  variant: Variant;
  /** Override the default HTML element. Use sparingly — the variant
   *  default is right ~90% of the time. */
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

export default function Text({ variant, as, className = '', children }: Props) {
  const Element = as ?? defaultElementByVariant[variant];
  return (
    <Element className={`text-${variant} ${className}`}>{children}</Element>
  );
}
