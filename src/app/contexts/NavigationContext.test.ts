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
  { type: 'healthMap' },
  { type: 'upload' },
  { type: 'processing' },
  { type: 'manualEntry' },
  { type: 'profile' },
  { type: 'results', reportId: 'rep-3f2a9c1b' },
  { type: 'compare' },
  { type: 'compare', aId: 'rep-001', bId: 'rep-002' },
  { type: 'problem', problemId: 'low-testosterone' },
];

describe('pageToPath', () => {
  it('maps each page to its clean path', () => {
    expect(pageToPath({ type: 'landing' })).toBe('/');
    expect(pageToPath({ type: 'home' })).toBe('/dashboard');
    expect(pageToPath({ type: 'healthMap' })).toBe('/health-map');
    expect(pageToPath({ type: 'quiz' })).toBe('/quiz');
    expect(pageToPath({ type: 'recommendedTests' })).toBe('/tests');
    expect(pageToPath({ type: 'upload' })).toBe('/upload');
    expect(pageToPath({ type: 'processing' })).toBe('/processing');
    expect(pageToPath({ type: 'manualEntry' })).toBe('/manual-entry');
    expect(pageToPath({ type: 'profile' })).toBe('/profile');
    expect(pageToPath({ type: 'results', reportId: 'abc' })).toBe(
      '/reports/abc',
    );
    expect(pageToPath({ type: 'problem', problemId: 'high-ldl' })).toBe(
      '/topics/high-ldl',
    );
    expect(pageToPath({ type: 'compare' })).toBe('/compare');
    expect(
      pageToPath({ type: 'compare', aId: 'rep-1', bId: 'rep-2' }),
    ).toBe('/compare/rep-1/rep-2');
    // A half-specified pair collapses to the picker route, not a broken
    // /compare/rep-1 path the parser can't round-trip.
    expect(pageToPath({ type: 'compare', aId: 'rep-1' })).toBe('/compare');
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
    expect(pathToPage('/health-map')).toEqual({ type: 'healthMap' });
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

  it('parses the compare routes (picker and explicit pair)', () => {
    expect(pathToPage('/compare')).toEqual({ type: 'compare' });
    expect(pathToPage('/compare/rep-1/rep-2')).toEqual({
      type: 'compare',
      aId: 'rep-1',
      bId: 'rep-2',
    });
  });

  /**
   * Route params keep their original case (the keyword is still matched
   * case-insensitively). IDs are lowercase by construction today, but a
   * deep link must survive an uppercase id rather than silently resolving
   * to a different (lowercased) id and 404-ing the lookup.
   */
  it('preserves param case while keeping the keyword case-insensitive', () => {
    expect(pathToPage('/reports/REP-AbC')).toEqual({
      type: 'results',
      reportId: 'REP-AbC',
    });
    expect(pathToPage('/Reports/REP-AbC')).toEqual({
      type: 'results',
      reportId: 'REP-AbC',
    });
    expect(pathToPage('/Topics/Low-VitD')).toEqual({
      type: 'problem',
      problemId: 'Low-VitD',
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

  it('treats a changed compare pair as a different page', () => {
    expect(
      pageEquals(
        { type: 'compare', aId: 'a', bId: 'b' },
        { type: 'compare', aId: 'a', bId: 'b' },
      ),
    ).toBe(true);
    // Swapping one side must register as a navigation, else the picker
    // change would no-op the URL update.
    expect(
      pageEquals(
        { type: 'compare', aId: 'a', bId: 'b' },
        { type: 'compare', aId: 'a', bId: 'c' },
      ),
    ).toBe(false);
  });
});
