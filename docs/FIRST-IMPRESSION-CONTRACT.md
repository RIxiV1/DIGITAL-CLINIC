# The First-Impression Contract

> **Prioritize confidently. Synthesize conservatively. Never force a narrative.**

This document governs every surface that interprets a report for a human —
the first screen after upload above all. Those screens are **implementations
of this contract, not free designs.** If a future "Body Story" / results
headline / dashboard summary cannot satisfy the contract below, it is not
shippable, no matter how good it looks.

It is written **experience-first on purpose.** The feeling comes before the
logic; the logic exists to earn the feeling honestly.

---

## 1. The feeling (the goal, before any rule)

In the first ~30 seconds after upload, the user should feel — in this order:

1. **Reassured** — they are not in the dark, and (unless it's genuinely
   urgent) they are probably okay.
2. **Understood** — the screen reflects *them* (their intake, their history),
   not a generic template.
3. **Curious** — there is one thing worth looking at, and they want to know more.
4. **Empowered** — they know what to *do*, even if the diagnosis is uncertain.
5. **Educated** — last, and only after the four above.

The most common failure mode — for AI-built health tools especially — is to
deliver #5 first and never deliver #1–#4 at all.

---

## 2. The five questions (the enforceable contract)

Above the fold, in order, the screen MUST answer all five:

1. **Am I generally okay?**
2. **What is the single most important thing?**
3. **Why does that thing matter?**
4. **What should I do next?**
5. **What can this report *not* tell me?**

A screen that leaves any of the five unanswered is incomplete by definition,
not by taste. See §5 for how this is enforced in code rather than in review.

---

## 3. The honesty gates (where product meets clinical safety)

The five questions are a product contract. These gates keep them from
becoming clinically unsafe under the pressure to feel good:

- **Q1 is data-gated, never reflexively reassuring.** Reassurance is the
  *default voice*, not a *default answer*. If the report contains a critical
  finding (a value past `criticalLow`/`criticalHigh`), Q1's honest answer is
  **not** "you're okay" — it is "most of this looks fine, and one thing needs
  prompt attention." A contract that always says "you're okay" is a liar with
  good typography, and it is the most dangerous thing this app could ship.

- **Q2 prioritizes confidently.** Ranking the most pressing marker is *always*
  safe — it's severity ordering, not diagnosis. This is the screen's spine and
  the one place it is allowed to be unhedged.

- **Q3 explains, it does not diagnose.** "Why it matters" is the harm anchor +
  the user's own context (`markerContextNote`), phrased as *what the number is
  associated with*, never *what disease you have*.

- **Q4 carries `certaintyOfAction`, not `certaintyOfDiagnosis`** (see §4).

- **Q5 is always present.** `reportLimitations` is not an optional footer; a
  single report's blind spots are part of the first impression, not an
  apology buried below the fold.

- **The synthesis rule.** The screen may name a *pattern* ("a metabolic
  pattern") **only** when the markers actually meet a recognized, citable
  cluster definition (e.g. metabolic-syndrome criteria; a hypogonadism
  cluster). Absent that, it must present findings as what they are. The engine
  **must be able to say "these are separate."** A narrative layer that can
  only ever unify is not a clinician — it's a horoscope.

---

## 4. `certaintyOfAction` — a new primitive

The insight behind this: **users do not need certainty about diseases. They
need certainty about what to do next.** Decouple the two.

- `certaintyOfDiagnosis` is frequently **low** — one blood draw rarely
  diagnoses anything, and the app should never pretend otherwise (Q5, §3).
- `certaintyOfAction` is frequently **high** — "talk to your doctor about
  this," "confirm with a fasting glucose," "retest in 12 weeks," "watch this
  trend" are robust recommendations *even when the meaning is uncertain.*

The screen should radiate the second kind of certainty, not the first. "I'm
not sure what this means, but I'm sure what you should do" is exactly how the
best clinician sounds.

This is **derivable from data that already exists** — it is a mapping, not a
new collection problem:

| Action | Trigger (already in the model) | Certainty |
| --- | --- | --- |
| See a doctor promptly | value past `criticalLow`/`criticalHigh` | high |
| Discuss with your doctor | `concern` tier | high |
| Confirm / retest | India confirm-caveats in `plain`; borderline tier | high |
| Compare the trend | `history.length > 0` / `getTrajectory` | high |
| Keep on schedule | `good` tier + `getRetestReminder` | high |

---

## 5. What feeds each answer (so this is buildable, not aspirational)

| # | Question | Existing primitive it consumes |
| --- | --- | --- |
| 1 | Am I okay? | `summarizeStatuses` + the critical-override gate (§3) |
| 2 | The one thing | `pickHeadlineMarker` / `rankFlaggedMarkers` |
| 3 | Why it matters | harm anchor (`actionSource`) + `markerContextNote` (intake) |
| 4 | What to do next | `certaintyOfAction` map (§4) + `getRetestReminder` |
| 5 | What it can't tell me | `reportLimitations` + `reportProvenance` |

The interpretation engine (`src/app/clinical/`) already holds or is growing
every one of these. "Your Body's Story" is the **presentation of this engine**,
owned by the clinical layer — not a parallel build.

---

## 6. Enforcement (so the contract holds when someone's in a hurry)

A contract that lives only in a doc is a suggestion. Make it a type:

```ts
// A first-impression view-model cannot be constructed with a missing slot.
type FirstImpression = {
  okay: OkayVerdict;          // Q1 — gated; encodes the critical override
  headline: RankedMarker;     // Q2 — never empty when markers exist
  why: WhyItMatters;          // Q3 — harm anchor + context, no diagnosis
  next: ActionWithCertainty;  // Q4 — certaintyOfAction, not diagnosis
  limits: ReportLimitations;  // Q5 — always present
};
```

Then a guard test — in the spirit of the existing copy-guard tests — asserts
that no `FirstImpression` renders with an empty slot, and that `okay` is never
"you're fine" while a critical marker is present. The five questions stop being
something a reviewer has to remember and become something the build refuses to
skip.

---

## 7. Ownership

This contract is a cross-cutting **product + clinical** spec. Implementation —
the `FirstImpression` type, the guard test, and the screen — belongs to the
clinical interpretation layer (`src/app/clinical/`), not to a page refactor.
Treat this file as the brief that layer is built against.
