/**
 * Real PDF parsing pipeline.
 *
 * Two stages:
 *   1. extractPdfText(file)            — uses pdfjs-dist (browser, no
 *                                        backend) to pull every visible
 *                                        text run out of the file.
 *   2. extractBiomarkersFromText(text) — runs the biomarker catalog
 *                                        against the extracted text and
 *                                        constructs real Biomarker
 *                                        objects for every alias the
 *                                        catalog knows about.
 *
 * The matcher is intentionally simple: per catalog entry, look for any
 * of the entry's aliases in the text, then scan forward up to ~80 chars
 * for a number followed by the entry's unit string. First hit wins.
 *
 * That's enough to extract values from typical lab PDFs where each row
 * is `Marker | Value | Unit | Range`. It will miss reports with weird
 * layouts (handwritten scans, exotic formatting); when extraction yields
 * zero markers the caller falls back to demo data.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  biomarkerCatalog,
  markerFromTemplate,
  type Biomarker,
  type BiomarkerTemplate,
} from '../data/biomarkers';

// Point pdfjs at its worker script. Vite resolves the ?url import to a
// real URL at build time, so this works in dev AND in the production
// bundle without manual copy steps.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ------------------------------------------------------------------ */
/* Stage 1 — PDF -> text                                                */
/* ------------------------------------------------------------------ */

/** Lightweight type guard for pdfjs-dist's TextContent.items entries.
 *  pdfjs returns a union of `TextItem | TextMarkedContent`; only the
 *  former carries a `str`. Avoiding `as` casts per the no-casting rule. */
function hasStr(item: unknown): item is { str: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str: unknown }).str === 'string'
  );
}

/**
 * Read a PDF File into the document text. Pages are joined with double
 * newlines so the matcher's per-row search windows don't accidentally
 * span page boundaries.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    for (const item of content.items) {
      if (hasStr(item)) lines.push(item.str);
    }
    pageTexts.push(lines.join('\n'));
  }

  // Surface a single document-wide string. Real lab PDFs typically lay
  // out one value per "row" of text items, so this gives the matcher
  // enough proximity signal without us reconstructing page geometry.
  return pageTexts.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Stage 2 — text -> biomarkers                                          */
/* ------------------------------------------------------------------ */

/** Escape RegExp metacharacters so an arbitrary alias / unit string
 *  can be embedded into a regex literal safely. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when the alias itself contains the template's unit (or any unit
 * alias) as a substring. Common in lab reports that label a row
 * "Density (million per ml)" — the unit is in the LABEL, not after the
 * value, so requiring a unit token after the number would (incorrectly)
 * reject this row.
 */
function aliasContainsUnit(alias: string, template: BiomarkerTemplate): boolean {
  if (!template.unit) return false;
  const aliasLower = alias.toLowerCase();
  if (aliasLower.includes(template.unit.toLowerCase())) return true;
  for (const u of template.unitAliases ?? []) {
    if (u.length > 0 && aliasLower.includes(u.toLowerCase())) return true;
  }
  return false;
}

/**
 * Try every alias in order; return the first regex that hits the text.
 *
 * Per-alias gating:
 *   - alias names its own unit (e.g. "Density (million per ml)") →
 *     `alias <80 chars> number`             (no unit gate; the alias is
 *                                            specific enough to avoid
 *                                            false positives on its own)
 *   - template has a unit and the alias does NOT name it →
 *     `alias <80 chars> number <30 chars> unit`
 *   - template has no unit (pH) →
 *     `alias <80 chars> number`
 *
 * The unit gate, when present, cuts down on false positives — e.g.
 * "Testosterone" appearing inside narrative text without ng/dL nearby
 * shouldn't match.
 */
function extractMarkerValue(
  text: string,
  template: BiomarkerTemplate,
): number | null {
  const between = '[\\s\\S]{0,80}?';
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const tail = '[\\s\\S]{0,30}?';

  // Pre-build the unit alternation once per template — same across aliases.
  const unitTokens = template.unit
    ? [template.unit, ...(template.unitAliases ?? [])]
        .filter((u) => u.length > 0)
        .map(escapeRegex)
    : [];
  const unitGate = unitTokens.length > 0 ? `(?:${unitTokens.join('|')})` : '';

  for (const alias of template.aliases) {
    const aliasPattern = escapeRegex(alias);
    const skipUnitGate = !template.unit || aliasContainsUnit(alias, template);
    const pattern = skipUnitGate
      ? `${aliasPattern}${between}${number}`
      : `${aliasPattern}${between}${number}${tail}${unitGate}`;
    const match = text.match(new RegExp(pattern, 'i'));
    if (!match) continue;
    const value = parseFloat(match[1]);
    if (!Number.isNaN(value)) return value;
  }
  return null;
}

/**
 * Run the entire biomarker catalog against the extracted text. Returns
 * a fully-typed Biomarker[] (with derived status, plain copy, etc.) for
 * every template that matched.
 */
export function extractBiomarkersFromText(text: string): Biomarker[] {
  const found: Biomarker[] = [];
  const seen = new Set<string>();
  for (const template of biomarkerCatalog) {
    if (seen.has(template.id)) continue;
    const value = extractMarkerValue(text, template);
    if (value === null) continue;
    found.push(markerFromTemplate(template, value));
    seen.add(template.id);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Combined entry point                                                 */
/* ------------------------------------------------------------------ */

export type PdfParseResult = {
  biomarkers: Biomarker[];
  /** Raw text we extracted — kept so the UI can show "we read N
   *  characters, matched M markers" diagnostics if something looks off. */
  rawText: string;
};

/** Convenience wrapper: file → biomarkers in one call. */
export async function parsePdfFile(file: File): Promise<PdfParseResult> {
  const rawText = await extractPdfText(file);
  const biomarkers = extractBiomarkersFromText(rawText);
  return { biomarkers, rawText };
}
