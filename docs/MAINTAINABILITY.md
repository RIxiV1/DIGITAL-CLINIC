# Maintainability check — for future me

Snapshot: **2026-06-28**, branch `design/monolith-dashboard-demo`.
Re-run the metrics before trusting them; they drift.

## The numbers

| metric | value | read |
| --- | --- | --- |
| source LOC (excl tests) | ~29,000 | mid-size app, not bloated |
| test files | 36 (+1 Playwright e2e) | healthy for the size |
| `clinical/` coverage | **8/8 modules tested** | the interpretation spine is the safest code — extend it, don't bypass it |
| page coverage | 4/13 pages | thin, but OK *because* logic is extracted to tested `clinical/`+`utils` and pages are presentational. Keep that pattern. |
| TODO/FIXME/HACK | **0** | clean |
| runtime deps | 25 | lean |
| gate | tsc + 675 tests + build all green | ✅ |
| **commits ahead of `main`** | **30** | ⚠ see P0 |

## Risks, prioritized

**P0 — `main` is a stale snapshot; the branch is the real product (30 commits ahead).**
The longer this sits unmerged, the scarier the merge and the more "audits"
grade the wrong tree. *Action:* merge to `main` as the "Person over Report"
milestone (tag + changelog), then keep `main` current. This is the single
biggest maintainability risk right now.

**P1 — Three files concentrate the real logic risk:**
- `services/pdfParser.ts` (1,893 lines) — the data-integrity gate, complex,
  one giant file. It *is* corpus-tested, but a 1.9k-line file is hard to
  review for clinical correctness. *When you next touch it,* split by stage
  (text-layer → OCR → unit reconciliation → catalog matching). Don't
  pre-emptively split.
- `data/biomarkers.ts` (1,344) — mixes DATA (`sampleBiomarkers`, categories)
  with LOGIC (`statusColor`, `bottomLineFor`, trend helpers). Interpretation
  now lives in *two* places (here + `clinical/`). The `interpretMarker()`
  consolidation should pull this logic into `clinical/`.
- `utils/persistence.ts` (891) — localStorage schema + migrations, highest
  blast radius (data-loss risk). Tested; treat changes here with care.

**P1 — Big pages** (HomePage 932, QuizPage 929, ReportResultsPage 830).
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

1. Merge to `main` (milestone) — stop the delta growing.
2. `interpretMarker()` consolidation — one source for status/tier/bottom-line/risk.
3. Vocabulary + "confidence" reconciliation (`docs/VOCABULARY.md`).
4. Split `pdfParser.ts` by stage — only when you next touch it.
5. Accessibility as a **release gate** (see the planned `RELEASE-CHECKLIST.md`).
6. Keep extracting page logic into tested models; pages stay dumb.
