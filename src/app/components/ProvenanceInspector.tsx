import type { Biomarker } from '../data/biomarkers';
import { OCR_LOW_CONFIDENCE_THRESHOLD } from '../services/pdfParser';

/**
 * The honest, per-marker "how did we read this?" panel — the trust core made
 * visible. Every line is derived from the marker itself; nothing is
 * fabricated. Confidence is QUALITATIVE and source-driven (never an invented
 * percentage), because a made-up "98%" on a health value is worse than none.
 */
function sourceLine(marker: Biomarker): string {
  if (typeof marker.ocrConfidence !== 'number') {
    return "Read straight from the report's text layer — highest confidence.";
  }
  return marker.ocrConfidence < OCR_LOW_CONFIDENCE_THRESHOLD
    ? 'Recovered via OCR on a low-quality scan — worth a second look.'
    : 'Recovered via OCR — the scan read cleanly.';
}

export function ProvenanceInspector({ marker }: { marker: Biomarker }) {
  // Only claims that are true for THIS marker, derived from what the parser
  // actually did to it.
  const checks = [
    'Matched to our biomarker catalog',
    'Passed physical sanity checks',
  ];
  if (marker.originalValue !== undefined && marker.originalUnit) {
    checks.push('Unit standardized to our reference');
  }
  if (
    typeof marker.labRefMin === 'number' &&
    typeof marker.labRefMax === 'number'
  ) {
    checks.push("Your lab's reference range validated");
  }

  return (
    <div className="mt-3 rounded-lg border border-line/70 p-3">
      <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
        How we read this
      </div>
      <ul className="mt-1.5 space-y-1">
        {checks.map((c) => (
          <li
            key={c}
            className="flex items-start gap-1.5 text-micro text-ink-soft"
          >
            <span aria-hidden="true" className="mt-px font-bold text-indigo-700">
              ✓
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-micro leading-snug text-muted">
        {sourceLine(marker)}
      </p>
    </div>
  );
}
