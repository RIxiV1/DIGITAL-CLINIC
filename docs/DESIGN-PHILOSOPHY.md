# Design Philosophy

Not a design system (that's [THEMING.md](THEMING.md) — tokens, contrast, the
bootstrap). This is the *why* behind the decisions: the principles a screen has
to satisfy before it ships. They're written down because consistency, not
features, is what widens the gap from here — and consistency needs a reference.

Each one is already practiced somewhere in the code; that's the point. These
describe the discipline that emerged, they don't aspire to a new one.

---

**The belief everything flows from:** people don't think in biomarkers — they
think in their body. Every decision below serves the move from *"I have 47 lab
values"* to *"I understand my body."*

1. **One question per screen.** Dashboard: *what deserves my attention?* Health
   Map: *where in my body does it belong?* Marker: *why does this number
   matter?* A screen that answers two will bloat. (Filter, not a feature.)

2. **One primary action per screen.** The dashboard offers one CTA, not a menu.
   More choices = choice overload (Iyengar), and an anxious reader skims.

3. **Reveal, don't dump.** One thing above the fold; reference data behind
   progressive disclosure. *Lived in:* the dashboard's zones (HomePage §63-93).

4. **Answer above the fold.** The primary question is answerable without
   scrolling. *Lived in:* dashboard + Health Map both pass the no-scroll audit.

5. **System first, marker as evidence.** Navigate body → system → finding, never
   a flat marker list as the spine. *Lived in:* the Health Map, `bodySystems.ts`.

6. **Reassure in the voice, gate on the data.** Reassurance is the default
   *voice*, never the default *answer* — a critical value overrides it. *Lived
   in:* `healthStorySentence`, the First-Impression Contract §3.

7. **Prioritize confidently; synthesize only when earned.** Always rank the one
   thing to look at first. Only name a *pattern* when a cited cluster supports
   it — the engine must be able to say "these are separate."

8. **Every word is product behavior.** Copy is navigation and trust, not
   decoration — editorial judgment (what to say, when, what *not* to, in what
   order) is the moat. One word lives in one place. *Lived in:* the value-neutral
   copy sweeps, the single-source nav labels.

---

## Two things to protect, because they disappear first

- **Joy has an owner.** Healthcare pulls everything toward "don't make mistakes."
  Once a sprint, ask *"what's delightful now?"* — not useful, not safe,
  delightful. If no one owns it, it erodes.

- **The metric is self-understanding.** Every usability test ends with one
  question: *"Tell me what you learned about your body."* Winning sounds like
  *"my heart deserves attention"* / *"my vitamin D is improving"* / *"I know what
  to ask my doctor."* Losing sounds like *"I had three red markers."* Not DAU,
  not session length — this.

---

*Before adding a screen, sentence, card, or feature, the only question is:
does this help someone understand themselves better than what's already there?
If it isn't an immediate yes, it doesn't ship.*
