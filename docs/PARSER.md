# Parser

The parser is the hardest part of the codebase. It turns a PDF or a phone-photo of a lab report into a structured `Biomarker[]` that the dashboard knows how to render.

There are three pipelines, run in fallback order. None of them are reliable on their own — they cover each other's blind spots.

This doc explains how they fit together, the catalog matcher between them, and the half-dozen subsystems that make real-world lab formats actually parse.

---

## The three pipelines

| # | Engine | Where | What it's good at | What it misses |
|---|---|---|---|---|
| 1 | pdfjs text-layer extraction | client | clean PDFs with selectable text (Quest, LabCorp, Apollo) | scanned PDFs, photos, image-only PDFs |
| 2 | Tesseract.js OCR | client | scans + photos with clear printing | low-contrast scans, handwriting, complex tabular layouts |
| 3 | Gemini 2.5 Flash vision | Vercel function `/api/parse-image` | anything the first two miss — esp. Indian lab templates (Dr Lal, Thyrocare, Redcliffe) | costs API quota, requires network, returns occasional hallucinations |

Pipelines 1 and 2 are inside [`services/pdfParser.ts`](../src/app/services/pdfParser.ts). Pipeline 3 is split: the client glue in [`services/aiParser.ts`](../src/app/services/aiParser.ts), the server function in [`api/parse-image.ts`](../api/parse-image.ts).

The orchestrator is [`services/api.ts`](../src/app/services/api.ts) — `parseUploadedReport()` is the single entry point everyone calls.

---

## The flow

```
parseUploadedReport(name, file, onProgress)
│
├─ validateUpload(file)        — MIME, size, sanitised name
│
├─ if PDF:
│   ├─ try pdfjs text-layer extraction
│   ├─ if text layer empty → run Tesseract per page
│   ├─ extractBiomarkersFromText(text) → matched biomarkers + unrecognised rows
│   └─ classifyOutOfScope(text) → "this is a CT scan / dental, not a lab panel"
│
├─ if image:
│   ├─ preprocess (grayscale + binarisation)
│   ├─ run Tesseract with PSM 6
│   └─ extractBiomarkersFromText(text) → same matcher
│
├─ return {
│     parsedFromFile: bool,
│     biomarkers: Biomarker[],
│     rawText: string,                       // for the "show what we read" disclosure
│     failureReason?: 'no-file' | 'no-matches' | 'parser-error' | 'out-of-scope',
│     errorMessage?: string,
│     ocrPagesAttempted?, ocrPagesSkipped?,  // partial OCR callout
│     unrecognizedRows?: string[],           // user-visible "we saw these but didn't map them"
│   }
│
└─ NOTE: Pipeline 3 (Gemini) is NOT called from here. The orchestrator only does
   pdfjs + Tesseract. Pipeline 3 is invoked separately from ProcessingPage —
   either via the manual "Try AI parser" button on the failure card OR via the
   auto-cascade (image + no-file failure + dc_aiAutoFallback setting on).
```

The separation matters: Pipelines 1+2 are free (CPU on the user's device), Pipeline 3 costs quota. The orchestrator doesn't cascade automatically — ProcessingPage does, with explicit user consent.

---

## The catalog and the matcher

Everything the parser returns gets mapped against [`data/biomarkers.ts`](../src/app/data/biomarkers.ts) — a hand-curated catalog of ~100 biomarker templates. A template looks like:

```ts
{
  id: 'hemoglobin',
  name: 'Hemoglobin',
  aliases: ['Haemoglobin', 'Hb', 'HGB'],
  unit: 'g/dL',
  unitAliases: ['g%', 'g %', 'gm%'],
  min: 13.5, max: 17.5,          // reference range used as the dashboard band
  category: 'blood', direction: 'band',
  simpleName: 'Oxygen carrier',
  plain: '…plain-English description…',
}
```

When the parser finds a marker, the matcher:

1. Normalises the printed name (lowercase, strip punctuation, collapse whitespace).
2. Checks every catalog template's `name + aliases` for a contiguous-word match against the normalised name.
3. Pulls the value, scales units if needed, sanity-bounds-checks, then emits a final `Biomarker` via `markerFromTemplate(template, value)`.

The catalog is the trust boundary. If a Gemini extraction comes back with `{ name: "PotassiumFakeMarker", value: 100 }`, the matcher returns null and the dashboard never sees it. New markers require a catalog entry.

---

## Unit reconciliation (Indian lab quirks)

Indian labs print the count-prefix in the unit column instead of scaling the value:

```
Platelet Count    245    thou/mm3       150,000–450,000
WBC               4.20   thou/mm3       4,000–11,000
RBC               5.79   mill/mm3       4.5–5.5
```

Without reconciliation, `245` against a reference of `150,000–450,000` lights up red as severe thrombocytopenia. The catalog's canonical unit for platelets is `/cumm` (raw cells per cubic mm), so we have to multiply the raw value by the unit's count-prefix.

`unitMultiplier()` in [`services/aiParser.ts`](../src/app/services/aiParser.ts) detects:

- `thou` / `thousand` / `10^3` / `10³` → ×1,000
- `lakh` / `lac` / `lakhs` → ×100,000
- `million` / `mill` / `10^6` / `10⁶` → ×1,000,000

Reconciliation: `value × (geminiMultiplier / catalogMultiplier)`. So `245 thou/cumm` against catalog `/cumm` = `245 × (1000 / 1) = 245,000` ✓. `4.09 mill/cumm` against catalog `million/cumm` = `4.09 × (1e6 / 1e6) = 4.09` (unchanged, as intended).

This only handles the count-prefix family. Mass/concentration units (mg/dL, ng/mL) return multiplier 1 — the catalog's canonical unit already enforces scale there.

---

## Sanity bounds

Two layers, applied to the **scaled** value:

1. **Absolute cap** — `value > 0 && value < 1e8`. Catches obvious hallucinations and missed-decimal mistakes (12.5 → 125000 from an OCR error).
2. **Per-template physical bounds** — uses `physicalMin/Max` if the template sets them, otherwise falls back to `min - 5×span` / `max + 5×span`. Admits clinical extremes (severe hypogonadism testosterone 80 ng/dL, DKA glucose 500) while rejecting "the model invented a number" cases.

Values that fail sanity bounds drop to the `unmapped` array, which the confirm view surfaces as "we saw these rows but couldn't map them" so the user knows something was read but not used.

---

## Hallucination guard (cross-category)

Pipeline 3 occasionally invents short marker names that match catalog aliases for unrelated categories. The textbook case we hit: Gemini returned `{ name: "pH", value: 4.2 }` on a CBC report where no pH row existed. Our catalog has `pH` as a Semen pH (Fertility) marker with reference 7.2–8, so a successful name-match meant a hallucinated 4.2 landed in the dashboard as "severely low semen pH" on a blood report.

The guard, `pruneSuspectShortNameMarkers()` in [`aiParser.ts`](../src/app/services/aiParser.ts):

- Any fertility-category marker with a canonical name ≤3 chars (e.g. `pH`) requires **at least one other fertility-axis marker** in the same response.
- A real semen panel always prints volume + motility + morphology alongside pH. A CBC never has pH.
- If the threshold isn't met, the marker drops to `unmapped` (so it's still surfaced to the user, just not rendered as a confident reading).

This is one half of the defence. The other half is in the Gemini system prompt — explicit "do not invent markers" rules in [`api/parse-image.ts`](../api/parse-image.ts).

---

## Failure reasons

`parseUploadedReport` returns one of four reasons when extraction fails:

| Reason | When | What ProcessingPage does |
|---|---|---|
| `no-file` | the file was lost (refresh, consumed pendingUpload) | shows "nothing to parse"; no AI cascade (no file to send) |
| `no-matches` | parser ran but found nothing in the catalog | manual failure card with "Try AI parser" button; auto-cascades on images |
| `parser-error` | parser crashed (corruption, password-protected, unexpected format) | same as no-matches |
| `out-of-scope` | classifier decided this isn't a lab panel (e.g. "Tax Invoice", X-ray report) | failure card; auto-cascades for images (the OCR-noise false-positive case), not for PDFs |

The `out-of-scope` classifier in `classifyOutOfScope()` scans the raw text for 5+ keyword hits from non-lab categories (viral panels, imaging, dental, billing). It's tuned conservatively — single matches don't trigger. Designed against clean PDF text; on noisy Tesseract output it false-positives, which is why image uploads get the more permissive cascade rule.

---

## Auto-cascade gate

When local parsing fails, ProcessingPage decides whether to invoke Pipeline 3 automatically or stop at the failure card.

```ts
// src/app/pages/ProcessingPage.tsx (around line 320)
const reason = result.failureReason ?? 'no-matches';
const isImage = !!file && /^image\//.test(file.type || '');
const isCascadeReason = reason !== 'no-file';
const shouldCascade =
  isImage && isCascadeReason && loadAiAutoFallbackSetting();
```

Three conditions, all required:

1. The file is an image (PDFs never cascade — pdfjs is reliable enough that PDF failures usually mean it's not a lab document at all)
2. The reason isn't `no-file` (nothing to send Gemini)
3. The user has `dc_aiAutoFallback` set to `true` (default; togglable in Profile)

When the cascade fires, ProcessingPage skips the failure card and renders `AiCascadeView` directly — spinner + privacy disclosure + Cancel button. Success → confirm view. Failure → drop to the failure card with the AI error inline.

---

## The Gemini system prompt

Worth reading in full at [`api/parse-image.ts`](../api/parse-image.ts) (`SYSTEM_PROMPT` constant). The structure:

1. **Column/row alignment rules** — for tabular Indian lab layouts, mentally trace horizontally from test name to result column. Never mistake a reference range bound for the result.
2. **Completeness rules** — process every row top-to-bottom, don't stop after the first few. Typical CBC has 11–14 numeric rows.
3. **Anti-hallucination rules** — only emit markers whose name is visibly printed on the same row as the value. Two-letter abbreviations (pH, Hb, K, Na) are flagged as high-risk to guess.
4. **Flag-suffix handling** — strip `L*`, `H*`, `*`, `†` from values; keep the number.

Combined with `temperature: 0` for deterministic output and a Zod-validated response schema with `responseMimeType: 'application/json'`, the model is heavily constrained. Even so, we layer the client-side hallucination guard on top — defence in depth.

---

## Retry behaviour

Pipeline 3 has one automatic retry with a 1-second backoff inside the serverless function (`/api/parse-image`). ~5–10% of vision-endpoint calls hit a brief 503 or fetch-failed that succeeds on immediate retry. Bounded at exactly one retry — covers the common transient blip without multiplying quota.

If the retry also fails, the 500 response includes:

```ts
{
  error: 'Internal error while parsing the image. Please try again.',
  kind: 'GoogleGenerativeAIError' | 'FetchError' | 'Error',
  hint: '<sanitised err.message — URLs, keys, base64 stripped>',
}
```

The client surfaces this as `Internal error... [<kind>: <hint>]` so the next failure is diagnosable from the UI without a Vercel-logs round-trip.

---

## Where to add things

| You want to… | Edit |
|---|---|
| Add a new biomarker | `data/biomarkers.ts` (add to `biomarkerCatalog`) |
| Add a new lab's unit alias | `data/biomarkers.ts` → `unitAliases` on the relevant template |
| Tighten the Gemini prompt | `api/parse-image.ts` → `SYSTEM_PROMPT` constant |
| Change the cascade gate | `pages/ProcessingPage.tsx` → search for `shouldCascade` |
| Adjust unit scaling | `services/aiParser.ts` → `unitMultiplier()` |
| Add a hallucination guard | `services/aiParser.ts` → `pruneSuspectShortNameMarkers()` (or a new pass) |
| Fix the out-of-scope classifier | `services/pdfParser.ts` → `classifyOutOfScope()` |

---

## Tests

The parser has the most test coverage in the repo. Run them:

```
npx vitest run src/app/services/pdfParser.test.ts
npx vitest run src/app/services/aiParser.test.ts
npx vitest run src/app/services/api.test.ts
```

`pdfParser.test.ts` is the big one — fixtures for real lab formats (Dr Lal, Thyrocare, Crystal Data, Quest), regression tests for the catalog matcher, and the column-reconstruction tests that pin the H3/H6/L-8 algorithm fixes.

`aiParser.test.ts` covers the catalog mapping + hallucination guard, with unit-test stand-ins for the Gemini response shape.

`api.test.ts` covers `parseUploadedReport()` orchestration and the `out-of-scope` classifier.

If you're changing the parser, you'll write or update one of these. New lab formats → add a fixture to `pdfParser.test.ts`.
