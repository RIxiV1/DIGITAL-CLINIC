<div align="center">

# Digital Clinic

**A patient-facing health dashboard that turns lab reports into plain English — entirely in the browser.**

Upload a PDF or photo of your blood work. The app parses it client-side (no server, no upload), scores you across hormonal / metabolic / cardiac / thyroid / vitamin axes, and shows trends over time. Pairs with a symptom quiz that recommends the right tests when you don't have a report yet.

<p>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 18.3" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.6" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6.0" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Vitest-4.1-7E9B4E?style=flat-square&logo=vitest&logoColor=white" alt="Vitest 4.1" /></a>
</p>

<sub><a href="https://digital-clinic-omega.vercel.app">Live demo</a> · built for <a href="https://formen.co.in">ForMen</a></sub>

</div>

---

<!-- Drop a 1:1 or 16:9 GIF / screenshot here once deployed: -->
<p align="center"><img src="docs/preview.png" alt="Digital Clinic walkthrough" width="720" /></p>

## Why this exists

Most lab reports in India are 4–10 page PDFs with subset fonts, dense tables, and zero accessibility. Patients get the file, glance at the "out of range" highlights, and panic — or ignore it. Digital Clinic re-presents the same data the way a friend who happens to be a doctor would: a single dashboard score, marker-by-marker plain-English explanations, and a "what to do next" rather than a wall of numbers.

The whole thing runs in the browser. No file is ever uploaded to a server.

## Highlights (the parts worth reading the code for)

**Multi-strategy PDF parser** — `src/app/services/pdfParser.ts`
PDF text extraction is notoriously fragile. This pipeline runs three reconstruction strategies in parallel and picks the candidate that yields the most catalog matches:
- Adaptive Y-tolerance line grouping (handles dense Indian-lab tables where rows pack tighter than pdfjs's default heuristic expects)
- X-gap–aware token joining (so `43` doesn't get split into `4 3` by the renderer and parse as `4` — a real bug seen on Thyrocare/SRL/Metropolis output)
- CID-keyed font handling via `cMapUrl` + `cMapPacked` for subset fonts

**OCR fallback for scanned reports** — Tesseract.js renders each PDF page at 2.5× and re-extracts when the text layer is empty or yields no catalog hits. Per-page timeout, page cap, and OCR-artefact normalisation (`5 .` → `5.`) keep it from stalling on pathological inputs. Same path handles JPEG / PNG uploads.

**Biomarker catalog with alias matching** — the catalog drives both parsing and rendering. Each marker knows its clinical aliases, reference ranges, optimal sub-ranges, and direction semantics (`band` / `up` / `down`) so a single component can correctly visualise "higher is better" (HDL) and "lower is better" (LDL) without per-marker branching.

**Clinical status logic that leans away from false assurance** — `statusForValue` grades each reading into optimal / borderline / out-of-range / critical. It trusts the lab's *own printed reference range* over our hardcoded band (no "your lab says normal, we say not" trust breaks), gates every "optimal" and harm-anchor line behind a **required citation** (cite-or-omit; no fabricated clinical lines), and localizes ranges to Indian guidelines (ICMR, Lipid Association of India, IAP). Ranges were audited against those guidelines and real Indian-lab references with adversarial verification — see [docs/CLINICAL-ACCURACY.md](docs/CLINICAL-ACCURACY.md).

**No backend, no auth, type-safe navigation** — a custom `NavigationContext` exposes a discriminated-union `Page` type on top of react-router primitives, so route params (`reportId`, `problemId`) are typed end-to-end and impossible-state navigations are caught at compile time. Pages are route-split via `React.lazy` with a stale-deploy guard: if a chunk fetch fails (user had the app open across a deploy), it hard-reloads instead of dropping them on an error boundary.

**Accessibility & motion** — `prefers-reduced-motion` cascaded through `MotionConfig` at the root so every framer-motion descendant collapses to 0ms without per-component checks. Skip-link to main content. Focus management on modals. Semantic landmarks throughout.

## How it works

```
PDF / image upload
      │
      ▼
┌─────────────────────────────────────────────┐
│  pdfjs text layer  ──► 3 reconstruction     │
│                        strategies in parallel│
│                                              │
│  (fallback) ──────► Tesseract.js OCR        │
└─────────────────────────────────────────────┘
      │
      ▼
  Normalisation (OCR artefacts, unit fixes)
      │
      ▼
  Biomarker catalog match (best candidate wins)
      │
      ▼
  Persist to localStorage  ──►  Dashboard / Results / Trends
```

State lives in two React contexts (`QuizContext`, `ReportsContext`) with `localStorage` persistence. No network calls outside loading the PDF/OCR workers.

## Stack

- **UI** — React 18, TypeScript, Tailwind CSS v4, framer-motion, lucide-react
- **Build** — Vite 6, route-level code splitting
- **Parsing** — pdfjs-dist 5, tesseract.js 7
- **Export** — jspdf for downloadable result reports
- **Test** — Vitest + Testing Library + jsdom

## Local development

Requires Node `>=20.11 <23`.

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # vitest run
npm run build        # tsc --noEmit && vitest run && vite build
npm run preview      # serve dist/
```

`npm run build` runs typecheck and tests before bundling — the build fails fast on either.

## Project Structure

```text
src/
└── app/
    ├── components/  # Reusable UI (BiomarkerBar, HealthRing, Sparkline, modals)
    ├── contexts/    # React Contexts (Quiz, Reports, Navigation)
    ├── data/        # Static catalogs (biomarkers, tests, quiz questions)
    ├── pages/       # Route-level page components (Landing, Quiz, Upload, HomePage, etc.)
    ├── services/    # Client-side services (PDF parser pipeline, PDF report exporter, API)
    └── utils/       # Global utilities (localStorage helpers, lazy reloading, a11y hooks)
```

## Docs

For anyone (human or AI) digging into the code, start here:

- **[AGENTS.md](AGENTS.md)** — repo conventions, sharp edges, commit rules. Read this first.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — 10-minute system map: state, routing, code-splitting, the upload flow.
- **[docs/PARSER.md](docs/PARSER.md)** — the multi-strategy PDF / OCR / Gemini pipeline. The hardest part of the codebase.
- **[docs/CLINICAL-ACCURACY.md](docs/CLINICAL-ACCURACY.md)** — how a value becomes optimal / borderline / out-of-range / critical, the "trust the pathologist" rule, range validation, and the false-alarm vs false-assurance trade-offs.
- **[docs/NAVIGATION.md](docs/NAVIGATION.md)** — the no-router `NavigationContext`, typed `Page` union, the `location.key` back() trick, and the StrictMode async-navigation gotcha.
- **[docs/THEMING.md](docs/THEMING.md)** — semantic tokens, dark-default bootstrap, `[data-theme='light']` scope-local islands.
- **[docs/I18N.md](docs/I18N.md)** — the UI-language system: dictionary, English-fallback chain, and why clinical copy is never auto-translated.
- **[docs/MOBILE.md](docs/MOBILE.md)** — mobile-first patterns and footguns: PWA install, fixed nav, `min-w-0`, 44px touch targets, OCR prewarm.
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — workflow, commits, branches, where to make common changes.

## Status

Built as a 3-month contract engagement. Production-grade build pipeline (typecheck + tests gating the bundle), deployable to any static host, currently configured for Vercel via `vercel.json`. PRs and forks welcome.
