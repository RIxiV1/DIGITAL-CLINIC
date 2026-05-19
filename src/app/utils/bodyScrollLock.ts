/**
 * Ref-counted body scroll lock. Multiple modals can call acquire() while
 * open; the lock only releases when the last one calls release().
 *
 * Why this exists: setting `document.body.style.overflow = 'hidden'`
 * naively means whichever component closes last wins — if modal A opens,
 * modal B opens (capturing overflow='hidden' as its "previous" value),
 * then B closes (restores to 'hidden'), then A closes (restores to '' if
 * its captured value was ''), the body ends up scrollable while B is
 * gone but A is logically still locked. Today we only render one modal
 * at a time, but this guards against future regressions and stacked
 * sheets.
 */

let lockCount = 0;
let prevOverflow: string | null = null;

export function acquireBodyScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = prevOverflow ?? '';
      prevOverflow = null;
    }
  };
}
