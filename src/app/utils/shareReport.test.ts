// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shareReport } from './shareReport';
import { sampleReports } from '../data/reports';

const report = sampleReports[0];

/** Define a temporary navigator method that jsdom doesn't ship. */
function setNav(prop: 'share' | 'canShare', value: unknown) {
  Object.defineProperty(navigator, prop, {
    value,
    configurable: true,
    writable: true,
  });
}
function clearNav(prop: 'share' | 'canShare') {
  if (prop in navigator) {
    delete (navigator as unknown as Record<string, unknown>)[prop];
  }
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => {
  openSpy.mockRestore();
  clearNav('share');
  clearNav('canShare');
});

describe('shareReport', () => {
  it('falls back to a wa.me link when Web Share is unavailable', async () => {
    // jsdom has no navigator.share by default.
    await shareReport(report);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = String(openSpy.mock.calls[0][0]);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).toContain('My%20blood%20test');
  });

  it('uses the native share sheet when available (no wa.me fallback)', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNav('share', share);
    setNav('canShare', () => false); // text-only platform
    await shareReport(report);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toHaveProperty('text');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('attaches the PDF when the platform can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNav('share', share);
    setNav('canShare', () => true);
    await shareReport(report);
    const payload = share.mock.calls[0][0] as { files?: File[] };
    expect(Array.isArray(payload.files)).toBe(true);
    expect(payload.files).toHaveLength(1);
    expect(payload.files![0].type).toBe('application/pdf');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does nothing further when the user dismisses the sheet (AbortError)', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    setNav('share', vi.fn().mockRejectedValue(abort));
    setNav('canShare', () => false);
    await shareReport(report);
    expect(openSpy).not.toHaveBeenCalled(); // no behind-the-back wa.me
  });

  it('degrades to wa.me if the share fails for a non-abort reason', async () => {
    setNav('share', vi.fn().mockRejectedValue(new Error('NotAllowedError')));
    setNav('canShare', () => false);
    await shareReport(report);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
