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

/** Max dimension (px) of the image we send to the server. Gemini reads
 *  text fine at this resolution; going higher just costs upload time
 *  and Vercel-body-limit risk for no recognition gain. */
const MAX_IMAGE_DIM = 2000;

/** JPEG quality for the downscale. 0.85 is the standard "indistinguishable
 *  from source for text" knob — preserves digit edges that lower values
 *  start to eat. */
const JPEG_QUALITY = 0.85;

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

/**
 * Resolve a Gemini-returned marker name against the biomarker catalog.
 * Returns the first template whose canonical name or any alias matches
 * case-insensitively. Strips punctuation/whitespace from both sides so
 * "Hemoglobin (Hb)" matches the "Hemoglobin" template.
 */
function findTemplateByName(name: string) {
  const normalised = name
    .toLowerCase()
    .replace(/[(),:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const template of biomarkerCatalog) {
    const candidates = [template.name, ...template.aliases].map((c) =>
      c
        .toLowerCase()
        .replace(/[(),:.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    if (candidates.some((c) => c === normalised || normalised.includes(c))) {
      return template;
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
    const value = typeof r.value === 'number' ? r.value : Number(r.value);
    if (!Number.isFinite(value)) continue;
    // Sanity bound mirrors pdfParser's catalog matcher: reject values
    // >5× outside the healthy span as obvious mis-reads.
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
      const parsed = JSON.parse(errBody) as { error?: string };
      if (parsed.error) message = parsed.error;
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
