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
 *   2. POST /api/parse-image — Gemini 2.0 Flash extracts
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
  type Biomarker,
} from '../data/biomarkers';

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
      canvas.toBlob(
        (b) => resolve(b ?? file),
        'image/jpeg',
        JPEG_QUALITY,
      );
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
 * Detect the count-prefix multiplier in a printed unit string.
 *
 * Indian labs print platelets/WBC as "245 thou/cumm" or "2.45 lakh/cumm"
 * rather than the canonical raw count (245,000). Gemini returns whatever
 * the lab printed verbatim; we have to reconcile that against the
 * catalog's canonical unit before storing the value, otherwise a
 * platelet count of 245 thou shows up as "245" against a 150,000–450,000
 * reference range and lights up red on a healthy reading.
 *
 * Returns the linear multiplier (1, 1e3, 1e5, 1e6). The reconciliation
 * step computes `geminiMult / catalogMult` and scales the value — so a
 * catalog template already in `million/cumm` (RBC) gets multiplier 1e6
 * too and the values pass through unscaled.
 *
 * NOT a general unit converter — only handles the count-prefix family
 * the Indian lab format uses. Mass/concentration units (mg/dL, ng/mL,
 * g/dL) return 1; the catalog's per-marker canonical unit already
 * enforces scale on those.
 */
function unitMultiplier(unit: string | null | undefined): number {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  if (/(^|[^a-z])(lakh|lac|lakhs)([^a-z]|$)/.test(u)) return 1e5;
  if (
    /(^|[^a-z])(million|mill)([^a-z]|$)/.test(u) ||
    /\b10\^?6\b/.test(u) ||
    /x10\^?6/.test(u) ||
    /10⁶/.test(u)
  ) {
    return 1e6;
  }
  if (
    /(^|[^a-z])(thou|thousand)([^a-z]|$)/.test(u) ||
    /\b10\^?3\b/.test(u) ||
    /x10\^?3/.test(u) ||
    /10³/.test(u)
  ) {
    return 1e3;
  }
  return 1;
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
      if (hasContiguousWordMatch(haystack, needle)) return template;
    }
  }
  return null;
}

/**
 * Map Gemini's flat array onto our Biomarker shape. Markers that don't
 * resolve to a catalog template are dropped silently — the catalog
 * scope is the source of truth for what the rest of the app knows how
 * to render. Future work: surface the dropped names in the confirm
 * view as "unrecognised markers" so the user knows they were seen.
 */
function mapGeminiResultsToCatalog(results: GeminiMarker[]): Biomarker[] {
  const seen = new Set<string>();
  const mapped: Biomarker[] = [];
  for (const r of results) {
    const template = findTemplateByName(r.name);
    if (!template) continue;
    if (seen.has(template.id)) continue;
    const raw = typeof r.value === 'number' ? r.value : Number(r.value);
    if (!Number.isFinite(raw)) continue;
    // Reconcile the lab's printed unit against the catalog's canonical
    // unit. "245 thou/cumm" → catalog `/cumm` → multiplier ratio 1000
    // → store 245,000. "4.09 mill/cumm" → catalog `million/cumm` →
    // ratio 1 → store 4.09 unchanged. Mass/concentration units (mg/dL,
    // ng/mL) return ratio 1 and pass through.
    const scale = unitMultiplier(r.unit) / unitMultiplier(template.unit);
    const value = raw * scale;
    // Sanity bounds applied to the SCALED value:
    //   1. Non-negative — a negative reading is hallucination or sign-
    //      flip, never legitimate.
    //   2. Absolute cap 1e8 — catches "model invented an absurd number"
    //      while admitting clinical extremes (severe thrombocytosis can
    //      legitimately exceed 1e6 in raw cells/cumm).
    //   3. Within 5× the catalog's healthy span — mirrors the regex
    //      matcher's bound.
    if (value < 0 || value > 1e8) continue;
    const span = template.max - template.min || 1;
    if (value < template.min - 5 * span || value > template.max + 5 * span)
      continue;
    mapped.push(markerFromTemplate(template, value));
    seen.add(template.id);
  }
  return mapped;
}

export type AiParseResult = {
  /** Biomarkers we recognised and mapped into the catalog. */
  biomarkers: Biomarker[];
  /** Raw count returned by the model — lets the caller distinguish
   *  "Gemini saw nothing" (rawCount = 0) from "Gemini saw markers we
   *  don't track yet" (rawCount > 0 but biomarkers.length = 0). */
  rawCount: number;
};

export class AiParseError extends Error {
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
export async function parseWithAi(file: File): Promise<AiParseResult> {
  const scaled = await downscaleImage(file);
  const base64 = await blobToBase64(scaled);

  const response = await fetch('/api/parse-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: scaled.type || 'image/jpeg',
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let message = `AI parser failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody) as { error?: string; kind?: string };
      if (parsed.error) message = parsed.error;
      // Server attaches `kind` (the error class name from the catch
      // block) for 500 responses — surfacing it in the UI lets us
      // distinguish a Gemini rate-limit error from a JSON-parse fail
      // or a body-size cap trip without a Vercel-logs round-trip.
      if (parsed.kind) message = `${message} [${parsed.kind}]`;
    } catch {
      if (errBody) message = errBody;
    }
    throw new AiParseError(message, response.status);
  }

  const body = (await response.json()) as ParseImageResponseShape;
  if (!body || !Array.isArray(body.biomarkers)) {
    throw new AiParseError('AI parser returned an unexpected shape');
  }

  return {
    biomarkers: mapGeminiResultsToCatalog(body.biomarkers),
    rawCount: body.biomarkers.length,
  };
}
