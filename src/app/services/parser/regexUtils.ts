/**
 * Tiny regex helpers shared across the parser modules.
 *
 * Split out so the catalog matcher, the OCR page-boundary display strip,
 * and the out-of-scope classifier can each escape a literal for use inside
 * a RegExp without any of them owning the helper (or duplicating it).
 */

/** Escape a string for literal use inside a `RegExp`. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
