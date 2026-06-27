/**
 * Clinical interpretation layer.
 *
 * The home for logic that turns raw lab data into what we tell the user —
 * kept OUT of components and pages so the same rule produces the same
 * wording on every screen (the recurring P0 from the Jun-2026 audits:
 * interpretation was drifting because it lived in data files, UI helpers,
 * and components at once).
 *
 * Charter / migration plan (do this when the branch is quiet — not while
 * the page-refactor is in flight):
 *   - `tierFor`        → currently inlined in components/BiomarkerBar.tsx
 *   - `statusColor`    → currently in data/biomarkers.ts
 *   - `bottomLineFor`  → currently in data/biomarkers.ts
 *   - `calculateRisk`  → currently in contexts/QuizContext.tsx
 * all move/compose here behind a single `interpretMarker(marker, quiz)`
 * the pages consume, with contract + snapshot tests freezing the output.
 *
 * Today this layer holds the pieces that already live as pure, tested
 * functions. Each addition stays pure (data in → data out) so it's unit-
 * tested in isolation and presentational code never re-implements it.
 */
export { markerContextNote } from './markerContext';
export { reportProvenanceNote, type ProvenanceNote } from './reportProvenance';
export {
  REPORT_LIMITATIONS,
  REPORT_LIMITATIONS_SOURCES,
  CRITICAL_LIMITATION_CAVEAT,
  type Limitation,
  type LimitationsSource,
} from './reportLimitations';
export {
  EVIDENCE_TIERS,
  evidenceForRecommendation,
  type EvidenceLevel,
  type EvidenceMatch,
} from './evidence';
export { HOW_WE_READ, DECISION_PRINCIPLE, type MethodStep } from './methodology';
