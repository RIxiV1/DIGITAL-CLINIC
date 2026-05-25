import { lazy, type ComponentType } from 'react';

/** When a user has the app open across a deploy, the in-memory bundle
 *  references chunk hashes that no longer exist on the server. The next
 *  lazy import then throws "Failed to fetch dynamically imported
 *  module" / "error loading dynamically imported module" and lands the
 *  user on the ErrorBoundary. `lazyWithReload` catches that exact
 *  failure and hard-reloads so the browser picks up the new index.html
 *  with the post-deploy chunk URLs.
 *
 *  Guarded by a session-scoped marker so a genuinely broken deploy
 *  doesn't trigger an infinite reload loop — if we already reloaded in
 *  the last RELOAD_GUARD_WINDOW_MS, we let the error propagate to the
 *  boundary, which has its own "Refresh app" CTA. */

const RELOAD_GUARD_KEY = 'dc_lazyReloadAttemptedAt';
const RELOAD_GUARD_WINDOW_MS = 10_000;

export function isChunkLoadError(err: unknown): boolean {
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : String(err);
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported') ||
    msg.includes('Importing a module script failed')
  );
}

function recentlyAttemptedReload(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < RELOAD_GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReloadAttempted(): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — proceed without the guard. Worst
    // case: one extra reload before the boundary takes over.
  }
}

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && !recentlyAttemptedReload()) {
        markReloadAttempted();
        window.location.reload();
        // Never-resolving promise so React doesn't try to render or
        // re-throw while the reload is kicking in.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}
