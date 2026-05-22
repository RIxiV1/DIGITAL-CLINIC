import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReportPdf, __testInternals } from './reportPdf';
import type { Report } from '../data/reports';
import type { Biomarker } from '../data/biomarkers';

const { asciize, tierForMarker } = __testInternals;

vi.mock('jspdf', () => {
  const mockSetFont = vi.fn();
  const mockSetFontSize = vi.fn();
  const mockSetTextColor = vi.fn();
  const mockGetTextWidth = vi.fn(() => 10);
  const mockText = vi.fn();
  const mockSplitTextToSize = vi.fn((text: string | string[]) => {
    return typeof text === 'string' ? [text] : text;
  });
  const mockSetFillColor = vi.fn();
  const mockRoundedRect = vi.fn();
  const mockCircle = vi.fn();
  const mockSetDrawColor = vi.fn();
  const mockSetLineWidth = vi.fn();
  const mockLine = vi.fn();
  const mockAddPage = vi.fn();
  const mockGetNumberOfPages = vi.fn(() => 2);
  const mockSetPage = vi.fn();
  const mockSave = vi.fn();

  (globalThis as any).__jspdfMocks = {
    mockSetFont,
    mockSetFontSize,
    mockSetTextColor,
    mockGetTextWidth,
    mockText,
    mockSplitTextToSize,
    mockSetFillColor,
    mockRoundedRect,
    mockCircle,
    mockSetDrawColor,
    mockSetLineWidth,
    mockLine,
    mockAddPage,
    mockGetNumberOfPages,
    mockSetPage,
    mockSave,
  };

  return {
    default: class MockJsPDF {
      setFont = mockSetFont;
      setFontSize = mockSetFontSize;
      setTextColor = mockSetTextColor;
      getTextWidth = mockGetTextWidth;
      text = mockText;
      splitTextToSize = mockSplitTextToSize;
      setFillColor = mockSetFillColor;
      roundedRect = mockRoundedRect;
      circle = mockCircle;
      setDrawColor = mockSetDrawColor;
      setLineWidth = mockSetLineWidth;
      line = mockLine;
      addPage = mockAddPage;
      getNumberOfPages = mockGetNumberOfPages;
      setPage = mockSetPage;
      save = mockSave;
    }
  };
});

const getMocks = () => (globalThis as any).__jspdfMocks;

/* ------------------------------------------------------------------ */
/* asciize                                                            */
/* ------------------------------------------------------------------ */

describe('reportPdf — asciize', () => {
  it('correctly normalizes curly double and single quotes to plain ASCII quotes', () => {
    expect(asciize('‘Hello’ and “World”')).toBe("'Hello' and \"World\"");
  });

  it('normalizes en-dashes, em-dashes, and math minus signs to plain hyphens', () => {
    expect(asciize('en–dash, em—dash, minus −')).toBe('en-dash, em-dash, minus -');
  });

  it('normalizes mathematical signs and ellipses to simple representations', () => {
    expect(asciize('greater ≥, less ≤, times ×, ellipsis …')).toBe('greater >=, less <=, times x, ellipsis ...');
  });

  it('normalizes Greek mu to Micro Sign U+00B5 for Helvetica rendering', () => {
    // μ is Greek mu (U+03BC), µ is Micro Sign (U+00B5)
    expect(asciize('μIU/mL')).toBe('µIU/mL');
  });
});

/* ------------------------------------------------------------------ */
/* tierForMarker                                                      */
/* ------------------------------------------------------------------ */

describe('reportPdf — tierForMarker', () => {
  it('returns CRITICAL tier for concern markers', () => {
    const marker: Biomarker = {
      id: 'glucose',
      name: 'Glucose',
      value: 120,
      unit: 'mg/dL',
      min: 70,
      max: 99,
      status: 'concern',
      category: 'metabolic',
      plain: 'test',
    };
    const tier = tierForMarker(marker);
    expect(tier.label).toBe('CRITICAL');
  });

  it('returns BORDERLINE tier for attention markers', () => {
    const marker: Biomarker = {
      id: 'glucose',
      name: 'Glucose',
      value: 95,
      unit: 'mg/dL',
      min: 70,
      max: 99,
      optimalMin: 70,
      optimalMax: 90,
      status: 'attention',
      category: 'metabolic',
      plain: 'test',
    };
    const tier = tierForMarker(marker);
    expect(tier.label).toBe('BORDERLINE');
  });

  it('returns OPTIMAL tier for good markers in optimal range', () => {
    const marker: Biomarker = {
      id: 'glucose',
      name: 'Glucose',
      value: 80,
      unit: 'mg/dL',
      min: 70,
      max: 99,
      optimalMin: 70,
      optimalMax: 90,
      status: 'good',
      category: 'metabolic',
      plain: 'test',
    };
    const tier = tierForMarker(marker);
    expect(tier.label).toBe('OPTIMAL');
  });
});

/* ------------------------------------------------------------------ */
/* generateReportPdf                                                  */
/* ------------------------------------------------------------------ */

describe('reportPdf — generateReportPdf', () => {
  beforeEach(() => {
    const mocks = getMocks();
    mocks.mockSetFont.mockClear();
    mocks.mockSetFontSize.mockClear();
    mocks.mockSetTextColor.mockClear();
    mocks.mockGetTextWidth.mockClear();
    mocks.mockText.mockClear();
    mocks.mockSplitTextToSize.mockClear();
    mocks.mockSetFillColor.mockClear();
    mocks.mockRoundedRect.mockClear();
    mocks.mockCircle.mockClear();
    mocks.mockSetDrawColor.mockClear();
    mocks.mockSetLineWidth.mockClear();
    mocks.mockLine.mockClear();
    mocks.mockAddPage.mockClear();
    mocks.mockGetNumberOfPages.mockClear();
    mocks.mockSetPage.mockClear();
    mocks.mockSave.mockClear();
  });

  it('generates a PDF with correct header, sections, markers, and triggers save', () => {
    const mockReport: Report = {
      id: 'rep-test-123',
      name: 'Comprehensive Male Health Panel',
      lab: 'Thyrocare Labs',
      uploadedOn: '2026-05-22',
      status: 'ready',
      badge: 'analyzed',
      biomarkers: [
        {
          id: 'glucose',
          name: 'Fasting Glucose',
          value: 92,
          unit: 'mg/dL',
          min: 70,
          max: 99,
          optimalMin: 75,
          optimalMax: 90,
          status: 'attention',
          category: 'metabolic',
          plain: 'Fasting glucose levels are healthy but slightly outside optimal.',
        },
        {
          id: 'ldl',
          name: 'LDL Cholesterol',
          value: 120,
          unit: 'mg/dL',
          min: 0,
          max: 100,
          status: 'concern',
          category: 'metabolic',
          plain: 'LDL is elevated.',
        }
      ]
    };

    generateReportPdf(mockReport);

    const mocks = getMocks();

    // Verify it saved with slugified filename
    expect(mocks.mockSave).toHaveBeenCalledTimes(1);
    expect(mocks.mockSave).toHaveBeenCalledWith('formen-comprehensive-male-health-panel.pdf');

    // Verify text draw calls were made
    expect(mocks.mockText).toHaveBeenCalled();
    const textArgs = mocks.mockText.mock.calls.map((call: any) => call[0]);
    
    // Check key strings
    expect(textArgs).toContain('ForMen');
    expect(textArgs).toContain(' Digital Clinic');
    
    // Check that we set font style and sizes
    expect(mocks.mockSetFont).toHaveBeenCalled();
    expect(mocks.mockSetFontSize).toHaveBeenCalled();
    expect(mocks.mockSetTextColor).toHaveBeenCalled();
  });
});
