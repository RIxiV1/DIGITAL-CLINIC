import { EVIDENCE_TIERS, type EvidenceLevel, type EvidenceMatch } from '../clinical';

/**
 * EvidenceBadge — the one place a graded lifestyle lever is rendered.
 *
 * Shared by the marker "Learn more" modal and the action-plan page so the
 * grade styling, the "Supports X" clause, and the clickable source can't
 * drift between surfaces. The grade itself comes from the conservative,
 * cite-or-omit engine in clinical/evidence.ts — callers only render this
 * when evidenceForRecommendation() returned a match, so an ungraded lever
 * shows nothing rather than a guessed badge.
 */

// Status-neutral styling — deliberately NOT the green/amber/red health
// palette, so an evidence GRADE can never be misread as a health VERDICT.
// The tier label carries the meaning; colour only nudges weight.
const TIER_STYLE: Record<EvidenceLevel, string> = {
  strong: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  moderate: 'text-ink-soft bg-canvas border-line',
  emerging: 'text-muted bg-canvas/60 border-line/70',
};

export function EvidenceBadge({
  match,
  /** Show the outcome the grade applies to ("Supports blood sugar…") — on
   *  by default for the roomy action-plan cards, off for the compact
   *  inline modal list where the line already sits beside it. */
  showSupports = false,
  className = '',
}: {
  match: EvidenceMatch;
  showSupports?: boolean;
  className?: string;
}) {
  const tier = EVIDENCE_TIERS[match.level];
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 align-middle ${className}`}
    >
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-micro font-semibold whitespace-nowrap ${TIER_STYLE[match.level]}`}
        title={`${tier.meaning} Supports ${match.supports}.`}
        aria-label={`Evidence: ${tier.label}. ${tier.meaning} Supports ${match.supports}.`}
      >
        {tier.label}
      </span>
      {showSupports && (
        <span className="text-micro text-muted">Supports {match.supports}</span>
      )}
      <a
        href={match.source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={match.source.label}
        aria-label={`Read the source: ${match.source.label}`}
        className="text-micro font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
      >
        source
      </a>
    </span>
  );
}

/** One-line key that defines the three grades. Rendered once per list (when
 *  anything on it is actually graded) so the tier labels never depend on a
 *  hover that doesn't exist on touch. */
export function EvidenceLegend({ className = '' }: { className?: string }) {
  return (
    <p className={`text-micro text-muted leading-snug ${className}`}>
      <span className="font-semibold text-ink-soft">Evidence grades:</span>{' '}
      Strong (trials &amp; guidelines) · Moderate (probably helps) · Emerging
      (early or mixed). Based on GRADE certainty.
    </p>
  );
}
