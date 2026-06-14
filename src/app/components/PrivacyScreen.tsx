import { useEffect, useState } from 'react';
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
  const { discreet } = useDiscreet();
  const [concealed, setConcealed] = useState(false);

  useEffect(() => {
    if (!discreet) {
      setConcealed(false);
      return;
    }
    const conceal = () => setConcealed(true);
    const reveal = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
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

  if (!discreet || !concealed) return null;

  // z above everything (skip-link is z-[100], modals z-50) so no health
  // content can peek through. Opaque, theme-aware canvas — a calm,
  // content-free screen, not an alarm.
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-canvas no-print"
    >
      <div className="flex flex-col items-center gap-3 text-muted">
        <Logo size="md" />
        <div className="inline-flex items-center gap-1.5 text-caption font-medium">
          <Lock size={13} />
          Hidden for privacy
        </div>
      </div>
    </div>
  );
}
