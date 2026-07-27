/**
 * Catalog matching: run the biomarker catalog against candidate text and
 * return typed Biomarker[] — with per-marker provenance and unrecognized-row
 * detection.
 *
 * The linear per-template regex approach and its defenses (ref-range absorber,
 * cutoff-prefix lookbehind, bounded between-window, OCR-tolerant unit gate)
 * are documented inline below. Extracted verbatim from pdfParser.ts — no
 * behaviour change.
 */

import {
  biomarkerCatalog,
  markerFromTemplate,
  deriveComputedMarkers,
  type Biomarker,
  type BiomarkerTemplate,
} from '../../data/biomarkers';
import { escapeRegex } from './regexUtils';
import { normalize, normalizeMu } from './pdfTextLayer';

/** Hard cap on input to the unknown-row matcher. Defensive — the regex
 *  is bounded (`{0,50}?` on the label window), but `matchAll` over a
 *  100 KB OCR blob with adversarial structure can still spike a phone
 *  CPU. 80 KB is well above any real lab report (a normal extraction
 *  is 2-15 KB) and well below the size where the matcher becomes
 *  noticeable. */
const UNKNOWN_ROW_INPUT_CAP = 80_000;

/* ------------------------------------------------------------------ */
/* Catalog matching                                                     */
/*                                                                      */
/* Strategy: linear regex per template, anchored on the alias text.    */
/* The pattern walks `alias → between → number → tail-with-refrange →  */
/* unit` and captures (value, refMin?, refMax?, printed-unit?). The    */
/* tail's optional ref-range absorber + the cutoff-prefix lookbehind   */
/* defend the "Reference Range Trap" (capturing the lab's upper bound  */
/* as the user's value) that linear scans are most vulnerable to.      */
/*                                                                      */
/* Audit note: an alternative architecture would do TRUE column-       */
/* geometry extraction — detect the "Result" / "Reference" column     */
/* headers, project each text item to a column, and only consider     */
/* values in the Result column. This is more robust on adversarial    */
/* multi-column templates but a multi-day rewrite. The current         */
/* defenses (ref-range absorber, cutoff lookbehind, bounded between-   */
/* window, page-boundary sentinel) close the specific failure modes   */
/* the audit identified for the linear approach. Column geometry is a  */
/* deferred backlog item, not an active defect.                        */
/* ------------------------------------------------------------------ */

/**
 * Tesseract letter confusions that survive into a unit token.
 *
 * Only the ones that actually bite here. `c`↔`e` was caught on the OCR bench:
 * a "realistic" phone photo read `WBC COUNT 7800 /eumm` — name and value
 * perfect, unit off by one letter — and the marker was silently dropped
 * because the unit gate didn't match. `m`↔`rn` is the other classic (two
 * narrow strokes fusing), and the digit/letter pairs are the standard
 * lookalikes that hit `mg/dL`, `g/dL` and `mmol/L`.
 *
 * Deliberately NOT a general fuzzy match: no edit distance, no dropped
 * characters, no `u`↔`v`. The unit gate is the matcher's false-positive
 * guard — it's what stops "WBC COUNT" binding to a page number — so it has
 * to keep demanding a unit-SHAPED token. This only forgives a misread
 * character in one, which is a much smaller loosening than it looks: every
 * expansion below still has to sit exactly where a unit belongs, right
 * after the value and its optional reference range.
 */
const OCR_UNIT_CONFUSIONS: Record<string, string> = {
  c: '[ce]',
  e: '[ec]',
  m: '(?:m|rn)',
  l: '[l1i]',
  i: '[il1]',
  o: '[o0]',
  '0': '[0o]',
  '1': '[1li]',
};

/**
 * Build an OCR-tolerant regex fragment for one unit token.
 *
 * Escapes per character rather than escaping the whole string first — the
 * substitutions have to be able to see each original character, and
 * escapeRegex would have already inserted backslashes to trip over.
 * Matching is case-insensitive at the call site, so the classes only list
 * lower case.
 */
function ocrTolerantUnit(unit: string): string {
  let out = '';
  for (const ch of unit) {
    out += OCR_UNIT_CONFUSIONS[ch.toLowerCase()] ?? escapeRegex(ch);
  }
  return out;
}

/**
 * Compiled-regex cache for the per-alias matcher. Each alias pattern is a
 * pure function of (alias, template unit/altUnits) — none change at
 * runtime — yet `extractMarkerValue` recompiles every one (~300 aliases)
 * for each of the 3 reconstruction candidates, on every upload. Caching
 * by the pattern string skips that recompilation with ZERO behavioural
 * change: same pattern → same RegExp, and the pattern is never used with
 * the `g` flag, so a shared instance carries no `lastIndex` state. Bounded
 * at ~300 distinct patterns for the lifetime of the catalog.
 */
const ALIAS_REGEX_CACHE = new Map<string, RegExp>();
function aliasRegex(pattern: string): RegExp {
  let re = ALIAS_REGEX_CACHE.get(pattern);
  if (!re) {
    re = new RegExp(pattern, 'i');
    ALIAS_REGEX_CACHE.set(pattern, re);
  }
  return re;
}

function aliasContainsUnit(
  alias: string,
  template: BiomarkerTemplate,
): boolean {
  if (!template.unit) return false;
  const a = alias.toLowerCase();
  if (a.includes(template.unit.toLowerCase())) return true;
  for (const u of template.unitAliases ?? []) {
    if (u.length > 0 && a.includes(u.toLowerCase())) return true;
  }
  return false;
}

/**
 * Detect a count-prefix multiplier in a printed unit string.
 *
 * Indian labs print platelets/WBC as "245 thou/cumm" or "2.45 lakh/cumm"
 * rather than the canonical raw count. The catalog's `platelets`
 * template uses /cumm (raw); a captured value of `245` against a
 * printed unit of `thou/cumm` is actually 245,000.
 *
 * Returns the linear multiplier (1, 1e3, 1e5, 1e6). The reconciliation
 * step in `extractMarkerValue` computes `printedMult / catalogMult` and
 * scales — so a catalog template already in `million/cumm` (RBC) gets
 * multiplier 1e6 too and values pass through unscaled.
 *
 * Mirror of aiParser.ts's identical helper. Mass/concentration units
 * (mg/dL, ng/mL, g/dL) return 1; per-marker canonical unit already
 * enforces scale on those.
 */
function unitMultiplier(unit: string | null | undefined): number {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  // Lakh = 1e5. Indian English convention. Variants: lakh, lakhs,
  // lac (older), lacs (older plural).
  if (/(^|[^a-z])(lakh|lakhs|lac|lacs)([^a-z]|$)/.test(u)) return 1e5;
  // Million = 1e6. Variants: million, mill, mio (German/European
  // notation seen on some imported labs), and the various 10^6
  // typesettings — plain `10^6`, the superscript `10⁶`, the `E`
  // notation `10E6`, and `x10^6` / `x 10^6` with optional space.
  if (
    /(^|[^a-z])(millions|million|mill|mil|mio|m)([^a-z]|$)/.test(u) ||
    /\b10\s*\^?\s*6\b/.test(u) ||
    /x\s*10\s*\^?\s*6/.test(u) ||
    /10\s*e\s*6\b/.test(u) ||
    /10⁶/.test(u)
  ) {
    return 1e6;
  }
  // Thousand = 1e3. Variants: thou, thous (the US CBC abbreviation, e.g.
  // "5.2 Thous/cu.mm"), thousand, and the short forms `th` ("4.24 th/cumm",
  // Healthians) and `k` ("202 K/uL", US/international), plus 10^3 / 10³ /
  // 10E3 / x10^3 with optional spacing. Without `th`, a Healthians TLC like
  // "4.24 th/cumm" stayed 4.24 against a /cumm template (4000–11000) and read
  // as a FALSE critical-low. `k`/`th` only ever match a standalone letter
  // followed by a non-letter (the `([^a-z]|$)` guard) — "kg", "kU/L" don't
  // trip them — and this function only runs on a unit that already passed
  // the gate, so the letters can't fire on arbitrary text.
  if (
    /(^|[^a-z])(thousands|thousand|thous|thou|th|k)([^a-z]|$)/.test(u) ||
    /\b10\s*\^?\s*3\b/.test(u) ||
    /x\s*10\s*\^?\s*3/.test(u) ||
    /10\s*e\s*3\b/.test(u) ||
    /10³/.test(u)
  ) {
    return 1e3;
  }
  return 1;
}

/**
 * Extract a single marker's value from text using its template.
 *
 * Per-alias gating:
 *   - alias contains its own unit ("Density (million per ml)")
 *       → `alias <80 chars> number`                  (no unit gate)
 *   - alias doesn't name its unit, template has one
 *       → `alias <80 chars> number <30 chars> unit`  (strict)
 *   - template has no unit (pH)
 *       → `alias <80 chars> number`
 *
 * Sanity check: rejects values >5× outside the healthy band — catches
 * data-entry errors and mis-parses (e.g. picking up the page number
 * instead of the value).
 */
type ExtractedMarker = {
  value: number;
  /** The original printed value + unit, set ONLY when the printed number
   *  was rescaled to canonical units (e.g. lakh/thou/million count
   *  prefixes). Drives the unit-reconciliation receipt in the UI. */
  originalValue?: number;
  originalUnit?: string;
  /** The reference range the lab itself printed alongside the value,
   *  captured by the `tail` regex's ref-range slot. Undefined when the
   *  row didn't include a printed range or the parser couldn't fit it
   *  into the recognised shape. */
  labRefMin?: number;
  labRefMax?: number;
  /** Character span of the full regex match in the normalized text.
   *  Used by extractBiomarkersFromText to suppress a less-specific match
   *  whose span is wholly contained in a more-specific one (e.g. 'HDL'
   *  inside 'Non-HDL Cholesterol'). */
  matchStart: number;
  matchEnd: number;
};

function extractMarkerValue(
  text: string,
  template: BiomarkerTemplate,
): ExtractedMarker | null {
  // Bounded between-window: allow AT MOST one newline between the
  // alias and the number. Cross-row glue matches were a real false-
  // positive vector — a marker on row N could pair with a number on
  // row N+5 if both fell within 80 chars under the old `[\\s\\S]`
  // version. We still need to admit the common "label on its own line,
  // value on the next line" layout (Indian-lab tabular reports use it
  // heavily after reconstructByPosition splits cells onto separate
  // lines), so we permit exactly one `\n` with a tight pre-newline
  // budget. The PAGE_BOUNDARY_SENTINEL emitted by OCR carries `\n\n`
  // around it, which this pattern can't cross — page-skip glue is
  // structurally prevented.
  // Make the optional cross-newline alternation LAZY (`??`) so the
  // engine prefers same-line matches when one is available. Without
  // the lazy quantifier the greedy `?` would happily skip a digit on
  // the current line to land on a digit on the next line — turning
  // "Total WBC Count 7200 /cumm\nTotal RBC Count 5.2 …" into a WBC
  // match for "5.2" when the right answer is "7200" on the same line.
  // Two binding shapes, same-line preferred:
  //   sameLine — alias and number on one reconstructed line.
  //   nextLine — the "label on its own line, value on the next line"
  //     tabular layout Indian labs use heavily. The post-newline run is
  //     LETTER-FREE so we only bind to a bare value cell ("13.5",
  //     "5.00 %"), never to a DIFFERENT row's label+value.
  // Why the letter-free guard: when OCR drops a section's real data rows,
  // a leftover row can sit directly under the section header. The header
  // word then reaches across the newline into that unrelated row —
  // "Motility\nVitality 5.00 %" made Total motility read 5 (vitality), and
  // "Morphology (Pap stain)\nExcess residual cytoplasm 0.00 %" made
  // Morphology read 0. Both are a header binding to the next labelled
  // row's value; banning letters before the number on the crossed line
  // structurally prevents it while preserving genuine value-cell layouts.
  const sameLine = '[^\\n]{0,80}?';
  const nextLine = '[^\\n]{0,40}?\\n[^A-Za-z\\n]{0,80}?';
  const between = `(?:${sameLine}|${nextLine})`;
  // Number pattern with a leading negative lookbehind. Rejects:
  //   - one-sided reference cutoffs (`<2.00`, `>5.00`, `≤140`, `≥1.5`)
  //     — labs print these as their reference threshold, not as the
  //     user's measured value.
  //   - mid-decimal starts (digit or `.` immediately before) — without
  //     this, the cutoff `<2.00` would have its `<` blocked but the
  //     engine could backtrack and bind `00` as the value (starting
  //     at the `.`'s right boundary).
  //   - mid-digit starts — `(?<!\\d)` so a captured number can't begin
  //     inside another number.
  // Trailing `(?!\\d)` makes the number ATOMIC: it can't END mid-number
  // either. Without it the engine backtracks a multi-digit value to satisfy
  // a downstream unit — e.g. "Normal morphology 70 - 75 %" split "70" into
  // "7" and then read "0 - 75" as a reference range, surfacing a phantom
  // morphology of 7. Forbidding a DIGIT immediately after the capture forces
  // the whole number or no match. A trailing "." is deliberately still
  // allowed — it's punctuation ("Glucose 92. mg/dL"), not a split — because
  // `(?:\\.\\d+)?` only consumes a "." when a digit follows it anyway.
  const numPattern = '(?<![<>≤≥\\d.])(-?\\d+(?:\\.\\d+)?)(?!\\d)';
  // Between number and unit: up to 30 non-digit chars, OPTIONALLY
  // followed by a reference-range shape ("12-14", "150 to 450",
  // "80–99") and then up to 30 more non-digit chars before the unit.
  //
  // Why the optional ref-range slot exists: many Indian lab reports
  // (and older British/Commonwealth formats) print the row as
  // `Marker  Value  RefMin - RefMax  Unit` — the reference range sits
  // BETWEEN the value and the unit, not after them. The previous tail
  // ([^\d\n]{0,30}?) refused to span digits, so it either failed the
  // match (best case) or captured the ref-range max as the value
  // (worst case, e.g. "Hemoglobin 15 male: 14 - 16 g%" captured 16).
  //
  // The optional ref-range is shaped strictly — `\d+(.\d+)? sep \d+(.\d+)?`
  // where sep is a hyphen/en-dash/em-dash or the literal word "to" —
  // so it only absorbs digits that LOOK like a range. The original
  // protection against "Vitamin D (25-OH) 28 ng/mL" capturing "25" is
  // preserved because "(25-OH)" doesn't match the ref-range shape:
  // the engine then backtracks and captures 28 correctly.
  //
  // The ref-range slot is now CAPTURED via groups so we can surface
  // the lab's printed range in the UI (CRITICAL 2 in the architectural
  // audit — "lab said normal, app says concern" trust break). Indices
  // m[3], m[4] hold refMin / refMax when matched. The pattern also
  // accepts the one-sided forms "<X" and ">X" (common in Indian labs)
  // and the ":" / "Reference Range" lead-ins that some templates use.
  const refRangeBody =
    '(\\d+(?:\\.\\d+)?)\\s*(?:[-–—]|to)\\s*(\\d+(?:\\.\\d+)?)';
  // A one-sided reference cutoff ("> 15", "<50", "≥58") printed BETWEEN the
  // value and the unit. Seminograms and many Indian panels format the row as
  // `Marker  Value  >Ref  Unit` — e.g. "Total sperm concentration 15 >15
  // Million/mL". Without absorbing it, the bare "15" of ">15" sits between
  // the value and the unit and blocks the unit gate, so the whole marker was
  // silently dropped (the headline sperm-concentration number, missed). It's
  // NON-capturing (unlike refRangeBody) — a one-sided cutoff is a threshold,
  // not a [min,max] range, so there's nothing to surface as the lab's range;
  // this keeps the m[2]/m[3] refMin/refMax group numbering unchanged. The
  // value itself is never captured from here: numPattern's `(?<![<>≤≥…])`
  // lookbehind already refuses to start a value right after a cutoff sign.
  //
  // Also absorb the WORD forms "up to 15" / "upto 15" — the textual
  // equivalent of "≤15", printed by many Indian/European labs (e.g. an ESR
  // reference of "Up to 15 mm/hr"). Without this, "ESR 2 Up to 15 mm/hr"
  // couldn't get the value "2" to the unit, so it backtracked and read the
  // reference "15" AS the value. "up to" is specific enough to be safe; bare
  // "to" is deliberately excluded (two-sided "X to Y" ranges are already
  // handled by refRangeBody, which the alternation tries first).
  const oneSidedCutoff = '(?:[<>≤≥]|up\\s*to|upto)\\s*\\d+(?:\\.\\d+)?';
  const tail = `[^\\d\\n]{0,30}?(?:(?:${refRangeBody}|${oneSidedCutoff})[^\\d\\n]{0,30}?)?`;

  // The SAME range, but sitting AFTER the unit — which is where real labs
  // actually print it:
  //
  //     Creatinine 1.00 mg/dL 0.70 - 1.30      <- Dr Lal PathLabs, and the
  //     Sodium 141 mmol/L (135-145)               Innoquest corpus fixture
  //
  // `tail` above only looks BEFORE the unit, so on those layouts — i.e. on
  // essentially every real report — labRefMin/Max came back undefined and we
  // silently graded against our own catalog band instead of the lab's. That
  // is exactly the trust break the ref-range capture was built to close
  // ("lab said normal, app says concern"): the mechanism shipped, and never
  // fired on the format that mattered. A normal UK urea of 7.1 mmol/L
  // (printed range 3.0-10.0) came back 'concern' against our band.
  //
  // Safe by construction: `[^\d\n]` cannot cross a newline, so this can only
  // ever read the rest of the marker's own row — never the next marker's
  // value. One-sided ranges ("<0.3", ">59") still match nothing and are
  // correctly skipped, because refRangeBody demands a dash between two
  // numbers.
  const tailAfterUnit = `(?:[^\\d\\n]{0,30}?${refRangeBody})?`;

  // normalizeMu on the catalog side mirrors the call inside normalize()
  // for the input text — without both sides agreeing on µ vs μ, units
  // that differ only in code point silently fail to match.
  // Alt-unit spellings (SI mmol/L, µmol/L, …) are admitted into the gate
  // too, so a report printed in those units still matches. The captured
  // token is reconciled to the canonical unit below via the template's
  // per-marker conversion factor.
  const altUnitTokens = (template.altUnits ?? []).flatMap((a) => a.units);
  const unitTokens = template.unit
    ? [template.unit, ...(template.unitAliases ?? []), ...altUnitTokens]
        .filter((u) => u.length > 0)
        .map((u) => ocrTolerantUnit(normalizeMu(u)))
    : [];
  // Capture the matched unit token so we can apply unitMultiplier
  // reconciliation when the lab prints in a different magnitude than
  // our catalog's canonical unit (e.g. "245 thou/cumm" → 245,000
  // against a /cumm template).
  //
  // Also widen the unit gate to admit count-prefixes IN FRONT of the
  // catalog unit. The catalog can't list every prefix×base combo
  // explicitly because they multiply combinatorially (thou/cumm,
  // lakh/cumm, thou/mm3, lakh/μL, …). Instead we accept an optional
  // prefix word (lakh|lac|thou|thousand|million|mill or a 10^N
  // shorthand) immediately before a known catalog unit, and let
  // unitMultiplier() figure out the scaling.
  // Optional count-prefix that can sit before the catalog's bare unit.
  // Mirrors the families recognised by unitMultiplier(): the named
  // prefixes (lakh/lac/thousand/thous/thou/million/mill/mio) and the
  // exponent typesettings (10^N, 10ᴺ, 10EN, x10^N) for N ∈ {3, 6}.
  // `thous` (the US CBC abbreviation) is listed BEFORE `thou` so it wins
  // the alternation and matches "Thous/cu.mm" whole, not just "thou".
  const prefixPattern =
    '(?:' +
    '(?:lakh|lakhs|lac|lacs|thousand|thous|thou|million|mill|mio)\\s*[/]?\\s*' +
    '|' +
    '(?:x?\\s*10\\s*(?:\\^|e|⁶|³)?\\s*[36]?)\\s*[/]?\\s*' +
    ')?';
  const unitGate =
    unitTokens.length > 0
      ? `(${prefixPattern}(?:${unitTokens.join('|')}))`
      : '';

  for (const alias of template.aliases) {
    const aliasEsc = escapeRegex(alias);
    const skipUnit = !template.unit || aliasContainsUnit(alias, template);
    // L-8: Even when we skip the unit gate (alias names its own unit, or
    // the template is unitless), require the number to end on a non-word
    // boundary. Without this, "Density (million per ml) reading 2024"
    // would capture the year 2024 as a value — the surrounding word
    // characters were valid as a number boundary under the looser
    // version of the pattern. Adding `(?!\\w)` makes the engine reject
    // a digit run that abuts a letter on the right, which catches the
    // metadata-row false positives.
    // Token-boundary guards around the alias. Without a RIGHT-side
    // letter boundary, a short alias that is a prefix of a longer word
    // matches inside it: 'pH' matched the "Ph" in "Physical Examination"
    // (the seminogram section header), and the between-window then bound
    // the next number — "Collection time 11.00" — so pH surfaced as 11
    // instead of the real 7.5 two rows down. The LEFT-side guard is the
    // mirror case (alias as a suffix, e.g. a stray "...someRBC"). Digits
    // and symbols are intentionally NOT boundaries: aliases legitimately
    // abut a value ("Density (million per ml)103") or end in '%'/')'.
    const lb = '(?<![A-Za-z])';
    const rb = '(?![A-Za-z])';
    const pattern = skipUnit
      ? `${lb}${aliasEsc}${rb}${between}${numPattern}(?!\\w)`
      : `${lb}${aliasEsc}${rb}${between}${numPattern}${tail}${unitGate}${tailAfterUnit}`;
    const m = text.match(aliasRegex(pattern));
    if (!m) continue;
    // Context guard: the same analyte name can denote a different test in a
    // different specimen with a different range ("Urine Glucose", "Random
    // Blood Sugar"). When the matched row carries a disqualifying word, this
    // template must not grade it — skip to the next alias (and, if every
    // alias lands on a disqualified row, return null so the value surfaces
    // uninterpreted rather than as a false flag). Scoped to the alias's own
    // line so a disqualifier elsewhere in the report can't suppress a valid
    // row. See BiomarkerTemplate.excludeIfRowMatches.
    if (template.excludeIfRowMatches) {
      const s = m.index ?? 0;
      const lineFrom = text.lastIndexOf('\n', s - 1) + 1;
      let lineTo = text.indexOf('\n', s);
      if (lineTo === -1) lineTo = text.length;
      if (template.excludeIfRowMatches.test(text.slice(lineFrom, lineTo))) {
        continue;
      }
    }
    const raw = parseFloat(m[1]);
    if (Number.isNaN(raw)) continue;
    // Capture group layout depends on whether skipUnit branched off.
    //   skipUnit=true:  m[1]=value (no other groups)
    //   skipUnit=false: m[1]=value, m[2]=refMin?, m[3]=refMax?, m[4]=unit,
    //                   m[5]=refMin?, m[6]=refMax?  (the post-unit range)
    // Each ref-range pair exists only when the lab printed one matching the
    // strict `\d+(.\d+)? sep \d+(.\d+)?` shape in that position; otherwise
    // that pair's outer `(?:...)?` was skipped and both are undefined.
    // Only ONE of the two pairs can be populated — they describe the same
    // slot on opposite sides of the unit — so pre-unit wins and post-unit is
    // the fallback.
    const printedUnit = !skipUnit && m[4] ? m[4] : '';
    const labRefMinStr = !skipUnit ? (m[2] ?? m[5] ?? '') : '';
    const labRefMaxStr = !skipUnit ? (m[3] ?? m[6] ?? '') : '';
    // Reconcile the lab's printed unit against the catalog's canonical
    // unit. Only do the reconciliation when we actually captured a
    // printed unit token (non-skipUnit path). When skipUnit is true,
    // the alias text already names the catalog's canonical unit
    // ("Density (million per ml)"), so the captured numeric is in
    // catalog units by construction — applying the multiplier ratio
    // would WRONGLY divide by the catalog's prefix (1e6 for
    // million/ml) and turn 103 into 0.000103.
    let scale = 1;
    if (!skipUnit && printedUnit) {
      // SI / alternative-unit conversion takes priority: when the printed
      // unit is one of the marker's altUnits, apply its exact per-marker
      // factor (e.g. glucose mmol/L → mg/dL ×18.0156). Otherwise fall back
      // to the count-prefix reconciliation (lakh / thou / million).
      const normPrinted = normalizeMu(printedUnit).toLowerCase();
      const alt = template.altUnits?.find((a) =>
        a.units.some((u) => normPrinted.includes(normalizeMu(u).toLowerCase())),
      );
      scale = alt
        ? alt.toCanonical
        : unitMultiplier(printedUnit) / unitMultiplier(template.unit);
    }
    // Clean up float-precision noise introduced by scaling — 2.45 * 1e5
    // yields 245000.00000000003 in IEEE-754, which is silly to surface
    // on a clinical dashboard. `toPrecision(12)` keeps 12 significant
    // digits (well above any real measurement precision) and drops the
    // floating-point error.
    const v = scale !== 1 ? parseFloat((raw * scale).toPrecision(12)) : raw;
    // Reject obviously-broken values up front. Floor at 0 (biomarkers
    // are non-negative even though the regex now refuses '-' anyway,
    // belt-and-braces).
    if (v < 0) continue;
    // A percentage cannot exceed 100. Values above it are data errors,
    // not measurements — e.g. P006's dummy seminogram printed "Total
    // motile (a+b+c) 117.00 %" and "Immotile (d) -17.00 %". Charting an
    // impossible 117% motility is worse than omitting it; reject and let
    // it surface in the unrecognized-rows panel instead. (The < 0 guard
    // above already drops the negative case.)
    if (template.unit === '%' && v > 100) continue;
    // Physical bound check — use template's explicit physicalMin/Max
    // when set, otherwise fall back to the 5×-span heuristic. Critical
    // status is decided later by statusForValue; this check is only
    // about rejecting values that are physically/clinically impossible.
    const span = template.max - template.min || 1;
    const physMin =
      typeof template.physicalMin === 'number'
        ? template.physicalMin
        : template.min - 5 * span;
    const physMax =
      typeof template.physicalMax === 'number'
        ? template.physicalMax
        : template.max + 5 * span;
    if (v < physMin || v > physMax) continue;
    // Scale the captured ref-range too — same multiplier logic as the
    // value. A lab printing "Platelet Count 245 (150 - 450) thou/cumm"
    // captures refMin=150, refMax=450 in printed thou units; we
    // multiply by the same scale so the user sees the lab's range in
    // the catalog's canonical units.
    const labRefMinNum = labRefMinStr ? parseFloat(labRefMinStr) : NaN;
    const labRefMaxNum = labRefMaxStr ? parseFloat(labRefMaxStr) : NaN;
    // A printed range is trustworthy only if (a) min < max, and (b) the
    // value it sits beside is actually near it. (b) is the important one now
    // that the lab range DRIVES status: OCR readily mangles a range —
    // "1.5 - 4.5" came back "15-45" off a real photo — and after lakh
    // scaling that made a normal platelet count read 'concern', a false
    // alarm invented purely by trusting a corrupt range. A lab does not
    // print a value 10x outside the range it prints next to it, so when that
    // happens the RANGE is the misread, not the value: discard it and grade
    // on the catalog band. The window is generous (0.5x-2x the bounds) so a
    // genuinely out-of-range result — the whole point of flagging — is kept;
    // only a range the value can't plausibly belong to is rejected.
    const scaledRefMin =
      scale !== 1
        ? parseFloat((labRefMinNum * scale).toPrecision(12))
        : labRefMinNum;
    const scaledRefMax =
      scale !== 1
        ? parseFloat((labRefMaxNum * scale).toPrecision(12))
        : labRefMaxNum;
    // Two guards, because the lab range now DRIVES status and a mis-OCR'd
    // range invents false flags:
    //
    //  1. Physically plausible: the scaled range must sit inside the marker's
    //     own physical bounds. Catches a range mangled into a different
    //     magnitude.
    //  2. The value must plausibly BELONG to its range. A lab never prints a
    //     result an order of magnitude outside the range beside it, so when
    //     that happens the range is the misread, not the value. This is the
    //     one that catches platelet "1.5 - 4.5" -> "15-45": after lakh
    //     scaling the value is 250k and the range is 1.5M-4.5M — both
    //     physically possible, but the value sits far below its own range, so
    //     the range is untrustworthy. Compared in scaled space (both sides
    //     converted) with a generous window, so a genuinely out-of-range
    //     result — the whole reason to flag — is still kept.
    // The value must plausibly belong to its range, tested by MAGNITUDE not
    // span: a span-based window can't tell glucose 250 (a true high, 2.5x its
    // 70-100 range) from a platelet 250k mis-paired with a 1.5M-4.5M range
    // (a 6x UNDER-shoot), because their spans differ wildly. A ratio can.
    // Genuine pathology rarely runs past ~5x the reference bound; a range the
    // value sits >5x outside was almost certainly mis-read, so we drop it and
    // grade on the catalog band. Guard against a zero bound before dividing.
    const belowOk = scaledRefMin <= 0 ? true : v >= scaledRefMin / 5;
    const aboveOk = scaledRefMax <= 0 ? true : v <= scaledRefMax * 5;
    const valueBelongs = belowOk && aboveOk;
    const rangeTrustworthy =
      Number.isFinite(labRefMinNum) &&
      Number.isFinite(labRefMaxNum) &&
      labRefMinNum < labRefMaxNum &&
      scaledRefMin >= physMin &&
      scaledRefMax <= physMax &&
      valueBelongs;
    const labRef = rangeTrustworthy
      ? { min: scaledRefMin, max: scaledRefMax }
      : undefined;
    return {
      value: v,
      // Unit reconciliation receipt: when we rescaled the printed number
      // (e.g. "2.4 lakh/cumm" → 240000 /µL), keep the ORIGINAL printed
      // value + unit so the UI can show the user we didn't invent a
      // different number — same result, standard units. Only set when a
      // real rescale happened (scale !== 1).
      originalValue: scale !== 1 ? raw : undefined,
      originalUnit: scale !== 1 ? (printedUnit ?? undefined) : undefined,
      labRefMin: labRef?.min,
      labRefMax: labRef?.max,
      matchStart: m.index ?? 0,
      matchEnd: (m.index ?? 0) + m[0].length,
    };
  }
  return null;
}

/**
 * Run the entire biomarker catalog against text. Returns the resulting
 * Biomarker array (with derived status/copy) for every template that
 * matched.
 */
type ExtractHit = { marker: Biomarker; start: number; end: number };

/**
 * Run the whole catalog against `text` and return the surviving hits WITH
 * their text spans (after specificity suppression). Shared by the plain
 * extractor and the provenance-aware one so both see identical results.
 */
function collectHits(text: string): { normalized: string; hits: ExtractHit[] } {
  const normalized = normalize(text);
  // Collect every template match WITH its text span, so we can suppress
  // less-specific matches below.
  const raw: ExtractHit[] = [];
  for (const template of biomarkerCatalog) {
    // biomarkerCatalog contains each template exactly once — the prior
    // `seen` Set/dedup was dead code that suggested an enforced
    // invariant the loop body didn't need. Dropped to keep the loop
    // readable; if catalog duplication ever needs to be defended
    // against, dedupe at the catalog source, not here.
    const extracted = extractMarkerValue(normalized, template);
    if (extracted === null) continue;
    const labRef =
      typeof extracted.labRefMin === 'number' &&
      typeof extracted.labRefMax === 'number'
        ? { min: extracted.labRefMin, max: extracted.labRefMax }
        : undefined;
    raw.push({
      marker: {
        ...markerFromTemplate(template, extracted.value, labRef),
        originalValue: extracted.originalValue,
        originalUnit: extracted.originalUnit,
      },
      start: extracted.matchStart,
      end: extracted.matchEnd,
    });
  }
  // Specificity suppression. A short alias can match inside a longer
  // marker's printed name on the same row — 'HDL' inside 'Non-HDL
  // Cholesterol', 'Iron' inside 'Total Iron Binding Capacity' — so both
  // templates extract the same value off one row. Drop a hit whose span
  // is wholly contained in a strictly-longer hit's span: that's the
  // substring match, and the longer one is the real (more specific)
  // marker. Genuine distinct markers sit on separate rows with non-
  // overlapping spans, so they're untouched. Catalog order preserved.
  const hits = raw.filter(
    (h) =>
      !raw.some(
        (g) =>
          g !== h &&
          g.end - g.start > h.end - h.start &&
          h.start >= g.start &&
          h.end <= g.end,
      ),
  );
  return { normalized, hits };
}

export function extractBiomarkersFromText(text: string): Biomarker[] {
  return deriveComputedMarkers(collectHits(text).hits.map((h) => h.marker));
}

/**
 * Per-marker provenance — the honest "why do we believe this?" data.
 * Report-level source + OCR confidence already live on PdfParseResult;
 * this is the piece only the parser can produce: the exact row it read and
 * what it validated. Every field is read off the real match — nothing here
 * is fabricated, which is the entire point of a trust feature. Derived
 * markers (ratios) have no source row, so they get no entry.
 */
export type MarkerProvenance = {
  /** The lab-report line the value was read from, verbatim. */
  originalRow: string;
  validations: {
    catalogMatch: boolean;
    unitConverted: boolean;
    rangeValidated: boolean;
  };
};

/**
 * Like extractBiomarkersFromText, but also returns a markerId → provenance
 * map for the directly-extracted markers.
 */
export function extractBiomarkersWithProvenance(text: string): {
  markers: Biomarker[];
  provenance: Map<string, MarkerProvenance>;
} {
  const { normalized, hits } = collectHits(text);
  const markers = deriveComputedMarkers(hits.map((h) => h.marker));
  const provenance = new Map<string, MarkerProvenance>();
  for (const h of hits) {
    provenance.set(h.marker.id, {
      originalRow: enclosingLine(normalized, h.start, h.end),
      validations: {
        catalogMatch: true,
        unitConverted: h.marker.originalUnit !== undefined,
        rangeValidated:
          h.marker.labRefMin !== undefined && h.marker.labRefMax !== undefined,
      },
    });
  }
  return { markers, provenance };
}

/** The full text line containing [start, end), trimmed — more meaningful to
 *  a reader than the bare matched span. */
function enclosingLine(text: string, start: number, end: number): string {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  let to = text.indexOf('\n', end);
  if (to === -1) to = text.length;
  return text.slice(from, to).trim();
}

/**
 * Lazy-built regex that matches a single label-value-unit triplet
 * anchored by a unit token that appears anywhere in the catalog.
 *
 * Why anchor on the unit: lab metadata rows ("Patient ID: 12345",
 * "Age: 35 yrs", "Page 2 of 5") rarely carry a clinical unit, so
 * gating on known units kills almost all the false positives without
 * needing a more sophisticated layout parser.
 */
// Caches the unit-anchored row regex per `biomarkerCatalog` reference
// — WeakMap keyed on the catalog array means HMR or a future test that
// swaps the catalog gets a fresh regex automatically, without us having
// to remember to invalidate. Built from the *normalized* (U+03BC) form
// of every catalog unit so it agrees with the text returned from
// normalize().
const UNKNOWN_ROW_REGEX_CACHE: WeakMap<typeof biomarkerCatalog, RegExp> =
  new WeakMap();
function getUnknownRowRegex(): RegExp {
  const cached = UNKNOWN_ROW_REGEX_CACHE.get(biomarkerCatalog);
  if (cached) return cached;
  const units = new Set<string>();
  for (const t of biomarkerCatalog) {
    if (t.unit) units.add(normalizeMu(t.unit));
    for (const u of t.unitAliases ?? []) {
      if (u.length > 0) units.add(normalizeMu(u));
    }
  }
  // Sort longer first so e.g. "ng/dL" wins over a substring "g/dL"
  // when both could match.
  const unitPattern = [...units]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const re = new RegExp(
    `([A-Za-z][\\w\\s\\(\\)\\-\\/\\.,'#]{2,50}?)(?:\\s*[:\\-=\\u2013\\u2212]\\s*|\\s+)(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?![A-Za-z0-9])`,
    'gi',
  );
  UNKNOWN_ROW_REGEX_CACHE.set(biomarkerCatalog, re);
  return re;
}

/**
 * Find label-value-unit rows in the text that the catalog didn't
 * extract. Two-step heuristic:
 *
 *   1. Match every `<label> <number> <unit>` triplet where the unit is
 *      known to the catalog. The unit gate kills most metadata rows.
 *   2. Drop triplets whose (value, unit) pair already appears in the
 *      extracted markers — we assume one numeric+unit pair per lab row.
 *
 * Returns up to 10 deduped rows. Surfaced in the confirm step so the
 * user knows whether a short extraction list reflects an unusual report
 * or a parser gap.
 */
export function findUnrecognizedRows(
  text: string,
  extracted: Biomarker[],
): string[] {
  // M-4: Cap the input size so matchAll doesn't run a 50ms+ scan over
  // an adversarial blob on phones. Real lab extractions are well under
  // the cap; anything beyond is either junk OCR output or a deliberately
  // crafted hostile input — neither case benefits from a complete
  // scan. The truncation is invisible to the user since the function
  // returns at most 10 rows anyway.
  const normalized = normalize(text).slice(0, UNKNOWN_ROW_INPUT_CAP);

  // Index each extracted reading under EVERY unit spelling the lab could
  // have printed it in — not just our canonical one.
  //
  // The rows below carry the LAB's spelling and scale; `m.unit` carries
  // ours. Comparing them directly meant a reading we got perfectly right
  // was reported to the user as one we'd failed on. It hit almost every
  // Indian panel: labs print electrolytes as "mEq/L" while our canonical is
  // "mmol/L", and eGFR as "mL/min/1.73m2" against our "mL/min". On Dr Lal
  // PathLabs' own specimen, 4 of the 7 rows we announced as uninterpreted —
  // sodium, potassium, chloride, eGFR — had all been read correctly. The
  // headline ("we read 51, interpreted 41") was the app understating itself.
  //
  // The catalog already knew every one of those spellings; this just asks it.
  const extractedByUnit = new Map<string, Set<number>>();
  const register = (unit: string, value: number) => {
    const key = (unit || '').toLowerCase();
    if (!extractedByUnit.has(key)) extractedByUnit.set(key, new Set());
    extractedByUnit.get(key)!.add(value);
  };
  for (const m of extracted) {
    register(m.unit || '', m.value);
    // Same reading, other spellings of the same-scale unit (mEq/L ≡ mmol/L).
    const template = biomarkerCatalog.find((t) => t.id === m.id);
    for (const u of template?.unitAliases ?? []) register(u, m.value);
    // Rescaled reads (SI altUnits, lakh/thou prefixes) differ in BOTH unit
    // and number, so the canonical pair can never match the printed row.
    // The reconciliation receipt holds exactly what was printed.
    if (m.originalUnit !== undefined && m.originalValue !== undefined) {
      register(m.originalUnit, m.originalValue);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  const re = getUnknownRowRegex();
  // matchAll needs a fresh lastIndex on each call when reused.
  re.lastIndex = 0;
  for (const match of normalized.matchAll(re)) {
    const label = match[1].trim().replace(/\s+/g, ' ');
    const value = parseFloat(match[2]);
    const unit = match[3];

    if (extractedByUnit.get(unit.toLowerCase())?.has(value)) continue;
    // Skip labels that are obviously not biomarker names — numeric
    // prefixes, all-caps single words (likely section headers).
    if (/^\d/.test(label)) continue;
    if (label.length < 3) continue;
    // Skip rows that are clearly part of a reference-range printout
    // rather than a marker measurement. Indian labs often include
    // explanatory rows like "Normal Range 200 mg/dL" or
    // "Biological Reference 100 mg/dL" next to a marker — these match
    // the label+number+unit shape but they're metadata, not
    // measurements, and surface as noise in the "we saw these rows
    // but couldn't map them" panel. (Range-style rows like
    // "Reference Range: 70-100 mg/dL" don't match the regex at all
    // because the colon isn't in the label char class and the dash
    // breaks the number-then-unit shape — those don't need filtering.)
    if (REF_ROW_KEYWORDS.test(label)) continue;

    const key = `${label.toLowerCase()}::${value}::${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(`${label} ${value} ${unit}`);
    if (out.length >= 10) break;
  }
  return out;
}

/** Words that mark a row as printed reference-range metadata rather
 *  than a marker measurement. Case-insensitive substring match. */
const REF_ROW_KEYWORDS =
  /\b(reference|ref\s*range|normal\s*range|biological\s*reference|bio\s*ref|desirable|optimal\s*range)\b/i;
