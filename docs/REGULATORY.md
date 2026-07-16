# Regulatory Exposure (India) — decision map

**This is not legal advice.** It is a sourced map of the terrain so a qualified
Indian medical-device / privacy lawyer can be briefed efficiently. Every quoted
finding below was verified 3-0 (adversarial 3-vote) against the primary source.
The EU/FDA contrast and the DPDP-transfer specifics were **not** completed (the
research run hit a usage limit mid-way) — they are marked UNRESOLVED.

---

## The headline, and why it's not a code problem

**ForMen's interpretation function very likely makes it Software as a Medical
Device (SaMD) in India, and the disclaimer does not exempt it.** This is the
gap between "the engineering is sound" and "safe to put in front of real
patients," and no commit closes it. It needs a legal decision.

### 1. "Medical purpose" includes screening/monitoring/prediction — not just diagnosis

> "SaMD perform a medical purpose on their own and they intended to create new
> information on their own for any medical purposes as defined in Section 4.1.9.
> ... 4.1.9 'Medical purposes' include, but are not be limited to, diagnosis,
> prevention, monitoring, mitigation, prediction, treatment, etc."
> — *CDSCO Draft Guidance on Medical Device Software, 21/10/2025*

A tool that takes lab values and outputs risk-tiered guidance is creating new
information for a medical purpose. "We only screen, we don't diagnose" is not an
exit — screening is named in the definition.

### 2. The disclaimer does not save you — your CLAIMS define your intended use

> "'Intended use' means the use for which the medical device is intended
> according to the data supplied by the manufacturer on the labelling or in the
> document containing instructions for use ... or in **promotional material**
> ... Medical device software outputs (e.g., this may include **clinical
> interpretation** ... **recommended additional tests** ...)"
> — *same source*

Device status turns on function and stated claims, not a "not a diagnosis"
banner. Note what this cuts both ways into: the product's **words** — the name
"Digital Clinic", "screening", "critical", "recommended tests" — are part of
what defines it *into* the category. Wording is therefore a real lever, not
cosmetic; but which wording keeps you out is a lawyer's call (§ Decisions).

### 3. Consumer + no-doctor + serious condition pushes the risk class UP, not down

> "SaMD intended to be used by non-clinical users in a 'serious situation or
> condition' ... without the support from specialized professionals, may be
> considered as SaMD used in a 'critical situation or condition'. It may, hence,
> influence the risk classification of the SaMD."
> — *same source*

The very things that make ForMen good product — a layperson, alone, getting a
"see a doctor promptly" flag — are the things the guidance says *raise* the
classification. Being consumer-facing is not a lighter-touch category here.

### 4. There is NO wellness / disclaimer carve-out in India

> "Laboratory Information Systems (LIS) are not qualified as medical devices,
> wherein the main intended use is the management and validation of incoming
> information ... Example (3): An AI/ML-based tool intended for triage, and/or
> screening ... [IS a device]"
> — *same source*

The "not a device" list is purely **functional** — storage, billing, encryption,
LIS. India's list gives no shelter for a tool that interprets. A triage/screening
tool is explicitly given as an example of something that *is* a device. (A grep of
the full guidance PDF for "wellness" returned **zero** hits.)

### 5. A SECOND, independent hook — and this one is binding law, not draft

> "Standalone software, which are not incorporated into the medical device
> itself and provide an analysis based on the results from the analyser, shall be
> classified in to the same [IVD] category as the [analyser]."
> — *MDR 2017, First Schedule, Part II, clause 1(d)* (verified verbatim)

This matters because everything above rests on the **draft** 2025 software
guidance. This clause is in the **already-operative Medical Devices Rules 2017**.
Software that analyses a lab analyser's output is pulled into the same IVD class as
the analyser — independently of the draft guidance. So the SaMD conclusion does
not depend on a draft that could still change wording.

### 6. Telemedicine — ForMen is OUTSIDE its scope (a point in your favour)

> "The guidelines are meant for RMPs under the IMC Act 1956 ... telemedicine is
> ... clinical service delivered by a Registered Medical Practitioner." … "3.7.4
> Technology platforms based on AI/ML are not allowed to counsel the patients or
> prescribe."
> — *Telemedicine Practice Guidelines 2020 (MoHFW)*

The TPG 2020 bind **Registered Medical Practitioners**; a standalone tool with no
RMP and no teleconsultation falls **outside their scope entirely** — so they
don't govern ForMen. The separate §3.7.4 bar on AI counselling/prescribing is the
line to never cross: ForMen says "discuss with your doctor" and never names a drug
or dose. Keep it that way — never output a treatment, dose, or drug name.

### 7. Global contrast — there is no market to escape to

Both other major regimes reach the **same** "regulated medical device" conclusion,
so a future non-India launch does not dodge the issue:

- **EU (MDR / MDCG 2019-11):** "software should be qualified ... depending on its
  intended purpose ... regardless of its location." Software that *processes,
  analyses, creates or modifies medical information for a medical purpose* is
  MDSW — a lab-interpretation tool lands **Class IIa or higher**. A disclaimer
  "may not be sufficient" to remove that status.
- **US (FDA CDS / 21st Century Cures §520(o)(1)(E)):** the Non-Device CDS
  exclusion requires the software be for **healthcare professionals**. "Software
  functions that support or provide recommendations to **patients or caregivers**
  ... meet the definition of a device." A patient-facing tool is a device and
  **cannot** use the exclusion.

India is not an outlier. All three anchor status to **function and intended use**,
which is why (finding 2) the only changes that move the needle are functional, not
cosmetic.

---

## Decisions the user must make (brief the lawyer with these exact questions)

1. **Is ForMen SaMD as currently worded?** Given findings 1-5, assume "likely
   yes" until a lawyer says otherwise — and note two independent hooks (the draft
   software guidance AND the binding MDR-2017 IVD clause). Ask: *what is the
   minimum change to intended-use wording/claims that would keep it out of the
   SaMD definition — or is registration unavoidable given the interpretation
   function?*
2. **If it is a device, what class (A/B/C/D) and what licence (MD-5 vs MD-9,
   QMS, predicate)?** Not pinned by this research (partly, the IVD-analyser hook
   suggests it inherits the analyser's class). A direct lawyer question.
3. **DPDP Act 2023 + the Gemini transfer.** UNRESOLVED. The on-device/no-server
   design plausibly minimises data-fiduciary exposure, but the opt-in image
   send to Google's **free** Gemini tier (which may train on the data) is the one
   outbound flow. Ask: *does that transfer make the operator a data fiduciary,
   and does moving to paid/Vertex (no training) change it?* Until answered, the
   safe default holds: **no Gemini key in production = no transfer** (the app
   already degrades to on-device-only without a key).
4. **Operator identity & liability.** Solo operator, no company, no insurance.
   Ask about personal liability if a misread drops a genuine emergency, and
   whether an entity + disclaimer-of-warranty + terms-of-use materially help.

## Concrete, non-controversial things that reduce exposure NOW

Done or safe to do without a legal call:
- **No treatment/drug/dose output** — already true; keep it as a hard rule.
- **No Gemini key in a production deploy** unless/until the DPDP question is
  answered — already the default behaviour (no key → on-device only).
- **Confirm-every-value step** — already present; keeps the human in the loop
  and supports a "tool, not decision-maker" framing.
- **Honest privacy wording** — already fixed (no absolute "never leaves your
  device" overclaim).

Deliberately NOT done, because the research says they're cosmetic or wrong:
- Adding "this is not a medical device" — a disclaimer does not change device
  status (finding 2), and asserting it while the function arguably makes it one
  could be worse than silence. Do not add.

## What this research could NOT establish (still open)

- **DPDP Act 2023 + the Gemini transfer — genuinely unverified.** Zero of the 23
  verified claims reached it: not the localStorage/no-server obligation question,
  not whether the opt-in image send to Google makes the operator a data
  fiduciary, not the cross-border-transfer rules, not free-tier-vs-Vertex. Needs
  its own research pass **and** a privacy lawyer. Until then the safe default
  holds: no Gemini key in production = no transfer.
- **Exact Indian risk class + licence path** (A/B/C/D, MD-5 vs MD-9, QMS,
  predicate) — a lawyer question; the IVD hook hints it inherits the analyser's
  class.
- **Draft-status caveat:** the pivotal CDSCO software guidance (21-Oct-2025) is
  **draft**, not final — it interprets the already-operative MDR 2017, but its
  wording could shift before finalisation. The MDR-2017 IVD clause (finding 5) is
  binding now regardless.

_Sources: CDSCO Draft Guidance on Medical Device Software 21/10/2025; Medical
Devices Rules 2017 First Schedule; MoHFW Telemedicine Practice Guidelines 2020;
EU MDCG 2019-11; US FDA Clinical Decision Support Software guidance. All findings
verified 3-0 (adversarial 3-vote) against primary sources except where marked._
