import { describe, expect, it } from 'vitest';
import {
  buildBodySystems,
  healthStorySentence,
  connectedStoryHeadline,
  type BodySystem,
} from './bodySystems';
import type { Biomarker, BiomarkerCategoryId, BiomarkerStatus } from '../data/biomarkers';

const mk = (
  category: BiomarkerCategoryId,
  status: BiomarkerStatus,
): Biomarker =>
  ({
    id: `${category}-${status}`,
    name: category,
    value: 1,
    unit: '',
    min: 0,
    max: 10,
    status,
    category,
    plain: '',
  }) as Biomarker;

const find = (systems: BodySystem[], id: string) =>
  systems.find((s) => s.id === id)!;

describe('buildBodySystems', () => {
  it('always returns the five systems, hormonal as the hub', () => {
    const systems = buildBodySystems([]);
    expect(systems.map((s) => s.id)).toEqual([
      'hormonal',
      'metabolic',
      'heart',
      'vitality',
      'filtration',
    ]);
    expect(find(systems, 'hormonal').hub).toBe(true);
  });

  it('folds categories into the right system and takes the worst status', () => {
    const systems = buildBodySystems([
      mk('hormones', 'good'),
      mk('fertility', 'concern'), // both fold into hormonal -> worst = concern
      mk('metabolic', 'attention'),
      mk('thyroid', 'good'),
    ]);
    expect(find(systems, 'hormonal').status).toBe('concern');
    expect(find(systems, 'hormonal').markerCount).toBe(2);
    expect(find(systems, 'hormonal').flaggedCount).toBe(1);
    expect(find(systems, 'metabolic').status).toBe('attention');
  });

  it('marks a system with no markers as unmeasured, never a fake "good"', () => {
    const systems = buildBodySystems([mk('hormones', 'good')]);
    expect(find(systems, 'heart').status).toBe('unmeasured');
    expect(find(systems, 'heart').markerCount).toBe(0);
  });

  it('covers all 11 categories across the five systems', () => {
    const everyCategory: BiomarkerCategoryId[] = [
      'hormones', 'metabolic', 'heart', 'thyroid', 'vitamins', 'liver',
      'kidney', 'blood', 'fertility', 'electrolytes', 'inflammation',
    ];
    const systems = buildBodySystems(everyCategory.map((c) => mk(c, 'good')));
    const totalMarkers = systems.reduce((n, s) => n + s.markerCount, 0);
    expect(totalMarkers).toBe(everyCategory.length); // none dropped
  });
});

describe('healthStorySentence', () => {
  it('returns null when nothing is measured', () => {
    expect(healthStorySentence(buildBodySystems([]))).toBeNull();
  });

  it('leads with same-day urgency when a system is critical', () => {
    const s = healthStorySentence(buildBodySystems([mk('heart', 'critical')]));
    expect(s).toMatch(/today|same-day/i);
  });

  it('is reassuring-first and doctor-voiced when only mild things are flagged', () => {
    const s = healthStorySentence(buildBodySystems([mk('metabolic', 'concern')]));
    expect(s).toMatch(/reassuring|prioritis|start with/i);
    expect(s).not.toMatch(/today|same-day/i);
  });
});

describe('connectedStoryHeadline', () => {
  it('frames the SYSTEMS LENS without overpromising a connected story', () => {
    const two = connectedStoryHeadline(
      buildBodySystems([mk('heart', 'concern'), mk('metabolic', 'critical')]),
    );
    expect(two).toMatch(/by system/i);
    // It must NOT assert the findings form one story (contract §3).
    expect(two).not.toMatch(/one connected story|connected story/i);

    const one = connectedStoryHeadline(buildBodySystems([mk('heart', 'concern')]));
    expect(one).toMatch(/by system/i);

    const none = connectedStoryHeadline(buildBodySystems([mk('heart', 'good')]));
    expect(none).toMatch(/calm/i);
  });
});
