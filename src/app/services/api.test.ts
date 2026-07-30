import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateUpload,
  parseUploadedReport,
  setPendingUpload,
  consumePendingUpload,
} from './api';
import { parsePdfFile, classifyOutOfScope } from './pdfParser';

vi.mock('./pdfParser', () => {
  return {
    parsePdfFile: vi.fn(),
    classifyOutOfScope: vi.fn(),
  };
});

describe('api — Pending-upload bridge', () => {
  it('sets and consumes pending upload file correctly', () => {
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
    setPendingUpload(file);
    expect(consumePendingUpload()).toBe(file);
    // Next consume should be null
    expect(consumePendingUpload()).toBeNull();
  });
});

describe('api — validateUpload', () => {
  it('returns error for null file', () => {
    const res = validateUpload(null);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('empty');
    }
  });

  it('returns error for a 0-byte file', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' });
    const res = validateUpload(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('empty');
    }
  });

  it('returns error for HEIC extension', () => {
    const file = new File(['x'], 'photo.heic', { type: '' });
    const res = validateUpload(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('type');
      expect(res.error.message).toContain('HEIC');
    }
  });

  it('returns error for HEIF type', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/heif' });
    const res = validateUpload(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('type');
    }
  });

  it('returns error for unsupported mime type', () => {
    const file = new File(['x'], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const res = validateUpload(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('type');
      expect(res.error.message).toContain('supported');
    }
  });

  it('returns error for oversized file', () => {
    const file = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 }); // 21 MB
    const res = validateUpload(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('size');
      expect(res.error.message).toContain('20 MB');
    }
  });

  it('returns ok for valid PDF file and sanitizes its name', () => {
    const file = new File(['x'], 'my\u0000report\u202E.pdf', {
      type: 'application/pdf',
    });
    const res = validateUpload(file);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.safeName).not.toContain('\u0000');
      expect(res.safeName).not.toContain('\u202E');
    }
  });
});

describe('api — parseUploadedReport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports progress stages and returns successfully parsed report', async () => {
    const mockBiomarkers = [
      {
        id: 'glucose',
        name: 'Glucose',
        value: 90,
        unit: 'mg/dL',
        status: 'good',
      },
    ] as any;

    vi.mocked(parsePdfFile).mockResolvedValue({
      biomarkers: mockBiomarkers,
      source: 'pdf-text',
      rawText: 'Glucose 90 mg/dL',
      unrecognizedRows: [],
    });

    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    const onProgress = vi.fn();

    const parsePromise = parseUploadedReport(
      { name: 'Test Report', file },
      onProgress,
    );

    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.parsedFromFile).toBe(true);
    expect(result.biomarkers).toEqual(mockBiomarkers);
    expect(result.report.name).toBe('Test Report');
    expect(onProgress).toHaveBeenCalled();

    const lastProgress =
      onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastProgress.overall).toBe(1);
  });

  it('carries the collection date through to the parsed report', async () => {
    // Without this the report is dated by upload, so a user backfilling old
    // reports gets them all stamped today — every trend collapses to a
    // zero-day span and the newest-by-date report may not be the newest one.
    vi.mocked(parsePdfFile).mockResolvedValue({
      biomarkers: [
        { id: 'glucose', name: 'Glucose', value: 90, unit: 'mg/dL' },
      ] as never,
      source: 'pdf-text',
      rawText: 'Collected On : 12/04/2026\nGlucose 90 mg/dL',
      unrecognizedRows: [],
      collectionDate: '2026-04-12',
    });

    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    const parsePromise = parseUploadedReport(
      { name: 'Backfilled Report', file },
      vi.fn(),
    );
    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.collectionDate).toBe('2026-04-12');
  });

  it('leaves the collection date undefined when none was read', async () => {
    vi.mocked(parsePdfFile).mockResolvedValue({
      biomarkers: [
        { id: 'glucose', name: 'Glucose', value: 90, unit: 'mg/dL' },
      ] as never,
      source: 'pdf-text',
      rawText: 'Glucose 90 mg/dL',
      unrecognizedRows: [],
    });

    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    const parsePromise = parseUploadedReport({ name: 'No Date', file }, vi.fn());
    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.collectionDate).toBeUndefined();
  });

  it('handles no file fallback scenario', async () => {
    const onProgress = vi.fn();
    const parsePromise = parseUploadedReport({ name: 'No File' }, onProgress);

    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.parsedFromFile).toBe(false);
    expect(result.failureReason).toBe('no-file');
  });

  it('flags out-of-scope files correctly', async () => {
    vi.mocked(parsePdfFile).mockResolvedValue({
      biomarkers: [],
      source: 'pdf-text',
      rawText: 'X-RAY CHEST shows normal lungs. Sinus rhythm on EKG.',
      unrecognizedRows: [],
    });
    vi.mocked(classifyOutOfScope).mockReturnValue('imaging');

    const file = new File(['x'], 'xray.pdf', { type: 'application/pdf' });
    const onProgress = vi.fn();

    const parsePromise = parseUploadedReport(
      { name: 'X-ray Report', file },
      onProgress,
    );

    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.parsedFromFile).toBe(false);
    expect(result.failureReason).toBe('out-of-scope');
  });

  it('handles parser exceptions gracefully', async () => {
    vi.mocked(parsePdfFile).mockRejectedValue(new Error('Password exception'));

    const file = new File(['x'], 'locked.pdf', { type: 'application/pdf' });
    const onProgress = vi.fn();

    const parsePromise = parseUploadedReport(
      { name: 'Locked', file },
      onProgress,
    );

    await vi.runAllTimersAsync();
    const result = await parsePromise;

    expect(result.parsedFromFile).toBe(false);
    expect(result.failureReason).toBe('parser-error');
    expect(result.errorMessage).toBe('Password exception');
  });
});
