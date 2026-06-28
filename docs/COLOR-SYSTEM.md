# The Color System — "Lamplight"

> **A worried person doesn't need more information. They need calm guidance.**

This is the emotional identity, not a swatch list. It governs how the product
*feels* to someone who just got an abnormal result. The test every choice must
pass: **will this screen make them breathe easier?** If a color, contrast, or
motion adds anxiety without adding honest signal, it's wrong — however beautiful.

It complements [DESIGN-PHILOSOPHY.md](DESIGN-PHILOSOPHY.md) (layout/IA) and
[THEMING.md](THEMING.md) (the token mechanics). This file is the *why* of color.

---

## The image

A single warm lamp on good paper, and one fountain pen. Not a screen, not a lab
— a desk in a quiet study where someone you trust explains your results.
**~95% of the interface is paper and ink.** Color is something the eye *earns*,
never something thrown at it. That restraint is both the luxury and the calm: a
quiet field means the one mark that *is* colored carries real meaning.

We are designing an **emotional interface for medical information**. The lab
values are the content; the product is how a person *feels* while understanding
them.

---

## The three things that make it ForMen (not just "tasteful")

### 1. The heartbeat — one indigo thread
A single, continuous, muted-indigo **line** is the only thing in the product
that is unmistakably alive. It is the same gesture everywhere:
- it **draws itself** while a report is being read (processing),
- it **connects the systems** on the Health Map ("your body is one system"),
- it is the **upload → understanding** progress.

At a blur the app reads as *warm cream, almost no color, one indigo line* — a
signature no other health app shares (they're cool-white and busy).
**Rules:** the thread is *calm* (slow, breathing, fully honored by
`prefers-reduced-motion` → it simply appears, no animation) and *functional* (it
always means "understanding is happening"). Never decorative motion — a
restless line manufactures the anxiety we exist to remove.

### 2. Dynamic emotional grading — the interface fills in with understanding
Intensity tracks the report's state. It changes **contrast, type weight,
whitespace density, and indigo-presence — never hue.** There is no red-panic mode.

| Grade | Feeling | What changes |
| --- | --- | --- |
| **Reassuring** | the screen exhales | near-pure warm paper; thread barely visible; generous whitespace; soft ink |
| **Moderate** | gentle focus | thread strengthens; indigo on the one thing that matters; type firms slightly |
| **Urgent** | *calm proximity* | contrast deepens, headline gains weight, whitespace tightens around the one concern — the screen leans in and says *pay attention*, **with composure, not red** |

Implement as a single `intensity` scalar (0→1) derived from the report's worst
status, nudging ~3 variables (indigo-presence, ink contrast, density). Not a
framework — a scalar.

**The three brakes (non-negotiable):**
1. **The chrome is never the messenger.** If a user learns "denser screen = bad
   news," the interface becomes a dread signal *before the words*. The
   *sentence* always tells them first; grading only reinforces.
2. **AA at every grade.** The calm end can't drift below legible contrast. Soft
   ≠ faint.
3. **Honest-signal holds.** Urgent-calm still *surfaces* the critical thing
   gravely; grading expresses severity through focus, never by withholding it
   (First-Impression Contract Q1).

### 3. Brass is a reward, not décor
**Whitespace carries premium; brass carries earned good news.** It appears only
on a genuine positive — *"Vitamin D is up — that's working,"* a marker that
improved, a streak held. The warm flicker of the lamp when something goes right,
so it *means* something when a worried person sees it.

---

## The emotional architecture (color serves this order)

Relief → understanding → action. The first screen is words, not data:
*"I've gone through your report. Most of what I'm seeing is reassuring. There are
two things I'd understand together."* (This is the existing `healthStorySentence`
in `clinical/`.) Then it unfolds, Apple-style: **one story → one relationship →
one recommendation → the evidence.** Color stays out of the way of that sentence
until the person is ready for the data.

---

## Tokens

Status colors are **muted earth, never the 🟢🟡🔴 panic palette**, and are
**always label-backed** (WCAG 1.4.1) — muting reduces hue-separation for
red-green CVD, so lightness + words carry the signal, not hue alone.

### Light (primary — warm paper)
| Role | Token | Value | Notes |
| --- | --- | --- | --- |
| Page | `bg` | `#F4EEE1` | honeyed warm; never `#fff` |
| Sunken | `bg-sunken` | `#ECE7DC` | |
| Card | `surface` | `#FBF6EC` | warmer + barely lighter, not shadow-lifted |
| Raised | `surface-raised` | `#FEFCF7` | the one hero card / modals |
| Ink | `text` | `#2B2620` | warm soft-black, never `#000` |
| Display ink | `text-display` | `#3C342B` | large headings sit softer so they don't hit |
| Secondary | `text-secondary` | `#5A534B` | |
| Muted | `text-muted` | `#8C8478` | |
| Faint | `text-faint` | `#ADA597` | footers — should almost disappear |
| **Accent / thread** | `accent` | `#2D3B8E` | the **verified** ForMen brand indigo (exact wordmark hex from `public/favicon.svg`); the one interactive hue + the heartbeat. Calm comes from warm paper + restraint, NOT from desaturating the brand. |
| Accent hover | `accent-hover` | `#2C2F49` | |
| On accent | `on-accent` | `#FBF6EC` | |
| Reward | `brass` | `#9C7A3C` | earned good news only |
| Healthy | `good` / `-soft` / `-ink` | `#5F7263` / `#E7EBE0` / `#48584C` | muted sage; "almost nothing" |
| Attention | `attention` / `-soft` / `-ink` | `#A8703A` / `#F2E7D7` / `#7E5226` | warm ochre; "worth a glance" |
| Critical | `critical` / `-soft` / `-ink` | `#8E3B34` / `#F0DEDA` / `#6F2C27` | oxblood; grave, small, late, never first |
| Border | `border` / `-strong` | `rgba(43,38,32,0.12)` / `0.20` | warm hairlines |
| Divider | `divider` | `rgba(43,38,32,0.07)` | almost gone |
| Focus | ring | `accent` 2px + 2px paper offset | never neon-cyan |
| Selection | | `rgba(54,58,87,0.16)` | warm ink wash, never browser-blue |
| Shadow | `sm` / `md` | `0 1px 2px rgba(40,30,20,.06)` / `0 4px 16px rgba(40,30,20,.05)` | warm, low, single-lamp |

### Dark (the same study, by lamplight — warm ink, never black)
| Role | Token | Value |
| --- | --- | --- |
| Page / surface / raised | `bg` / `surface` / `surface-raised` | `#16130F` / `#1F1B16` / `#262019` |
| Ink / secondary / muted | `text` / `-secondary` / `-muted` | `#ECE6DC` / `#B4ACA0` / `#857D70` |
| Accent / thread | `accent` | `#97A3EA` (the brand `#2D3B8E` lifted for the dark charcoal) |
| Reward | `brass` | `#C39E5E` |
| Healthy / attention / critical | `good` / `attention` / `critical` | `#8AA089` / `#C99A5E` / `#CC7A6E` (dusty brick — visible, never neon) |
| Border / divider | `border` / `divider` | `rgba(236,230,220,0.14)` / `0.07` |

### Glow & shadow philosophy
**No glow.** Glow is the clearest "AI SaaS" tell. The only permitted luminance
change is a ≤2% warm lift on the primary CTA on hover. Shadows are soft, warm,
single-direction (one lamp); in dark mode shadows are invisible, so **hairlines
carry elevation.**

### Graph & Health Map
Not a rainbow. A trend draws in **its own status hue** (or ink-indigo at low
opacity when neutral); multi-series caps at three (indigo → brass → slate
`#6E7588`). Health Map tiles are **paper**; the only color is the system's worst
**status** — color means *how it's doing*, never *which system it is*.

---

## Relationship to what's shipped
The live app uses the **verified** brand indigo `#2D3B8E` (exact wordmark hex
from `public/favicon.svg`) as the accent, on warm paper, with vivid
`#16a34a` / `#dc2626` status. "Lamplight" keeps that *exact brand hue* and turns
down everything around it — vivid status → muted sage/ochre/oxblood, neutrals
warmed — so calm comes from restraint, not from altering the brand colour.
Reversible, token-level. (An earlier step used an approximate `#3b4a9e`; that was
corrected to the sampled `#2D3B8E`.) The **words** (relief, guidance) are
the clinical layer's; the **calm field, the thread, and the grading** are this
system's. They meet on the first screen.
