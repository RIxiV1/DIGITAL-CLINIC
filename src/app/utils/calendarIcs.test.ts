import { describe, it, expect } from 'vitest';
import { retestReminderIcs, escapeIcs } from './calendarIcs';

describe('escapeIcs', () => {
  it('escapes backslash, semicolon, comma, and newline', () => {
    expect(escapeIcs('a\\b; c, d\ne')).toBe('a\\\\b\\; c\\, d\\ne');
  });
});

describe('retestReminderIcs', () => {
  // Fixed clock so the emitted dates are deterministic.
  const ics = retestReminderIcs({
    reportName: 'Hormone Panel',
    months: 4,
    now: new Date('2026-07-20T09:00:00Z'),
  });

  it('is a well-formed VCALENDAR/VEVENT', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('emits an all-day DATE start 7 days out (2026-07-27)', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260727');
    expect(ics).toContain('DTEND;VALUE=DATE:20260728');
  });

  it('uses CRLF line endings', () => {
    expect(ics.includes('\r\n')).toBe(true);
  });

  it('carries a day-before alarm', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('has a stable per-report UID (re-add updates, not duplicates)', () => {
    const again = retestReminderIcs({
      reportName: 'Hormone Panel',
      months: 6,
      now: new Date('2026-08-01T00:00:00Z'),
    });
    const uid = (s: string) => s.match(/UID:(\S+)/)?.[1];
    expect(uid(ics)).toBe(uid(again));
  });
});
