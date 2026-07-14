// @vitest-environment jsdom
/**
 * Trust-boundary tests for persistence.ts.
 *
 * localStorage is attacker-and-accident-controlled (extensions, stale
 * builds, shared-device devtools). These tests pin the defensive
 * contract: corrupted input must NEVER crash a load, must self-heal
 * (clear the poisoned key), and must never lose good data for the sake
 * of one bad record. The TTL filter must not silently delete reports,
 * and dc_pendingConfirm — which short-circuits into "your report" —
 * must reject anything off-schema so fabricated lab values can't be
 * injected.
 *
 * Complements persistence.test.ts (which focuses on the AI-fallback
 * flag).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadReports,
  saveReports,
  loadQuiz,
  loadQuizComplete,
  loadPendingConfirm,
  savePendingConfirm,
  pruneExpiredReports,
  cleanupExpiredReports,
  cleanupOrphanProcessing,
  loadTheme,
  saveTheme,
  loadLang,
  loadCatalogAck,
  loadRetestDismissedReportId,
  wipeAllData,
  exportAllData,
  getStorageStats,
  REPORTS_KEY,
} from './persistence';

const TTL_MS = 180 * 24 * 60 * 60 * 1000;

type AnyReport = Record<string, unknown>;
function makeReport(over: AnyReport = {}): AnyReport {
  return {
    id: 'rep-1',
    name: 'Report',
    lab: 'Lab',
    uploadedOn: '12 Apr 2026',
    status: 'ready',
    biomarkers: [],
    ...over,
  };
}
function setReports(reports: AnyReport[], savedAt = new Date().toISOString()) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify({ savedAt, reports }));
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('readValidated self-heals on corruption', () => {
  it('returns the fallback AND clears the key on non-JSON', () => {
    localStorage.setItem('dc_quizComplete', '{not-json');
    expect(loadQuizComplete()).toBe(false);
    expect(localStorage.getItem('dc_quizComplete')).toBeNull();
  });

  it('returns the fallback AND clears the key on a type mismatch', () => {
    localStorage.setItem('dc_quizComplete', JSON.stringify('yes'));
    expect(loadQuizComplete()).toBe(false);
    expect(localStorage.getItem('dc_quizComplete')).toBeNull();
  });
});

describe('loadReports — per-entry tolerance', () => {
  it('returns [] when nothing is stored', () => {
    expect(loadReports()).toEqual([]);
  });

  it('keeps valid reports and drops only the invalid ones', () => {
    setReports([
      makeReport({ id: 'good-1' }),
      { id: '', name: 'broken' }, // fails ReportSchema (empty id, missing fields)
      makeReport({ id: 'good-2' }),
    ]);
    const ids = (loadReports() as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual(['good-1', 'good-2']);
  });

  it('rejects a legacy bare-array shape (no envelope) without crashing', () => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify([makeReport()]));
    expect(loadReports()).toEqual([]);
  });
});

describe('saveReports — hard cap', () => {
  it('persists at most MAX_REPORTS (200), newest-first', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      makeReport({ id: `rep-${i}` }),
    );
    expect(saveReports(many)).toBe(true);
    const loaded = loadReports() as Array<{ id: string }>;
    expect(loaded).toHaveLength(200);
    expect(loaded[0].id).toBe('rep-0');
    expect(loaded[199].id).toBe('rep-199');
  });

  it('round-trips a saved list through load', () => {
    saveReports([makeReport({ id: 'a' }), makeReport({ id: 'b' })]);
    expect((loadReports() as Array<{ id: string }>).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('pruneExpiredReports — pure TTL filter (no silent data loss)', () => {
  const now = Date.parse('2026-06-07T00:00:00Z');

  it('keeps recent, prunes aged-out, never prunes samples or undated', () => {
    const { kept, pruned } = pruneExpiredReports(
      [
        { uploadedAt: '2026-06-01' }, // recent → keep
        { uploadedAt: '2025-01-01' }, // > 180d → prune
        { uploadedAt: '2020-01-01', isSample: true }, // sample → keep
        {}, // no date → keep
        { uploadedAt: 'not-a-date' }, // malformed → keep
      ],
      now,
    );
    expect(pruned).toBe(1);
    expect(kept).toHaveLength(4);
  });

  it('is inclusive at exactly the TTL boundary, exclusive one day past', () => {
    const at = new Date(now - TTL_MS).toISOString().slice(0, 10);
    const over = new Date(now - TTL_MS - 86_400_000).toISOString().slice(0, 10);
    expect(pruneExpiredReports([{ uploadedAt: at }], now).pruned).toBe(0);
    expect(pruneExpiredReports([{ uploadedAt: over }], now).pruned).toBe(1);
  });
});

describe('cleanupExpiredReports — in-place TTL prune', () => {
  it('rewrites storage with only the surviving reports', () => {
    const now = Date.parse('2026-06-07T00:00:00Z');
    setReports([
      makeReport({ id: 'fresh', uploadedAt: '2026-06-01' }),
      makeReport({ id: 'stale', uploadedAt: '2024-01-01' }),
    ]);
    const res = cleanupExpiredReports(now);
    expect(res).toEqual({ pruned: 1, quotaError: false });
    expect((loadReports() as Array<{ id: string }>).map((r) => r.id)).toEqual([
      'fresh',
    ]);
  });

  it('is a no-op when there is nothing stored', () => {
    expect(cleanupExpiredReports()).toEqual({ pruned: 0, quotaError: false });
  });
});

describe('cleanupOrphanProcessing', () => {
  it('drops a processing report with no matching pendingConfirm', () => {
    setReports([
      makeReport({ id: 'orphan', status: 'processing' }),
      makeReport({ id: 'done', status: 'ready' }),
    ]);
    expect(cleanupOrphanProcessing().pruned).toBe(1);
    expect((loadReports() as Array<{ id: string }>).map((r) => r.id)).toEqual([
      'done',
    ]);
  });

  it('keeps a processing report whose pendingConfirm survives (restore path)', () => {
    savePendingConfirm({
      processingId: 'mid',
      fileName: 'f.pdf',
      biomarkers: [],
    });
    setReports([makeReport({ id: 'mid', status: 'processing' })]);
    expect(cleanupOrphanProcessing().pruned).toBe(0);
    expect((loadReports() as Array<{ id: string }>).map((r) => r.id)).toEqual([
      'mid',
    ]);
  });
});

describe('loadQuiz — partial-tolerance via .catch([])', () => {
  it('preserves valid fields and defaults malformed array fields to []', () => {
    localStorage.setItem(
      'dc_quiz',
      JSON.stringify({
        age: '25-34',
        activity: 'moderate',
        priorities: 'not-an-array',
        symptoms: [1, 2, 3],
      }),
    );
    const q = loadQuiz() as {
      age?: string;
      activity?: string;
      priorities: string[];
      symptoms: string[];
    } | null;
    expect(q?.age).toBe('25-34');
    expect(q?.activity).toBe('moderate');
    expect(q?.priorities).toEqual([]);
    expect(q?.symptoms).toEqual([]);
  });
});

describe('loadPendingConfirm — injection guard', () => {
  it('round-trips a valid record', () => {
    savePendingConfirm({
      processingId: 'p1',
      fileName: 'r.pdf',
      biomarkers: [],
    });
    expect(loadPendingConfirm()?.processingId).toBe('p1');
  });

  it('returns null for an off-schema record (no fabricated values reach UI)', () => {
    localStorage.setItem(
      'dc_pendingConfirm',
      JSON.stringify({ processingId: 'p1', biomarkers: [] }), // missing fileName
    );
    expect(loadPendingConfirm()).toBeNull();
  });
});

describe('theme — bare-string format shared with the bootstrap', () => {
  it('writes a bare string (not a JSON envelope) and reads it back', () => {
    saveTheme('light');
    expect(localStorage.getItem('dc_theme')).toBe('light');
    expect(loadTheme()).toBe('light');
  });

  it('an explicit saved choice always wins over the OS preference', () => {
    saveTheme('dark');
    vi.stubGlobal('matchMedia', () => ({ matches: false })); // OS = light
    expect(loadTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('with no explicit choice, defaults to Instrument dark (regardless of OS)', () => {
    localStorage.removeItem('dc_theme');
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark') }));
    expect(loadTheme()).toBe('dark');
    vi.stubGlobal('matchMedia', () => ({ matches: false })); // OS = light
    expect(loadTheme()).toBe('dark'); // still Instrument dark by default
    vi.unstubAllGlobals();
  });

  it('ignores a garbage value → Instrument dark default (no explicit choice)', () => {
    localStorage.setItem('dc_theme', 'garbage');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(loadTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });
});

describe('simple scalar prefs — defaults', () => {
  it('loadLang defaults to en; loadCatalogAck to 0; retest dismissal to null', () => {
    expect(loadLang()).toBe('en');
    expect(loadCatalogAck()).toBe(0);
    expect(loadRetestDismissedReportId()).toBeNull();
  });
});

describe('wipeAllData / exportAllData / getStorageStats — namespace scoping', () => {
  it('wipes only dc_* keys and leaves foreign keys intact', () => {
    localStorage.setItem('dc_one', '1');
    localStorage.setItem('dc_two', '2');
    localStorage.setItem('not_ours', 'keep');
    expect(wipeAllData()).toBe(2);
    expect(localStorage.getItem('dc_one')).toBeNull();
    expect(localStorage.getItem('not_ours')).toBe('keep');
  });

  it('exportAllData decodes JSON values, falls back to raw, tags schema 1', () => {
    saveTheme('light'); // bare string → not JSON-parseable
    localStorage.setItem('dc_catalogAck', JSON.stringify(3));
    const dump = exportAllData();
    expect(dump.schema).toBe(1);
    expect(dump.entries['dc_catalogAck']).toBe(3);
    expect(dump.entries['dc_theme']).toBe('light');
  });

  it('getStorageStats counts only dc_* keys and reads savedAt', () => {
    localStorage.setItem('foreign', 'x');
    setReports([makeReport()], '2026-04-12T00:00:00.000Z');
    const stats = getStorageStats();
    expect(stats.keyCount).toBe(1);
    expect(stats.oldestDate?.toISOString()).toBe('2026-04-12T00:00:00.000Z');
  });
});

describe('critical-status reports survive load (regression)', () => {
  // The schema enum once omitted 'critical', so a report containing a
  // panic value validated fine on save but was dropped WHOLE on the next
  // load — silent data loss for the most urgent users. This pins the
  // round-trip so the enum can't drift out of sync with BiomarkerStatus.
  it('keeps a report whose biomarker status is "critical"', () => {
    setReports([
      makeReport({
        id: 'rep-crit',
        biomarkers: [
          {
            id: 'glucose',
            name: 'Fasting Glucose',
            value: 260,
            unit: 'mg/dL',
            min: 70,
            max: 100,
            status: 'critical',
            category: 'metabolic',
            plain: 'Blood sugar — a critical reading needs same-day care.',
          },
        ],
      }),
    ]);
    const loaded = loadReports();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].biomarkers[0].status).toBe('critical');
  });
});
