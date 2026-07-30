/**
 * Collection-date extraction.
 *
 * The bar here is asymmetric on purpose: missing a date costs a trend line,
 * but inventing one reorders the user's history and can headline a stale
 * reading as current. So the "returns null" cases matter more than the
 * happy path, and there are more of them.
 */

import { describe, it, expect } from 'vitest';
import { extractCollectionDate } from './reportDate';

const TODAY = new Date('2026-07-30T00:00:00Z');
const read = (t: string) => extractCollectionDate(t, TODAY);

describe('extractCollectionDate — formats real labs print', () => {
  it.each([
    ['Collected On : 12/04/2026', '2026-04-12'],
    ['Sample Collected: 12-Apr-2026', '2026-04-12'],
    ['Collection Date 12 April 2026', '2026-04-12'],
    ['Collected on 2026-04-12', '2026-04-12'],
    ['Sample Drawn On 12.04.2026', '2026-04-12'],
    ['Specimen Collection Date : 12/Apr/26', '2026-04-12'],
  ])('reads %s', (text, expected) => {
    expect(read(text)).toBe(expected);
  });

  it('reads a date printed with a time after it', () => {
    expect(read('Collected On : 12/04/2026 10:35 AM')).toBe('2026-04-12');
  });

  it('reads a US month-first spelling', () => {
    expect(read('Collected On: Apr 12, 2026')).toBe('2026-04-12');
  });
});

describe('extractCollectionDate — day/month ambiguity', () => {
  it('reads an unambiguous day-first date', () => {
    expect(read('Collected On 25/04/2026')).toBe('2026-04-25');
  });

  it('uses the digits to disambiguate when it can', () => {
    // 04/25 can only be month-first.
    expect(read('Collected On 04/25/2026')).toBe('2026-04-25');
  });

  it('defaults to day-first when neither digit settles it', () => {
    // India/UK convention — the audience this is built for. A US report
    // meaning 6 April will be read as 4 June; that's the documented cost of
    // picking a default, and it only ever affects sort order.
    expect(read('Collected On 04/06/2026')).toBe('2026-06-04');
  });

  it('prefers a month-name reading over a guessed numeric one', () => {
    // Same label priority, but only one of them can't have been misread.
    const text = 'Reported On 04/12/2026\nCollected On 05-May-2026';
    expect(read(text)).toBe('2026-05-05');
  });
});

describe('extractCollectionDate — which label wins', () => {
  it('prefers the collection date over the report date', () => {
    // The physiology belongs to the draw, not to the printing.
    const text = 'Collected On : 12/04/2026\nReported On : 15/04/2026';
    expect(read(text)).toBe('2026-04-12');
  });

  it('prefers collection over registration', () => {
    const text = 'Registered On : 11/04/2026\nCollected On : 12/04/2026';
    expect(read(text)).toBe('2026-04-12');
  });

  it('falls back to the report date when no collection date is printed', () => {
    expect(read('Reported On : 15/04/2026')).toBe('2026-04-15');
  });
});

describe('extractCollectionDate — refuses rather than guesses', () => {
  it('returns null for an unlabelled date', () => {
    // A bare date is as likely to be a date of birth as a collection date,
    // and a DOB would rewrite the whole history.
    expect(read('12/04/2026')).toBeNull();
  });

  it('does not read a date of birth', () => {
    expect(read('Patient Name: A Kumar\nDOB: 12/04/1994\nAge: 32 Years')).toBeNull();
  });

  it('returns null for a future date', () => {
    expect(read('Collected On : 12/04/2027')).toBeNull();
  });

  it('returns null for an impossible calendar date', () => {
    expect(read('Collected On : 31/02/2026')).toBeNull();
  });

  it('returns null for a date older than the plausibility window', () => {
    expect(read('Collected On : 12/04/1980')).toBeNull();
  });

  it('returns null on empty or dateless text', () => {
    expect(read('')).toBeNull();
    expect(read('Hemoglobin 14.2 g/dL\nPlatelet Count 240000 /cumm')).toBeNull();
  });

  it('does not reach past intervening fields to an unrelated date', () => {
    // The label window is tight so a date belonging to a later field can't
    // be captured off a flattened single-line layout. (Runs of spaces are
    // collapsed first, so padding alone doesn't push a date out of range —
    // intervening CONTENT is what has to.)
    const text =
      'Collected On : Lab No 1234567890 Patient Mr A Kumar Referred By Dr S Rao 12/04/2026';
    expect(read(text)).toBeNull();
  });
});

describe('extractCollectionDate — realistic header block', () => {
  it('picks the collection date out of a full Indian lab header', () => {
    const header = [
      'Dr Lal PathLabs',
      'Patient Name : Mr A Kumar          Age/Sex : 32 Y / M',
      'DOB : 04/03/1994',
      'Lab No. : 1234567890',
      'Collected On : 12/04/2026 08:15 AM',
      'Received On  : 12/04/2026 11:40 AM',
      'Reported On  : 13/04/2026 06:02 PM',
      '',
      'Hemoglobin        14.2    g/dL     13.0 - 17.0',
    ].join('\n');
    expect(read(header)).toBe('2026-04-12');
  });
});
