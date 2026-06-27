import {
  type Biomarker,
  type BiomarkerCategoryId,
  type BiomarkerStatus,
} from '../data/biomarkers';

/**
 * Connected Systems — ForMen's signature model.
 *
 * Competitors show a flat wall of biomarkers. The ownable men's-health
 * truth is that those markers aren't isolated: testosterone behaves as a
 * NETWORK HUB — systems-level clustering (low-T + inflammation + renal
 * function) predicts male aging better than any single value
 * (Nature Communications Medicine 2026; PMC11999286). So we fold the 11
 * clinical categories into five systems and put the hormonal axis at the
 * centre, with the others connected to it — "these aren't eight problems,
 * they're signals from one system."
 *
 * This is the data model only (pure, unit-tested). The ConnectedSystems
 * component renders it. Status is honest: a system with no markers in the
 * report reads 'unmeasured', never a fabricated "good".
 */

export type BodySystemId =
  | 'hormonal'
  | 'metabolic'
  | 'heart'
  | 'vitality'
  | 'filtration';

export type SystemStatus = BiomarkerStatus | 'unmeasured';

type SystemDef = {
  id: BodySystemId;
  label: string;
  /** The hub the whole map orbits — rendered at centre. */
  hub?: boolean;
  categories: BiomarkerCategoryId[];
  /** Short, science-grounded reason this system links to the hormonal hub.
   *  Undefined on the hub itself. */
  link?: string;
};

// Five systems covering all 11 categories, hormonal at the centre.
const SYSTEM_DEFS: SystemDef[] = [
  {
    id: 'hormonal',
    label: 'Hormones',
    hub: true,
    categories: ['hormones', 'fertility'],
  },
  {
    id: 'metabolic',
    label: 'Energy & Metabolic',
    categories: ['metabolic', 'thyroid'],
    link: 'Insulin resistance and belly fat pull testosterone down.',
  },
  {
    id: 'heart',
    label: 'Heart',
    categories: ['heart', 'inflammation'],
    link: 'Low testosterone tracks with cardiovascular risk.',
  },
  {
    id: 'vitality',
    label: 'Recovery & Vitality',
    categories: ['vitamins', 'blood'],
    link: 'Vitamin D, iron and sleep are the raw materials for testosterone.',
  },
  {
    id: 'filtration',
    label: 'Filtration',
    categories: ['kidney', 'liver', 'electrolytes'],
    link: 'Clearance and hydration shape how the rest of your panel reads.',
  },
];

export type BodySystem = {
  id: BodySystemId;
  label: string;
  hub: boolean;
  status: SystemStatus;
  /** Markers present in the report for this system. */
  markerCount: number;
  /** Count of markers that need care (concern + critical). */
  flaggedCount: number;
  link?: string;
};

const STATUS_RANK: Record<BiomarkerStatus, number> = {
  good: 0,
  attention: 1,
  concern: 2,
  critical: 3,
};

/** Worst status wins — a system is only as calm as its most-flagged marker. */
function worstStatus(markers: Biomarker[]): SystemStatus {
  if (markers.length === 0) return 'unmeasured';
  return markers.reduce<BiomarkerStatus>((worst, m) => {
    return STATUS_RANK[m.status] > STATUS_RANK[worst] ? m.status : worst;
  }, 'good');
}

/**
 * Build the five-system view from a report's markers. Stable order
 * (hub first, then as defined) — the renderer positions them; it
 * shouldn't depend on input ordering.
 */
export function buildBodySystems(markers: Biomarker[]): BodySystem[] {
  return SYSTEM_DEFS.map((def) => {
    const inSystem = markers.filter((m) => def.categories.includes(m.category));
    const flaggedCount = inSystem.filter(
      (m) => m.status === 'concern' || m.status === 'critical',
    ).length;
    return {
      id: def.id,
      label: def.label,
      hub: !!def.hub,
      status: worstStatus(inSystem),
      markerCount: inSystem.length,
      flaggedCount,
      link: def.link,
    };
  });
}

/**
 * The idea, in one line — the "holy shit" sentence that leads the signature
 * moment. ForMen's whole belief is that a man's body isn't a pile of
 * separate problems; it's one connected system. This states it against the
 * actual report (how many markers are flagged), so it's true, not slogan.
 */
export function connectedStoryHeadline(systems: BodySystem[]): string {
  const flagged = systems.reduce((n, s) => n + s.flaggedCount, 0);
  if (flagged === 0) {
    return 'Your body is one connected system — and right now, the whole story is calm.';
  }
  const noun =
    flagged === 1 ? 'an isolated problem' : `${flagged} separate problems`;
  return `Your body isn’t showing ${noun}. It’s telling one connected story.`;
}

/** The worst-status MEASURED system, or null if nothing was measured. */
function worstMeasured(systems: BodySystem[]): BodySystem | null {
  const measured = systems.filter((s) => s.status !== 'unmeasured');
  if (measured.length === 0) return null;
  return measured.reduce((worst, s) =>
    STATUS_RANK[s.status as BiomarkerStatus] >
    STATUS_RANK[worst.status as BiomarkerStatus]
      ? s
      : worst,
  );
}

/**
 * One emotional, honest sentence to lead the signature view — "Your Health
 * Story". Reassurance-first, names the one system worth attention, defers
 * to a doctor on anything urgent. Returns null when nothing is measured
 * (the caller shows an upload prompt instead of a fabricated verdict).
 */
export function healthStorySentence(systems: BodySystem[]): string | null {
  const worst = worstMeasured(systems);
  if (!worst) return null;

  const name = worst.label.toLowerCase();
  switch (worst.status) {
    case 'critical':
      return `Your ${name} needs attention today — one result is flagged for same-day care. Everything else can wait until you've spoken to a doctor.`;
    case 'concern':
      return `Strong overall — your ${name} is the one system worth a closer look right now.`;
    case 'attention':
      return `Looking solid. Keep a light eye on your ${name}; nothing here is a red flag.`;
    default:
      return 'Every system we can see is in good shape. Keep doing what you’re doing.';
  }
}
