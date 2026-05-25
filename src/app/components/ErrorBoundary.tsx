import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError } from '../utils/lazyWithReload';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level safety net so a render error in any page surfaces a visible
 * message + Reload button instead of an empty white screen. Without this,
 * a crash anywhere in the tree leaves the user staring at nothing.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the dev console for diagnosis. Production users still get
    // the visible UI below, which is the important thing.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught a render error:', error, info);
  }

  reset = () => {
    // Clear the error so the children re-render. Previously we also
    // forced window.location.reload(), which threw away in-memory
    // navigation history + quiz answers. Now the user gets back to a
    // clean tree without losing their context.
    this.setState({ error: null });
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
      const hardReload = () => window.location.reload();
      return (
        <div className="min-h-dvh bg-canvas grid place-items-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-concern-soft text-concern">
              <span className="font-display text-display-md leading-none">!</span>
            </div>
            <div className="mt-5 text-micro uppercase tracking-[0.18em] font-bold text-concern">
              {isChunkError ? 'New version available' : 'Something broke'}
            </div>
            <h1 className="font-display text-display-md leading-tight mt-2 text-balance">
              {isChunkError
                ? 'We just shipped an update.'
                : 'A page render failed mid-flight.'}
            </h1>
            <p className="mt-3 text-caption text-ink-soft leading-relaxed">
              {isChunkError
                ? "Your browser is still on the previous version of the app. Refresh to load the latest — you won't lose any saved reports."
                : 'You hit a render error in the app. Try again to get back to a clean state — if it keeps happening on the same page, the message below is the clue to send back.'}
            </p>
            {!isChunkError && (
              <pre className="mt-5 text-left text-caption leading-relaxed font-mono bg-surface border border-line rounded-2xl p-4 overflow-auto max-h-48">
                {msg}
              </pre>
            )}
            <button
              type="button"
              onClick={isChunkError ? hardReload : this.reset}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-indigo-600 text-white text-caption font-semibold shadow-clinical hover:bg-indigo-700 transition-colors"
            >
              {isChunkError ? 'Refresh app' : 'Try again'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
