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
                                     │  Pipeline 3 only — opt-in
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

There are three React contexts, combined under one `AppProvider`:

```
AppProvider (src/app/AppContext.tsx)
├── NavigationProvider   →  the typed Page state machine + URL sync
├── QuizProvider         →  the symptom/priority quiz answers + risk tiers
└── ReportsProvider      →  the user's locker of lab reports
```

Each context exposes hooks (`useNavigation()`, `useQuiz()`, `useReports()`) and a `loadXxx()` / `saveXxx()` pair in `utils/persistence.ts`.

### NavigationContext — the no-router system

We don't use React Router for navigation. Instead, a typed union models every page in the app:

```ts
// src/app/contexts/types.ts
export type Page =
  | { type: 'landing' }
  | { type: 'home' }
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'manualEntry' }
  | { type: 'results'; reportId: string }
  | { type: 'problem'; problemId: string }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'profile' };
```

`navigate(page)` pushes a new URL with `?page=...` params; `replace(page)` swaps the current entry. Browser back/forward works through `location.key`. The whole thing is ~250 lines. See [NAVIGATION.md](NAVIGATION.md) for the deep dive.

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

The `dc_theme` key is the only one that breaks the JSON-envelope convention because the pre-React inline script in `index.html` can't pull in zod and shouldn't depend on `JSON.parse`. See [THEMING.md](THEMING.md).

If a stored value fails its zod schema, the load helper returns the default and silently re-saves on the next write. This is deliberate — corruption from browser extensions, dev-tools tampering, or a past-buggy version of the app shouldn't crash everyone on every boot.

---

## Code splitting

`LandingPage` is eager — it's the first thing a visitor sees and we don't want a chunk flicker before the hero paints.

Every other page is lazy-loaded through `lazyWithReload` (not raw `React.lazy`). The wrapper catches the specific `ChunkLoadError` that happens when a user has the app open during a deploy (old chunk URLs gone) and triggers a hard reload instead of dumping them on the ErrorBoundary.

Per-page chunks: Quiz, RecommendedTests, Home, Upload, Processing, ManualEntry, ReportResults, ProblemDetail, Profile.

Suspense fallback is a low-fidelity `PageSkeleton` — kept deliberately ugly so it never gets mistaken for the real page during slow networks.

---

## Animation

`framer-motion` is the only animation library. `AnimatePresence` wraps the page host so cross-route transitions can be choreographed (fade-out the old page, fade-in the new). `MotionConfig` sets project-wide defaults.

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

- **Privacy.** No backend means no logs of who uploaded what. Even the Gemini fallback is opt-in and surfaces a clear "image leaves your device" disclosure.
- **Cheap to host.** Static SPA + one serverless function. The free Vercel tier covers everything except heavy Gemini use.
- **Fast first paint.** ~150 kB gzipped main bundle, eager landing, route-split everything else.
- **Deterministic on the client.** The whole parser is replayable from a saved file; no server roundtrips means no rate limits to debug.

## What it's *not* good at

- **Multi-device sync.** Reports live in `localStorage` — clear-cache or new-device means a fresh start. No account model.
- **Server-side ingestion.** If you ever wanted to take uploads via email or webhook, the architecture would need a real backend.
- **Heavy concurrent processing.** Tesseract.js runs on the main thread; OCRing a 20-page scanned PDF on a low-end phone takes a minute. Worth noting before promising performance.

These are deliberate trade-offs for the current product stage, not accidents to fix.
