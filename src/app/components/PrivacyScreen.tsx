import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import Logo from './Logo';
import { useDiscreet } from '../AppContext';

/**
 * Discreet Mode privacy veil.
 *
 * When Discreet Mode is on, this covers ALL content the instant the app
 * loses focus or is backgrounded — the app-switcher snapshot, an alt-tab,
 * a glance away — and lifts the moment the user returns.
 *
 * V1 is an *away-state* veil, not a passcode lock: it addresses the most
 * common "someone might see my screen" fear (shoulder-surfing, the OS app
 * switcher preview), which is exactly the 2 AM context — phone dimmed,
 * terrified a passer-by glances over. A real passcode/biometric lock that
 * also gates *re-entry* on the same device is a heavier, later layer.
 *
 * `blur`/`pagehide` fire BEFORE the OS captures the switcher thumbnail, so
 * the veil is already up in that snapshot. `focus` + a visible document
 * lift it. Listeners only attach while Discreet Mode is on.
 */
export default function PrivacyScreen() {
  const { discreet, concealNonce } = useDiscreet();
  const [concealed, setConcealed] = useState(false);
  // "Manual" = the user tapped Hide now (works even with Discreet Mode off).
  // A manual veil does NOT auto-lift on focus — only an explicit tap/Esc
  // dismisses it. The away-state (Discreet) veil keeps lifting on return.
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);
  manualRef.current = manual;

  const dismiss = useCallback(() => {
    setManual(false);
    setConcealed(false);
  }, []);

  // Manual "hide now" — raise the veil immediately on each concealNonce bump
  // (skip the initial 0). Independent of the Discreet setting.
  useEffect(() => {
    if (concealNonce === 0) return;
    setManual(true);
    setConcealed(true);
  }, [concealNonce]);

  // Away-state veil — only while Discreet Mode is on.
  useEffect(() => {
    if (!discreet) return;
    const conceal = () => setConcealed(true);
    const reveal = () => {
      // Never auto-lift a manual veil; only the away-state one.
      if (
        !manualRef.current &&
        document.visibilityState === 'visible' &&
        document.hasFocus()
      ) {
        setConcealed(false);
      }
    };
    const onVisibility = () =>
      document.visibilityState === 'hidden' ? conceal() : reveal();

    window.addEventListener('blur', conceal);
    window.addEventListener('focus', reveal);
    window.addEventListener('pagehide', conceal);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', conceal);
      window.removeEventListener('focus', reveal);
      window.removeEventListener('pagehide', conceal);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [discreet]);

  // Esc dismisses a manual veil (desktop quick-exit).
  useEffect(() => {
    if (!concealed || !manual) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [concealed, manual, dismiss]);

  if (!concealed) return null;

  const body = (
    <div className="flex flex-col items-center gap-3 text-muted">
      <Logo size="md" />
      <div className="inline-flex items-center gap-1.5 text-caption font-medium">
        <Lock size={13} />
        Hidden for privacy
      </div>
      {manual && (
        <div className="text-micro text-muted/80">Tap anywhere to return</div>
      )}
    </div>
  );

  // z above everything (skip-link is z-[100], modals z-50) so no health
  // content can peek through. Opaque, theme-aware canvas — a calm,
  // content-free screen, not an alarm. A manual veil is a tappable button
  // (tap to return); the away-state veil is passive + aria-hidden.
  return manual ? (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Hidden for privacy — tap to return"
      className="fixed inset-0 z-[200] grid place-items-center bg-canvas no-print"
    >
      {body}
    </button>
  ) : (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-canvas no-print"
    >
      {body}
    </div>
  );
}
