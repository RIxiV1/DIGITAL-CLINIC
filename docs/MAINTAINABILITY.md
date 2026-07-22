# Maintainability check — for future me

Snapshot: **2026-06-28**, refreshed **2026-07-22**, branch `design/monolith-dashboard-demo`.
(Refresh re-measured: deps, test count, `clinical/` coverage, file sizes, and the `main` delta. LOC and the page-coverage ratio are still approximate.)
Re-run the metrics before trusting them; they drift.

## The numbers

| metric | value | read |
| --- | --- | --- |
| source LOC (excl tests) | ~30,000 | mid-size app, not bloated |
| test files | 43 (+1 Playwright e2e) | healthy for the size |
| `clinical/` coverage | **10/10 modules tested** | the interpretation spine is the safest code — extend it, don't bypass it |
| page coverage | deep tests on a few; a render smoke covers every page | thin on deep page tests, but OK *because* logic is extracted to tested `clinical/`+`utils` and pages are presentational. Keep that pattern. |
| TODO/FIXME/HACK | **0** | clean |
| runtime deps | 11 | lean |
| gate | tsc + 805 tests + build all green | ✅ |
| **commits ahead of `main`** | 0–few (main kept current) | ✅ P0 resolved |

## Risks, prioritized

**P0 — RESOLVED (2026-07-22).** `main` is now kept current — the branch is
merged continuously (HEAD is ~0–2 commits ahead of `origin/main` at any time),
so audits grade the real tree. Keep it that way: isolate and merge; don't let a
big delta re-accumulate.

**P1 — Two files still concentrate the real logic risk:**
- `data/biomarkers.ts` (1,344) — mixes DATA (`sampleBiomarkers`, categories)
  with LOGIC (`statusColor`, `bottomLineFor`, trend helpers). Interpretation
  now lives in *two* places (here + `clinical/`). The `interpretMarker()`
  consolidation should pull this logic into `clinical/`.
- `utils/persistence.ts` (895) — localStorage schema + migrations, highest
  blast radius (data-loss risk). Tested; treat changes here with care.
- ~~`services/pdfParser.ts` (1,893 lines)~~ **DONE** — split by stage into
  `services/parser/*.ts` (`pdfTextLayer`, `ocrPipeline`, `catalogMatcher`,
  `outOfScope`, `regexUtils`); `pdfParser.ts` is now a ~362-line orchestrator +
  re-export barrel. Corpus tests still green.

**P1 — Big pages** (HomePage 968, QuizPage 929, ReportResultsPage 1,122).
Per the rule "review, not auto-split": fine as long as logic keeps migrating
to tested models (HomePage→`pages/home/dashboardModel`, report→`clinical/`).
Never let interpretation logic accumulate back in a page.

**P2 — Coherence debt (documented, queued for the consolidation pass):**
- Vocabulary divergence — `docs/VOCABULARY.md` (status tiers, "confidence"
  overload → Read quality / Evidence strength / Action confidence).
- Accent colour: in-app uses `indigo` (~154×) vs `forest` (~15×) vs the
  landing's warm-stone `blue-*` ramp. Pick one accent; reconcile once.
- Two contributors commit to this branch under one git identity → "isolate
  before commit" is manual discipline, not enforced. Stage explicit files.

## The pattern that's working — protect it

`clinical/` is pure, fully tested interpretation; components/pages are
presentational and read from it. That's *why* thin page-test coverage is
safe. The single rule that keeps this maintainable: **interpretation logic
lives in `clinical/` (or a tested model), never in a component.** Everything
good about this codebase's testability follows from that.

## Future-me checklist (in order)

1. ~~Merge to `main` (milestone)~~ **DONE** — `main` is kept current; keep it that way.
2. `interpretMarker()` consolidation — one source for status/tier/bottom-line/risk.
3. Vocabulary + "confidence" reconciliation (`docs/VOCABULARY.md`).
4. ~~Split `pdfParser.ts` by stage~~ **DONE** — see `services/parser/*.ts`.
5. Accessibility as a **release gate** (see the planned `RELEASE-CHECKLIST.md`).
6. Keep extracting page logic into tested models; pages stay dumb.
