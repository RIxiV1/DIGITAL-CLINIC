// @vitest-environment jsdom
import { render, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { EvidenceBadge, EvidenceLegend } from './EvidenceBadge';
import { EVIDENCE_TIERS, type EvidenceMatch } from '../clinical';

afterEach(cleanup);

const MATCH: EvidenceMatch = {
  level: 'strong',
  supports: 'blood sugar and insulin sensitivity',
  source: {
    label: 'ADA — Physical Activity/Exercise and Diabetes',
    url: 'https://example.org/ada',
  },
};

describe('EvidenceBadge', () => {
  it('renders the tier label for the match level', () => {
    render(<EvidenceBadge match={MATCH} />);
    expect(screen.getByText(EVIDENCE_TIERS.strong.label)).toBeTruthy();
  });

  it('renders the source as a real, safe external link', () => {
    render(<EvidenceBadge match={MATCH} />);
    const link = screen.getByRole('link', { name: /read the source/i });
    expect(link.getAttribute('href')).toBe(MATCH.source.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('shows the supported outcome only when asked', () => {
    const { rerender } = render(<EvidenceBadge match={MATCH} />);
    expect(screen.queryByText(/Supports blood sugar/)).toBeNull();
    rerender(<EvidenceBadge match={MATCH} showSupports />);
    expect(screen.getByText(/Supports blood sugar and insulin sensitivity/)).toBeTruthy();
  });
});

describe('EvidenceLegend', () => {
  it('defines the three grades inline', () => {
    render(<EvidenceLegend />);
    expect(screen.getByText(/Evidence grades:/)).toBeTruthy();
    expect(screen.getByText(/Strong .*Moderate .*Emerging/s)).toBeTruthy();
  });
});
