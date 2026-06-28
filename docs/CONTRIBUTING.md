# Contributing

How to make changes here smoothly. Written for engineers and AI agents alike — if you're an AI, [`AGENTS.md`](../AGENTS.md) at the root is a good companion read.

---

## Getting set up

```
# clone
git clone https://github.com/RIxiV1/DIGITAL-CLINIC.git
cd DIGITAL-CLINIC

# install
npm install

# dev server (vite, port 5173)
npm run dev

# verify your machine matches CI
npm run build
```

Node ≥20.11 < 23. PowerShell 5.1 on Windows; bash via WSL also works. The dev server hot-reloads everything except the `index.html` bootstrap script (full page refresh required for that).

The AI parser pipeline (Pipeline 3) needs a `GEMINI_API_KEY` env var to function. For local development, copy `.env.example` to `.env.local` and add your key — or run `vercel env pull` if you have access to the Vercel project. Without the key, Pipelines 1 and 2 still work fine; Pipeline 3 returns a 500 with `GEMINI_API_KEY not configured on the server`.

---

## The workflow

1. **Branch off main.** Branch name: `<type>/<short-kebab-desc>`. Examples below.

   ```
   git checkout main
   git pull origin main
   git checkout -b fix/the-thing-thats-broken
   ```

2. **Make the change. Test it. Build it.**

   ```
   npm run build   # tsc + vitest + vite — same gates as CI
   ```

   If any of the three fails, it's not ready yet — worth fixing before you push.

3. **Commit. One logical change per commit.**

   ```
   git add <specific files>
   git commit -m "fix(parser): handle thou/cumm unit alias in Dr Lal CBC"
   ```

   Type prefixes: `feat`, `fix`, `refactor`, `polish`, `chore`, `docs`, `test`, `security`. Scope in parens when it helps narrow what changed.

4. **Push and open a PR.**

   ```
   git push -u origin <your-branch>
   gh pr create --base main --head <your-branch> --title "..." --body "..."
   ```

   Main is protected — direct pushes are rejected. PR is the only path.

5. **Vercel preview deploys automatically.** A green check on the PR means the build passed and the preview is live. The preview URL is in the PR comments.

6. **Squash-merge when ready.**

   ```
   gh pr merge <number> --squash --delete-branch
   ```

---

## Branch naming

| Prefix | When |
|---|---|
| `feat/` | new user-facing feature |
| `fix/` | bug fix |
| `refactor/` | structural change, no behaviour change |
| `polish/` | small visual / copy / token-alignment tweaks |
| `chore/` | tooling, deps, build config |
| `docs/` | documentation changes (this file, AGENTS.md, etc.) |
| `test/` | adding tests without changing prod code |
| `security/` | security hardening |

Short kebab description after the slash. `fix/gemini-2.5-flash`, `feat/ai-auto-fallback`, `polish/pulse-glow-brand-alignment`. If you can't fit the intent in 5 words, the branch is doing too much.

---

## Commit messages

The diff already says *what*. The commit message should say *why*.

**Good:**

```
fix(ai-parser): scale count-prefix units before catalog mapping

Dr Lal PathLabs prints platelets as "245 thou/cumm" — Gemini returned
that verbatim and the mapper passed the raw 245 into a catalog template
whose canonical unit is /cumm (raw cells). Result: healthy readings
rendered as severe-low / red.
```

**Bad:**

```
update aiParser.ts
```

For trivial commits (typo fixes, lint), one-line is fine. For anything else, write a body that explains the motivation. Future-you will thank present-you.

**Please skip:**

- AI-attribution tags like `Co-Authored-By: Claude` or `🤖 Generated with [Claude Code]`. We've had to scrub these from history before, so leaving them out saves everyone the cleanup.
- `--no-verify` to skip hooks, unless someone explicitly asks for it.
- Force-pushing to main — it's protected anyway, so it won't go through.

---

## Where to make common changes

| You want to… | Edit |
|---|---|
| Add a biomarker to the dashboard | [`src/app/data/biomarkerCatalog.ts`](../src/app/data/biomarkerCatalog.ts) — append to the `biomarkerCatalog` table (grading/trend logic stays in [`biomarkers.ts`](../src/app/data/biomarkers.ts)) |
| Add a new lab's unit alias | Same catalog file — extend `unitAliases` on the relevant template |
| Change how a marker is interpreted / explained | [`src/app/clinical/`](../src/app/clinical/) — the interpretation layer (system grouping, context, trends, limitations); see [ARCHITECTURE.md](ARCHITECTURE.md#the-clinical-interpretation-layer) |
| Add a new page route | Add a variant to `Page` in [`src/app/contexts/types.ts`](../src/app/contexts/types.ts), wire it in [`src/app/App.tsx`](../src/app/App.tsx), build the page component |
| Change a theme color | [`src/index.css`](../src/index.css) — `@theme :root` (light) + `:root[data-theme='dark']` (dark) |
| Add a quiz symptom | [`src/app/data/quiz.ts`](../src/app/data/quiz.ts) + scoring weights in [`src/app/contexts/QuizContext.tsx`](../src/app/contexts/QuizContext.tsx) |
| Tighten the Gemini system prompt | [`api/parse-image.ts`](../api/parse-image.ts) — `SYSTEM_PROMPT` constant |
| Add a tracked toggle to Profile | Persistence helper in [`src/app/utils/persistence.ts`](../src/app/utils/persistence.ts), UI in [`src/app/pages/ProfilePage.tsx`](../src/app/pages/ProfilePage.tsx) |
| Adjust the dashboard layout | [`src/app/pages/HomePage.tsx`](../src/app/pages/HomePage.tsx) + [`src/app/pages/home/`](../src/app/pages/home/) (Explore panes; pure derivations in `dashboardModel.ts`) |
| Adjust the report results layout | [`src/app/pages/ReportResultsPage.tsx`](../src/app/pages/ReportResultsPage.tsx) |
| Adjust the upload flow | [`src/app/pages/UploadPage.tsx`](../src/app/pages/UploadPage.tsx) + [`src/app/pages/processing/`](../src/app/pages/processing/) (parse state machine + confirm/cascade/failed views) |

For anything bigger, read [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`PARSER.md`](PARSER.md) first.

---

## Testing

We use Vitest. The test command is included in `npm run build`, or run it directly:

```
npx vitest run              # CI-style, one shot
npx vitest                  # watch mode
npx vitest run src/app/services/pdfParser.test.ts   # one file
```

Default environment is `node` for fast pure-logic tests. Tests that touch DOM (localStorage, window) need the jsdom annotation at the top:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// …
```

`pages.smoke.test.tsx` is the rendering smoke test — checks that each page mounts without throwing. Run it if you change `App.tsx`, the `Page` union, or any context's provider.

The parser has the deepest test coverage. Real-lab-format fixtures live in [`src/app/services/pdfParser.test.ts`](../src/app/services/pdfParser.test.ts). Add a fixture when you support a new lab format.

---

## A few things to avoid (and why)

- **Scope creep.** Keep a change to what the task asks for — a bug fix doesn't need surrounding cleanup, and three similar lines are fine without a premature abstraction.
- **Defensive code for things that can't happen.** Trust framework guarantees; validate only at the real boundaries (user input, external APIs, localStorage).
- **Multi-paragraph docstrings.** A short comment above a well-named function is usually plenty.
- **New dependencies without a strong reason.** Bundle size matters — the main bundle is ~150 kB gzipped and we'd like to keep it there.
- **Committing WIP straight to main.** Go through a branch + PR (main is protected anyway).
- **Reading localStorage around the `dc_*` zod schemas.** That validation is our trust boundary against poisoned keys — go through the helpers.
- **Creating planning / decision / analysis Markdown files** unless asked. PR descriptions and commit messages are the durable record.

---

## When in doubt

1. Read the most relevant `docs/` file.
2. Read the most recent merged PRs touching the same area — they show the team's style. `gh pr list --state merged --limit 10`.
3. Open a draft PR early. Mark it `WIP` in the title. Get feedback before sinking more time.

Good faith bug reports, half-finished investigations, and "I don't know if this is right" PRs are all welcome. The point is to ship working code, not to be polished about it.
