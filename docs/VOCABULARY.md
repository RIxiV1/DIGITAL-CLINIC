# Vocabulary (the product's words)

A single source of truth for the nouns and status words ForMen shows users.
Written during a stabilization pass — the goal is **one word, one meaning**,
so the product reads like it came from one company (Apple/Linear discipline).

This is a reference + findings doc, not a refactor. The mass reconciliation
belongs to the single-owner consolidation pass once the branch is quiet — do
**not** fan out edits across pages now (it would race the active page work).
The canonical source in code is `statusColor` / `STATUS_FILTER_OPTIONS` in
`src/app/data/biomarkers.ts`.

## Status tiers — canonical

| tier (code) | canonical label | use | do NOT use |
| --- | --- | --- | --- |
| `good` | **Healthy** / On track | "Healthy" in the key; "On track" in prose | — |
| `attention` | **Keep an eye** | everywhere | "to watch", "needs attention", "NEEDS ATTENTION" |
| `concern` | **Needs care** | everywhere | "Worth a look", "Needs review", "to review" |
| `critical` | **See a doctor** | everywhere (consistent today ✓) | — |

**Sanctioned exception — count strips only.** The dashboard/report count
chips may read "N need care" / "N to watch" as plural count phrasing. That's
the *only* place an alternate form is allowed; single-item status always uses
the canonical label.

## Findings (real divergences, June 2026)

- **`concern` has four surface forms:** "Needs care" (canonical), "Worth a
  look" (Health Map — now fixed to "Needs care"), "to review"
  (DashboardHeadline count strip — sanctioned), "NEEDS REVIEW"
  (`StatusBadge`). The last is *report-level* state (a report needs review),
  a different axis from a marker's tier — keep it, but be aware a user can
  conflate "review" and "care". Consider "NEEDS A LOOK" for the report badge.
- **`attention`:** "Keep an eye" (canonical) vs "to watch"/"needs attention".
  Reconcile prose to "Keep an eye"; "to watch" allowed only in count strips.
- **`good`:** "Healthy" (the key) vs "On track" (most prose). Both are fine
  but pick a primary — recommend "On track" for prose, "Healthy" for the
  legend — and stop mixing within a single screen.

## Core nouns

| term | means | not |
| --- | --- | --- |
| **Marker** | one measured value (LDL, Vitamin D) — the user-facing word | "result", "value", "reading" in UI copy (`biomarker` is the internal/data term; ProcessingPage uses "result" 27× — reconcile) |
| **Report** | one uploaded lab document | "scan" (the act/photo), "PDF" |
| **Locker** | the saved collection of reports | "history", "library" (pick one if "Locker" stays) |
| **Health Map** | the connected-systems signature view | — see collision below |
| **System** | one of the five body systems (hormonal hub + 4) | "category" (that's the 11 internal data categories) |
| **Trend** | change over time | "movement", "trajectory" (internal only) |
| **Evidence** | strength behind a recommendation (Strong/Moderate/Emerging) | — |
| **Confidence** | ⚠ used for TWO things: parser/OCR read confidence AND `certaintyOfAction` ("High confidence"). Disambiguate — e.g. "read clearly" for OCR, "confidence" for action. |

## Naming collision to resolve

**"Health Map" is used twice.** The new signature section is "Your Health
Map" (ConnectedSystems), but the bottom-nav **Map** tab routes to
`HealthMapPage` (a per-marker systems list). Two things called Map. The
intended end state: the signature *becomes* the Map tab and the old list
retires — a nav change for the consolidation pass (nav is shared/active, so
not now).
