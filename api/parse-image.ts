/**
 * Vision LLM fallback for lab-report parsing.
 *
 * The browser-side pipeline (pdfjs text-layer → Tesseract.js OCR →
 * catalog regex match) covers ~60-70% of uploads. This endpoint picks
 * up the rest: photos of printouts, scanned PDFs with no text layer,
 * yellow-background Indian lab templates that Tesseract can't read.
 *
 * Why Gemini 2.0 Flash (over Claude / GPT-4o): no credit card to
 * provision a key (Google AI Studio), 1,500 requests/day free tier,
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

Rules:
- Return JSON matching the schema exactly. No commentary, no markdown.
- "name": use the marker name AS PRINTED on the report (e.g., "Hemoglobin", "Total Testosterone", "Haemoglobin"). Preserve original spelling and casing.
- "value": the numeric value as a plain number (e.g., 12.5, 280, 1550000). Strip commas. No units inside this field.
- "unit": the unit STRING as printed on the report (e.g., "g/dL", "ng/dL", "/cumm", "thou/mm3", "g%", "fL", "%"). Preserve the exact glyph the lab used — including older Indian conventions like "g%" or "/cu.mm".
- "refMin"/"refMax": the lab's reference range numeric bounds if printed; omit otherwise. Strip commas. For one-sided patterns like "<2.00" or ">5.00", omit both fields (we don't model one-sided ranges yet).
- Skip non-numeric result rows ("Normal", "Adequate", "Trace", "Not Detected", "Negative", "Positive" without a value).
- Skip metadata rows (patient name, date, lab address, doctor name, page numbers, barcodes, signatures).
- Skip section headers like "Differential Leucocyte Count" — those aren't measurements.
- Common Indian lab formats: Marker → Value → Reference Range → Unit (Crystal Data, Dr Lal PathLabs, Thyrocare). Numbers can appear BEFORE the unit on the same row.

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
      },
    });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ]);

    const text = result.response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini's structured-output should make this impossible, but if
      // the model ever returns commentary alongside the JSON, fall
      // through to validation-fail with the raw text logged.
      console.error('parse-image: non-JSON response from Gemini:', text);
      return res
        .status(502)
        .json({ error: 'Upstream returned non-JSON response' });
    }

    const validated = ResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('parse-image: schema validation failed', validated.error);
      return res.status(502).json({
        error: 'Upstream JSON did not match expected schema',
      });
    }

    return res.status(200).json(validated.data);
  } catch (err) {
    console.error('parse-image: unhandled error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
