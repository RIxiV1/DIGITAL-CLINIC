import { describe, it, expect } from 'vitest';
import { pageToPath, pathToPage, pageEquals } from './NavigationContext';
import type { Page } from './types';

/**
 * White-box tests for the Page <-> URL path mapping that backs the
 * no-router navigation. These are pure functions; the round-trip is the
 * contract every deep link and browser back/forward relies on.
 */

const ALL_PAGES: Page[] = [
  { type: 'landing' },
  { type: 'quiz' },
  { type: 'recommendedTests' },
  { type: 'home' },
  { type: 'upload' },
  { type: 'processing' },
  { type: 'manualEntry' },
  { type: 'profile' },
  { type: 'results', reportId: 'rep-3f2a9c1b' },
  { type: 'problem', problemId: 'low-testosterone' },
];

describe('pageToPath', () => {
  it('maps each page to its clean path', () => {
    expect(pageToPath({ type: 'landing' })).toBe('/');
    expect(pageToPath({ type: 'home' })).toBe('/dashboard');
    expect(pageToPath({ type: 'quiz' })).toBe('/quiz');
    expect(pageToPath({ type: 'recommendedTests' })).toBe('/tests');
    expect(pageToPath({ type: 'upload' })).toBe('/upload');
    expect(pageToPath({ type: 'processing' })).toBe('/processing');
    expect(pageToPath({ type: 'manualEntry' })).toBe('/manual-entry');
    expect(pageToPath({ type: 'profile' })).toBe('/profile');
    expect(pageToPath({ type: 'results', reportId: 'abc' })).toBe('/reports/abc');
    expect(pageToPath({ type: 'problem', problemId: 'high-ldl' })).toBe(
      '/topics/high-ldl',
    );
  });

  it('URL-encodes params with reserved characters', () => {
    expect(pageToPath({ type: 'results', reportId: 'a/b c' })).toBe(
      '/reports/a%2Fb%20c',
    );
  });
});

describe('pathToPage', () => {
  it('parses each known path', () => {
    expect(pathToPage('/')).toEqual({ type: 'landing' });
    expect(pathToPage('/dashboard')).toEqual({ type: 'home' });
    expect(pathToPage('/quiz')).toEqual({ type: 'quiz' });
    expect(pathToPage('/tests')).toEqual({ type: 'recommendedTests' });
    expect(pathToPage('/upload')).toEqual({ type: 'upload' });
    expect(pathToPage('/processing')).toEqual({ type: 'processing' });
    expect(pathToPage('/manual-entry')).toEqual({ type: 'manualEntry' });
    expect(pathToPage('/profile')).toEqual({ type: 'profile' });
  });

  it('treats /minimal as the landing page (variant chosen in LandingPage)', () => {
    expect(pathToPage('/minimal')).toEqual({ type: 'landing' });
  });

  it('is forgiving about trailing slash and leading-segment case', () => {
    expect(pathToPage('/quiz/')).toEqual({ type: 'quiz' });
    expect(pathToPage('/Quiz')).toEqual({ type: 'quiz' });
    expect(pathToPage('/DASHBOARD/')).toEqual({ type: 'home' });
  });

  it('parses parameterised routes and decodes the param', () => {
    expect(pathToPage('/reports/rep-001')).toEqual({
      type: 'results',
      reportId: 'rep-001',
    });
    expect(pathToPage('/topics/low-vit-d')).toEqual({
      type: 'problem',
      problemId: 'low-vit-d',
    });
    expect(pathToPage('/reports/a%2Fb')).toEqual({
      type: 'results',
      reportId: 'a/b',
    });
  });

  it('falls back to landing for unknown paths', () => {
    expect(pathToPage('/nope')).toEqual({ type: 'landing' });
    expect(pathToPage('/reports')).toEqual({ type: 'landing' });
    expect(pathToPage('/reports/a/b')).toEqual({ type: 'landing' });
  });

  /**
   * Known limitation, documented as a test: pathToPage lowercases the
   * WHOLE path, so a param with uppercase round-trips lowercased. This is
   * SAFE today because every id is lowercase by construction (reportId =
   * crypto.randomUUID hex, problemId = kebab-case). If a future id can
   * contain uppercase, this test should fail loudly and the lowercasing
   * must be scoped to the route segment only.
   */
  it('lowercases param segments (safe only because ids are lowercase)', () => {
    expect(pathToPage('/reports/REP-AbC')).toEqual({
      type: 'results',
      reportId: 'rep-abc',
    });
  });
});

describe('pageToPath ∘ pathToPage round-trip', () => {
  it('is the identity for every page variant (lowercase ids)', () => {
    for (const page of ALL_PAGES) {
      expect(pathToPage(pageToPath(page))).toEqual(page);
    }
  });
});

describe('pageEquals', () => {
  it('returns false when the previous page is null/undefined', () => {
    expect(pageEquals(null, { type: 'home' })).toBe(false);
    expect(pageEquals(undefined, { type: 'home' })).toBe(false);
  });

  it('compares by type for param-less pages', () => {
    expect(pageEquals({ type: 'home' }, { type: 'home' })).toBe(true);
    expect(pageEquals({ type: 'home' }, { type: 'profile' })).toBe(false);
  });

  it('compares params for parameterised pages', () => {
    expect(
      pageEquals(
        { type: 'results', reportId: 'a' },
        { type: 'results', reportId: 'a' },
      ),
    ).toBe(true);
    expect(
      pageEquals(
        { type: 'results', reportId: 'a' },
        { type: 'results', reportId: 'b' },
      ),
    ).toBe(false);
    expect(
      pageEquals(
        { type: 'problem', problemId: 'x' },
        { type: 'problem', problemId: 'y' },
      ),
    ).toBe(false);
  });
});
