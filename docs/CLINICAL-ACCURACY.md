# Clinical Accuracy

The parser ([PARSER.md](PARSER.md)) gets a number off the page. This doc is about what happens next: how that number becomes **"optimal / borderline / out of range / critical"**, and the rules that keep that judgement honest.

On a patient-facing health app there are exactly two ways to get this wrong, and they are not equally bad:

- **False alarm** — a healthy value shown as a problem. Cost: needless anxiety, an unnecessary doctor visit. Annoying, erodes trust.
- **False assurance** — an out-of-range value shown as normal. Cost: a real problem goes unnoticed. **This is the dangerous one**, and every design choice below leans away from it.

If you're editing reference ranges, the tiering logic, or the catalog, read this first.

---

## The four tiers

A reading lands in one of four statuses ([`BiomarkerStatus`](../src/app/data/biomarkers.ts)):

| Tier | Means | UI tone |
|---|---|---|
| `good` | Inside the **optimal** sub-band (or the healthy range when no optimal band is set) | Green "Optimal" |
| `attention` | Inside the healthy range but **outside the optimal sub-band** | Neutral "Borderline" — deliberately calm, this is not a clinical concern |
| `concern` | **Outside the healthy range**, but not at a panic value | Amber "Out of range" |
| `critical` | Past an explicit same-day-care cliff | Red "Critical" |

The fourth tier exists because a three-tier system lumped `platelet 149k` (mild, watch it) in with `platelet 8k` (ER now) under identical copy. `attention` exists so that "not perfect" doesn't read like "something's wrong."

---

## How a value becomes a tier

All of it lives in one pure function, [`statusForValue(template, value, labRef?)`](../src/app/data/biomarkers.ts) (≈ L1037, after the catalog data moved to `biomarkerCatalog.ts`). The order of checks is the whole design — read it top to bottom:

```
1. value < criticalLow  OR  value > criticalHigh   → 'critical'   (catalog only; checked FIRST)
2. pick the healthy band:  labRef if the lab printed one, else catalog min/max
3. value outside that healthy band                 → 'concern'
4. value inside healthy but outside optimal band   → 'attention'
5. otherwise                                       → 'good'
```

Worked example — fasting glucose, catalog healthy `70–99`, optimal `75–90`, criticalHigh `250`:

| Value | Tier | Why |
|---|---|---|
| 85 | `good` | inside optimal |
| 95 | `attention` | healthy, but above the 90 optimal ceiling |
| 110 | `concern` | above healthy 99 |
| 260 | `critical` | past the 250 cliff (step 1 wins before anything else) |

---

## The three rules that keep it honest

### 1. Trust the signing pathologist's printed range

When the parser captures the lab's **own printed reference range** (`labRef`), that range — not our catalog `min`/`max` — decides `concern` vs `good` (step 2 above). The reasoning: the lab that ran the assay knows its own instrument, method, and population calibration better than our hardcoded standard does. A user seeing "your lab said 30–40 is normal, this app says you're out of range" is a trust break we refuse to create.

**The one exception, and it matters:** the `critical` check (step 1) runs *before* the `labRef` override and always uses the **catalog's** `criticalLow`/`criticalHigh`. Critical cliffs are absolute panic values, not range-relative — so a printed lab range can never *rescue* a value from the critical tier. This is deliberate (a genuine panic value should always escalate) but it has a sharp consequence: **a wrong `criticalHigh` produces a false `critical` alarm on every path, PDF included.** Critical thresholds get the most scrutiny for exactly this reason.

What this means for "is our catalog range correct?":

| If this is wrong… | It misleads the user… | Severity |
|---|---|---|
| catalog `min`/`max` | only when no `labRef` was captured — **manual entry**, or a lab/OCR that didn't print a range | medium |
| `criticalLow`/`criticalHigh` | **always** — `labRef` can't override it | **high** |
| `optimalMin`/`optimalMax` | always, but only flips `attention` ↔ `good` (nags; never fakes disease) | low |

### 2. Cite or omit — never a fabricated clinical line

Two optional bands carry a **required citation**, enforced structurally:

- `optimalMin`/`optimalMax` need `optimalSource`.
- `actionMin`/`actionMax` (the dashed "harm-anchor" tick on the result bar — e.g. the HbA1c ≥6.5% diabetes line) need `actionSource`.

The tick literally cannot render without its source: [`BiomarkerBar.tsx`](../src/app/components/BiomarkerBar.tsx) gates it on `!!marker.actionSource`. An uncited clinical threshold is worse than no threshold — it looks invented and erodes the whole product's credibility. If you can't cite it, don't draw it.

**Cite-or-omit extends to the "what helps" recommendations, too.** Each action-plan lever is graded at render time by [`clinical/evidence.ts`](../src/app/clinical/evidence.ts) (`evidenceForRecommendation`): a lever it can tie to a named source gets a **Strong / Moderate / Emerging** tier (GRADE-aligned certainty language), the specific outcome it supports (never a blanket claim), and a tappable source link — rendered through the shared [`EvidenceBadge`](../src/app/components/EvidenceBadge.tsx) on both the action plan ([`ProblemDetailPage`](../src/app/pages/ProblemDetailPage.tsx)) and the marker "Learn more" modal. A lever it can't ground returns `null` and shows **no badge** — an ungraded line is honest; a guessed "Strong evidence" would be the same false authority this rule forbids for clinical thresholds.

### 3. India-first ranges

Where Indian guidance diverges from Western defaults, we follow the Indian one and cite it:

| Marker | Our floor/target | Source |
|---|---|---|
| Vitamin D | ≥20 ng/mL (not the US Endocrine Society's 30) | IOM / IAP |
| Male haemoglobin | ≥13.0 g/dL | WHO / India |
| LDL | targets per Lipid Association of India | LAI 2020 |
| Diabetes (HbA1c ≥6.5, FPG ≥126) | WHO/ICMR diagnostic lines | ICMR 2018 |

When adding or editing a range for this India-first, adult-male audience, prefer an Indian guideline source. See the catalog comments and [PARSER.md](PARSER.md#the-catalog-and-the-matcher).

(Two more layers belong to the parser, not the tiering, but they protect accuracy too: **sanity bounds** reject OCR garbage before it's graded, and the **hallucination guard** stops an invented marker from being rendered. Both are in [PARSER.md](PARSER.md#sanity-bounds).)

---

## How the ranges are validated

The catalog's ~75 graded markers were audited against authoritative guidelines and real Indian-lab reference ranges. The method (worth repeating whenever ranges change):

1. **Source of truth, India-first.** ICMR (diabetes), Lipid Association of India (lipids), Endocrine Society / AACE (hormones), KDIGO (eGFR), WHO 2021 (semen) — then cross-checked against published reference ranges from Thyrocare, Dr Lal PathLabs, Metropolis, SRL, and Tata 1mg Labs.
2. **Per-marker verdict:** `accurate` (matches consensus), `minor` (defensible lab-to-lab variation), or `concern` (clinically meaningful mismatch).
3. **Adversarial second pass.** Every flagged range is re-checked by an independent reviewer whose default stance is *"the flag is wrong, refute it."* Only flags that survive refutation become tracked issues. This is what stops the audit itself from generating false alarms.

A range change should clear the same bar: a citation, a sanity-check against what major Indian labs actually print, and a moment's thought about which tier the change moves people between (and in which direction — toward or away from false assurance).

---

## Known limitations & interpretation caveats

Honest list of where a reading can still mislead, and the safe resolution. These are tracked, not hidden.

| Marker | Issue | Direction | Resolution |
|---|---|---|---|
| **Blood Urea (BUN)** | ✅ **Fixed.** One marker aliases both *BUN* (≈7–20 mg/dL) and *Urea* (≈15–40 mg/dL) — different conventions ~2.14× apart. It used to grade both against the BUN band with `criticalHigh: 47`, so a normal "Urea ~50" tripped a **false `critical`** (the cliff is checked before `labRef`) and manual-entry "Urea 21–40" read `concern`. Now re-scaled to the India-first urea convention (band `15–40`, `criticalHigh: 100`). Residual: a genuine *BUN*-scale critical entered without a printed range surfaces as `concern` rather than `critical` (rare for this audience; never silent). A precise `bun`/`urea` split is deferred — it needs a matcher change (bare "Urea" substring-matches "Blood Urea Nitrogen", and the matcher emits every matching template). | was false critical → resolved | Done (re-scale). Full split tracked. |
| **Free Testosterone** | ✅ **Caveat added; full support deferred.** `8.7–25.1 pg/mL` is correct for the **direct/analog immunoassay** most Indian labs run, but not for calculated/equilibrium-dialysis free-T (~120–368 pg/mL, same `pg/mL` unit). On the PDF path, `physicalMax: 60` already **drops** calculated-scale values to "couldn't map" (so they're not falsely flagged), and a printed range grades them correctly via `labRef`. The plain copy now warns the band assumes a direct assay and to defer to the printed range. We deliberately do **not** auto-switch the band by magnitude: a ~55 direct value (pathologically high) and a ~55 calculated value (low) are indistinguishable from the number alone, so a heuristic would risk false assurance. Full method-aware grading needs an explicit assay signal (deferred). | residual: manual entry of a calculated value can over-flag | Caveat done; method-aware grading tracked. |
| **SHBG** | ✅ **Fixed.** Upper bound was `50 nmol/L`, below most lab ceilings (≈57–76); SHBG rises with age, so healthy older men read "high." Raised to `57` (consensus adult-male ceiling). Only bit without a `labRef`; low stakes. | was false alarm → resolved | Done. |
| **HbA1c** | ✅ **Addressed.** Thresholds are correct (5.7 / 6.5) — no number change. HbA1c is unreliable in Indian populations (iron-deficiency anaemia → spuriously high; thalassaemia/G6PD → either way). The anaemia / confirm-with-glucose caveat now shows in the plain copy at **every tier** (not only the harm-anchor tick, which is concern/critical-gated). | risk via assay, not our numbers | Done (caveat in copy). |
| **eGFR** | ✅ **Fixed.** KDIGO stages now map onto the four tiers via the band: ≥90 (G1) `good`, 60–89 (G2, mildly reduced — not CKD alone) `attention`, <60 (G3, CKD) `concern`, <30 `critical`. Healthy floor moved 90→60 (the KDIGO CKD cutoff) + an optimal band at ≥90 (KDIGO-cited). This makes the meaningful <60 cutoff visible *and* stops 60–89 reading as a false "out of range" for older adults — and resolves an inconsistency (the copy already said "<60 indicates CKD" while the band flagged <90). | was mild false assurance + false alarm → resolved | Done. |

Everything else in the audited set (51 of the graded markers checked clean, plus the rest) matched guideline consensus within accepted lab-to-lab variation.

---

## Clinical sign-off checklist (before real patients)

This is the honest gap between "the engineering is sound" and "a clinician has
approved what we tell people." Everything below is a **clinical judgement**, not
a code change — a doctor should approve or correct each item. It is written to be
actionable in about an hour. Nothing here is silent: each item is a value that
currently grades as `concern` ("discuss with your doctor") when it *might* warrant
`critical` ("speak to a doctor promptly"), i.e. possible **under**-escalation.

**Why these aren't already set:** every critical threshold in the catalog fires
regardless of the lab's printed range, so an over-aggressive one manufactures a
same-day panic on a healthy person. Under-escalation and over-escalation are both
harms; picking the cutoff is a clinician's call. The structural failures (values
being *deleted* before they could be graded — see the ceiling audit in
[`emergencyEscalation.test.ts`](../src/app/clinical/emergencyEscalation.test.ts))
have been fixed; these remaining ones are threshold *judgements*.

Already done and pinned by test: emergency escalation for K⁺, Na⁺, Hb, glucose,
creatinine, platelets, WBC, Ca²⁺, AST, ALT, and — mirroring the reviewed TSH
storm/myxedema thresholds — **Free T4** (`criticalLow 0.3`, `criticalHigh 5.0`
ng/dL; confirm these two numbers).

**Needs a clinician to decide `criticalLow`/`criticalHigh` (or confirm "leave as concern"):**

| Marker | Band | The same-day scenario | Suggested cutoff to confirm/reject |
|---|---|---|---|
| **Cortisol (AM)** | 6.2–19.4 µg/dL | Adrenal insufficiency / crisis. Genuinely uncovered — no other marker catches it. | `criticalLow` ~3 µg/dL (Endocrine Society: AM cortisol <3 strongly suggests adrenal insufficiency) |
| **Free T3** | 2.3–4.2 pg/mL | T3 toxicosis. Partly covered by TSH + Free T4 now. | `criticalHigh` ~2× ULN? or leave — TSH/FT4 catch the storm |
| **Total T3 / T4** | 80–200 / 4.5–12 | Thyroid emergency, but totals move with binding proteins → less reliable alone | Likely leave as concern; confirm |
| **ALP** | 44–147 U/L | Very high = biliary obstruction/malignancy, but rarely *same-day* off the number alone | Likely leave as concern; confirm |
| **GGT** | 9–48 U/L | Marker of the cause, not itself an emergency | Likely leave as concern; confirm |
| **Iron** | 65–175 µg/dL | Acute iron toxicity (ingestion), not a routine-panel emergency | Likely leave as concern; confirm |
| **Albumin** | 3.5–5 g/dL | Severe hypoalbuminaemia matters but isn't same-day off the number | Likely leave as concern; confirm |

**Also for the same reviewer, one pass each:**

- **The 5 unevidenced labs.** The upload screen names Thyrocare, Dr Lal PathLabs, SRL, Metropolis, Apollo, Healthians as "labs we read fluently." Only **Dr Lal PathLabs** is evidenced (real published specimen, in the corpus). Either evidence the other five with a real report each (drop into `extraction.corpus.test.ts`) or soften the claim.
- **Indirect bilirubin** — genuine catalog gap (we carry total + direct).
- **The direct/analog vs calculated Free-T assay ambiguity** — already caveated in copy; confirm the caveat wording is enough.

---

## Where to change things

| You want to… | Edit | Then |
|---|---|---|
| Change a healthy range | `data/biomarkerCatalog.ts` → `min`/`max` on the template | cite the source in a comment; re-run the audit bar above |
| Change a critical cliff | `data/biomarkerCatalog.ts` → `criticalLow`/`criticalHigh` | **highest care** — this fires regardless of `labRef`; validate against published panic values |
| Add/tighten an optimal band | `data/biomarkerCatalog.ts` → `optimalMin`/`optimalMax` **+ `optimalSource`** | no source → don't add it |
| Add a harm-anchor tick | `data/biomarkerCatalog.ts` → `actionMin`/`actionMax` **+ `actionSource`** | tick won't render without the source |
| Change how tiers are derived | `data/biomarkers.ts` → `statusForValue()` | update [`biomarkers.test.ts`](../src/app/data/biomarkers.test.ts) — it pins the tier boundaries |

---

## Tests

`statusForValue` and the tier boundaries are pinned in [`src/app/data/biomarkers.test.ts`](../src/app/data/biomarkers.test.ts) — in/out of healthy range, optimal-band edges, the critical tier, and the `labRef`-priority override. If you touch the tiering or a range that has an edge-case test, expect that file to need updating. Run it:

```
npx vitest run src/app/data/biomarkers.test.ts
```
