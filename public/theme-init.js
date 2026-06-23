/* Theme bootstrap — stamps `data-theme` onto <html> before the React
 * bundle parses (and before first paint) so the page carries the user's
 * persisted theme with no light <-> dark flash.
 *
 * Why this is an EXTERNAL file and not an inline <script>: the production
 * CSP is `script-src 'self'` with no 'unsafe-inline'. An inline bootstrap
 * is silently blocked in prod — `data-theme` never gets set and the page
 * falls back to the light base palette, so the deployed site loaded in
 * light even though dark is the brand default (dev has no CSP, so it
 * looked fine locally — a dev/prod divergence). A same-origin file
 * satisfies 'self' with no CSP hash to maintain. Keep it dependency-free
 * and loaded synchronously in <head> so it executes before paint.
 *
 * Default is dark (brand identity on first impression). The OS
 * `prefers-color-scheme` is intentionally NOT honored; the only way to
 * land on light is an explicit 'light' written to localStorage by the
 * Profile toggle.
 */
(function () {
  var theme = 'dark';
  try {
    var saved = localStorage.getItem('dc_theme');
    if (saved === 'light') theme = 'light';
  } catch (e) {
    /* Private mode / quota / disabled storage. Falls through to the dark
       default so the brand stays consistent. */
  }
  document.documentElement.dataset.theme = theme;

  /* Keep the mobile-browser top-bar tint in sync with the canvas.
     Mirrors `--color-canvas` from the [data-theme] blocks in index.css;
     ProfilePage's toggle does the same flip on each runtime switch. */
  var themeColor = theme === 'light' ? '#F7F4EF' : '#100E0C';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
})();
