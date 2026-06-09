/**
 * Ref-counted, iOS-safe body scroll lock.
 *
 * The previous implementation set `document.body.style.overflow = 'hidden'`
 * which works on desktop but is NOT enough on iOS Safari — touch-based
 * rubber-band scrolling still works underneath the modal, and the page
 * jumps back to top once the modal closes.
 *
 * The iOS-safe pattern instead pins the body in place with
 * `position: fixed; top: -scrollY; width: 100%`. That gives us:
 *
 *   - No rubber-band on touch (body can't scroll because it's fixed)
 *   - The page stays visually at the same Y while the lock is active
 *     (because we translate the body up by the captured scrollY)
 *   - On release, we restore the original styles AND scroll the window
 *     back to the captured Y, so the user lands exactly where they were.
 *
 * Ref-counting still applies — if modal A opens, then B opens on top,
 * then B closes, A's lock holds until A also releases. Only the first
 * acquire snapshots the body styles + scrollY; only the last release
 * restores them.
 *
 * "Without breaking absolute touch bounds": the modal itself is
 * `position: fixed; inset: 0` so it's anchored to the visual viewport
 * regardless of body's positioning. Internal modal scroll (the
 * `overflow-y-auto` content area) has its own scroll context and
 * keeps working normally.
 */

type Saved = {
  overflow: string;
  position: string;
  top: string;
  width: string;
  /** Scroll position at the moment the first lock was acquired. */
  scrollY: number;
};

let lockCount = 0;
let saved: Saved | null = null;

export function acquireBodyScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    const body = document.body;
    saved = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      scrollY: window.scrollY,
    };

    // The translate-up keeps the visible content at the same Y. Without
    // this, the page would visually jump to the top when body goes
    // position:fixed (since fixed elements ignore the document's scroll).
    body.style.position = 'fixed';
    body.style.top = `-${saved.scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0 && saved) {
      const body = document.body;
      const restored = saved;
      saved = null;
      // Restore styles BEFORE the scrollTo, otherwise the browser
      // sees body still position:fixed and ignores the scroll request
      // on some engines.
      body.style.overflow = restored.overflow;
      body.style.position = restored.position;
      body.style.top = restored.top;
      body.style.width = restored.width;
      // 'instant' so we don't smooth-scroll back — the user perceives
      // the modal closing AND the page snapping into place as one
      // continuous motion, not a two-stage animation.
      window.scrollTo({
        left: 0,
        top: restored.scrollY,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  };
}
