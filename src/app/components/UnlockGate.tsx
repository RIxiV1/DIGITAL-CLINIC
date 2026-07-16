import { useState, type FormEvent } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { useReports } from '../AppContext';
import Button from './ui/Button';
import Container from './ui/Container';
import Logo from './ui/Logo';

/**
 * Full-screen unlock gate. Rendered instead of the app whenever a data
 * lock is armed and this session hasn't unlocked yet (ReportsContext
 * `locked`). The only ways forward are: enter the PIN, or use the
 * forgot-PIN escape hatch (wipe + start over) — the conscious trade-off
 * for at-rest encryption with no server-side recovery.
 */
export default function UnlockGate() {
  const { unlock, wipeAndReset } = useReports();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || pin.length < 4) return;
    setBusy(true);
    setError(false);
    const ok = await unlock(pin);
    if (!ok) {
      // Wrong PIN — clear and let them retry. On success, `locked` flips
      // and this whole gate unmounts, so there's no success branch here.
      setError(true);
      setPin('');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-6 safe-bottom">
      <Container size="narrow" className="w-full">
        <div className="mx-auto max-w-sm text-center">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>
          <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-4">
            <Lock size={20} aria-hidden />
          </div>
          <h1 className="font-display text-display-md leading-tight text-ink">
            Your data is locked.
          </h1>
          <p className="mt-2 text-body-sm text-ink-soft leading-relaxed">
            Enter your PIN to unlock your reports on this device. Nothing
            leaves your device — the PIN decrypts data stored only here.
          </p>

          {!confirmWipe ? (
            <form onSubmit={submit} className="mt-6">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                aria-label="PIN"
                aria-invalid={error || undefined}
                value={pin}
                maxLength={12}
                onChange={(e) => {
                  // Digits only; clear the error as soon as they edit.
                  setPin(e.target.value.replace(/\D/g, ''));
                  if (error) setError(false);
                }}
                placeholder="••••"
                className={`w-full h-14 text-center text-display-md tracking-[0.4em] tabular-nums rounded-[16px] bg-surface border text-ink focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-concern/60 focus:ring-concern/40'
                    : 'border-line focus:ring-indigo-400/60 focus:border-indigo-400'
                }`}
              />
              {error && (
                <p
                  role="alert"
                  className="mt-2 text-caption text-concern font-medium"
                >
                  That PIN didn’t match. Try again.
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                variant="primary"
                disabled={busy || pin.length < 4}
                className="mt-5 w-full"
              >
                {busy ? 'Unlocking…' : 'Unlock'}
              </Button>
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="mt-4 text-caption text-muted hover:text-ink underline underline-offset-2 min-h-11"
              >
                Forgot your PIN?
              </button>
            </form>
          ) : (
            <div className="mt-6 text-left">
              <div className="flex items-start gap-3 rounded-2xl bg-concern-soft border border-concern/30 px-4 py-3">
                <ShieldAlert
                  size={18}
                  className="text-concern shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-caption text-ink leading-relaxed">
                  There’s no PIN recovery — the data is encrypted on this
                  device only. Resetting <strong>permanently clears</strong>{' '}
                  your saved reports here. You can re-upload them afterward.
                </p>
              </div>
              <Button
                size="lg"
                variant="primary"
                onClick={wipeAndReset}
                className="mt-5 w-full !bg-concern hover:!bg-concern/90"
              >
                Reset &amp; clear my data
              </Button>
              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="mt-4 w-full text-caption text-muted hover:text-ink min-h-11"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
