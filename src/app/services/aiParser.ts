/**
 * Client-side glue for the Vision-LLM fallback path (Pipeline 3).
 *
 * Sequence when a user taps "Try AI parser" on the failure screen:
 *
 *   1. downscaleImage()   — shrink to max 2000px and compress to JPEG.
 *                            Cuts a 10MB iPhone photo to ~300-800KB,
 *                            keeps us under Vercel's 4.5MB serverless
 *                            body limit, and speeds up upload by ~10x.
 *
 *   2. POST /api/parse-image — Gemini 2.5 Flash extracts
 *                              { name, value, unit, refMin?, refMax? }
 *                              for each marker it sees.
 *
 *   3. mapGeminiResultsToCatalog() — fuzzy-match each returned name
 *                                     against our biomarker catalog's
 *                                     aliases, then enrich with the
 *                                     catalog's unit/range/plain-English
 *                                     copy via markerFromTemplate(). The
 *                                     existing confirm view then renders
 *                                     these like any other extraction.
 *
 * Why we map back to the catalog instead of trusting Gemini's units:
 * Gemini gives us the lab's printed unit verbatim ("g%", "/cu.mm"), but
 * our UI displays + statuses against the canonical units in the
 * catalog. Going through the catalog gives us status colors, optimal
 * ranges, and the plain-English copy for free.
 */

import {
  biomarkerCatalog,
  markerFromTemplate,
  deriveComputedMarkers,
  type Biomarker,
} from '../data/biomarkers';
import { normalizeMu } from './parser/pdfTextLayer';
import { unitMultiplier, roundConvertedValue } from './parser/units';

/** Re-exported so this module stays the import site the AI-path tests and
 *  callers already use. The definition itself is shared with the text
 *  matcher — see parser/units.ts for why it must not be duplicated. */
export { unitMultiplier };

/**
 * Single source of truth for the AI-parser privacy disclosure copy.
 * Shown in three places:
 *   1. Below the manual "Try AI parser" button on the failure card
 *   2. Below the auto-cascade "Trying AI parser..." progress view
 *   3. Next to the "AI auto-fallback" toggle in Profile
 * Keeping it here avoids prose drift across surfaces — change the
 * one constant, all three update together.
 */
export const AI_PARSER_PRIVACY_COPY =
  'Sends this image to Google Gemini for parsing. The image leaves your device for this step; Google may retain it to improve their service. Free, no account needed.';

/** Max dimension (px) of the image we send to the server. Held at
 *  2200 — bumping to 2600 reproducibly tripped Gemini's image-payload
 *  limit on Dr Lal PathLabs PNGs (server returned "Internal error").
 *  2200 keeps digits ~25px tall on a 14-row CBC, still above the
 *  vision-model guessing threshold, and lands ~400-800KB JPEG. */
const MAX_IMAGE_DIM = 2200;

/** JPEG quality for the downscale. 0.88 is the sweet spot we landed
 *  on: 0.85 left visible ringing on thin digit strokes ("3"/"8" and
 *  "5"/"6" confusions on tight tabular templates), 0.92 pushed file
 *  sizes past Gemini's limit. */
const JPEG_QUALITY = 0.88;

/**
 * Downscale a File to a JPEG Blob whose longest edge is at most
 * MAX_IMAGE_DIM. Returns the original file unmodified if it's already
 * within bounds AND already a JPEG (no point re-encoding a small
 * jpeg). On any canvas/createImageBitmap failure, falls back to the
 * original — the server still has a payload-size guard.
 */
async function downscaleImage(file: File): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined') return file;
    const bmp = await createImageBitmap(file);
    const longest = Math.max(bmp.width, bmp.height);
    // Already small + already jpeg → skip re-encode. PNGs always
    // re-encode (they're often huge for screenshots and we want the
    // JPEG compression).
    if (longest <= MAX_IMAGE_DIM && file.type === 'image/jpeg') {
      bmp.close?.();
      return file;
    }
    const scale = Math.min(1, MAX_IMAGE_DIM / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close?.();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => {
        // Release the backing canvas buffer immediately — a multi-MP
        // phone photo's canvas can hold tens of MB of GPU/heap memory,
        // and on low-RAM Android repeated uploads otherwise accumulate
        // until the tab OOMs. Mirrors renderPageToImage in pdfParser.
        canvas.width = 0;
        canvas.height = 0;
        resolve(b ?? file);
      }, 'image/jpeg', JPEG_QUALITY);
    });
  } catch {
    return file;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // Use a chunked approach to avoid call-stack issues on large buffers.
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

type GeminiMarker = {
  name: string;
  value: number;
  unit: string;
  refMin?: number | null;
  refMax?: number | null;
};

type ParseImageResponseShape = {
  biomarkers: GeminiMarker[];
};

/** Minimum candidate-token-length we'll accept as a match. Single-
 *  character aliases (or two-letter ones like "Hb") get matched
 *  AS-IS via the canonical name path, but only when they appear as a
 *  standalone token in the model's output — never as a substring of a
 *  longer word. The contiguous-word matcher below enforces that. */
const MIN_CANDIDATE_LENGTH = 2;

/** Split a normalised string into tokens (already lowercased + de-
 *  punctuated upstream). Empty entries are filtered. */
function tokenise(s: string): string[] {
  return s.split(' ').filter(Boolean);
}

/**
 * Return true iff every token of `needle` appears as a contiguous run
 * in `haystack`. Word-level (not substring): the alias "B12" matches
 * a haystack of "vitamin b12 cobalamin" but does NOT match "ab12cd".
 * This was a real attack surface — the previous matcher used
 * `haystack.includes(needle)` and a model output of "totally insane
 * testosterone-like reading" could match alias "total testosterone".
 */
function hasContiguousWordMatch(
  haystackTokens: string[],
  needleTokens: string[],
): boolean {
  if (needleTokens.length === 0) return false;
  for (let i = 0; i + needleTokens.length <= haystackTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < needleTokens.length; j++) {
      if (haystackTokens[i + j] !== needleTokens[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Molar-concentration unit spellings. A value in any of these is a count of
 * molecules per litre; a catalog unit like mg/dL is a mass per volume. The
 * two are related only through the analyte's molar mass, which is exactly
 * what a template's `altUnits` entry encodes — so if no altUnit matched,
 * we have no lawful way to convert and must not pretend the number is
 * already canonical.
 *
 * Deliberately does NOT include mass-ratio units (mg/L, µg/mL, g/L): those
 * differ from a mass-per-volume canonical unit only by a power of ten, which
 * `unitMultiplier` and the count-prefix path already handle correctly.
 */
const MOLAR_UNIT_PATTERN = /(^|[^a-z])[munp]?mol\s*\/\s*l([^a-z]|$)/i;

/**
 * True when the printed unit is molar, the template's canonical unit is NOT
 * molar, and therefore no meaning-preserving conversion exists here.
 *
 * A template whose own unit is molar (SHBG in nmol/L, for instance) is left
 * alone — matching molar against molar is the normal case, and the
 * count-prefix ratio handles any magnitude difference.
 */
function isUnconvertibleMolarUnit(
  normalisedPrintedUnit: string,
  templateUnit: string,
): boolean {
  if (!MOLAR_UNIT_PATTERN.test(normalisedPrintedUnit)) return false;
  return !MOLAR_UNIT_PATTERN.test(normalizeMu(templateUnit).toLowerCase());
}

/**
 * Resolve a Gemini-returned marker name against the biomarker catalog.
 * Returns the first template whose canonical name or any alias matches
 * the model's output as a contiguous word-run (case-insensitive).
 * Strips punctuation/whitespace from both sides so "Hemoglobin (Hb)"
 * still resolves to the "Hemoglobin" template.
 *
 * Hardened vs. the previous `.includes()` matcher: that direction was
 * backwards (`normalised.includes(c)`) so a model output of arbitrary
 * length could match a short alias as a substring of a longer word,
 * defeating the catalog's role as the trust boundary.
 */
function findTemplateByName(name: string) {
  const normalised = name
    .toLowerCase()
    .replace(/[(),:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalised) return null;
  const haystack = tokenise(normalised);
  // Take the MOST SPECIFIC match, not the first one in catalog order.
  //
  // A short alias that is a prefix of a longer marker's name wins on catalog
  // order alone: "Free T4" contains the token "T4", so it resolved to the
  // TOTAL T4 template (µg/dL, a different analyte with a different range)
  // and a free T4 of 1.13 ng/dL was reported as a total T4 of 14.5 µg/dL,
  // graded 'concern' instead of 'good'. "Free T3" → total T3 the same way.
  //
  // The text matcher already defends this with span-containment suppression
  // (see collectHits); this is the same idea in token space. Longest match
  // wins, catalog order only breaks ties, so every existing single-candidate
  // resolution is unchanged.
  let best: (typeof biomarkerCatalog)[number] | null = null;
  let bestTokens = 0;
  for (const template of biomarkerCatalog) {
    const candidates = [template.name, ...template.aliases]
      .map((c) =>
        c
          .toLowerCase()
          .replace(/[(),:.]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter((c) => c.length >= MIN_CANDIDATE_LENGTH);
    for (const candidate of candidates) {
      const needle = tokenise(candidate);
      if (needle.length <= bestTokens) continue;
      if (hasContiguousWordMatch(haystack, needle)) {
        best = template;
        bestTokens = needle.length;
      }
    }
  }
  return best;
}

export type AiMapResult = {
  /** Mapped biomarkers ready for the dashboard. */
  biomarkers: Biomarker[];
  /** Names + values + units the model returned that we couldn't map to
   *  a catalog template, or that failed sanity bounds after scaling.
   *  Surfaced in the confirm view as "your lab also tested these — we
   *  don't analyze them yet" so the user understands a 70-marker panel
   *  didn't get silently truncated to 18. */
  unmapped: Array<{ name: string; value: number; unit: string }>;
};

/**
 * Scale and vet the reference range the model read off the report.
 *
 * Deliberately the same three guards the text matcher applies to a range it
 * captured itself (see extractMarkerValue in parser/catalogMatcher.ts), for
 * the same reason: once a printed range DRIVES status, a misread one doesn't
 * degrade gracefully — it invents a flag.
 *
 *   1. Well-formed: both bounds finite and min < max.
 *   2. Physically plausible: the scaled range sits inside the marker's own
 *      physical bounds, so a range mangled into the wrong magnitude is out.
 *   3. The value belongs beside it: a lab never prints a result more than
 *      ~5x outside the range it prints next to it. When that happens the
 *      RANGE is the misread, so we drop it and grade on the catalog band.
 *      Tested by magnitude ratio rather than span, because spans differ far
 *      too much between markers for one window to fit them all.
 *
 * Returns undefined when the range fails any guard — the caller then grades
 * against the catalog, exactly as it did before ranges were plumbed through.
 */
function trustedLabRange(
  r: GeminiMarker,
  scale: number,
  value: number,
  physMin: number,
  physMax: number,
): { min: number; max: number } | undefined {
  const rawMin = typeof r.refMin === 'number' ? r.refMin : NaN;
  const rawMax = typeof r.refMax === 'number' ? r.refMax : NaN;
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return undefined;
  if (rawMin >= rawMax) return undefined;
  const min = scale !== 1 ? roundConvertedValue(rawMin * scale, scale) : rawMin;
  const max = scale !== 1 ? roundConvertedValue(rawMax * scale, scale) : rawMax;
  if (min < physMin || max > physMax) return undefined;
  const belowOk = min <= 0 ? true : value >= min / 5;
  const aboveOk = max <= 0 ? true : value <= max * 5;
  if (!belowOk || !aboveOk) return undefined;
  return { min, max };
}

/**
 * Map Gemini's flat array onto our Biomarker shape. Markers that don't
 * resolve to a catalog template are returned in the `unmapped` array
 * rather than silently dropped — the catalog scope is still the source
 * of truth for what the rest of the app knows how to render, but the
 * UI gets to tell the user "we saw N more markers your lab tested,
 * here they are."
 */
export function mapGeminiResultsToCatalog(
  results: GeminiMarker[],
): AiMapResult {
  const seen = new Set<string>();
  const mapped: Biomarker[] = [];
  const unmapped: Array<{ name: string; value: number; unit: string }> = [];
  const recordUnmapped = (r: GeminiMarker) => {
    const value = typeof r.value === 'number' ? r.value : Number(r.value);
    unmapped.push({
      name: r.name,
      value: Number.isFinite(value) ? value : NaN,
      unit: r.unit ?? '',
    });
  };
  for (const r of results) {
    const template = findTemplateByName(r.name);
    if (!template) {
      recordUnmapped(r);
      continue;
    }
    if (seen.has(template.id)) continue;
    const raw = typeof r.value === 'number' ? r.value : Number(r.value);
    if (!Number.isFinite(raw)) {
      recordUnmapped(r);
      continue;
    }
    // Reconcile the lab's printed unit against the catalog's canonical
    // unit. "245 thou/cumm" → catalog `/cumm` → multiplier ratio 1000
    // → store 245,000. "4.09 mill/cumm" → catalog `million/cumm` →
    // ratio 1 → store 4.09 unchanged. Mass/concentration units (mg/dL,
    // ng/mL) return ratio 1 and pass through.
    // SI / alternative-unit conversion takes priority (mirrors pdfParser's
    // extractMarkerValue): when Gemini's unit is one of the marker's altUnits,
    // apply its exact per-marker factor — mmol/L→mg/dL, µmol/L→mg/dL,
    // pg/mL→ng/mL, x10^9/L→/cumm, etc. Otherwise fall back to the count-prefix
    // ratio. Without this the AI path silently skipped EVERY SI conversion:
    // a troponin in pg/mL stayed 1000x too high (a false MI), a D-dimer in
    // mg/L stayed 1000x too low (a missed PE), SI glucose/creatinine/calcium
    // graded against the wrong band. This keeps the AI parser in lockstep
    // with the text parser on unit handling.
    const normPrinted = normalizeMu(r.unit ?? '').toLowerCase();
    const alt = template.altUnits?.find((a) =>
      a.units.some((u) => normPrinted.includes(normalizeMu(u).toLowerCase())),
    );
    // A MOLAR unit we can't convert is not a unit we may ignore.
    //
    // The text matcher has a unit gate: a printed unit that isn't the
    // template's own (or a declared altUnit) simply fails to match, and the
    // marker is safely skipped. The AI path has no such gate — it resolves on
    // NAME and then applies whatever scale it can work out, defaulting to 1.
    // So a lipid panel printed in mmol/L (routine across the UK, Europe,
    // Malaysia and Australia) mapped "Total Cholesterol 5.2 mmol/L" straight
    // onto the mg/dL template as 5.2 mg/dL — a real 201 mg/dL reported as an
    // impossibly low number that still cleared the physical bounds and
    // rendered as a normal result.
    //
    // A molar concentration can NEVER be numerically equivalent to a
    // mass-per-volume canonical unit, so when we see one and the template
    // doesn't declare a conversion for it, treating it as canonical is always
    // wrong. Route it to unmapped instead — the user is told the lab tested
    // it and we didn't interpret it, which is the honest outcome. Narrow on
    // purpose: only these molar spellings, and only when no altUnit matched,
    // so no marker we CAN read is newly rejected.
    if (!alt && isUnconvertibleMolarUnit(normPrinted, template.unit)) {
      recordUnmapped(r);
      continue;
    }
    const scale = alt
      ? alt.toCanonical
      : unitMultiplier(r.unit) / unitMultiplier(template.unit);
    // Same precision rule as the text matcher — a molar conversion rounds to
    // 3 sig-figs, an exact power-of-ten count-prefix shift keeps every
    // printed digit and only sheds IEEE-754 noise. See parser/units.ts.
    const value = scale !== 1 ? roundConvertedValue(raw * scale, scale) : raw;
    // Sanity bounds applied to the SCALED value:
    //   1. Non-negative — biomarkers are non-negative; a negative
    //      reading is hallucination or sign-flip.
    //   2. Per-template physical bound — uses `physicalMin/Max` when
    //      set (admits clinical extremes like glucose 500 in DKA,
    //      platelet 1.2M in essential thrombocythemia, while
    //      rejecting hallucinated numbers); falls back to the 5×-span
    //      heuristic for templates without explicit bounds yet.
    if (value < 0) {
      recordUnmapped(r);
      continue;
    }
    const span = template.max - template.min || 1;
    const physMin =
      typeof template.physicalMin === 'number'
        ? template.physicalMin
        : template.min - 5 * span;
    const physMax =
      typeof template.physicalMax === 'number'
        ? template.physicalMax
        : template.max + 5 * span;
    if (value < physMin || value > physMax) {
      recordUnmapped(r);
      continue;
    }
    // The lab's OWN printed range, scaled the same way the value was.
    //
    // Gemini returns refMin/refMax, the response schema validates them, and
    // they were then dropped on the floor — `markerFromTemplate` was called
    // without its third argument. So "trust the signing pathologist", the
    // rule the whole grading model is built on, silently did not apply to
    // anything read off a photo. It also removed the only mechanism that
    // absorbs a lab's sex- or method-specific range, since the catalog
    // carries one band per marker.
    //
    // Trusted on the same terms as the text path (see extractMarkerValue):
    // min < max, both inside the marker's physical bounds, and the value has
    // to plausibly belong beside them — a model that misreads a range is at
    // least as likely as OCR that does, and an unchecked range invents
    // flags rather than fixing them.
    const labRef = trustedLabRange(r, scale, value, physMin, physMax);
    mapped.push({
      ...markerFromTemplate(template, value, labRef),
      // Unit-reconciliation receipt — keep the lab's printed value/unit
      // when we rescaled (e.g. lakh/thou/million prefixes), so the UI can
      // show "same result, standard units".
      originalValue: scale !== 1 ? raw : undefined,
      originalUnit: scale !== 1 ? (r.unit ?? undefined) : undefined,
    });
    seen.add(template.id);
  }
  return pruneSuspectShortNameMarkers({ biomarkers: mapped, unmapped });
}

/**
 * Defence-in-depth pass against cross-category hallucinations.
 *
 * Real failure observed on a Redcliffe Labs CBC: Gemini returned
 * `{ name: "pH", value: 4.2 }` despite there being no pH row anywhere
 * in the report. Our catalog has "pH" as a Semen pH marker (Fertility
 * category) with reference 7.2-8, so the matcher correctly resolved
 * the name and dumped a hallucinated 4.2 into the dashboard as
 * "severely low semen pH." Trust-killer.
 *
 * Root cause is upstream (vision model inventing a short ambiguous
 * abbreviation). The prompt now forbids this explicitly, but a second
 * line of defence at the catalog boundary is cheap insurance: if a
 * fertility marker with a short canonical name (≤3 chars: pH, plus
 * any future additions like K, Na) appears AND no other fertility-axis
 * markers were extracted in the same response, treat it as suspect
 * and move it to the unmapped list. A genuine semen analysis would
 * report volume, motility, morphology, count alongside pH; a CBC
 * never includes pH.
 *
 * Threshold rationale: require ≥1 OTHER fertility marker (so total
 * ≥2). Conservative — drops only the textbook hallucination pattern
 * without false-positiving on legitimate multi-marker semen analyses.
 */
export function pruneSuspectShortNameMarkers(input: AiMapResult): AiMapResult {
  const fertilityCount = input.biomarkers.filter(
    (b) => b.category === 'fertility',
  ).length;
  if (fertilityCount === 0) return input;
  const kept: Biomarker[] = [];
  const newUnmapped = [...input.unmapped];
  for (const b of input.biomarkers) {
    const normalised = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isShortName = normalised.length > 0 && normalised.length <= 3;
    const isFertility = b.category === 'fertility';
    if (isFertility && isShortName && fertilityCount < 2) {
      newUnmapped.push({
        name: b.name,
        value: b.value,
        unit: b.unit,
      });
      continue;
    }
    kept.push(b);
  }
  return { biomarkers: kept, unmapped: newUnmapped };
}

export type AiParseResult = {
  /** Biomarkers we recognised and mapped into the catalog. */
  biomarkers: Biomarker[];
  /** Raw count returned by the model — lets the caller distinguish
   *  "Gemini saw nothing" (rawCount = 0) from "Gemini saw markers we
   *  don't track yet" (rawCount > 0 but biomarkers.length = 0). */
  rawCount: number;
  /** Markers the model returned that didn't resolve to a catalog
   *  template (or failed sanity bounds). Surfaced in the confirm view
   *  so a 70-marker panel that mapped to 18 catalog markers reads as
   *  "we mapped 18 and saw 52 more your lab tested" — not as silent
   *  truncation. Empty when every returned marker was mapped. */
  unmapped: Array<{ name: string; value: number; unit: string }>;
};

class AiParseError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiParseError';
  }
}

/**
 * Main entry point. Throws AiParseError on any non-200 response or
 * shape mismatch so the caller can render a meaningful error without
 * having to inspect HTTP details.
 */
export async function parseWithAi(
  file: File,
  signal?: AbortSignal,
): Promise<AiParseResult> {
  // Short-circuit if the caller already cancelled before we did any
  // work — saves a downscale and a base64 encode on a doomed call.
  if (signal?.aborted) {
    throw new AiParseError('AI parser cancelled', undefined);
  }
  const scaled = await downscaleImage(file);
  const base64 = await blobToBase64(scaled);
  if (signal?.aborted) {
    throw new AiParseError('AI parser cancelled', undefined);
  }

  // Deadline guard. Without this a missing or unresponsive endpoint
  // leaves the "Trying AI parser…" screen spinning forever — most
  // visibly on a local `vite dev` build, where `/api/parse-image` (a
  // deployed serverless function) has no handler and the POST never
  // resolves. We abort our OWN controller on timeout (never the
  // caller's), so the cascade doesn't mislabel a timeout as a user
  // cancel. Gemini cold-starts occasionally take ~15s, so the ceiling
  // is generous.
  // On a local build `/api/parse-image` usually has no handler (plain
  // `vite dev`), so the POST hangs — fail fast (8s) instead of making the
  // developer wait the full production ceiling. `vercel dev` answers well
  // within 8s, so it still works there.
  const isLocalDev =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const TIMEOUT_MS = isLocalDev ? 8_000 : 45_000;
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', forwardAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/parse-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: scaled.type || 'image/jpeg',
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new AiParseError(
        isLocalDev
          ? 'The AI reader isn’t available on a local build (no server running). Enter values manually or try a different file.'
          : 'The AI reader took too long to respond. Try again, or enter values manually.',
      );
    }
    if (signal?.aborted) throw new AiParseError('AI parser cancelled');
    // Genuine network failure (offline, connection refused, DNS).
    throw new AiParseError(
      'Couldn’t reach the AI reader. Check your connection, or enter values manually.',
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let message = `AI parser failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody) as {
        error?: string;
        kind?: string;
        hint?: string;
      };
      if (parsed.error) message = parsed.error;
      // Server attaches `kind` (error class name) and a sanitised
      // `hint` (message fragment with URLs/keys/payloads stripped) for
      // 500 responses — surfacing both in the UI distinguishes a Gemini
      // rate-limit from a fetch-failed from a schema-rejected without
      // a Vercel-logs round-trip.
      const suffix = [parsed.kind, parsed.hint].filter(Boolean).join(': ');
      if (suffix) message = `${message} [${suffix}]`;
    } catch {
      if (errBody) message = errBody;
    }
    throw new AiParseError(message, response.status);
  }

  // A 200 that isn't JSON means we hit something other than the real
  // endpoint — most commonly a dev server answering `/api/*` with the
  // SPA's index.html. Turn the cryptic "Unexpected token '<'" into a
  // message that points at the actual cause.
  let body: ParseImageResponseShape;
  try {
    body = (await response.json()) as ParseImageResponseShape;
  } catch {
    throw new AiParseError(
      'The AI reader isn’t available here (the server returned a page, not data). This step needs the deployed build — enter values manually or try a different file.',
    );
  }
  if (!body || !Array.isArray(body.biomarkers)) {
    throw new AiParseError('AI parser returned an unexpected shape');
  }

  const mapResult = mapGeminiResultsToCatalog(body.biomarkers);
  return {
    // Run the AI-parsed markers through the same derivation step as the
    // text path, so an AI-read Total T + SHBG (or glucose + insulin)
    // produces calculated free-T / HOMA-IR too. Derivation is idempotent
    // (it skips a marker the lab already reported), so this is safe.
    biomarkers: deriveComputedMarkers(mapResult.biomarkers),
    unmapped: mapResult.unmapped,
    rawCount: body.biomarkers.length,
  };
}
