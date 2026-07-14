/* Theme bootstrap — stamps `data-theme` onto <html> before the React
 * bundle parses (and before first paint) so the page carries the user's
 * persisted theme with no light <-> dark flash.
 *
 * Why this is an EXTERNAL file and not an inline <script>: the production
 * CSP is `script-src 'self'` with no 'unsafe-inline'. An inline bootstrap
 * is silently blocked in prod — `data-theme` never gets set and the
 * bootstrap doesn't run at all (dev has no CSP, so it looked fine locally
 * — a dev/prod divergence). A same-origin file satisfies 'self' with no
 * CSP hash to maintain. Keep it dependency-free and loaded synchronously
 * in <head> so it executes before paint.
 *
 * Default: an explicit saved choice always wins; otherwise ForMen opens in
 * the INSTRUMENT dark world — the deliberate, distinctive brand identity
 * (cool instrument-navy, periwinkle, coral/amber readouts). Light warm-paper
 * stays one tap away via the Profile toggle for anyone who prefers it (it
 * also avoids the light-on-dark halation astigmatic readers can get). Must
 * match loadTheme() in persistence.ts exactly, or first paint will flash.
 */
(function () {
  var theme;
  try {
    var saved = localStorage.getItem('dc_theme');
    // Explicit user choice always wins; otherwise default to Instrument dark.
    theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  } catch (e) {
    /* Private mode / quota / disabled storage → the Instrument default. */
    theme = 'dark';
  }
  document.documentElement.dataset.theme = theme;

  /* Keep the mobile-browser top-bar tint in sync with the canvas.
     Mirrors `--color-canvas` from the [data-theme] blocks in index.css;
     ProfilePage's toggle does the same flip on each runtime switch. */
  var themeColor = theme === 'light' ? '#F7F4EF' : '#0F1320';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
})();
