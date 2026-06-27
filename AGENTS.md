# AGENTS.md

Welcome! Whether you're a new engineer or an AI agent, this is the best place to start. It covers how we work here and the gotchas that are easier to know up front than to hit the hard way.

If a more specific source disagrees with this file — a `README` in a subfolder, an explicit instruction from a maintainer, a comment marked CRITICAL in code — trust the more specific one.

---

## How we work (the essentials)

A few team agreements that keep the codebase pleasant to work in:

1. **Keep the build green.** `npm run build` runs `tsc --noEmit && vitest run && vite build`. If any of the three is red, it's not ready to merge yet — that's the exact gate CI and Vercel use, so it's worth running locally first.

2. **Comment the *why*, not the *what*.** A comment earns its place when the reasoning isn't obvious — a hidden constraint, a workaround for a specific bug, a subtle invariant. If a well-named function already says it, you can skip the comment.

3. **Keep the git history about the code.** Please leave out AI-attribution tags like `Co-Authored-By: Claude` or `🤖 Generated with [Claude Code]`. We've had to scrub these from history before, so skipping them saves everyone the cleanup.

4. **Keep changes focused.** A bug fix doesn't need surrounding cleanup, a one-shot script doesn't need a helper, and three similar lines are fine — no need to abstract them yet. Save "while I'm here" refactors for their own PR.

5. **One logical change per commit.** Make it, test it, move on. It's far easier to review (and to revert) when a bug fix, a refactor, and a typo fix aren't bundled together.

---

## Where things live

```
DIGITAL CLINIC/
├── api/                            # Vercel serverless functions (Node runtime)
│   └── parse-image.ts              #   POST /api/parse-image — Gemini vision fallback
├── docs/                           # The long-form docs you might be reading right now
├── src/
│   ├── index.css                   # Tailwind v4 @theme + dark-mode token overrides
│   ├── main.tsx                    # React.StrictMode bootstrap
│   └── app/
│       ├── App.tsx                 # PageHost: lazy routing + keyed enter-only page motion (no AnimatePresence)
│       ├── AppContext.tsx          # Combined provider wrapper
│       ├── components/             # Shared atoms (Button, Card, Container, Pill, etc.)
│       ├── contexts/               # Navigation, Quiz, Reports, Language, Discreet contexts
│       ├── data/                   # The biomarker catalog, sample reports, quiz config
│       ├── i18n/                   # UI-language dictionary + translate() (docs/I18N.md)
│       ├── pages/                  # One file per route, lazy-loaded
│       ├── services/               # Parsing pipelines, report PDF generator
│       └── utils/                  # localStorage, sanitisers, hooks, lazy reload
├── public/                         # Static assets: PDF.js worker, hero image, favicons, theme-init.js (theme bootstrap), manifest.webmanifest + PWA icons
├── vercel.json                     # SPA rewrite + serverless function config
└── package.json
```

Hunting for something? Start from the relevant entry above and grep outward — no need to read every file front to back.

---

## Commit conventions

Type prefixes: `feat`, `fix`, `refactor`, `polish`, `chore`, `docs`, `test`, `security`. Scope in parens when it helps narrow what changed:

```
feat(ai-parser): retry transient Gemini failures
fix(landing): wire dead nav anchors to real sections
docs(readme): add Docs section pointing to AGENTS.md + docs/*
```

Body is optional for trivial commits. For anything non-obvious, include a body that says *why* — the diff already shows *what*.

**Branch naming:** `<type>/<short-kebab-desc>`. Examples: `fix/gemini-2.5-flash`, `feat/ai-auto-fallback`, `polish/pulse-glow-brand-alignment`.

**Main is protected,** so every change lands through a PR (direct pushes are rejected). Vercel spins up a preview deploy on each PR — wait for the green check before merging.

---

## The docs

Read the one matching what you're touching before you grep — each is a focused deep-dive (200–400 lines).

| Doc | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The big picture: the four contexts, the upload flow, persistence, code-splitting |
| [docs/NAVIGATION.md](docs/NAVIGATION.md) | The hand-rolled no-router `Page`-union navigation + the StrictMode async gotcha |
| [docs/PARSER.md](docs/PARSER.md) | The three-pipeline parser, the biomarker catalog + its fields (optimal / action / critical), India-localized ranges |
| [docs/CLINICAL-ACCURACY.md](docs/CLINICAL-ACCURACY.md) | How a value becomes optimal/borderline/out-of-range/critical, the "trust the pathologist" rule, cite-or-omit, range validation, and known accuracy caveats |
| [docs/FIRST-IMPRESSION-CONTRACT.md](docs/FIRST-IMPRESSION-CONTRACT.md) | The experience-first contract every report-interpretation screen must satisfy: the five questions, the honesty gates (prioritize-confidently/synthesize-conservatively), `certaintyOfAction`, and how it's enforced as a type |
| [docs/SECURITY.md](docs/SECURITY.md) | The privacy/security model: threat model, on-device storage, opt-in at-rest encryption (AES-GCM + PBKDF2), Discreet Mode, the consent-gated AI caveat, vuln reporting |
| [docs/THEMING.md](docs/THEMING.md) | Dark-default semantic tokens, the external (CSP-safe) theme bootstrap, on-color contrast |
| [docs/I18N.md](docs/I18N.md) | The UI-language system: dictionary, English-fallback chain, adding keys/languages |
| [docs/MOBILE.md](docs/MOBILE.md) | Mobile-first patterns + footguns: PWA, fixed nav, `min-w-0`, touch targets, OCR prewarm |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Setup, running locally, and how to ship a change |

---

## Things that will surprise you

These parts look surprising until you know the why behind them. Each has its own deep-dive doc; skim here so you know where to look.

### 1. There's no router library — we rolled our own

The whole app navigates through a typed `Page` union (`contexts/types.ts`) and a `NavigationContext` that maps each page to a clean URL path (`/dashboard`, `/reports/:id`, `/topics/:problemId`, …) and derives the current page *back* from the URL. Back/forward and deep links work naturally because the URL is the single source of truth. React Router is in the dependency tree, but we only use its `useLocation`/`useNavigate` primitives under the hood.

Why: we needed a handful of path routes plus a dozen typed page states, and a hand-rolled URL-as-state mapping keeps deep links clean and the page state fully typed.

See [docs/NAVIGATION.md](docs/NAVIGATION.md).

### 2. Dark is the default theme — light is opt-in

The whole semantic token system runs on `:root[data-theme='dark']` overrides, not `dark:` Tailwind variants. The theme is stamped on `<html>` *before* React mounts (no FOUC) by an **external** bootstrap, `public/theme-init.js` — external, **not** inline, because the production CSP's `script-src` allows `'self'`, `'wasm-unsafe-eval'`, and the jsdelivr CDN — but no `'unsafe-inline'`, so inline scripts are blocked. As an inline script it silently failed in prod and the deployed site loaded in light; don't move it back inline. `prefers-color-scheme` is deliberately ignored — dark is the brand identity on first paint regardless of OS.

See [docs/THEMING.md](docs/THEMING.md).

### 3. The parser is three pipelines in a fallback chain

Upload a PDF or photo of a lab report and we try, in order:

1. **pdfjs** text-layer extraction (PDFs with selectable text)
2. **Tesseract.js** OCR (image PDFs, photos)
3. **Gemini 2.5 Flash** vision LLM via a Vercel serverless function (anything the first two miss)

Pipeline 3 is the slow expensive one — it only runs on user opt-in (or auto-cascade when local fails on an image, gated by a Profile setting). The catalog matcher in between maps whatever the parsers extract onto our canonical biomarker list, with unit reconciliation (handle `thou/cumm`, `lakh/cumm`, the Indian lab conventions) and a hallucination guard.

This is the most complex subsystem. See [docs/PARSER.md](docs/PARSER.md).

### 4. Persistence is namespaced + zod-validated

Everything in localStorage has a `dc_` prefix (`dc_reports`, `dc_quiz`, `dc_theme`, etc.) and every load path validates the persisted JSON against a zod schema before trusting it. Without validation, a poisoned key (browser extension, past-buggy version, dev-tools session on a shared device) would crash the app on every load. Schema mismatch → fall back to default, don't crash.

The one exception: `dc_theme` is stored as a raw `'dark'` / `'light'` string (no JSON envelope) so the pre-React bootstrap (`public/theme-init.js`) can read it without needing `JSON.parse`.

### 5. Reports have a status state machine, not a boolean

A report goes `processing` → `ready` (or gets removed). The `processing` placeholder is what powers the upload flow's progress UI. Don't filter on `r.status === 'ready'` only — `processing` reports are real, just incomplete. See `ReportsContext` and the `makeReport` factory in `data/reports.ts`.

### 6. `lazyWithReload`, not raw `React.lazy`

If a user has the app open when we ship a new deploy, the old chunk URLs are gone from Vercel. Raw `React.lazy` would dump them on the ErrorBoundary with a confusing `ChunkLoadError`. `utils/lazyWithReload.ts` catches that specific error and triggers a hard reload instead. Use it for any new code-split.

### 7. PDF.js worker is bundled separately

The PDF.js worker is a separate JS file fetched from `/pdf.worker.min-*.mjs` (Vite hashes it). Don't try to inline it. The worker has its own bundle hash for cache-busting on deploys.

### 8. UI text runs through a tiny i18n layer (English-source, India-first)

UI chrome (nav, buttons, settings) renders through `t('key')` from `useLanguage()`. English is the source of truth + fallback; Hindi is populated; other Indian languages are scaffolded and surface in the picker only once translated (so a user can't pick a language that would render English). **Clinical interpretation copy is deliberately NOT translated** — it needs clinician review, not an engineer's dictionary. See [docs/I18N.md](docs/I18N.md).

### 9. It's an installable PWA, and mobile has its own footguns

The app ships a web manifest + maskable icons (installable / standalone). Mobile layout has traps we've already hit and fixed: the bottom nav is `fixed` (not `sticky`, or you get a dead zone under it), flex/grid children that hold a horizontal scroller need `min-w-0` (or they blow past the viewport), and interactive atoms use `touch-action: manipulation` + 44px hit areas. OCR assets are prewarmed on image-select. See [docs/MOBILE.md](docs/MOBILE.md).

### 10. Reference ranges are India-localized; "harm-anchor" ticks must be cited

Catalog ranges and citations follow Indian guidelines where they diverge (Vitamin D ≥20, male haemoglobin ≥13, LDL → Lipid Association of India, diabetes → WHO/ICMR). A marker can carry a cited `actionMin`/`actionMax` ("harm-anchor") rendered as a reference tick on the result bar — but **only with a source** (cite-or-omit, same rule as optimal ranges; never a fabricated clinical line). How a value then becomes a status tier (and why `criticalHigh` fires even when the lab's printed range says otherwise) is in [docs/CLINICAL-ACCURACY.md](docs/CLINICAL-ACCURACY.md). See also [docs/PARSER.md](docs/PARSER.md).

### 11. Sensitive data can be encrypted at rest, and the key only lives in memory

There's an opt-in PIN lock (`utils/dataLock.ts` + `utils/crypto.ts`): when on, reports and quiz answers are stored as AES-GCM ciphertext, keyed by a PBKDF2-SHA256 (200k-iter) derivation of the PIN. The derived key is non-extractable and **memory-only** — never persisted — so a forgotten PIN is unrecoverable *by design* (the UI offers wipe-and-restart, not a backdoor). Reports and quiz coordinate through a lock-event bus (`enabled`/`unlocked`/`disabled`/`wiped`), and the plaintext loaders refuse to read ciphertext so a half-migrated state can't silently wipe data. Separately, **Discreet Mode** (`contexts/DiscreetContext.tsx` + `<PrivacyScreen>`) veils the screen when the app is backgrounded. Full model in [docs/SECURITY.md](docs/SECURITY.md).

---

## Sharp edges worth knowing

- **`Date.now()`, `Math.random()`, `new Date()` are fine in app code, but if you write deterministic-test code, freeze them.** The tests don't currently rely on this; just be aware.
- **PowerShell 5.1 is the dev shell on Windows.** No `&&` chaining (`A; if ($?) { B }` instead). Bash via WSL also available.
- **iOS Safari double-tap zoom** — input font-size below 16px triggers it on focus. We enforce 16px minimum on mobile in `index.css`. Don't drop below 16px on form inputs.
- **`useEffect` cleanup runs in StrictMode** — the dev double-mount is real. If you write effects with side-effects (network calls, navigation), you need a mount guard ref or an `AbortController`. See [docs/NAVIGATION.md](docs/NAVIGATION.md#strictmode-async-gotcha).
- **The serverless `/api/parse-image` is image-only** (JPEG / PNG / WebP allowlist) and has a 30s `maxDuration`. Don't send PDFs to it — they'll bounce with a 400.

---

## What to do when you're stuck

1. **Read the relevant doc in `docs/`.** They're each 200–400 lines and answer the questions you'd otherwise ask.
2. **Grep for the symbol or string,** not the abstraction. "Where's the parser called?" → grep `parseUploadedReport`. "How does dark mode work?" → grep `data-theme`.
3. **Run `npm run build` after any non-trivial change.** It catches type errors, test failures, and bundle issues in one shot.
4. **Look at the most recent merged PRs** for examples of how this team writes commits, structures changes, and handles rebases. `gh pr list --state merged --limit 10`.

If you find something in this file that's wrong, fix it. The docs are not sacred; they're a tool.
