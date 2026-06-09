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

All of it lives in one pure function, [`statusForValue(template, value, labRef?)`](../src/app/data/biomarkers.ts) (≈ L992). The order of checks is the whole design — read it top to bottom:

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
| **Free Testosterone** | `8.7–25.1 pg/mL` is correct for **direct/analog immunoassay** (what most Indian labs run) but not for calculated/equilibrium-dialysis free-T (~120–368 pg/mL). A dialysis-method result reads grossly "high." | false alarm on method mismatch | Make free-T method-aware (label the assay; pick the band by magnitude/method); prefer calculated free-T per Endocrine Society. |
| **SHBG** | ✅ **Fixed.** Upper bound was `50 nmol/L`, below most lab ceilings (≈57–76); SHBG rises with age, so healthy older men read "high." Raised to `57` (consensus adult-male ceiling). Only bit without a `labRef`; low stakes. | was false alarm → resolved | Done. |
| **HbA1c** | ✅ **Addressed.** Thresholds are correct (5.7 / 6.5) — no number change. HbA1c is unreliable in Indian populations (iron-deficiency anaemia → spuriously high; thalassaemia/G6PD → either way). The anaemia / confirm-with-glucose caveat now shows in the plain copy at **every tier** (not only the harm-anchor tick, which is concern/critical-gated). | risk via assay, not our numbers | Done (caveat in copy). |
| **eGFR** | ✅ **Fixed.** KDIGO stages now map onto the four tiers via the band: ≥90 (G1) `good`, 60–89 (G2, mildly reduced — not CKD alone) `attention`, <60 (G3, CKD) `concern`, <30 `critical`. Healthy floor moved 90→60 (the KDIGO CKD cutoff) + an optimal band at ≥90 (KDIGO-cited). This makes the meaningful <60 cutoff visible *and* stops 60–89 reading as a false "out of range" for older adults — and resolves an inconsistency (the copy already said "<60 indicates CKD" while the band flagged <90). | was mild false assurance + false alarm → resolved | Done. |

Everything else in the audited set (51 of the graded markers checked clean, plus the rest) matched guideline consensus within accepted lab-to-lab variation.

---

## Where to change things

| You want to… | Edit | Then |
|---|---|---|
| Change a healthy range | `data/biomarkers.ts` → `min`/`max` on the template | cite the source in a comment; re-run the audit bar above |
| Change a critical cliff | `data/biomarkers.ts` → `criticalLow`/`criticalHigh` | **highest care** — this fires regardless of `labRef`; validate against published panic values |
| Add/tighten an optimal band | `data/biomarkers.ts` → `optimalMin`/`optimalMax` **+ `optimalSource`** | no source → don't add it |
| Add a harm-anchor tick | `data/biomarkers.ts` → `actionMin`/`actionMax` **+ `actionSource`** | tick won't render without the source |
| Change how tiers are derived | `data/biomarkers.ts` → `statusForValue()` | update [`biomarkers.test.ts`](../src/app/data/biomarkers.test.ts) — it pins the tier boundaries |

---

## Tests

`statusForValue` and the tier boundaries are pinned in [`src/app/data/biomarkers.test.ts`](../src/app/data/biomarkers.test.ts) — in/out of healthy range, optimal-band edges, the critical tier, and the `labRef`-priority override. If you touch the tiering or a range that has an edge-case test, expect that file to need updating. Run it:

```
npx vitest run src/app/data/biomarkers.test.ts
```
