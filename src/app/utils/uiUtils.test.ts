import { describe, it, expect } from 'vitest';
import { formatDate, formatBytes } from './uiUtils';

describe('formatDate', () => {
  it('returns an em-dash for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('returns an em-dash for an unparseable date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate(new Date('nonsense'))).toBe('—');
  });

  it('formats a valid Date (locale-robust: contains the year, not the dash)', () => {
    const out = formatDate(new Date('2026-04-16T00:00:00Z'));
    expect(out).not.toBe('—');
    expect(out).toMatch(/2026/);
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(formatDate('2026-04-16')).toMatch(/2026/);
  });
});

describe('formatBytes', () => {
  it('renders bytes below 1 KB as B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('renders KB with one decimal at the 1 KB boundary and above', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('renders MB with one decimal at the 1 MB boundary and above', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
