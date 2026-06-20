/**
 * Vision LLM fallback for lab-report parsing.
 *
 * The browser-side pipeline (pdfjs text-layer → Tesseract.js OCR →
 * catalog regex match) covers ~60-70% of uploads. This endpoint picks
 * up the rest: photos of printouts, scanned PDFs with no text layer,
 * yellow-background Indian lab templates that Tesseract can't read.
 *
 * Why Gemini 2.5 Flash (over Claude / GPT-4o): no credit card to
 * provision a key (Google AI Studio), generous free tier,
 * native responseSchema for structured-JSON output (no prompt prayer
 * needed — the API forces the response to match the shape).
 *
 * Privacy note baked into the contract: free-tier callers' prompts may
 * be retained by Google to improve their service. The client surfaces
 * this on the "Try AI parser" button so users opt in deliberately. When
 * we swap in a paid Vertex AI key later, the no-retention guarantee
 * kicks in and the client-side disclosure goes away — the function
 * signature is identical.
 *
 * Runtime: Node serverless (default). 30s timeout (typical latency is
 * 3-6s, leaving headroom for Gemini rate-limit retries).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';

export const config = {
  maxDuration: 30,
};

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Origin allowlist for the parser endpoint. Configurable via
 * `ALLOWED_ORIGINS` (comma-separated). Falls back to the production
 * Vercel host + localhost for dev. Vercel preview deployments (where
 * the URL changes per commit) need to be added explicitly via the env
 * var — the regex prefix `re:` lets you cover preview hosts with one
 * entry (e.g. `re:^https://digital-clinic-omega-git-.+\\.vercel\\.app$`)
 * without opening the gate to every Vercel-hosted app. Anything that
 * starts with `re:` is parsed as a regex; everything else is a literal
 * match.
 *
 * Note: Origin can be omitted (e.g., direct curl from the user's own
 * shell, server-to-server, some Android WebViews). When Origin is
 * missing we apply the stricter posture: reject unless the env var
 * sets `ALLOW_NO_ORIGIN=1` — preview deploys + local CLI tests can
 * opt in deliberately.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://digital-clinic-omega.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const RAW_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOriginEntries = (
  RAW_ALLOWED_ORIGINS.length ? RAW_ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS
).map(
  (
    entry,
  ): { kind: 'literal'; value: string } | { kind: 'regex'; value: RegExp } => {
    if (entry.startsWith('re:')) {
      try {
        return { kind: 'regex', value: new RegExp(entry.slice(3)) };
      } catch {
        // A malformed pattern would otherwise open-fail to "always
        // reject" silently. Log + fall back to literal so misconfig
        // surfaces in deploy logs rather than 100% of users getting
        // 403s with no diagnostic.
        // eslint-disable-next-line no-console
        console.error(
          'parse-image: invalid regex in ALLOWED_ORIGINS:',
          entry,
          '— treating as literal.',
        );
        return { kind: 'literal', value: entry };
      }
    }
    return { kind: 'literal', value: entry };
  },
);

function isOriginAllowed(origin: string): boolean {
  for (const entry of allowedOriginEntries) {
    if (entry.kind === 'literal') {
      if (entry.value === origin) return true;
    } else if (entry.value.test(origin)) {
      return true;
    }
  }
  return false;
}

/**
 * Same-origin POSTs are trusted regardless of the literal allowlist.
 *
 * Rationale: the SPA always POSTs from the deployment's own hostname.
 * On a Vercel preview deploy (URL like
 * `digital-clinic-omega-git-feat-…-shaik.vercel.app`), the browser
 * sends `Origin: https://<that-preview-host>` and `Host: <that-preview-host>`.
 * Comparing the two lets every preview deploy work out of the box
 * without per-branch `ALLOWED_ORIGINS` env config.
 *
 * Safety: cross-origin attackers send a DIFFERENT Origin (their own
 * site) while Host still resolves to OUR deployment. Origin !== Host
 * → rejected by this check AND the literal allowlist. So same-origin
 * trust doesn't weaken the gate.
 *
 * Caveat: `req.headers.host` can be set by reverse proxies and is
 * tampered with in some misconfigurations. On Vercel the platform
 * sets it from the actual hostname being served; an attacker who
 * could spoof Host would also need to clear the literal allowlist
 * AND defeat browser SOP — well outside the threat model we cover.
 */
function isSameOriginRequest(
  origin: string,
  host: string | undefined,
): boolean {
  if (!host) return false;
  // Vercel deployments are always HTTPS. Localhost dev can be either,
  // but the localhost entries in DEFAULT_ALLOWED_ORIGINS already cover
  // those — same-origin trust only matters for preview/prod deploys.
  return origin === `https://${host}`;
}

const allowNoOrigin = process.env.ALLOW_NO_ORIGIN === '1';

/* ------------------------------------------------------------------ */
/* Rate limiting                                                        */
/*                                                                      */
/* The Origin gate stops casual browser abuse, but a non-browser client */
/* can spoof the Origin header (curl -H "Origin: …") and use this as a  */
/* free Gemini relay — exhausting the free-tier quota or running up     */
/* cost. This is a per-instance sliding-window limiter: on serverless   */
/* it can't see across instances, but it still throttles a sustained    */
/* attack hitting a warm instance and bounds quota burn, with zero      */
/* infra. For globally-accurate limiting, set UPSTASH_REDIS_REST_URL +  */
/* UPSTASH_REDIS_REST_TOKEN and swap this for @upstash/ratelimit        */
/* (sliding window, same key) — the call site below stays identical.    */
/* ------------------------------------------------------------------ */
const RATE_LIMIT_WINDOW_MS = 60_000;
// A human parsing their own reports does a handful of calls; 15/min/IP
// leaves generous room for retries while throttling automated abuse.
const RATE_LIMIT_MAX = 15;
// Bound memory: cap tracked IPs and evict oldest-inserted when full so a
// spray of distinct source IPs can't grow the map unboundedly.
const MAX_TRACKED_IPS = 5000;
const rateHits = new Map<string, number[]>();

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : (xff ?? '');
  // Vercel's edge sets x-forwarded-for; the left-most entry is the
  // client. Clients can't strip it (the platform populates it), so it's
  // a reliable-enough key for abuse throttling.
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}

/** Records a hit for `ip` at `now` and returns true if it exceeds the
 *  window budget. Pure aside from the module-level Map. */
function isRateLimited(ip: string, now: number): boolean {
  let arr = rateHits.get(ip);
  if (!arr) {
    if (rateHits.size >= MAX_TRACKED_IPS) {
      const oldest = rateHits.keys().next().value;
      if (oldest !== undefined) rateHits.delete(oldest);
    }
    arr = [];
  }
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = arr.filter((t) => t > cutoff);
  recent.push(now);
  rateHits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

/** MIME types Gemini can ingest as inline image data and that match
 *  our client-side allowlist. Anything else gets rejected before it
 *  reaches the model — the client downscales to JPEG so this is
 *  belt-and-braces. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Strict JSON shape the model returns. Matches what the client maps
 * onto our Biomarker template via the catalog alias resolver — the
 * model captures whatever name the lab printed (e.g., "Haemoglobin"),
 * the client maps it back to the canonical id ("hb").
 */
const ResponseSchema = z.object({
  biomarkers: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      unit: z.string(),
      refMin: z.number().nullable().optional(),
      refMax: z.number().nullable().optional(),
    }),
  ),
});

export type ParseImageResponse = z.infer<typeof ResponseSchema>;

const SYSTEM_PROMPT = `You are a medical lab-report parser. Extract every numeric biomarker reading from the image.

CRITICAL — column/row alignment in tabular layouts:
Indian lab reports (Dr Lal PathLabs, Thyrocare, Crystal Data, Metropolis) print results in a strict grid:
    Test Name | Result | Units | Bio. Ref. Interval
Each row is a single marker. NEVER pull a value from a different row.
Before emitting a marker, mentally trace a HORIZONTAL line from the test name across to the result column — that exact number is "value", not the one above or below.
The reference range column (e.g. "13.00-17.00") looks similar to a result; never mistake a min/max range bound for the result. The result is a single number, the range has a hyphen / "to" between two numbers.
If a SINGLE specific numeric value is unreadable due to image quality, omit ONLY that one marker and CONTINUE with the rest of the report. Never stop extraction early. Process EVERY row top-to-bottom before responding — a typical CBC has 11–14 numeric rows (Hemoglobin, RBC, WBC, Platelets, Hematocrit/PCV, MCV, MCH, MCHC, RDW, plus differentials); a typical lipid panel has 4–6; a thyroid panel has 3–4. If your output contains fewer rows than the report visibly has, you have failed the task.

CRITICAL — no hallucinated markers:
Only emit markers whose test name is VISIBLY PRINTED in the image on the same row as the value you are reporting. Do NOT infer a marker name from the report title, section header, package name ("Full Body Checkup", "Wellness Panel"), or anatomical context. If the visible page is a CBC (Complete Blood Count), do NOT invent non-blood markers such as semen pH, vitamin levels, urine pH, or thyroid hormones — those would appear on other pages of a multi-page report. Emit ONLY what you can read directly from this page.
Two-letter test abbreviations (pH, Hb, K, Na) are particularly risky to guess — only emit them if the literal characters appear in the test-name column of the row you are reading. "pH" is NEVER a CBC marker.
Flag suffixes after the value ("L*", "H*", "CL*", "CH*", "*", "†", "L", "H") are status indicators for low/high/critical — strip them and keep ONLY the numeric value. "11.4 L*" means value 11.4 with status low — emit value: 11.4.

Rules:
- Return JSON matching the schema exactly. No commentary, no markdown.
- "name": use the marker name AS PRINTED on the report (e.g., "Hemoglobin", "Total Testosterone", "Haemoglobin", "Packed Cell Volume (PCV)"). Preserve original spelling, casing, and any parenthesised aliases.
- "value": the numeric value as a plain number (e.g., 12.5, 280, 1550000). Strip commas. No units inside this field. Preserve all printed decimal places (12.09 stays 12.09, not 12.1).
- "unit": the unit STRING as printed on the report (e.g., "g/dL", "ng/dL", "/cumm", "thou/mm3", "g%", "fL", "%"). Preserve the exact glyph the lab used — including older Indian conventions like "g%" or "/cu.mm". If a row's units column says "thou/mm3" or "mill/mm3", report that EXACT string — do NOT normalise it to "/cumm" or strip the prefix.
- "refMin"/"refMax": the lab's reference range numeric bounds if printed; omit otherwise. Strip commas. For one-sided patterns like "<2.00" or ">5.00", omit both fields (we don't model one-sided ranges yet).
- Skip non-numeric result rows ("Normal", "Adequate", "Trace", "Not Detected", "Negative", "Positive" without a value).
- Skip metadata rows (patient name, date, lab address, doctor name, page numbers, barcodes, signatures).
- Skip section headers like "Differential Leucocyte Count" — those aren't measurements. But DO extract the individual differential rows beneath them (Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils) — those ARE measurements.
- Extract Packed Cell Volume (PCV) / Hematocrit / HCT — it is a real marker, not a header.

Return ONLY the JSON object.`;

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    biomarkers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          value: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          refMin: { type: SchemaType.NUMBER, nullable: true },
          refMax: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['name', 'value', 'unit'],
      },
    },
  },
  required: ['biomarkers'],
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // Origin gate. Browsers send Origin on cross-origin POSTs; the same-
  // origin XHR from our SPA also sends it. Reject anything that doesn't
  // match the allowlist so the endpoint can't be abused as a free
  // Gemini relay from random sites. This is NOT a substitute for rate-
  // limiting (a determined attacker can spoof Origin via curl), but it
  // closes the easy-browser-abuse vector.
  const origin = req.headers.origin;
  const host =
    typeof req.headers.host === 'string' ? req.headers.host : undefined;
  if (typeof origin === 'string' && origin.length > 0) {
    if (!isOriginAllowed(origin) && !isSameOriginRequest(origin, host)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else if (!allowNoOrigin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limit per client IP — the Origin gate doesn't stop a spoofed-
  // Origin curl client, so this bounds how fast the endpoint can be
  // driven as a Gemini relay. Checked before any model work so abuse is
  // rejected cheaply.
  if (isRateLimited(clientIp(req), Date.now())) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return res
      .status(429)
      .json({ error: 'Too many requests. Please wait a minute and retry.' });
  }

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: 'GEMINI_API_KEY not configured on the server' });
  }

  try {
    const { imageBase64, mimeType } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || !mimeType) {
      return res
        .status(400)
        .json({ error: 'Missing imageBase64 or mimeType in body' });
    }

    // MIME-type allowlist. Gemini accepts a wider set than we want to
    // expose — restricting to JPEG/PNG/WebP matches the client-side
    // validateUpload allowlist and stops surprising formats (TIFF, SVG
    // with embedded scripts, etc.) reaching the model. The downscaler
    // re-encodes to JPEG anyway, so this should never trip for our own
    // client; it catches direct API callers and any future client bug.
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        error: 'Unsupported image type. Use JPEG, PNG, or WebP.',
      });
    }

    // Defensive payload-size cap. Vercel Hobby tier serverless body
    // limit is 4.5MB; base64-encoded images run ~33% larger than the
    // original bytes, so refuse anything >4MB encoded with a clear
    // error rather than letting the platform timeout/500. Client-side
    // downscale (in src/app/services/aiParser.ts) ensures we never
    // hit this in practice — this is the safety net.
    if (imageBase64.length > 4 * 1024 * 1024) {
      return res.status(413).json({
        error:
          'Image too large after base64 encoding. The client should downscale before upload.',
      });
    }

    // Light base64 shape check: reject anything that isn't a plain
    // base64 string. Prevents accidentally feeding Gemini a data-URL
    // prefix (`data:image/jpeg;base64,…`) which the SDK quietly mangles
    // — and rejects garbage strings before we burn a Gemini call.
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64)) {
      return res.status(400).json({ error: 'Invalid imageBase64 encoding.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      // Pinned to gemini-2.5-flash, the canonical stable replacement
      // after the 2.0 deprecation (Feb 2026) and the 1.5-line retirement
      // (returns 404 on v1beta for new projects). Path we walked to
      // get here, for future-us:
      //   - 'gemini-2.0-flash-exp' → 404 (preview alias retired)
      //   - 'gemini-2.0-flash'     → 429 limit=0 in free tier (regional)
      //   - 'gemini-1.5-flash'     → 404 (entire line retired)
      // If 2.5-flash also surfaces a regional free-tier-0, fall back
      // to 'gemini-2.5-flash-lite' which historically carries a more
      // lenient free quota.
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
        // Temperature 0 = deterministic. For an extraction task there is
        // exactly one correct answer per row; the default 1.0 sampling
        // was letting the model "creatively" misread the result column
        // (e.g., RBC 3.79 → 4.09, MCV 99.6 → 92.7 on the Dr Lal PathLabs
        // tabular layout). Pinning to 0 keeps the output stable across
        // re-runs and roughly halves the misread rate in our spot checks.
        temperature: 0,
      },
    });

    // Retry transient Gemini failures once before giving up. Empirically
    // ~5-10% of vision-endpoint calls hit a brief 503 / fetch-failed /
    // cold-start hiccup that succeeds on immediate retry. Bounded at
    // exactly one retry: that's enough to cover the common case without
    // multiplying latency or quota burn on a truly broken upstream.
    //
    // Retry only the generateContent call itself, NOT the surrounding
    // validation — if we threw because of a bad request, retrying the
    // same bad request just wastes a quota tick.
    const callGemini = () =>
      model.generateContent([
        SYSTEM_PROMPT,
        {
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        },
      ]);
    let result;
    try {
      result = await callGemini();
    } catch (firstErr) {
      console.warn(
        'parse-image: first attempt failed, retrying after 1s:',
        firstErr instanceof Error ? firstErr.name : typeof firstErr,
      );
      await new Promise((r) => setTimeout(r, 1000));
      result = await callGemini();
    }

    const text = result.response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini's structured-output should make this impossible. Log a
      // length-only diagnostic — we deliberately do NOT log `text`
      // because it contains the user's lab values (PII).
      console.error(
        'parse-image: non-JSON response from Gemini, length =',
        text.length,
      );
      return res
        .status(502)
        .json({ error: 'Upstream returned non-JSON response' });
    }

    const validated = ResponseSchema.safeParse(parsed);
    if (!validated.success) {
      // Log only the zod issue paths — the issue messages can echo
      // the value that failed validation (which is the user's PII).
      console.error(
        'parse-image: schema validation failed at paths',
        validated.error.issues.map((i) => i.path.join('.')).join(','),
      );
      return res.status(502).json({
        error: 'Upstream JSON did not match expected schema',
      });
    }

    return res.status(200).json(validated.data);
  } catch (err) {
    // Log the error class server-side. We expose the error NAME and a
    // sanitised message fragment in the client response so failure modes
    // surface in the UI without a Vercel-logs round-trip — but we strip
    // anything that looks like a URL, API key, or base64 payload before
    // returning, since the Gemini SDK occasionally embeds request URLs
    // and prompt echoes in its error messages.
    const name = err instanceof Error ? err.name : typeof err;
    const rawMessage = err instanceof Error ? err.message : '';
    const sanitised = rawMessage
      .replace(/https?:\/\/\S+/g, '<url>')
      .replace(/AIza[A-Za-z0-9_-]{10,}/g, '<key>')
      .replace(/[A-Za-z0-9+/=]{40,}/g, '<data>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    console.error('parse-image: unhandled error', name, rawMessage);
    // The sanitiser already strips URLs/keys/base64, but a message
    // fragment is still attacker-visible surface in prod. Return the
    // hint only off-production (preview/dev) where it aids debugging;
    // prod gets the error class name (`kind`) only, which is safe.
    const isProd = process.env.VERCEL_ENV === 'production';
    return res.status(500).json({
      error: 'Internal error while parsing the image. Please try again.',
      kind: name,
      hint: isProd ? undefined : sanitised || undefined,
    });
  }
}
