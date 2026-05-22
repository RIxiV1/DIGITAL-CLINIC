import { useEffect, useRef, type RefObject } from 'react';
import { acquireBodyScrollLock } from './bodyScrollLock';

/**
 * Selector matching anything keyboard-focusable. Identical to the
 * inlined list that used to live in every modal — pulled out so the
 * three callers don't drift apart over time.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(
    el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((node) => !node.hasAttribute('aria-hidden'));
}

type Options<T extends HTMLElement> = {
  /** True when the modal is mounted/visible. When false the hook tears
   *  down its listener, scroll lock, and restore-focus side effects. */
  open: boolean;
  /** Ref to the dialog card. Focus trap looks for focusables among its
   *  descendants. */
  cardRef: RefObject<T | null>;
  /** Called on Escape. The hook stashes this in a ref so the effect
   *  doesn't tear down + re-setup every parent render (a passing arrow
   *  function would otherwise churn the keydown listener + body-style
   *  mutations every time the parent re-renders). */
  onClose: () => void;
  /** Optional ref to focus on open. When omitted, focuses the first
   *  focusable descendant of cardRef — handy for confirm dialogs where
   *  the safe button is the natural first stop. Modals with a dedicated
   *  close button pass that button's ref here. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Shared a11y boilerplate for modal dialogs:
 *   - Esc closes (stopPropagation so a parent listener can't react too)
 *   - Tab / Shift+Tab focus-trap that wraps inside the card
 *   - Body scroll lock (ref-counted via acquireBodyScrollLock, so
 *     stacked modals don't fight each other)
 *   - On open: focuses initialFocusRef if provided, else the first
 *     focusable in the card
 *   - On close: restores focus to whichever element had it pre-open
 *
 * Previously this was inlined in DataPanelModal, LearnMoreModal, and
 * QuizPage's ExitConfirm — ~50 lines of identical boilerplate × 3.
 * Extracting kept the contract identical (no behavioural deltas) and
 * means future a11y fixes (e.g., handling autofocusable inputs) land in
 * one place.
 */
export function useModalA11y<T extends HTMLElement>({
  open,
  cardRef,
  onClose,
  initialFocusRef,
}: Options<T>): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Capture pre-open focus owner so we can return focus on close.
    // Skip <body> — restoring there is a no-op and we don't want to
    // mistake it for a real trigger.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = focusablesIn(cardRef.current);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Wrap focus around the card so keyboard users can't tab into the
      // (visually hidden) page underneath the modal.
      if (e.shiftKey && (active === first || !cardRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const releaseScrollLock = acquireBodyScrollLock();

    // 30ms timeout lets framer-motion's enter animation begin before we
    // jump focus — without the wait the focus move can race the layout
    // and land on an element that isn't visible yet.
    const id = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ?? focusablesIn(cardRef.current)[0] ?? null;
      target?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
      window.clearTimeout(id);
      // Restore focus. preventScroll so the page doesn't jump (we just
      // released the scroll lock; the page is already at the right Y).
      // rAF waits for the exit animation's first frame so the focus
      // move doesn't race the unmount.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        requestAnimationFrame(() => {
          previouslyFocused.focus({ preventScroll: true });
        });
      }
    };
  }, [open, cardRef, initialFocusRef]);
}
