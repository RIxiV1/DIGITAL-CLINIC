import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { useReports } from '../AppContext';
import Button from './Button';

/**
 * Profile row for the opt-in at-rest data lock. Off by default. Setting a
 * PIN encrypts the saved reports on this device; turning it off rewrites
 * them as plaintext. The unlock-at-every-open + no-recovery trade-offs
 * are stated inline so enabling it is an informed choice.
 */
export default function DataLockSetting() {
  const { lockEnabled, enableLock, disableLock } = useReports();
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setSetupOpen(false);
    setPin('');
    setConfirm('');
    setErr(null);
  };

  const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 12);

  const onEnable = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pin.length < 4) {
      setErr('Use at least 4 digits.');
      return;
    }
    if (pin !== confirm) {
      setErr('Those PINs don’t match.');
      return;
    }
    setBusy(true);
    await enableLock(pin);
    setBusy(false);
    reset();
  };

  const onDisable = async () => {
    if (busy) return;
    setBusy(true);
    await disableLock();
    setBusy(false);
  };

  const inputCls =
    'h-11 px-3 rounded-xl bg-canvas border border-line text-body-sm text-ink text-center tracking-[0.3em] tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400';

  return (
    <div className="px-5 py-4 border-b border-line/70">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
          <Lock size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-body-sm">
            Lock my data with a PIN
          </div>
          <div className="text-caption text-muted text-pretty">
            {lockEnabled
              ? 'On — your reports are encrypted on this device and need the PIN each time you open the app.'
              : 'Encrypts your saved reports on this device. You’ll enter the PIN each time you open the app. There’s no PIN recovery — forgetting it means starting over.'}
          </div>
        </div>
        {lockEnabled ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={onDisable}
            disabled={busy}
            className="shrink-0"
          >
            {busy ? '…' : 'Turn off'}
          </Button>
        ) : (
          !setupOpen && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setSetupOpen(true)}
              className="shrink-0"
            >
              Set PIN
            </Button>
          )
        )}
      </div>

      {!lockEnabled && setupOpen && (
        <form onSubmit={onEnable} className="mt-3 flex flex-col gap-2">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-label="New PIN"
            placeholder="PIN (4+ digits)"
            value={pin}
            onChange={(e) => {
              setPin(onlyDigits(e.target.value));
              if (err) setErr(null);
            }}
            className={inputCls}
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Confirm PIN"
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => {
              setConfirm(onlyDigits(e.target.value));
              if (err) setErr(null);
            }}
            className={inputCls}
          />
          {err && (
            <p role="alert" className="text-caption text-concern font-medium">
              {err}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? 'Enabling…' : 'Enable lock'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={reset}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
