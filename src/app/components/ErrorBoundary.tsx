import { Component, type ErrorInfo, type ReactNode } from 'react';

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
      return (
        <div className="min-h-screen bg-canvas grid place-items-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-concern-soft text-concern">
              <span className="font-display text-[20px] leading-none">!</span>
            </div>
            <div className="mt-5 text-[10px] uppercase tracking-[0.18em] font-bold text-concern">
              Something broke
            </div>
            <h1 className="font-display text-[24px] leading-tight mt-2 text-balance">
              A page render failed mid-flight.
            </h1>
            <p className="mt-3 text-[13.5px] text-ink-soft leading-relaxed">
              You hit a render error in the app. Try again to get back to a
              clean state — if it keeps happening on the same page, the
              message below is the clue to send back.
            </p>
            <pre className="mt-5 text-left text-[11.5px] leading-relaxed font-mono bg-surface border border-line rounded-2xl p-4 overflow-auto max-h-48">
              {msg}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-indigo-600 text-white text-[13.5px] font-semibold shadow-clinical hover:bg-indigo-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
