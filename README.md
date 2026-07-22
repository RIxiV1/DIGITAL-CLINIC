<div align="center">

# Digital Clinic

**Understand your blood test in plain English — right on your phone.**

Upload your blood report (PDF or photo). We read it, show you where you stand, and explain what each number means — the way a friend who happens to be a doctor would. No signup, no account, and nothing is uploaded to us.

**[Try it here](https://digital-clinic-formen.vercel.app)** · Built for [ForMen](https://formen.co.in)

</div>

<p align="center"><img src="docs/preview.png" alt="Digital Clinic walkthrough" width="720" /></p>

> A screening tool to help you understand your results — **not a diagnosis**. Always confirm with a doctor before acting on anything here.

---

## Why we built this

Most blood reports in India are 4–10 pages of tiny tables and confusing numbers. People either panic at the "out of range" values or ignore the whole thing. Neither helps.

Digital Clinic shows you the same report in a way you can actually use:

- One clear picture of where you stand
- Every result in plain words — what it is, whether it's fine, and what to do
- How your numbers change over time, once you've uploaded more than one report

Don't have a report yet? Take the short quiz about how you've been feeling and we'll tell you which tests to ask for.

---

## What makes it different

**Your report is read on your phone.** There's no server holding your data — no login, no cloud, no tracking. Your reports live only in your browser. The one time anything leaves your device is if the AI helps read a photo (below), and we always tell you before it happens.

**Reads tricky reports.** Indian lab PDFs are hard — tight tables, odd fonts, sometimes just a scanned photo. We try three different ways to read the file and keep whichever works best. If it's a photo, we read it the way a scanner does. And if a photo still won't read, you can send that one image to Google's AI to try again — it's shown on screen first, you can cancel, and you can switch it off in your profile. (It's on by default for photos we can't read; we'd rather tell you that plainly than claim "nothing ever leaves your device.")

**Explains results like a friend would.** No walls of numbers — just "here's what it is, here's why it matters, here's what to do," with the source behind our advice so you can check it.

**Follows Indian guidelines.** We use ICMR, the Lipid Association of India, and IAP references — not American ones that don't always fit Indian bodies. And if your lab printed its own normal range, we trust that over ours.

**Extra privacy if you want it.** Turn on the PIN lock and your saved reports are locked with strong encryption that only your PIN can open — even we can't recover it, so keep the PIN safe. Turn on Discreet Mode and the screen hides the moment you switch apps.

**Built for everyone.** Works well with reduced-motion settings. Colours are chosen so red-green colour-blind readers can still tell a warning from an all-clear — and every status has a word next to it, never just a colour.

---

## What you'll see

- One **overview** so you know where you stand at a glance
- Each marker (cholesterol, sugar, thyroid, vitamins, hormones) explained in simple words
- A clear status for each: **healthy**, **keep an eye on it**, **needs care**, or **see a doctor**
- How each number is trending, once you've uploaded more than one report
- A plain **"what to do next"** — with the evidence behind it — for anything that's off

---

## For developers

**Built with:** React 18 · TypeScript · Vite 6 · Tailwind CSS v4 · framer-motion
**Reads PDFs:** pdfjs-dist &nbsp;·&nbsp; **Reads photos:** Tesseract.js
**Optional AI backup:** Google Gemini (server-side key; used only for photos the device can't read)
**Export:** jsPDF &nbsp;·&nbsp; **Testing:** Vitest + Testing Library + Playwright

### Run it locally

Node.js 20–22 (at least 20.19).

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # run the tests
npm run build        # typecheck + tests + bundle
npm run preview      # preview the build
```

The build fails fast — a broken test or a type error means no bundle.

### How it works

```
PDF or photo comes in
        │
        ▼
Read the PDF's text layer  (3 reconstruction strategies, best match wins)
        │
        ▼   (if empty / no matches)
Read it like a scanner — Tesseract OCR
        │
        ▼   (if still stuck, and only for photos)
Offer to send the image to Google's AI — user's choice, on by default, cancelable
        │
        ▼
Clean up OCR noise + reconcile units (Indian lab quirks)
        │
        ▼
Match against our biomarker catalog (best candidate wins)
        │
        ▼
Save to browser storage → dashboard / results / trends
```

### Folder structure

```
src/app/
├── clinical/    # Turns matched numbers into meaning (status, context, trends, limits)
├── components/  # Reusable UI (bars, rings, sparklines, modals)
├── contexts/    # App-wide state (navigation, reports, quiz, language, discreet)
├── data/        # The biomarker catalog + sample reports + quiz config
├── pages/       # One screen per route (big ones split into folders)
├── services/    # PDF parser pipeline, PDF report exporter, API client
└── utils/       # localStorage, share text, a11y hooks, lazy reload
```

### Deeper docs

Start with **[AGENTS.md](AGENTS.md)** for repo conventions, then dig in — each doc is a focused deep-dive:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the whole thing fits together
- **[docs/PARSER.md](docs/PARSER.md)** — reading PDFs and photos (the hard part)
- **[docs/CLINICAL-ACCURACY.md](docs/CLINICAL-ACCURACY.md)** — how a value becomes healthy / borderline / off / critical
- **[docs/SECURITY.md](docs/SECURITY.md)** — the privacy + encryption model (and the honest AI caveat)
- **[docs/THEMING.md](docs/THEMING.md)** · **[docs/COLOR-SYSTEM.md](docs/COLOR-SYSTEM.md)** — look, feel, and colour
- **[docs/I18N.md](docs/I18N.md)** · **[docs/MOBILE.md](docs/MOBILE.md)** — languages and mobile patterns

Full index in [AGENTS.md](AGENTS.md).

---

## Status

Built as a 3-month engagement for [ForMen](https://formen.co.in). Production-grade build (typecheck + tests gate the bundle); deploys to any static host, currently on Vercel. PRs and forks welcome.
