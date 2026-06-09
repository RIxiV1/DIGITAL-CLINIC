import { Component, type ErrorInfo, type ReactNode } from 'react';
import Illustration from './Illustration';
import { isChunkLoadError } from '../utils/lazyWithReload';
import { wipeAllData } from '../utils/persistence';
import { clearPendingUpload } from '../services/api';

type Props = { children: ReactNode };
type State = {
  error: Error | null;
  /** Wall-clock of the most recent crash, used to detect "I just hit
   *  the reset button and crashed again" — the classic poisoned-
   *  localStorage signature. */
  lastCrashAt: number;
  /** Count of crashes seen since the last successful render. After 2
   *  in a 10-second window we surface the "Reset local data" escape
   *  hatch so a poisoned `dc_*` record can't permanently brick the
   *  app from inside. */
  consecutiveCrashes: number;
};

/** Repeated-crash window — within this many ms a second crash counts
 *  as "the reset didn't help." Wide enough to catch the user actually
 *  reading the error and tapping retry; narrow enough that a crash
 *  hours later doesn't count as consecutive. */
const REPEAT_CRASH_WINDOW_MS = 10_000;

/**
 * Top-level safety net so a render error in any page surfaces a visible
 * message + Reload button instead of an empty white screen. Without this,
 * a crash anywhere in the tree leaves the user staring at nothing.
 *
 * After two crashes in a short window we offer a "Reset local data"
 * button — the canonical signature of a poisoned localStorage record
 * (zod validation would catch most of these on load, but the
 * ErrorBoundary is the last line for anything that slips through, like
 * a runtime invariant that depends on data shape we don't yet validate
 * in the persistence layer).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lastCrashAt: 0, consecutiveCrashes: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the dev console for diagnosis. Production users still get
    // the visible UI below, which is the important thing.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught a render error:', error, info);
    // Use Date.now() in a class lifecycle (not during render) so we
    // can detect a rapid-fire repeat crash for the "wipe data" hint.
    const now = Date.now();
    this.setState((prev) => {
      const isRepeat =
        prev.lastCrashAt > 0 && now - prev.lastCrashAt < REPEAT_CRASH_WINDOW_MS;
      return {
        lastCrashAt: now,
        consecutiveCrashes: isRepeat ? prev.consecutiveCrashes + 1 : 1,
      };
    });
  }

  reset = () => {
    // Clear the error so the children re-render. Previously we also
    // forced window.location.reload(), which threw away in-memory
    // navigation history + quiz answers. Now the user gets back to a
    // clean tree without losing their context.
    //
    // We deliberately keep `consecutiveCrashes` intact so if the same
    // render crashes immediately, render() can promote the "Reset
    // local data" affordance — a hard recovery for the poisoned-
    // storage case where ordinary reset just re-crashes.
    this.setState({ error: null });
  };

  resetAndWipe = () => {
    // Last-ditch recovery: wipe all dc_* localStorage keys and the in-
    // memory File handoff, then hard-reload so every context rehydrates
    // from a clean slate. The reload is intentional — clearing state in
    // place would not re-trigger context initialisers, and the same
    // bad shape would re-cause whatever crash brought us here.
    try {
      wipeAllData();
      clearPendingUpload();
    } catch {
      /* swallow — the reload is what guarantees recovery */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const msg =
        this.state.error.message ||
        this.state.error.toString() ||
        'Unknown error';
      // Chunk-load failures usually mean a stale deploy — the user had
      // the app open when we shipped and is now holding chunk URLs that
      // no longer exist. lazyWithReload tries one auto-reload first;
      // by the time we land here it already fired, so the fix is a
      // full-page refresh (which bypasses the in-memory module cache).
      const isChunkError = isChunkLoadError(this.state.error);
      const showWipeRecovery =
        !isChunkError && this.state.consecutiveCrashes >= 2;
      const hardReload = () => window.location.reload();
      return (
        <div className="min-h-dvh bg-canvas grid place-items-center px-6 py-12">
          <div className="max-w-md text-center">
            <Illustration
              src="/illustrations/error-warning.svg"
              className="mx-auto w-40 sm:w-48 h-auto"
            />
            <div className="mt-6 text-micro uppercase tracking-eyebrow font-bold text-concern">
              {isChunkError ? 'New version available' : 'Something broke'}
            </div>
            <h1 className="font-display text-display-md leading-tight mt-2 text-balance">
              {isChunkError
                ? 'We just shipped an update.'
                : showWipeRecovery
                  ? 'That keeps crashing.'
                  : 'A page render failed mid-flight.'}
            </h1>
            <p className="mt-3 text-caption text-ink-soft leading-relaxed">
              {isChunkError
                ? "Your browser is still on the previous version of the app. Refresh to load the latest — you won't lose any saved reports."
                : showWipeRecovery
                  ? 'Looks like something in your saved data is causing the crash. Resetting clears everything stored in this browser — reports, quiz answers, prefs — and reloads from scratch. You can re-upload your reports afterwards.'
                  : 'You hit a render error in the app. Try again to get back to a clean state — if it keeps happening on the same page, the message below is the clue to send back.'}
            </p>
            {!isChunkError && (
              <pre className="mt-5 text-left text-caption leading-relaxed font-mono bg-surface border border-line rounded-2xl p-4 overflow-auto max-h-48">
                {msg}
              </pre>
            )}
            <div className="mt-5 flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={isChunkError ? hardReload : this.reset}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-indigo-600 text-on-primary text-caption font-semibold shadow-clinical hover:bg-indigo-700 transition-colors"
              >
                {isChunkError ? 'Refresh app' : 'Try again'}
              </button>
              {showWipeRecovery && (
                <button
                  type="button"
                  onClick={this.resetAndWipe}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-surface border border-concern/40 text-concern text-caption font-semibold hover:bg-concern-soft/60 transition-colors"
                >
                  Reset local data and reload
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
