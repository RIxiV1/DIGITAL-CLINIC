/**
 * Programmatic PDF generation for the report download.
 *
 * The previous "Download as PDF" used window.print(), which produced
 * the browser's print-to-PDF output complete with URL header, timestamp
 * footer, and whatever quirks the user's printer dialog imposed. This
 * file replaces that with a fully-controlled PDF: our branding, our
 * layout, no browser chrome.
 *
 * Implementation: pure jsPDF, no html2canvas. Text stays selectable
 * and the rendered file size is small (~30KB for a typical report).
 *
 * The standard jsPDF fonts (Helvetica) only support Latin-1
 * (WinAnsiEncoding), so em-dashes, curly quotes, and other typographic
 * characters that appear in our copy must be sanitized before drawing.
 * See `asciize()` below.
 */

import jsPDF from 'jspdf';
import {
  biomarkersByCategory,
  bottomLineFor,
  categories as biomarkerCategories,
  summarizeStatuses,
  type Biomarker,
  type BiomarkerCategory,
} from '../data/biomarkers';
import type { Report } from '../data/reports';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

// A4 in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_T = 18;
const MARGIN_B = 22;
const MARGIN_L = 16;
const MARGIN_R = 16;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// Colors — RGB triples matching the app's design tokens.
const COLOR = {
  indigoBrand: [0, 102, 204] as const,
  indigoDeep: [0, 82, 163] as const,
  ink: [15, 20, 34] as const,
  inkSoft: [44, 51, 68] as const,
  muted: [107, 114, 128] as const,
  line: [229, 231, 235] as const,
  canvas: [248, 249, 250] as const,
  surface: [255, 255, 255] as const,
  gold: [255, 184, 0] as const,
  good: [22, 163, 74] as const,
  goodSoft: [220, 252, 231] as const,
  attention: [217, 119, 6] as const,
  attentionSoft: [254, 243, 199] as const,
  concern: [220, 38, 38] as const,
  concernSoft: [254, 226, 226] as const,
};

/* ------------------------------------------------------------------ */
/* Drawing context                                                      */
/* ------------------------------------------------------------------ */

type Ctx = {
  doc: jsPDF;
  y: number;
};

function newCtx(): Ctx {
  return {
    doc: new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }),
    y: MARGIN_T,
  };
}

/** Add a new page and reset the Y cursor. */
function nextPage(ctx: Ctx): void {
  ctx.doc.addPage();
  ctx.y = MARGIN_T;
}

/** If less than `neededMm` of vertical space remains on the page, add a new page. */
function ensureSpace(ctx: Ctx, neededMm: number): void {
  if (ctx.y + neededMm > PAGE_H - MARGIN_B) nextPage(ctx);
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Replace Unicode typography that the default Helvetica can't render
 * with ASCII equivalents. Without this, em-dashes appear as garbled
 * boxes and curly quotes vanish entirely.
 *
 * Mu: Micro Sign (U+00B5) IS in Latin-1 and renders as µ. Greek small
 * letter mu (U+03BC) is NOT — the parser normalizes incoming text to
 * U+03BC for matching, so we have to flip back to U+00B5 here for the
 * PDF output. Without this, μIU/mL on screen becomes a blank box in
 * the downloaded PDF.
 */
function asciize(text: string): string {
  return text
    .replace(/[‘’]/g, "'") // curly single quotes
    .replace(/[“”]/g, '"') // curly double quotes
    .replace(/[–—]/g, '-') // en-dash (U+2013), em-dash (U+2014)
    .replace(/−/g, '-') // math minus sign (U+2212) — common in copy
    .replace(/…/g, '...') // ellipsis
    .replace(/×/g, 'x') // multiplication sign (e.g. x10^6)
    .replace(/≥/g, '>=') // greater-or-equal — not in WinAnsi
    .replace(/≤/g, '<=') // less-or-equal — not in WinAnsi
    .replace(/μ/g, 'µ'); // Greek mu (U+03BC) → Micro Sign (U+00B5)
}

type FontWeight = 'normal' | 'bold' | 'italic' | 'bolditalic';

/** Apply a font + size + color in one call. Saves repetition. */
function setText(
  ctx: Ctx,
  size: number,
  weight: FontWeight,
  color: readonly [number, number, number],
): void {
  ctx.doc.setFont('helvetica', weight);
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(color[0], color[1], color[2]);
}

/** Width of an arbitrary text run in current font. */
function textWidth(ctx: Ctx, text: string): number {
  return ctx.doc.getTextWidth(asciize(text));
}

/* ------------------------------------------------------------------ */
/* Section drawers                                                      */
/* ------------------------------------------------------------------ */

function drawHeader(ctx: Ctx, report: Report): void {
  const { doc } = ctx;

  // Top eyebrow row: brand on the left, date+lab on the right.
  setText(ctx, 12, 'bold', COLOR.indigoBrand);
  doc.text('ForMen', MARGIN_L, ctx.y);
  setText(ctx, 12, 'normal', COLOR.indigoBrand);
  doc.text(' Digital Clinic', MARGIN_L + textWidth(ctx, 'ForMen') + 0.5, ctx.y);

  setText(ctx, 9, 'normal', COLOR.muted);
  const right = asciize(`${report.uploadedOn}  -  ${report.lab}`);
  doc.text(right, PAGE_W - MARGIN_R - doc.getTextWidth(right), ctx.y);

  ctx.y += 6;

  // Report title
  setText(ctx, 19, 'bold', COLOR.ink);
  doc.text(asciize(report.name), MARGIN_L, ctx.y);
  ctx.y += 12;
}

function drawBottomLine(ctx: Ctx, biomarkers: Biomarker[]): void {
  const { doc } = ctx;
  const summary = summarizeStatuses(biomarkers);
  const line = asciize(bottomLineFor(biomarkers));

  // Card background — brand gold, rounded.
  const cardX = MARGIN_L;
  const cardY = ctx.y;
  // Two-pass measure: pre-wrap the line to know how tall the box needs
  // to be. Headroom for eyebrow, line, and the three counters below.
  setText(ctx, 13, 'normal', COLOR.ink);
  const wrapped = doc.splitTextToSize(line, CONTENT_W - 14) as string[];
  const lineCount = wrapped.length;
  const linesHeight = lineCount * 5.6;
  const cardHeight = 14 + linesHeight + 22;

  doc.setFillColor(COLOR.gold[0], COLOR.gold[1], COLOR.gold[2]);
  doc.roundedRect(cardX, cardY, CONTENT_W, cardHeight, 4, 4, 'F');

  // Eyebrow
  setText(ctx, 8, 'bold', COLOR.ink);
  doc.text('THE BOTTOM LINE', cardX + 7, cardY + 8);

  // Summary text
  setText(ctx, 13, 'normal', COLOR.ink);
  doc.text(wrapped, cardX + 7, cardY + 15);

  // Three counters along the bottom
  const counterY = cardY + cardHeight - 12;
  const counterStep = (CONTENT_W - 14) / 3;
  drawCounter(ctx, cardX + 7 + counterStep * 0, counterY, 'ON TRACK', summary.good, COLOR.good);
  drawCounter(ctx, cardX + 7 + counterStep * 1, counterY, 'NEEDS ATTENTION', summary.attention, COLOR.attention);
  drawCounter(ctx, cardX + 7 + counterStep * 2, counterY, 'NEEDS CARE', summary.concern, COLOR.concern);

  ctx.y += cardHeight + 10;
}

function drawCounter(
  ctx: Ctx,
  x: number,
  y: number,
  label: string,
  count: number,
  dot: readonly [number, number, number],
): void {
  const { doc } = ctx;
  // Dot
  doc.setFillColor(dot[0], dot[1], dot[2]);
  doc.circle(x + 1.2, y - 2.5, 1.2, 'F');

  // Label
  setText(ctx, 7, 'bold', COLOR.indigoDeep);
  doc.text(label, x + 4, y - 1.8);

  // Count
  setText(ctx, 16, 'bold', COLOR.ink);
  doc.text(String(count), x + 4, y + 6.5);
}

function drawCategorySection(
  ctx: Ctx,
  category: BiomarkerCategory,
  markers: Biomarker[],
): void {
  ensureSpace(ctx, 22);
  const { doc } = ctx;

  // Section header
  setText(ctx, 13, 'bold', COLOR.indigoBrand);
  doc.text(asciize(category.name), MARGIN_L, ctx.y);
  ctx.y += 4.5;

  setText(ctx, 9, 'normal', COLOR.muted);
  doc.text(asciize(category.description), MARGIN_L, ctx.y);
  ctx.y += 5;

  // Section underline
  doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, ctx.y, MARGIN_L + CONTENT_W, ctx.y);
  ctx.y += 5;

  for (const m of markers) {
    drawMarker(ctx, m);
  }
  ctx.y += 4;
}

function drawMarker(ctx: Ctx, marker: Biomarker): void {
  // Conservative reservation — a marker block runs ~35mm including its
  // wrapped plain-text body. ensureSpace adds a page break if we'd
  // straddle the bottom margin.
  ensureSpace(ctx, 35);

  const { doc } = ctx;
  const tier = tierForMarker(marker);

  // Row 1 — name on the left, value+unit on the right.
  setText(ctx, 12, 'bold', COLOR.ink);
  doc.text(asciize(marker.name), MARGIN_L, ctx.y);

  setText(ctx, 13, 'bold', COLOR.ink);
  const valStr = asciize(`${marker.value} ${marker.unit}`.trim());
  const valW = doc.getTextWidth(valStr);
  doc.text(valStr, PAGE_W - MARGIN_R - valW, ctx.y);
  ctx.y += 4.5;

  // Subtitle: simpleName (left) + tier badge (right)
  if (marker.simpleName) {
    setText(ctx, 9, 'normal', COLOR.muted);
    doc.text(asciize(marker.simpleName), MARGIN_L, ctx.y);
  }

  // Tier badge — right-aligned under the value
  const badgeText = ` ${tier.label} `;
  setText(ctx, 7, 'bold', COLOR.surface);
  const badgeW = doc.getTextWidth(badgeText) + 4;
  const badgeX = PAGE_W - MARGIN_R - badgeW;
  doc.setFillColor(tier.color[0], tier.color[1], tier.color[2]);
  doc.roundedRect(badgeX, ctx.y - 3.6, badgeW, 4.5, 1.5, 1.5, 'F');
  doc.text(badgeText, badgeX + 2, ctx.y - 0.5);

  ctx.y += 4.5;

  // Healthy range line
  setText(ctx, 8, 'normal', COLOR.muted);
  const unitSuffix = marker.unit ? ` ${marker.unit}` : '';
  const rangeStr = asciize(`Healthy ${marker.min}-${marker.max}${unitSuffix}`);
  doc.text(rangeStr, MARGIN_L, ctx.y);

  if (typeof marker.optimalMin === 'number' && typeof marker.optimalMax === 'number') {
    const optStr = asciize(`  -  Optimal ${marker.optimalMin}-${marker.optimalMax}${unitSuffix}`);
    setText(ctx, 8, 'normal', COLOR.good);
    doc.text(optStr, MARGIN_L + doc.getTextWidth(rangeStr), ctx.y);
  }
  ctx.y += 5;

  // Plain English explanation
  setText(ctx, 9.5, 'normal', COLOR.inkSoft);
  const plain = asciize(marker.plain);
  const wrapped = doc.splitTextToSize(plain, CONTENT_W) as string[];
  doc.text(wrapped, MARGIN_L, ctx.y);
  ctx.y += wrapped.length * 4 + 4;

  // Inter-marker divider
  doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L, ctx.y - 2, MARGIN_L + CONTENT_W, ctx.y - 2);
  ctx.y += 3;
}

type Tier = {
  label: string;
  color: readonly [number, number, number];
};

function tierForMarker(marker: Biomarker): Tier {
  if (marker.status === 'critical') {
    return { label: 'SEE A DOCTOR', color: COLOR.concern };
  }
  if (marker.status === 'concern') {
    return { label: 'OUT OF RANGE', color: COLOR.concern };
  }
  const hasOptimal =
    typeof marker.optimalMin === 'number' &&
    typeof marker.optimalMax === 'number';
  const inOptimal =
    hasOptimal &&
    marker.value >= (marker.optimalMin as number) &&
    marker.value <= (marker.optimalMax as number);
  if (marker.status === 'attention' || (hasOptimal && !inOptimal)) {
    return { label: 'BORDERLINE', color: COLOR.attention };
  }
  return { label: 'OPTIMAL', color: COLOR.good };
}

function drawDisclaimer(ctx: Ctx): void {
  ensureSpace(ctx, 28);
  const { doc } = ctx;

  doc.setFillColor(COLOR.canvas[0], COLOR.canvas[1], COLOR.canvas[2]);
  doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, ctx.y, CONTENT_W, 22, 3, 3, 'FD');

  setText(ctx, 8, 'bold', COLOR.indigoBrand);
  doc.text('IMPORTANT', MARGIN_L + 5, ctx.y + 6);

  setText(ctx, 9, 'normal', COLOR.inkSoft);
  const text = asciize(
    'Digital Clinic translates and contextualises your report — it is not a diagnosis. Always discuss findings with a qualified doctor before changing medication or starting therapy.',
  );
  const wrapped = doc.splitTextToSize(text, CONTENT_W - 10) as string[];
  doc.text(wrapped, MARGIN_L + 5, ctx.y + 11);

  ctx.y += 28;
}

function drawFooters(ctx: Ctx): void {
  const { doc } = ctx;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Hairline above the footer
    doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, PAGE_H - 14, PAGE_W - MARGIN_R, PAGE_H - 14);

    // Inline the font/color setup rather than building a fake Ctx —
    // setText only ever reads ctx.doc today, but a future change that
    // started reading ctx.y would break this footer call silently.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR.muted[0], COLOR.muted[1], COLOR.muted[2]);
    doc.text('ForMen - Digital Clinic', MARGIN_L, PAGE_H - 9);

    const pageLabel = `${i} / ${total}`;
    const w = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, PAGE_W - MARGIN_R - w, PAGE_H - 9);
  }
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                   */
/* ------------------------------------------------------------------ */

/** Build a clean PDF of the given report and trigger a browser download. */
export function generateReportPdf(report: Report): void {
  const ctx = newCtx();

  drawHeader(ctx, report);
  drawBottomLine(ctx, report.biomarkers);

  // Walk categories in the canonical order from biomarkers.ts so the
  // PDF reads in the same sequence the UI does. biomarkersByCategory
  // returns only categories that actually have markers, so empty
  // sections don't print blank headers.
  const groups = biomarkersByCategory(report.biomarkers);
  // Make sure the group order matches `categories` ordering rather
  // than whatever the marker array happened to be in.
  const categoryOrder = new Map(
    biomarkerCategories.map((c, i) => [c.id, i] as const),
  );
  groups.sort(
    (a, b) =>
      (categoryOrder.get(a.category.id) ?? 999) -
      (categoryOrder.get(b.category.id) ?? 999),
  );

  for (const group of groups) {
    drawCategorySection(ctx, group.category, group.markers);
  }

  drawDisclaimer(ctx);
  drawFooters(ctx);

  // Filename: safe-slug from the report name. The user's browser
  // shows a "Save as" dialog if their settings prompt; otherwise the
  // PDF lands in the default download folder.
  const slug =
    report.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report';
  ctx.doc.save(`formen-${slug}.pdf`);
}
