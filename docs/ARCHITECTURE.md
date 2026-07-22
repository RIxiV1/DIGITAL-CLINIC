# Architecture

A ten-minute system map. Read this if you're new and want to know how the pieces fit together before diving in.

The app is a single-page Vite + React 18 SPA that runs entirely client-side, with one Vercel serverless function (`/api/parse-image`) that proxies image uploads to Google Gemini. There's no backend database — every byte of user data lives in their own browser's `localStorage`.

---

## The big picture

```
                   ┌──────────────────────────────────────┐
                   │              Vite SPA                │
                   │   (React 18 + Tailwind v4 + Framer)  │
                   │                                      │
   user uploads ──▶│  Pipeline 1: pdfjs text-layer        │
   a lab report    │  Pipeline 2: Tesseract.js OCR        │──▶ biomarker catalog
                   │  Pipeline 3: Gemini Vision (fallback)│    matcher → dashboard
                   │                                      │
                   │  Persisted in dc_* localStorage keys │
                   │  (zod-validated on every load)       │
                   └─────────────────┬────────────────────┘
                                     │
                                     │  Pipeline 3 — disclosed, default-on
                                     ▼
                   ┌─────────────────────────────────────┐
                   │   Vercel Function /api/parse-image  │
                   │   (Node, 30s maxDuration)           │
                   │   forwards image → Gemini 2.5 Flash │
                   │   returns biomarker JSON            │
                   └─────────────────────────────────────┘
```

Everything except Pipeline 3 happens in the user's browser. No PII leaves the device unless the user explicitly opts in (or the auto-cascade fires, also gated by a Profile setting).

---

## State containers

There are five React contexts, combined under one `AppProvider`:

```
AppProvider (src/app/AppContext.tsx)
└── LanguageProvider          →  selected UI language + the t() translator
    └── DiscreetProvider       →  Discreet Mode (screen veil) preference
        └── NavigationProvider →  the typed Page state machine + URL sync
            └── QuizProvider     →  the symptom/priority quiz answers + risk tiers
                └── ReportsProvider →  the user's locker of lab reports
```

Each context exposes hooks (`useNavigation()`, `useQuiz()`, `useReports()`, `useLanguage()`, `useDiscreet()`) and a `loadXxx()` / `saveXxx()` pair in `utils/persistence.ts`.

### NavigationContext — the no-router system

We don't use React Router for navigation. Instead, a typed union models every page in the app:

```ts
// src/app/contexts/types.ts
export type Page =
  | { type: 'landing' }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'home' }
  | { type: 'healthMap' }
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'manualEntry' }
  | { type: 'results'; reportId: string; view?: 'details' }
  | { type: 'compare'; aId?: string; bId?: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' }
  | { type: 'privacy' };
```

`navigate(page)` pushes a new URL **path** (e.g. `/reports/:id`), `replace(page)` rewrites the current entry, and `back()` defers to the browser. `page` is derived from the URL, so back/forward and pasted deep links work for free. The whole thing is ~300 lines. See [NAVIGATION.md](NAVIGATION.md) for the deep dive.

### QuizContext

Holds the user's quiz answers (age range, activity level, selected priorities, selected symptoms) and computes a `systemTiers` object (hypogonadism / erectile dysfunction / cardiovascular: low / moderate / high) from the symptom selections. The scoring logic — `calculateRisk` — is exported and unit tested.

### ReportsContext

The user's lab-report locker. Each report has:

```ts
type Report = {
  id: string;
  name: string;             // user-facing label
  date: string;             // ISO yyyy-mm-dd
  status: 'processing' | 'ready';
  biomarkers: Biomarker[];
  lab?: string;
  // …a few more fields for OCR meta + sample-report flags
};
```

Note the `status` field — a report exists in `processing` state from the moment the user hits "Start analysing" until either parsing succeeds (becomes `ready`) or fails (gets removed). That's why the dashboard can show a "your report is processing" placeholder.

The dashboard and Health Map don't read a single report — they read a **combined snapshot** (`getCombinedSnapshot` in `data/reports.ts`) that unions every report, taking the most recent reading per marker and folding older readings into that marker's history. This is why a user with a CBC *and* a separate hormone panel sees both systems on one screen, instead of only their most-comprehensive single report.

### LanguageContext

The selected UI language + a type-checked `t(key)` translator. English is the source of truth and the fallback; Hindi is populated; other Indian languages are scaffolded. **Scope is UI chrome only** — clinical interpretation copy is intentionally excluded (it needs clinician-reviewed translations). Persisted to `dc_lang`. Deep dive: [I18N.md](I18N.md).

### DiscreetContext

Holds the Discreet Mode on/off preference (persisted to `dc_discreet`), shared by the Profile toggle and the `<PrivacyScreen>` veil. When on, the veil obscures all content the instant the app loses focus or is backgrounded — a lightweight shoulder-surfing / hand-the-phone-over defence that complements the at-rest encryption. Full privacy model: [SECURITY.md](SECURITY.md).

---

## How an upload flows through the system

This is the most important user journey. Tracing it through the code is the fastest way to understand the architecture.

```
1. UploadPage                          (src/app/pages/UploadPage.tsx)
   ├─ user picks/drops/pastes a file
   ├─ validateUpload() — MIME allowlist, size cap, sanitised filename
   ├─ fileRef.current = file  ──┐
   │                            │  Files don't serialise. Module-level bridge,
   │                            │  not React state, not localStorage.
   └─ on "Start analysing":     │
      ├─ addReport({ status: 'processing', name, ... })
      ├─ setPendingUpload(fileRef.current)  ◀┘
      └─ navigate({ type: 'processing' })

2. ProcessingPage                      (src/app/pages/ProcessingPage.tsx)
   ├─ on mount: file = consumePendingUpload()
   ├─ parseUploadedReport(name, file, onProgress) ───▶ services/api.ts
   │   ├─ Pipeline 1 (pdfjs text layer) ──▶ services/pdfParser.ts
   │   ├─ Pipeline 2 (Tesseract OCR)    ──▶ services/pdfParser.ts (same module)
   │   └─ Catalog matcher               ──▶ data/biomarkers.ts
   ├─ if extraction succeeded:
   │     setPendingConfirm({ biomarkers, fileName, ... })
   │     → ConfirmExtractedValuesView lets the user verify before commit
   │     → on confirm: markReportReady(id, { biomarkers, lab })
   ├─ if extraction failed AND file is an image AND setting allows:
   │     setAiCascadeFile(file)
   │     → AiCascadeView shows spinner + privacy notice
   │     → parseWithAi(file, signal) ──▶ services/aiParser.ts → /api/parse-image
   │     → on success: same ConfirmExtractedValuesView as above
   └─ if AI also fails, OR not an image:
         setFailure({ reason, errorMessage, fileName, file })
         → ParseFailedView with retry / sample / manual entry options

3. Confirm view                        (still ProcessingPage)
   ├─ user reviews extracted values
   ├─ "Looks right" ──▶ markReportReady(id, …)
   │                    navigate({ type: 'results', reportId: id })
   └─ "Re-upload"   ──▶ removeReport(id); navigate({ type: 'upload' })

4. ReportResultsPage                   (src/app/pages/ReportResultsPage.tsx)
   └─ renders the biomarker dashboard against catalog-derived ranges
```

The parser is the biggest single chunk of complexity. See [PARSER.md](PARSER.md).

---

## The clinical interpretation layer

Between the data and the UI sits `src/app/clinical/` — the layer that turns
matched markers into something a person understands. Keeping it separate is the
point: the **data** (`data/biomarkers.ts` logic + types, and the extracted
`data/biomarkerCatalog.ts` 77-marker table) says *what a value is*; the
**clinical layer** says *what it means and what to do*; the **UI only displays.**

Its public surface is `clinical/index.ts`. The pieces, by role:

- **System grouping** (`bodySystems.ts`) — folds markers into body systems
  (`buildBodySystems`) and writes the honest, reassurance-first signature
  sentences (`healthStorySentence`, `connectedStoryHeadline`). This is why the
  app navigates body → system → finding, not as a flat marker list.
- **Per-marker meaning** — context from the user's own intake
  (`markerContextNote`), trend reading (`markerTrendNote`), action certainty
  (`certaintyOfAction`), and the harm-anchored "why it matters."
- **Honesty rails** — report-level limitations (`reportLimitations`),
  provenance (`reportProvenanceNote`), visible methodology (`methodology`).
  These keep interpretation from over-claiming.

Two docs govern this layer's *behaviour*, not just its code:
[FIRST-IMPRESSION-CONTRACT.md](FIRST-IMPRESSION-CONTRACT.md) (what every
report-interpretation screen must answer, and the prioritize-confidently /
synthesize-only-when-earned gates) and [DESIGN-PHILOSOPHY.md](DESIGN-PHILOSOPHY.md).

> Note: pages were split for the same separation. `ProcessingPage` →
> `pages/processing/` (parse state machine + the confirm / cascade / failed
> views); `HomePage` → `pages/home/` (the Explore panes + `dashboardModel.ts`,
> the dashboard's pure derivations). The page file orchestrates; the logic and
> sub-views live beside it.

---

## Persistence

Everything user-owned is in `localStorage`, namespaced with a `dc_` prefix and validated against a zod schema on every read.

| Key | Shape | Used by |
|---|---|---|
| `dc_reports` | `Report[]` (≤200, 6mo TTL) | ReportsContext |
| `dc_quiz` | `QuizAnswers` | QuizContext |
| `dc_quizComplete` | `boolean` | dashboard gating |
| `dc_pendingConfirm` | unfinished-extraction record | ProcessingPage restore-on-back |
| `dc_aiAutoFallback` | `boolean` (default `true`) | ProcessingPage cascade gate |
| `dc_theme` | raw `'dark'` / `'light'` string | inline bootstrap + ProfilePage |
| `dc_catalogAck` | `number` (catalog version seen) | dashboard migration notice |
| `dc_retestAck` | report id the re-test banner was dismissed for | dashboard re-test nudge |
| `dc_lang` | language code (`'en'` / `'hi'` / …) | LanguageContext — see [I18N.md](I18N.md) |
| `dc_lock` | `{ salt, verifier }` lock metadata | dataLock — at-rest encryption |
| `dc_discreet` | `boolean` | DiscreetContext (screen veil) |

The `dc_theme` key is the only one that breaks the JSON-envelope convention because the pre-React bootstrap can't pull in zod and shouldn't depend on `JSON.parse`. That bootstrap is an **external** file (`public/theme-init.js`), not an inline script, because the production CSP blocks inline scripts — see [THEMING.md](THEMING.md).

If a stored value fails its zod schema, the load helper returns the default and silently re-saves on the next write. This is deliberate — corruption from browser extensions, dev-tools tampering, or a past-buggy version of the app shouldn't crash everyone on every boot.

**At-rest encryption (opt-in).** When the user sets a PIN, `dc_reports` and `dc_quiz`
hold AES-GCM ciphertext envelopes instead of plaintext, keyed by a PBKDF2-SHA256
(200k-iter) derivation of the PIN that lives in memory only. `dc_lock` stores the salt +
a verifier blob (never the PIN or key). The plaintext loaders refuse to read ciphertext,
so a half-migrated state can't silently wipe data. Full model — including the
forgot-PIN-means-wipe trade-off and the cross-context lock-event bus — in
[SECURITY.md](SECURITY.md).

---

## Code splitting

`LandingPage` is eager — it's the first thing a visitor sees and we don't want a chunk flicker before the hero paints.

Every other page is lazy-loaded through `lazyWithReload` (not raw `React.lazy`). The wrapper catches the specific `ChunkLoadError` that happens when a user has the app open during a deploy (old chunk URLs gone) and triggers a hard reload instead of dumping them on the ErrorBoundary.

Per-page chunks: Quiz, RecommendedTests, Home, HealthMap, Upload, Processing, ManualEntry, ReportResults, Compare, ProblemDetail, Profile, Privacy.

Suspense fallback is a low-fidelity `PageSkeleton` — kept deliberately ugly so it never gets mistaken for the real page during slow networks.

---

## Animation

`framer-motion` is the only animation library. `MotionConfig` sets project-wide defaults.

**Page transitions are enter-only — deliberately NOT `AnimatePresence`.** The page host in `App.tsx` is a single `motion.div` keyed on `pageKey(page)`; changing the key unmounts the old page and mounts the new one with an enter animation, no exit. We tried `AnimatePresence` and removed it: its exit-complete callback never reliably fired here, so the outgoing page lingered as a ghost overlay (it read as "infinite scroll" on sign-out). **Don't re-introduce `AnimatePresence` at the page-host level.** `AnimatePresence` is still the right tool *inside* components for mount/unmount of modals and sheets (LearnMoreModal, MarkerSheet, the home panes) — that's where it's used.

We respect `prefers-reduced-motion` — anywhere we animate beyond a fade, there's a `useReducedMotion()` check that short-circuits to no animation.

---

## Build & deploy

```
npm run dev      # vite dev server, port 5173
npm run build    # tsc + vitest + vite build (gates CI)
npm run preview  # serve the production build locally
npm test         # vitest run (subset of npm run build)
```

The build script is intentionally a chain: `tsc --noEmit && vitest run && vite build`. If types fail, tests don't run. If tests fail, the bundle doesn't build. Local equivalents to CI.

Deploy is via Vercel. Every push to any branch gets a preview deploy. Main is protected — only PR-merged changes reach production. The serverless function `/api/parse-image` runs on the same deployment.

Environment variables (`GEMINI_API_KEY`, optional `ALLOWED_ORIGINS`, optional `ALLOW_NO_ORIGIN`) live in Vercel project settings, not in the repo.

---

## What this architecture is good at

- **Privacy.** No backend means no logs of who uploaded what. The Gemini fallback is the one path off-device — disclosed at the point of use, cancelable, and switch-offable in Profile (default-on for a failed *image* parse; off entirely when no `GEMINI_API_KEY` is configured).
- **Cheap to host.** Static SPA + one serverless function. The free Vercel tier covers everything except heavy Gemini use.
- **Fast first paint.** ~150 kB gzipped main bundle, eager landing, route-split everything else.
- **Deterministic on the client.** The whole parser is replayable from a saved file; no server roundtrips means no rate limits to debug.

## What it's *not* good at

- **Multi-device sync.** Reports live in `localStorage` — clear-cache or new-device means a fresh start. No account model.
- **Server-side ingestion.** If you ever wanted to take uploads via email or webhook, the architecture would need a real backend.
- **Heavy concurrent processing.** Tesseract.js runs on the main thread; OCRing a 20-page scanned PDF on a low-end phone takes a minute. Worth noting before promising performance.

These are deliberate trade-offs for the current product stage, not accidents to fix.
