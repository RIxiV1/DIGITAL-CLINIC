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
 * Default: an explicit saved choice always wins; otherwise honor the OS
 * `prefers-color-scheme` and fall back to the warm-paper LIGHT theme.
 * Light is the brand's distinctive ("warm paper clinic-chart") identity —
 * so it leads the first impression — and it's the safer default for the
 * dense numeric/clinical data this app shows (research: dark mode's
 * eye-comfort edge isn't supported, and light-on-dark causes halation for
 * the large minority with astigmatism). Dark-preferrers still get it via
 * their OS setting or the Profile toggle. Must match loadTheme() in
 * persistence.ts exactly, or first paint will flash.
 */
(function () {
  var theme;
  try {
    var saved = localStorage.getItem('dc_theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved; // explicit user choice always wins
    } else {
      theme =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    }
  } catch (e) {
    /* Private mode / quota / disabled storage → the warm-paper identity. */
    theme = 'light';
  }
  document.documentElement.dataset.theme = theme;

  /* Keep the mobile-browser top-bar tint in sync with the canvas.
     Mirrors `--color-canvas` from the [data-theme] blocks in index.css;
     ProfilePage's toggle does the same flip on each runtime switch. */
  var themeColor = theme === 'light' ? '#F7F4EF' : '#100E0C';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
})();
