// @vitest-environment jsdom
import { render, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import DashboardHeadline from './DashboardHeadline';
import type { Biomarker, BiomarkerStatus } from '../data/biomarkers';

afterEach(cleanup);

/** Minimal, history-less markers so pickCopy skips the trend (State A)
 *  branch and exercises the single-report State B logic under test. */
function markers(statuses: BiomarkerStatus[]): Biomarker[] {
  return statuses.map(
    (status, i) =>
      ({
        id: `m${i}`,
        name: `Marker ${i}`,
        value: 1,
        unit: 'x',
        min: 0,
        max: 10,
        status,
        category: 'metabolic',
        plain: '',
      }) as Biomarker,
  );
}

const noop = () => {};

describe('DashboardHeadline copy (State B)', () => {
  it('leads with reassurance (in-range majority), flag in the qualifier', () => {
    render(
      <DashboardHeadline
        markers={markers(['good', 'good', 'good', 'concern'])}
        hasReport
        onPrimaryCTA={noop}
      />,
    );
    expect(screen.getByRole('heading').textContent).toContain(
      '3 of 4 markers look good.',
    );
    expect(screen.getByText(/a closer look/)).toBeTruthy();
  });

  it('lets a CRITICAL marker lead — reassurance never buries same-day care', () => {
    render(
      <DashboardHeadline
        markers={markers(['good', 'good', 'critical'])}
        hasReport
        onPrimaryCTA={noop}
      />,
    );
    expect(screen.getByRole('heading').textContent).toContain('a doctor soon');
    // The reassurance still appears, but as the qualifier, not the masthead.
    expect(screen.getByText(/2 of 3 markers are in range/)).toBeTruthy();
  });

  it('leads with the flag when nothing is in range (no false reassurance)', () => {
    render(
      <DashboardHeadline
        markers={markers(['concern', 'concern'])}
        hasReport
        onPrimaryCTA={noop}
      />,
    );
    expect(screen.getByRole('heading').textContent).toContain(
      '2 markers need a closer look.',
    );
  });

  it('still celebrates an all-clear report', () => {
    render(
      <DashboardHeadline
        markers={markers(['good', 'good'])}
        hasReport
        onPrimaryCTA={noop}
      />,
    );
    expect(screen.getByRole('heading').textContent).toContain('in range');
  });
});
