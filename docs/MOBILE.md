# Mobile

The app is mobile-first and ships as an installable PWA. This doc captures
the mobile-specific patterns and the footguns we've already hit — read it
before touching layout, the bottom nav, or the upload/OCR path.

---

## Installable PWA / standalone

- [`public/manifest.webmanifest`](../public/manifest.webmanifest) +
  square/maskable icons (`public/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, generated from the wordmark on the dark
  canvas). `display: standalone`, brand `theme_color`/`background_color`.
- Linked from [`index.html`](../index.html) (`<link rel="manifest">` +
  `apple-mobile-web-app-*` meta). All assets are same-origin, so the
  `default-src 'self'` CSP in `vercel.json` covers them with no extra
  directive.
- **Why it matters beyond "add to home screen":** launching standalone
  drops the browser chrome, which removes the iOS/Android dynamic-toolbar
  resize that makes `dvh`-based heights feel like they "keep scrolling."

## The theme bootstrap must stay an external file (CSP)

`public/theme-init.js` sets `data-theme` before paint. It is **not**
inline because the production CSP (`script-src 'self'`, no
`'unsafe-inline'`) silently blocks inline scripts — an inline bootstrap
left the deployed site stuck in light mode while local dev (no CSP) looked
fine. Don't move it back inline. See [THEMING.md](THEMING.md).

---

## Layout footguns

### `min-w-0` on flex/grid children that contain a horizontal scroller

A flex/grid item defaults to `min-width: auto`, so it won't shrink below
its content's intrinsic width. A `w-max` row inside an `overflow-x-auto`
scroller (e.g. the results-page filter strip) therefore blew the whole
column past the viewport (~547px on a 393px screen); `overflow-x: clip`
then clipped the content on the right ("alignment" bug). **Fix: add
`min-w-0` to the grid/flex child** so it shrinks to its track and the
strip scrolls inside its own bounds. (`ReportResultsPage`'s `<main>`.)

### Bottom nav is `fixed`, not `sticky`

[`BottomNav`](../src/app/components/BottomNav.tsx) is
`fixed inset-x-0 bottom-0`. It used to be `sticky`, which left the pages'
`pb-28` clearance padding sitting *below* it at the end of the scroll — a
~112px dead zone under the tab bar. Pages that render `BottomNav` keep
`pb-28` (md:`pb-12`) to clear the fixed bar. **Don't revert to `sticky`.**

### Global safety nets (already in `index.css`)

- `html { overflow-x: clip }` — last-resort guard against a rogue wide
  element triggering page-level horizontal scroll. Fix offenders at the
  source (`min-w-0`); this is belt-and-suspenders.
- `html { overscroll-behavior-y: none }` — no rubber-band scroll-chaining
  past content (reads as "extra scroll" on phones).
- `@media (max-width: 767px) { input, select, textarea { font-size: 16px } }`
  — iOS auto-zooms a focused field under 16px and often doesn't restore.
  Keep form controls ≥16px on mobile (this rule enforces it).

---

## Touch & motion

- **`touch-action: manipulation`** on `button, a, [role=button], [role=switch], [role=radio]`
  (in `index.css`) removes the legacy ~300ms double-tap-zoom wait, so taps
  fire immediately and a fast double-tap can't zoom the page.
  `user-select: none` on the same set stops a quick tap selecting label
  text. Horizontal pill scrollers (`.scrollbar-none`) get momentum +
  `overscroll-behavior-x: contain`.
- **44px touch targets.** Interactive controls use `min-h-11` (44px) — the
  WCAG 2.2 **AAA** target size (the AA floor is only 24px). Keep new tap
  targets ≥44px; the visible glyph can be smaller, expand the hit area.
- **Reduced motion.** `<MotionConfig reducedMotion="user">` wraps the app
  in `App.tsx`, so Framer Motion drops transform/layout animation when the
  OS asks. Animate composite props (`transform`, `opacity`) only — never
  `height`/`width`/`margin`.

---

## On-device OCR performance

- The parser already creates **one** Tesseract worker per parse and reuses
  it across pages (don't create one per image/page).
- **Prewarm:** [`prewarmOcr()`](../src/app/services/pdfParser.ts) (exposed
  via `services/api`) creates+terminates a worker to pull the ~4 MB
  `eng.traineddata` + WASM core into the browser cache, then keeps nothing
  resident. `UploadPage` fires it the moment an **image** is selected
  (images always OCR; text-PDFs never download it). The fetch overlaps the
  user reviewing their file, so the real parse skips it: measured cold OCR
  ~4.1s → ~1.1s.
- We did **not** swap to `tesseract-wasm` (smaller payload) — it isn't a
  drop-in and would mean rewriting the OCR path of the most-tested, most
  fragile subsystem for a first-OCR-only gain the prewarm already captures.

---

## Verifying mobile changes

There's no committed browser-test harness, but the quick loop is: run
`npm run dev`, drive a mobile viewport (393×… , `isMobile`) with a headless
Chromium, and check `document.documentElement.scrollWidth === innerWidth`
(no horizontal overflow) plus elements whose right edge exceeds the
viewport while **not** inside an `overflow-x:auto/hidden/clip` ancestor
(genuine clipped overflow). Screenshot the page in dark mode. That's how
the overflow/alignment, nav dead-space, and footer issues were found.
