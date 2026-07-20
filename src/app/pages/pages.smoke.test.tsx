// @vitest-environment jsdom
/**
 * Page smoke tests — verify each page renders without throwing.
 *
 * These don't assert on detailed UI; they catch the regression class
 * "I refactored something and now the dashboard crashes on mount."
 * Pure-logic tests (97 of them in the suite) can't catch that — the
 * code typechecks and the catalog matcher still works, but the page
 * itself errors out on render.
 *
 * Runs in jsdom (configured per-glob in vite.config.ts). Each test
 * mounts the real page inside <AppProvider> so navigation/quiz/reports
 * contexts behave like production — no manual mocks to drift out of
 * sync with the real contract.
 */

import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AppProvider } from '../AppContext';
import LandingPage from './LandingPage';
import HomePage from './HomePage';
import QuizPage from './QuizPage';
import RecommendedTestsPage from './RecommendedTestsPage';
import UploadPage from './UploadPage';
import ManualEntryPage from './ManualEntryPage';
import ProcessingPage from './ProcessingPage';
import ProfilePage from './ProfilePage';
import ReportResultsPage from './ReportResultsPage';
import ProblemDetailPage from './ProblemDetailPage';
import HealthMapPage from './HealthMapPage';
import ComparePage from './ComparePage';

// jspdf needs window.matchMedia for some setup paths; framer-motion
// reads it via prefers-reduced-motion. jsdom doesn't ship one by
// default — provide a no-op shim once for the whole file.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// scrollTo is called by some pages (LandingPage's back-to-top button
// is wired to scrollTo); jsdom doesn't implement it.
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = vi.fn();
}

// framer-motion's whileInView uses IntersectionObserver; jsdom doesn't
// ship one. Stub with a no-op so render() doesn't throw before we even
// get to assert anything. ResizeObserver gets the same treatment.
class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  (
    window as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver =
    StubIntersectionObserver as unknown as typeof IntersectionObserver;
}
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}

afterEach(cleanup);

const renderWithProvider = (ui: React.ReactNode) =>
  render(<AppProvider>{ui}</AppProvider>);

describe('page smoke tests', () => {
  it('LandingPage renders', () => {
    const { container } = renderWithProvider(<LandingPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('LandingPage minimal variant renders at /minimal', () => {
    // Path-driven variant: LandingPage reads useLocation().pathname
    // and switches to the 4-section trim layout. Test via MemoryRouter
    // with an explicit initialEntries so we don't depend on jsdom's
    // window.location.
    const { container } = render(
      <AppProvider router="memory" initialEntries={['/minimal']}>
        <LandingPage />
      </AppProvider>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('HomePage renders (empty locker state)', () => {
    const { container } = renderWithProvider(<HomePage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('HealthMapPage renders (empty locker → empty state)', () => {
    const { container } = renderWithProvider(<HealthMapPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('QuizPage renders', () => {
    const { container } = renderWithProvider(<QuizPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('RecommendedTestsPage renders', () => {
    const { container } = renderWithProvider(<RecommendedTestsPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('UploadPage renders', () => {
    const { container } = renderWithProvider(<UploadPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('ManualEntryPage renders', () => {
    const { container } = renderWithProvider(<ManualEntryPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('ProfilePage renders', () => {
    const { container } = renderWithProvider(<ProfilePage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('ReportResultsPage renders (sample report id)', () => {
    // rep-001 is the curated sample — guaranteed to resolve via
    // findReport's sampleReports fallback. Real user reports would
    // require pre-seeding ReportsContext state.
    const { container } = renderWithProvider(
      <ReportResultsPage reportId="rep-001" />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('ProblemDetailPage renders (known problem id)', () => {
    // 'low-testosterone' is referenced from sampleBiomarkers and
    // exists in data/problems.ts. If it ever stops existing this
    // assertion fails loudly — surfaces broken problem-id refs.
    const { container } = renderWithProvider(
      <ProblemDetailPage problemId="low-testosterone" />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('ProblemDetailPage renders not-found state for an unknown id', () => {
    const { container } = renderWithProvider(
      <ProblemDetailPage problemId="not-a-real-problem" />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('ComparePage renders the sample-fallback demo with no ids', () => {
    // Empty locker → the page falls back to the two curated sample
    // reports and canonicalises the URL via replace(). MemoryRouter keeps
    // that rewrite off window.history during the test.
    const { container } = render(
      <AppProvider router="memory" initialEntries={['/compare']}>
        <ComparePage />
      </AppProvider>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('ComparePage renders a comparison for two sample report ids', () => {
    const { container } = render(
      <AppProvider router="memory" initialEntries={['/compare/rep-001/rep-002']}>
        <ComparePage aId="rep-001" bId="rep-002" />
      </AppProvider>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('ProcessingPage renders without crashing (empty-locker fallback path)', () => {
    // With no processing report in context, ProcessingPage's mount
    // effect navigates home — but the initial render still has to
    // produce DOM. This pins "the parsing UI mounts without throwing"
    // (catches regressions in the parseSteps render loop, the
    // pendingConfirm restore, or the loadPendingConfirm/localStorage
    // calls). MemoryRouter prevents the redirect from touching
    // window.history during the test.
    const { container } = render(
      <AppProvider router="memory" initialEntries={['/processing']}>
        <ProcessingPage />
      </AppProvider>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
