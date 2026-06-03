# AGENTS.md

If you're an AI agent or a new engineer working in this repo, read this first. It covers the rules you'll be held to and the gotchas you'd otherwise hit.

If a more specific file disagrees with this one (a `README` inside a subfolder, an explicit user instruction, a comment marked CRITICAL in code), the more specific source wins.

---

## The five rules

1. **Build has to be green.** `npm run build` runs `tsc --noEmit && vitest run && vite build`. If those three don't pass, the work isn't done. CI and Vercel both gate on this.

2. **Default to no comments.** Only write a comment when the *why* isn't obvious — a hidden constraint, a workaround for a specific bug, a subtle invariant. Don't explain what a well-named function already says.

3. **No Claude attribution in commits.** No `Co-Authored-By: Claude`, no `🤖 Generated with [Claude Code]`, none of that. The repo owner has rewritten history more than once to scrub these.

4. **Don't expand scope.** A bug fix doesn't need surrounding cleanup. A one-shot script doesn't need a helper. Three similar lines beat a premature abstraction. No "while I'm here" refactors.

5. **One logical change per commit.** Make it. Test it. Move on. Don't bundle a bug fix with a refactor with a typo fix.

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
│       ├── App.tsx                 # PageHost: lazy routing + AnimatePresence
│       ├── AppContext.tsx          # Combined provider wrapper
│       ├── components/             # Shared atoms (Button, Card, Container, Pill, etc.)
│       ├── contexts/               # NavigationContext, QuizContext, ReportsContext
│       ├── data/                   # The biomarker catalog, sample reports, quiz config
│       ├── pages/                  # One file per route, lazy-loaded
│       ├── services/               # Parsing pipelines, report PDF generator
│       └── utils/                  # localStorage, sanitisers, hooks, lazy reload
├── public/                         # Static assets (PDF.js worker, hero image, favicons)
├── vercel.json                     # SPA rewrite + serverless function config
└── package.json
```

If you're hunting for something, start at the source listed above and grep outward. Don't read every file front-to-back.

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

**Main is protected.** You can't push to it directly. Every change goes through a PR. The Vercel preview deploy runs on every PR — green check before you merge.

---

## Things that will surprise you

These are the parts that look weird until you know why. Each gets its own deep-dive doc; skim them here so you know where to look.

### 1. There's no router library — we built our own

The whole app navigates through a typed `Page` union (`contexts/types.ts`) and a `NavigationContext` that syncs the union to `?page=...` URL params. Back/forward buttons work via `location.key`. React Router is in the dependency tree but only used for `useLocation()` to read `pathname` on the landing page.

Why: at the time we needed exactly two routes (`/` and `/minimal`) and a dozen typed page states, and the URL-as-state mapping wanted to be hand-rolled so deep links and analytics could read a clean `?page=` enum.

See [docs/NAVIGATION.md](docs/NAVIGATION.md).

### 2. Dark is the default theme — light is opt-in

The whole semantic token system runs on `:root[data-theme='dark']` overrides, not `dark:` Tailwind variants. The theme is stamped on `<html>` by an inline script in `index.html` *before* React mounts (no FOUC). `prefers-color-scheme` is deliberately ignored — dark is the brand identity on first paint regardless of OS.

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

The one exception: `dc_theme` is stored as a raw `'dark'` / `'light'` string (no JSON envelope) so the pre-React bootstrap script in `index.html` can read it without needing `JSON.parse`.

### 5. Reports have a status state machine, not a boolean

A report goes `processing` → `ready` (or gets removed). The `processing` placeholder is what powers the upload flow's progress UI. Don't filter on `r.status === 'ready'` only — `processing` reports are real, just incomplete. See `ReportsContext` and the `makeReport` factory in `data/reports.ts`.

### 6. `lazyWithReload`, not raw `React.lazy`

If a user has the app open when we ship a new deploy, the old chunk URLs are gone from Vercel. Raw `React.lazy` would dump them on the ErrorBoundary with a confusing `ChunkLoadError`. `utils/lazyWithReload.ts` catches that specific error and triggers a hard reload instead. Use it for any new code-split.

### 7. PDF.js worker is bundled separately

The PDF.js worker is a separate JS file fetched from `/pdf.worker.min-*.mjs` (Vite hashes it). Don't try to inline it. The worker has its own bundle hash for cache-busting on deploys.

---

## Sharp edges worth memorising

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
