# Security & Privacy

Privacy isn't a feature here — it's the architecture. This app handles some of the most
sensitive data a person has (hormonal, metabolic, sexual-health lab values), so the
default is that **nothing leaves the device**, and the one exception is loudly opt-in.

This doc is the single source of truth for the privacy/security model. If you change
anything in `utils/crypto.ts`, `utils/dataLock.ts`, `utils/persistence.ts`,
`contexts/DiscreetContext.tsx`, or `api/parse-image.ts`, update this file too.

---

## Threat model — who we protect against, and how

| Adversary | Mitigation |
|---|---|
| **A server breach leaking everyone's reports** | There is no server with user data. Reports are parsed in the browser and stored in `localStorage`. There's nothing central to breach. |
| **Someone with physical access to the unlocked device** (shared family phone — common in our India-first audience) | Opt-in **PIN lock** encrypts reports at rest (AES-GCM); **Discreet Mode** veils the screen the instant the app is backgrounded. (Quiz answers are not encrypted — see "What the lock covers" below.) |
| **A shoulder-surfer while the app is open** | **Discreet Mode** (`PrivacyScreen`) blanks content on blur / tab-switch / app-background. |
| **A poisoned `localStorage` key** (browser extension, past-buggy build, dev-tools on a shared device) | Every load path validates against a **zod** schema and falls back to default rather than trusting (or crashing on) malformed data. |
| **Eavesdropping on the one network call** (the optional AI parser) | HTTPS; only a single image is sent, only on explicit per-use consent, and only if the user turned the feature on. |

What we **don't** claim to defend against: a compromised browser/OS, a keylogger, or a
malicious extension with full page access. Those defeat any client-side app.

---

## The default: 100% on-device

- **No backend, no account, no login.** Nothing to sign up for; nothing is associated
  with an identity.
- **No analytics, no telemetry, no third-party trackers.**
- **Storage is local and namespaced.** Everything lives under a `dc_` prefix in
  `localStorage` (`dc_reports`, `dc_quiz`, `dc_theme`, `dc_lock`, …) and is read back
  through zod-validated loaders (`utils/persistence.ts`).
- The only baseline network traffic is fetching the static app + the PDF.js / Tesseract
  workers (and their trained-data assets) — never your report.

---

## At-rest encryption (opt-in PIN lock)

Off by default. When a user sets a PIN in Profile, their **reports** are encrypted in
`localStorage` so someone browsing the device (or its dev-tools) sees only ciphertext.
(Quiz answers are **not** encrypted — `saveQuiz` writes plaintext; only `dc_reports`
goes through `saveReportsMaybeEncrypted`.) Implemented in `utils/crypto.ts` +
`utils/dataLock.ts` on the Web Crypto API.

**Crypto:**
- **AES-GCM, 256-bit key** for the data, with a fresh **96-bit IV** per encryption.
- Key derived from the PIN via **PBKDF2-SHA256, 200,000 iterations** + a random
  per-install salt — the high work factor is what makes an offline brute-force of a short
  PIN expensive rather than instant.
- The derived key is **non-extractable** and lives **in memory only**. It is never
  written to disk; neither is the PIN.

**How unlock works without storing the PIN:** on enable we seal a known verifier token
with the key and store `{ salt, verifier }` under `dc_lock`. On unlock we re-derive the
key from the entered PIN and try to decrypt the verifier — success means the PIN was
right. The PIN itself is never persisted or compared directly.

**Forgot-PIN = wipe, by design.** Because the key only exists in memory and is derived
from the PIN, a forgotten PIN is unrecoverable. The UI offers "forgot PIN → wipe and
start over" rather than a backdoor. That's the honest trade-off of real client-side
encryption: no recovery path means no backdoor.

**Coordination.** The lock covers **reports** (quiz answers are stored as plaintext today).
`dataLock.ts` exposes imperative helpers (`enableLock` / `unlock` / `lock` / `clearLockMeta`
/ `getSessionKey`) that `ReportsContext` calls directly — encrypt on enable, decrypt on
unlock, re-write as plaintext on disable, clear on wipe. There is no event bus and no
subscriber model. A guard in the
plaintext loaders refuses to read ciphertext (so a half-migrated state can't silently
wipe data).

---

## Discreet Mode

A second, lighter privacy layer for the "someone glanced at my screen" case. When enabled
(Profile toggle, persisted), `contexts/DiscreetContext.tsx` + the `<PrivacyScreen>` veil
obscure all content the instant the app loses focus or is backgrounded — so a
notification, an app-switch, or handing the phone over doesn't expose lab values. It's a
UI veil, not encryption; the two are complementary.

---

## The one exception: the AI parser (consent-gated)

When on-device OCR can't read a photo, the user can tap **"Try AI parser"** to send that
single image to Google Gemini (`api/parse-image.ts`, a stateless Vercel function that
forwards the image and returns structured JSON — it stores nothing).

This is the **only** path where data leaves the device, and it's treated as such:
- **Two ways it fires.** Either an explicit per-use tap, or an **auto-cascade that is on by
  default** (opt-out) for a failed *image* parse — a Cancel control shows while it runs, and
  it can be switched off in Profile → "AI auto-fallback" for zero implicit network egress.
- **Disclosed at the point of use:** "the image leaves your device; Google may retain it
  to improve their service."
- **Honest caveat:** it currently uses Gemini's **free tier, which can use submitted data
  to improve Google's products.** So we do not claim "your data never leaves your device"
  unqualified. The path to an airtight claim is a **paid Gemini key or Vertex AI** (neither
  trains on submitted data) — a known, deliberate next step, not an oversight.

`GEMINI_API_KEY` is a server-side secret (Vercel env / local `.env.local`, gitignored).
It is **never** prefixed `VITE_` and never shipped to the client.

---

## Honest non-goals

- This is **not** a certified medical-records system (not HIPAA / DPDP-audited). It's a
  privacy-respecting screening tool; formal compliance is a separate undertaking.
- Storage is **device-bound by design** — there's no cross-device sync, because sync would
  mean a server holding your data. Export-as-PDF is the intentional portability path.
- Client-side encryption can't protect against a compromised device/browser/extension.

---

## Reporting a vulnerability

Found a security issue? Please email **shaiksuhaib360@gmail.com** with details and steps
to reproduce, rather than opening a public issue. You'll get an acknowledgement and a fix
timeline. Given the data this app touches, security reports are taken seriously.
