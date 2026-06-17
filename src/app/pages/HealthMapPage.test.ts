import { describe, it, expect } from 'vitest';
import { healthMapHeadline, rollup, summaryText } from './HealthMapPage';
import type { Biomarker } from '../data/biomarkers';

/**
 * Unit tests for the Health Map's per-system rollup — the logic that
 * turns a system's markers into one worst-status + summary line. The
 * smoke test only exercises the empty-state branch (empty locker), so
 * this covers the populated path the user actually sees.
 *
 * Only the fields rollup() reads are populated; the rest of the Biomarker
 * shape is irrelevant to the rollup contract.
 */
function marker(status: Biomarker['status']): Biomarker {
  return {
    id: `m-${status}`,
    name: status,
    value: 1,
    unit: '',
    min: 0,
    max: 2,
    status,
    category: 'hormones',
    plain: '',
  } as Biomarker;
}

describe('rollup', () => {
  it('reports the worst status present (critical > concern > attention > good)', () => {
    expect(rollup([marker('good'), marker('attention')]).worst).toBe(
      'attention',
    );
    expect(
      rollup([marker('good'), marker('attention'), marker('concern')]).worst,
    ).toBe('concern');
    expect(
      rollup([marker('good'), marker('concern'), marker('critical')]).worst,
    ).toBe('critical');
  });

  it('is "good" only when every marker is on track', () => {
    expect(rollup([marker('good'), marker('good')]).worst).toBe('good');
  });

  it('collapses critical into the concern count (mirrors the Vitals Strip)', () => {
    const r = rollup([marker('critical'), marker('concern'), marker('good')]);
    expect(r.critical).toBe(1);
    expect(r.concern).toBe(2); // critical + concern
    expect(r.good).toBe(1);
  });
});

describe('summaryText', () => {
  it('leads with see-a-doctor when anything is critical', () => {
    expect(
      summaryText(rollup([marker('critical'), marker('concern')])),
    ).toBe('See a doctor');
  });

  it('pluralises the needs-care count', () => {
    expect(summaryText(rollup([marker('concern')]))).toBe('1 needs care');
    expect(summaryText(rollup([marker('concern'), marker('concern')]))).toBe(
      '2 need care',
    );
  });

  it('falls back to "to watch", then "Healthy"', () => {
    expect(summaryText(rollup([marker('attention')]))).toBe('1 to watch');
    expect(summaryText(rollup([marker('good')]))).toBe('Healthy');
  });
});

describe('healthMapHeadline', () => {
  it('does not say "a handful" for a single concern (the reported bug)', () => {
    expect(healthMapHeadline({ critical: 0, concern: 1, attention: 0 })).toBe(
      'Just one thing to work on',
    );
  });

  it('uses the plural framing only for 2+ concerns', () => {
    expect(healthMapHeadline({ critical: 0, concern: 3, attention: 0 })).toBe(
      'A handful of things to work on',
    );
  });

  it('is count-aware for the critical (see-a-doctor) tier', () => {
    expect(healthMapHeadline({ critical: 1, concern: 2, attention: 0 })).toBe(
      'One thing needs a doctor',
    );
    expect(healthMapHeadline({ critical: 2, concern: 0, attention: 0 })).toBe(
      'A few things need a doctor',
    );
  });

  it('is count-aware for the keep-an-eye tier, and celebrates all-clear', () => {
    expect(healthMapHeadline({ critical: 0, concern: 0, attention: 1 })).toBe(
      'Looking good — one to keep an eye on',
    );
    expect(healthMapHeadline({ critical: 0, concern: 0, attention: 0 })).toBe(
      'Everything’s healthy',
    );
  });
});
