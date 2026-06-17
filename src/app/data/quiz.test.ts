import { describe, it, expect } from 'vitest';
import {
  quizSteps,
  getStepOptions,
  findOptionLabel,
  buildLabelMap,
  totalQuizSteps,
  exclusiveOptionIds,
  toggleMultiSelect,
} from './quiz';

describe('exclusive opt-out handling', () => {
  it('flags the symptoms "Nothing specific" and safety "None of these" opts as exclusive', () => {
    expect(exclusiveOptionIds('symptoms')).toEqual(new Set(['proactive']));
    expect(exclusiveOptionIds('comorbidities')).toEqual(new Set(['none']));
    // Fields without an opt-out have none.
    expect(exclusiveOptionIds('priorities').size).toBe(0);
  });

  it('selecting an exclusive option clears every other selection', () => {
    const ex = exclusiveOptionIds('comorbidities');
    expect(toggleMultiSelect(['nitrates', 'high-bp'], 'none', ex)).toEqual([
      'none',
    ]);
  });

  it('selecting a normal option clears a previously-set exclusive option', () => {
    const ex = exclusiveOptionIds('comorbidities');
    expect(toggleMultiSelect(['none'], 'nitrates', ex)).toEqual(['nitrates']);
  });

  it('toggles normally among non-exclusive options', () => {
    const ex = exclusiveOptionIds('comorbidities');
    expect(toggleMultiSelect(['nitrates'], 'high-bp', ex).sort()).toEqual([
      'high-bp',
      'nitrates',
    ]);
    expect(toggleMultiSelect(['nitrates', 'high-bp'], 'nitrates', ex)).toEqual([
      'high-bp',
    ]);
  });

  it('deselecting the exclusive option just removes it', () => {
    const ex = exclusiveOptionIds('comorbidities');
    expect(toggleMultiSelect(['none'], 'none', ex)).toEqual([]);
  });
});

describe('getStepOptions', () => {
  it('returns the flat options for a simple step', () => {
    const flat = quizSteps.find((s) => s.options && s.options.length > 0);
    expect(flat).toBeDefined();
    expect(getStepOptions(flat!)).toEqual(flat!.options);
  });

  it('flattens grouped options for a grouped step', () => {
    const grouped = quizSteps.find((s) => s.optionGroups);
    expect(grouped).toBeDefined();
    const expectedCount = grouped!.optionGroups!.reduce(
      (n, g) => n + g.options.length,
      0,
    );
    expect(getStepOptions(grouped!)).toHaveLength(expectedCount);
  });
});

describe('buildLabelMap', () => {
  const map = buildLabelMap();

  it('is non-empty and every id maps to a non-empty label', () => {
    expect(map.size).toBeGreaterThan(0);
    for (const [id, label] of map) {
      expect(id.length).toBeGreaterThan(0);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('includes every option surfaced by getStepOptions', () => {
    for (const step of quizSteps) {
      for (const opt of getStepOptions(step)) {
        expect(map.get(opt.id)).toBe(opt.label);
      }
    }
  });
});

describe('findOptionLabel', () => {
  it('resolves an option id to its label for the right field', () => {
    const step = quizSteps.find((s) => s.field && getStepOptions(s).length > 0);
    expect(step?.field).toBeTruthy();
    const opt = getStepOptions(step!)[0];
    expect(findOptionLabel(step!.field!, opt.id)).toBe(opt.label);
  });

  it('returns undefined for an unknown id', () => {
    expect(findOptionLabel('age', '__does_not_exist__')).toBeUndefined();
  });
});

describe('totalQuizSteps', () => {
  it('matches the number of steps', () => {
    expect(totalQuizSteps).toBe(quizSteps.length);
    expect(totalQuizSteps).toBeGreaterThan(0);
  });
});
