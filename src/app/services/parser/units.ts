/**
 * Unit scaling + numeric precision — the two pieces BOTH extraction paths
 * (deterministic text matcher and the Gemini fallback) have to agree on.
 *
 * They previously each carried their own copy of `unitMultiplier`, and the
 * copies drifted: the text path learned `lacs`, `mio`, `10E6` and the spaced
 * `10 ^ 3` forms while the AI path did not. Eight real unit spellings scaled
 * correctly when read off a PDF and silently returned 1 when read off a photo
 * — turning a normal "2.4 lacs/cumm" platelet count into a false critical
 * thrombocytopenia on the AI path only. The bug wasn't the regex; it was
 * having two of them. One module, one definition, imported by both.
 */

/**
 * Detect a count-prefix multiplier in a printed unit string.
 *
 * Indian labs print platelets/WBC as "245 thou/cumm" or "2.45 lakh/cumm"
 * rather than the canonical raw count. The catalog's `platelets` template
 * uses /cumm (raw); a captured value of `245` against a printed unit of
 * `thou/cumm` is actually 245,000.
 *
 * Returns the linear multiplier (1, 1e3, 1e5, 1e6). Callers reconcile with
 * `printedMult / catalogMult` — so a template already in `million/cumm` (RBC)
 * gets multiplier 1e6 too and its values pass through unscaled.
 *
 * Mass/concentration units (mg/dL, ng/mL, g/dL) return 1; the per-marker
 * canonical unit already enforces scale on those.
 */
export function unitMultiplier(unit: string | null | undefined): number {
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

/** Digits kept when only IEEE-754 noise needs stripping. Far above any real
 *  measurement precision, far below the ~17 digits where the noise lives. */
const IEEE_CLEANUP_DIGITS = 12;

/** Digits kept for a genuine measurement conversion. Three is the most any
 *  lab reports, and a molar factor can't justify more than went in. */
const CONVERTED_SIG_FIGS = 3;

/**
 * True when `scale` is an exact power of ten (1000, 0.001, 1e5, 0.1 …).
 *
 * `Math.log10` is exact for these in IEEE-754 doubles, but compare against
 * the rounded exponent anyway so a future non-exact factor can't sneak in
 * through a floating-point hair.
 */
function isPowerOfTen(scale: number): boolean {
  if (!Number.isFinite(scale) || scale <= 0) return false;
  const exp = Math.log10(scale);
  return Math.abs(exp - Math.round(exp)) < 1e-9;
}

/**
 * Round a unit-converted value to its HONEST precision.
 *
 * The two kinds of scaling in this parser are not the same operation, and
 * rounding them the same way is what broke:
 *
 *   - A COUNT-PREFIX scale (lakh, thou, ×10⁹/L, g/L→g/dL) is a power of ten:
 *     moving the decimal point. It is EXACT. "2.456 lakh/cumm" IS 245,600 —
 *     every digit was printed by the lab. Rounding it to three significant
 *     figures reports 246,000, a number the report does not contain. Same for
 *     "11.25 ×10⁹/L" → 11,250 becoming 11,300, and for a troponin of
 *     15.67 pg/mL → 0.01567 ng/mL becoming 0.0157. Here there is nothing to
 *     round: the only thing to remove is IEEE-754 noise, because 2.45 × 1e5
 *     evaluates to 245000.00000000003.
 *
 *   - A MOLAR/MASS conversion (µmol/L ÷ 88.42, mmol/L × 18.0156) is a real
 *     measurement conversion. It manufactures digits nobody measured:
 *     205 µmol/L ÷ 88.42 = 2.3184799819 mg/dL reads like a ten-digit
 *     instrument reading. Three significant figures is the honest ceiling.
 *
 * Telling the two apart by the scale factor itself keeps both properties
 * without needing to know which call site asked.
 */
export function roundConvertedValue(converted: number, scale: number): number {
  if (!Number.isFinite(converted)) return converted;
  const digits = isPowerOfTen(scale)
    ? IEEE_CLEANUP_DIGITS
    : CONVERTED_SIG_FIGS;
  // parseFloat un-does the scientific notation toPrecision emits for large
  // numbers, so a count like 316000 stays 316000, not "3.16e+5".
  return parseFloat(converted.toPrecision(digits));
}
