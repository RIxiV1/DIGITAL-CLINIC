# Theming

An explicit saved choice always wins; with no choice we honor the OS `prefers-color-scheme` and fall back to the **warm-paper light** theme (the brand's distinctive identity, and the safer default for dense clinical numbers). Both themes are first-class. The whole system runs on semantic Tailwind v4 tokens — there are zero `dark:` variants sprinkled across components.

This doc explains the five principles, the no-FOUC bootstrap, and how to add a new themed surface without breaking dark mode.

---

## Palette & type identity ("ForMen — Indigo & Gold on warm paper")

The visual identity is the **ForMen brand** (deep indigo + gold) rendered as
**navy-and-gold on a warm paper canvas** — premium men's-apothecary / editorial-clinic, not blue on a dark-SaaS slab. The canvas decides everything: indigo on cream reads premium; the same indigo on dark charcoal reads generic. Colour is organised into deliberate lanes — keep them separate:

| Lane | Tokens | Use |
| --- | --- | --- |
| **Chrome** (neutral warm-stone) | the `blue-*` / `indigo-*` / `primary-*` alias — resolves to a **warm-stone ramp**, NOT blue | nav, secondary buttons, most fills |
| **Brand / interactive accent** (ForMen indigo) | `--color-forest` **and** `--color-clay`, both `#2D3B8E` (light — the EXACT wordmark hex, sampled from `public/favicon.svg`) / `#97A3EA` (dark), with `--color-on-*` for text on them | the wordmark, primary CTA, action links, focus rings, landing accent phrases — the one ownable brand hue |
| **Warm secondary** (ForMen gold) | `--color-gold-*` (`#FFB800`, desaturated for dark) | highlights, gold pills, the calm `attention` status family |
| **Alarm** (crimson) | `--color-concern` → **`#ef4444`** (dark) | clinical warnings / flagged diagnostics only |

The accent is **blue-dominant**, so the "act here" indigo separates from the crimson alarm under protanopia/deuteranopia (blue-vs-red is the safe CVD pair) — even more reliably than the old forest did. Clay and forest now resolve to the *same* indigo (the app has one brand accent + gold, not two warm accents); terracotta has retired into the brand. The clinical status colours (`good` / `attention` / `concern` / `critical`) are **unchanged** and stay label-backed, never colour-only.

**Dark ladder** (warm charcoal): canvas `#0b0a09` → card `--color-surface` `#1a1816` → hero `--color-paper` `#242220` — an even ~1.12:1 step each so layers read. In dark the drop-shadows are invisible, so the **hairline carries the card edge**: `--color-line` is `rgb(231 229 228 / 0.16)` (≈1.44:1 over canvas), not a barely-there 0.10.

> **The class names lie, on purpose.** `bg-indigo-600` / `text-blue-700` render *terracotta-stone*, because the brand hue was retargeted in one place (`--color-blue-*`) rather than via 380+ per-component edits. Don't "fix" them back to blue. A future rename to `--color-primary-*` is the proper cleanup.

**Type:** display = **Domine** (variable serif, self-hosted `@font-face` in `index.css`, file in `public/fonts/`) — used LARGE for headlines + big overview numbers via the `.font-display` utility. Body = **Manrope** (self-hosted via `@fontsource/manrope`, latin subset). **No Google Fonts `<link>` — zero third-party font requests.** Small/clinical data numbers use `tabular-nums`, not the serif.

---

## The five principles

Every line of theme code in [`src/index.css`](../src/index.css) follows one of these. If you're tempted to break one, look hard for a different solution first.

### 1. `:root[data-theme='dark']` beats `@theme :root`

The dark mode block uses the `[data-theme='dark']` attribute selector (specificity 0,2,0) which beats Tailwind v4's `@theme :root` (specificity 0,1,0) deterministically. **No `!important` anywhere in the theme code.**

If you ever feel like you need `!important` to make a token stick, you're fighting the cascade wrong. Re-read the source order in `index.css` and find the lower-specificity declaration that's bleeding through.

### 2. Semantic re-binding, not Tailwind color overrides

The dark block re-binds `--color-canvas`, `--color-ink`, `--color-primary-600`, etc. — the same variables Tailwind v4 reads when it generates `bg-canvas` / `text-ink` / `bg-primary-600` classes.

Components that use those classes reskin themselves automatically when `data-theme` flips. **There are zero `dark:bg-...` variants in the codebase.** If you write `dark:bg-canvas`, code review will catch it (or should — flag it if you see one).

### 3. "On-color" tokens for guaranteed contrast

Every filled surface has a paired "on-color" token:

- `--color-on-primary` — text on `bg-primary-600` (the warm-stone chrome fill)
- `--color-on-forest` — text on `bg-forest` (the interactive accent: primary CTAs) — measures AAA in both themes
- `--color-on-clay` — text on `bg-clay` (the decorative terracotta accent: landing panels, highlighted cards)
- `--color-on-status` — text on `bg-good` / `bg-attention` / `bg-concern`
- `--color-on-gold` — text on the brand gold

These are deliberate. Without them, `text-white` on a light dark-mode fill drops below AA — illegible. With them, the on-color flips per theme (e.g. on-primary / on-forest / on-clay become **deep warm ink** in dark, where the fills are light stone / sage / tan) so contrast stays above WCAG AA. **Never put `text-white` on a fill — always pair the on-color token.**

### 4. De-escalated status palette in dark mode

Status fills de-escalate in dark mode: `good` → emerald `#5FCB95`, `attention` → warm amber `#D9A765`. **`concern` is an authoritative crimson `#ef4444`** — it deliberately stays clear of both the warm-stone chrome and the forest interactive accent so an alarm never reads as a button. Forest↔crimson also separate under colour-blindness (on both hue and lightness) — which is exactly why forest, not the red-family clay, owns the interactive lane. The vivid Tailwind defaults are visual noise on a dark canvas; this set reads as clinical.

Status text *on soft backgrounds* uses dedicated `*-ink` tokens (`--color-good-ink`, `--color-attention-ink`, etc.) for AA contrast.

### 5. Inset shadows in dark, drop shadows in light

Dark surfaces lift via `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04)` instead of drop shadows. Drop shadows are invisible on a dark canvas; inset highlights mimic light hitting the top edge of a card and read as elevation.

In light mode, the same elements use their usual `shadow-clinical` / `shadow-pop` drop shadows.

### Bonus rule — modern CSS color syntax

We use `rgb(R G B / A)` and `color-mix(in oklab, …)` throughout — no legacy `rgba(R, G, B, A)`. Tailwind v4's `color-mix` utilities require the modern syntax to interoperate.

---

## How the bootstrap works (no FOUC)

The theme is stamped on `<html data-theme="...">` by a script that runs
*before* React mounts. Without it, the page would paint in the CSS-default
theme and then flicker to the resolved theme once React reads
`localStorage` / the OS preference — so the bootstrap resolves it first.

> ⚠️ **This script lives in [`public/theme-init.js`](../public/theme-init.js) — an EXTERNAL file, loaded synchronously from `<head>`. It is deliberately NOT inline.** The production CSP's `script-src` in `vercel.json` allows `'self'`, `'wasm-unsafe-eval'` (for the pdfjs/Tesseract WASM), and the jsdelivr CDN — but **no `'unsafe-inline'`**, which silently blocks inline scripts. As an inline `<script>` the bootstrap never ran in prod — `data-theme` stayed unset and the deployed site loaded in **light** on fresh devices, while local dev (no CSP) looked fine. A same-origin file satisfies `'self'` with no CSP hash to maintain, and a blocking `<head>` script still runs before first paint. **Don't move it back inline.** If you edit it, it's still just one same-origin file — no CSP change needed.

```js
// public/theme-init.js — referenced as <script src="/theme-init.js"></script>
(function () {
  var theme;
  try {
    var saved = localStorage.getItem('dc_theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved; // explicit user choice always wins
    } else {
      theme = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
    }
  } catch (e) { theme = 'light'; /* private mode / disabled storage */ }
  document.documentElement.dataset.theme = theme;

  var themeColor = theme === 'light' ? '#F7F4EF' : '#100E0C';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor);
})();
```

Three things this script does:

1. Resolves the theme: an explicit `localStorage['dc_theme']` wins; otherwise it honors the OS `prefers-color-scheme` and falls back to **`'light'`** (the warm-paper identity) — including on any storage failure. `loadTheme()` in `persistence.ts` mirrors this exactly, or first paint flashes.
2. Stamps `<html data-theme="dark">` or `<html data-theme="light">`.
3. Syncs the `<meta name="theme-color">` tag so the mobile browser top-bar tint matches the canvas color on first paint.

**`prefers-color-scheme` IS honored now** (it previously wasn't). Rationale: the distinctive warm-paper look should lead the first impression, and the evidence on dense clinical data + astigmatism halation favors light; dark-preferrers still get dark via their OS setting or the Profile toggle.

---

## The `dc_theme` localStorage format

The bootstrap script reads `dc_theme` as a **bare string** (`'dark'` or `'light'`), not a JSON envelope. This is the only `dc_*` key that breaks the JSON pattern.

Why: the inline bootstrap can't import `zod` and shouldn't depend on `JSON.parse`. If you put `JSON.stringify('dark')` in storage, the bootstrap would read the literal six-character string `"dark"` (with quotes) and the comparison would fail.

`loadTheme()` / `saveTheme()` in [`utils/persistence.ts`](../src/app/utils/persistence.ts) mirror this format. Both readers must agree — change one, change the other.

---

## Toggling the theme

`ProfilePage` exposes a theme toggle. The handler:

```tsx
const toggleTheme = () => {
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  setThemeState(next);
  saveTheme(next);                              // localStorage
  const root = document.documentElement;
  root.classList.add('theme-transitioning');    // 240ms color transition
  root.dataset.theme = next;                    // re-bind tokens
  const themeColor = next === 'light' ? '#F7F4EF' : '#100E0C';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  setTimeout(() => root.classList.remove('theme-transitioning'), 240);
};
```

The `theme-transitioning` class adds a global `transition: background-color 240ms, color 240ms, border-color 240ms` so the flip is smooth instead of a hard jump. Removed after the transition so element-level animations don't compete with it.

---

## Scope-local light islands

The `[data-theme='light']` selector in `index.css` is written without
`:root`, so it matches **any** element carrying the attribute — not just
the document root. That lets you force a subtree to the light token
bindings even on a dark page:

```tsx
<div data-theme="light" className="rounded-2xl ...">
  {/* This subtree uses the light token bindings even if the page is dark. */}
</div>
```

> **Currently there are no consumers.** The landing hero card and the
> Doctor-Summary mockup used to be light islands (to look like printed
> paper), but they were switched to follow the page theme — they now read
> as dark app-screenshots, which is the better look since dark works
> end-to-end. The mechanism is kept for genuine "must stay paper-white"
> surfaces (e.g. a future print/PDF preview).

Use sparingly. Every scope-local island is a place where the global
dark/light flip stops being uniform across the page.

---

## Adding a new themed surface

If you're building a new card, button, or page region:

1. **Use semantic class names.** `bg-canvas` / `bg-surface` / `text-ink` / `text-ink-soft` / `border-line`. Don't use `bg-white` or `text-gray-900` — those don't re-theme.
2. **For accent surfaces (CTAs, status fills),** pair the surface with its on-color: `bg-forest text-on-forest` (the primary CTA), `bg-primary-600 text-on-primary`, `bg-good text-on-status`. Don't use `text-white` on accents.
3. **For status text on soft backgrounds,** use the `*-ink` variant: `bg-good-soft text-good-ink`. The vivid `text-good` measures ~3:1 on `bg-good-soft` — fails AA.
4. **For shadows,** use the existing `shadow-clinical` / `shadow-pop` / `shadow-blue` utilities. Don't write `shadow-[0_2px_8px_rgba(0,0,0,0.1)]` — it won't theme.
5. **Test both themes before committing.** Toggle via Profile or via dev tools (`document.documentElement.dataset.theme = 'light'`).

---

## Adding a new color

Don't, unless you really need to. The existing scale covers most needs: the warm-stone chrome ramp (`blue`/`indigo`/`primary`, all aliased together), `forest` (+ `on-forest`, the interactive accent), the `clay` terracotta decorative accent (+ `on-clay`), the warm `paper`/`paper-ink` hero tones, `gold`, `mint`, the status colours, and neutrals. Before adding a hue, check it doesn't collapse a lane — keep chrome (stone), interactive accent (forest), and alarm (crimson) distinct.

If you must:

1. Add the light-mode values to the `@theme :root` block at the top of `index.css`.
2. Add dark-mode overrides to the `:root[data-theme='dark']` block (with the `--color-*` variables re-bound).
3. If the color will be used as a background surface, also add an `on-color` token (`--color-on-<name>`).
4. Run the build. If it passes, you're done.

---

## Anti-patterns

- **`dark:bg-…` Tailwind variants** — skip them; the whole system is semantic re-binding, not class-variant overrides.
- **`!important` on color rules** — usually a sign the cascade can be fixed at the source; look for the lower-specificity declaration bleeding through.
- **`text-white` on accent backgrounds** — use the on-color token, or dark mode will eat your contrast.
- **`bg-gray-100` / `text-gray-900` / raw color names** — use semantic tokens; raw Tailwind colors don't re-theme.
- **`rgba(R, G, B, A)` in inline styles** — use the modern `rgb(R G B / A)` syntax for consistency and `color-mix` interop.
- **Reading `localStorage.dc_theme` outside `loadTheme()`/`saveTheme()`** — the format is shared with the external bootstrap (`public/theme-init.js`), so both readers have to agree.

---

## Where to look in the code

- [`src/index.css`](../src/index.css) — the entire theme system: `@theme :root`, `[data-theme='light']`, `:root[data-theme='dark']`, plus the global resets and `.theme-transitioning` keyframe.
- [`public/theme-init.js`](../public/theme-init.js) — the no-FOUC bootstrap (external; loaded from [`index.html`](../index.html)). External because of the CSP — see the bootstrap section above.
- [`public/manifest.webmanifest`](../public/manifest.webmanifest) — PWA manifest; its `theme_color`/`background_color` mirror the dark canvas. See [MOBILE.md](MOBILE.md).
- [`src/app/pages/ProfilePage.tsx`](../src/app/pages/ProfilePage.tsx) — the theme toggle UI.
- [`src/app/utils/persistence.ts`](../src/app/utils/persistence.ts) — `loadTheme()` / `saveTheme()`.

If you need to verify a contrast ratio, paste the foreground and background hex values into any AA-checker. Aim for 4.5:1 on body text, 3:1 on large text (≥18.66 px bold or ≥24 px regular).
