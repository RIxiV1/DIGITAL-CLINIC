/**
 * Catalog self-consistency invariants — a standing proactive probe.
 *
 * For EVERY template, build a clean row of itself (canonical name + a
 * mid-range value + its canonical unit) and assert two things:
 *
 *   1. It parses back to that marker at the right value (catches alias
 *      gaps, unit-gate failures, and value-collapse / mis-scale bugs like
 *      the RBC "Millions" → 0.000 one).
 *   2. That row surfaces NO unrelated marker (catches cross-category
 *      false positives like "Free T3" → free testosterone, or
 *      "Total Count" → sperm count).
 *
 * This is the automated version of "upload lots of varied reports and see
 * what breaks." It runs on every catalog/matcher change, so neither a new
 * marker nor a tweaked alias can silently reintroduce these bug classes.
 *
 * KNOWN_COLLISIONS documents the substring overlaps we've accepted: a
 * short alias that is part of a longer marker's NAME. They only fire when
 * a row is parsed in isolation — in a real panel the genuine row appears
 * first and claims the match — so they're allow-listed rather than fixed
 * (the clean fix needs matcher specificity; boundary hacks would break
 * legit hyphenated labels). A NEW collision not listed here is a real bug:
 * fix it, don't extend the list lightly.
 */

import { describe, it, expect } from 'vitest';
import { biomarkerCatalog, type BiomarkerTemplate } from '../data/biomarkers';
import { extractBiomarkersFromText } from './pdfParser';

// Previously held 'non-hdl': ['hdl'] and 'tibc': ['iron'] — both fixed by
// the matcher's specificity suppression (a shorter alias contained in a
// longer marker's span is dropped). The allow-list is empty now; any
// entry that needs adding is a real collision to investigate first.
const KNOWN_COLLISIONS: Record<string, readonly string[]> = {};

function midValue(t: BiomarkerTemplate): number {
  const m = (t.min + t.max) / 2;
  return Math.round(m * 100) / 100 || 1;
}

describe('catalog self-consistency invariants', () => {
  for (const t of biomarkerCatalog) {
    if (!t.aliases.length) continue; // derived-only templates have no row
    const v = midValue(t);
    const row = `${t.name} ${v}${t.unit ? ' ' + t.unit : ''}`;

    it(`${t.id} parses its own canonical row at the right value`, () => {
      const self = extractBiomarkersFromText(row).find((m) => m.id === t.id);
      expect(self, `expected "${row}" to extract ${t.id}`).toBeDefined();
      expect(self!.value).toBeCloseTo(v, 1); // canonical unit → scale 1
    });

    it(`${t.id}'s canonical row surfaces no unrelated marker`, () => {
      const others = extractBiomarkersFromText(row)
        .map((m) => m.id)
        .filter((id) => id !== t.id);
      const allowed = KNOWN_COLLISIONS[t.id] ?? [];
      const unexpected = others.filter((id) => !allowed.includes(id));
      expect(unexpected, `"${row}" leaked: ${unexpected.join(', ')}`).toEqual(
        [],
      );
    });
  }
});
