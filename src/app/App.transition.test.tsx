// @vitest-environment jsdom
/**
 * Page-transition regression test.
 *
 * Invariant: an in-app navigation leaves EXACTLY ONE page <main>, and
 * the new page actually mounts. PageHost keys the page wrapper on page
 * identity (no AnimatePresence) so React unmounts the old page and mounts
 * the new one synchronously.
 *
 * What this catches in jsdom: a transition that fails to mount the next
 * page at all (e.g. re-introducing <AnimatePresence mode="wait"> around a
 * child whose exit never completes — the URL changes but content stays on
 * the old page). The first waitFor below times out in that case.
 *
 * What it does NOT catch: the original production bug was an
 * <AnimatePresence mode="popLayout"> "ghost" — the exited page left
 * mounted, absolutely positioned over the live page, intercepting taps
 * and breaking scroll (felt like an unresponsive infinite scroll after
 * Sign out). framer-motion resolves exits synchronously in jsdom, so the
 * ghost never forms here; that regression is guarded by the Playwright
 * navigation DOM-leak sweep (mains/nav/node counts must stay flat across
 * repeated real-browser navigations), not this test.
 */

import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import App from './App';

// jsdom shims (same set the page smoke tests install).
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
}
if (typeof window !== 'undefined' && !window.scrollTo) window.scrollTo = vi.fn();
class StubObserver {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
}
for (const key of ['IntersectionObserver', 'ResizeObserver'] as const) {
  if (typeof window !== 'undefined' && !(key in window)) {
    (window as unknown as Record<string, unknown>)[key] = StubObserver;
  }
}

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const mains = () => document.querySelectorAll('main#main-content');

describe('PageHost navigation', () => {
  it('renders exactly one page <main> at a time and swaps it on navigation', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    // Landing is eager — one main from the first paint.
    expect(mains()).toHaveLength(1);
    expect(screen.getAllByText(/men.s hormonal health/i).length).toBeGreaterThan(0);

    // Navigate to the sample report (lazy page behind Suspense).
    const sample = screen.getAllByRole('button', { name: /see a sample report/i })[0];
    fireEvent.click(sample);

    // The landing page is gone immediately on the keyed swap...
    await waitFor(() => {
      expect(screen.queryAllByText(/men.s hormonal health/i)).toHaveLength(0);
    });
    // ...and once the lazy report chunk resolves out of Suspense, there
    // is again exactly one <main> — never two (the ghost-page bug would
    // leave the old landing main mounted alongside the new one).
    await waitFor(() => {
      expect(mains()).toHaveLength(1);
    });
    expect(mains()).toHaveLength(1);
  });
});
