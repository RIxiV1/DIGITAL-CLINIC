/**
 * Unit scaling + converted-value precision.
 *
 * These two used to live twice (once per extraction path) and drift apart,
 * which is exactly the class of bug this module exists to prevent — so the
 * parity assertions here matter as much as the value assertions.
 */

import { describe, it, expect } from 'vitest';
import { unitMultiplier, roundConvertedValue } from './units';

describe('unitMultiplier — spellings the AI path used to miss', () => {
  // Each of these scaled correctly when read off a PDF and returned 1 when
  // read off a photo, because the two copies had diverged. A platelet count
  // of "2.4 lacs/cumm" stayed 2.4 and rendered as critical thrombocytopenia.
  it('resolves the plural lakh spelling "lacs"', () => {
    expect(unitMultiplier('lacs/cumm')).toBe(1e5);
    expect(unitMultiplier('2.4 lacs/cumm')).toBe(1e5);
  });

  it('resolves the European "mio" million abbreviation', () => {
    expect(unitMultiplier('mio/µL')).toBe(1e6);
  });

  it('resolves E-notation exponents', () => {
    expect(unitMultiplier('10E3/uL')).toBe(1e3);
    expect(unitMultiplier('10E6/L')).toBe(1e6);
  });

  it('resolves exponents with spaces around the caret', () => {
    expect(unitMultiplier('10 ^ 3/uL')).toBe(1e3);
    expect(unitMultiplier('10 ^ 6 /L')).toBe(1e6);
    expect(unitMultiplier('x 10^3/uL')).toBe(1e3);
  });

  it('still returns 1 for plain mass/concentration units', () => {
    for (const u of ['mg/dL', 'ng/mL', 'g/dL', '%', '/cumm', '', '   ']) {
      expect(unitMultiplier(u)).toBe(1);
    }
    expect(unitMultiplier(null)).toBe(1);
    expect(unitMultiplier(undefined)).toBe(1);
  });
});

describe('roundConvertedValue — exact shifts vs real conversions', () => {
  // A power-of-ten scale is a decimal-point move. Every digit was printed by
  // the lab, so rounding to a fixed 3 sig-figs reports a number the report
  // does not contain.
  it('keeps every printed digit through a count-prefix shift', () => {
    expect(roundConvertedValue(2.456 * 1e5, 1e5)).toBe(245600);
    expect(roundConvertedValue(11.25 * 1e3, 1e3)).toBe(11250);
    expect(roundConvertedValue(10.25 * 1e3, 1e3)).toBe(10250);
  });

  it('keeps small-magnitude digits through a power-of-ten shift', () => {
    // Troponin pg/mL → ng/mL. 0.0157 would be a different reading.
    expect(roundConvertedValue(15.67 * 0.001, 0.001)).toBeCloseTo(0.01567, 8);
  });

  it('still strips IEEE-754 noise on an exact shift', () => {
    // 2.45 * 1e5 evaluates to 245000.00000000003.
    expect(roundConvertedValue(2.45 * 1e5, 1e5)).toBe(245000);
  });

  // A molar factor manufactures digits nobody measured — 3 sig-figs is the
  // honest ceiling there.
  it('caps a molar conversion at 3 significant figures', () => {
    // 205 µmol/L ÷ 88.42 = 2.3184799819 mg/dL
    expect(roundConvertedValue(205 / 88.42, 1 / 88.42)).toBe(2.32);
    expect(roundConvertedValue(8.8 * 6.006, 6.006)).toBe(52.9);
  });

  it('passes non-finite values through untouched', () => {
    expect(Number.isNaN(roundConvertedValue(NaN, 1e3))).toBe(true);
  });
});
