import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  formatDelta,
  getPreviousValue,
  getTrendTone,
  pickHeadlineMarker,
  summarizeStatuses,
  type Biomarker,
} from '../data/biomarkers';

type Props = {
  /** Markers from the report this hero summarizes, or null/[] if none. */
  markers: Biomarker[] | null;
  /** Whether the user has ANY analyzed report. */
  hasReport: boolean;
  /** The report these markers came from — labelled so it's never
   *  ambiguous WHICH report the headline + score reflect (the dashboard
   *  shows your most comprehensive panel, which may not be your newest
   *  upload). Omitted in the no-report state. */
  source?: { name: string; uploadedOn: string };
  onPrimaryCTA: () => void;
};

/**
 * Top-of-page headline per the dashboard brief.
 *
 * Visual treatment: the "warm paper clinic-chart" identity — a deliberate
 * break from BOTH AI defaults (the cold navy glow-SaaS look AND the safe
 * greyscale monolith). The hero is a warm off-white `bg-paper` card with a
 * warm hairline, split into an ASYMMETRIC two-panel layout: a wide
 * narrative column and a narrower score panel divided by a warm rule.
 *
 * Hierarchy comes from radical type CONTRAST, not effects: an oversized,
 * thin Instrument Serif headline + score (`font-editorial`) set against
 * dense, tightly-tracked monospace counts and tiny uppercase labels —
 * the kind of intentional scale jump a human designer makes and a
 * generator's uniform hierarchy doesn't. The score is a custom split
 * meter (in-range vs to-review), not the generic activity ring every
 * dashboard reaches for. Colour is owned and restrained: warm charcoal
 * ink, a deep forest "in-range" tone, and a single terracotta accent on
 * the CTA + the "to review" count.
 *
 * Four data-driven copy states (logic unchanged):
 *   A. 2+ readings on at least one marker  → call out the biggest change
 *   B. 1 report, some red markers          → "[N] markers need attention"
 *   C. 0 reports                           → "Upload your first report"
 *   D. all green                           → celebrate, recommend retest
 */
export default function DashboardHeadline({
  markers,
  hasReport,
  source,
  onPrimaryCTA,
}: Props) {
  const { eyebrow, headline, qualifier, sub, ctaLabel } = pickCopy(
    markers,
    hasReport,
  );

  const summary =
    markers && markers.length > 0 ? summarizeStatuses(markers) : null;

  const onTrackPct =
    summary && summary.total > 0
      ? Math.round((summary.good / summary.total) * 100)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-lg bg-paper text-paper-ink border border-paper-line"
    >
      <div className="flex flex-col md:flex-row">
        {/* Narrative column — intentionally the wider of the two. */}
        <div className="flex-1 min-w-0 p-6 md:p-9">
          <div className="text-micro uppercase tracking-[0.2em] font-semibold text-paper-soft">
            {eyebrow}
          </div>
          {/* Oversized, thin editorial headline — the deliberate scale
              jump. leading is pulled tight so the serif reads as a
              confident masthead, not body copy. */}
          <h1 className="mt-3 font-editorial text-[2.5rem] md:text-[3.25rem] leading-[1.04] tracking-tight text-balance text-paper-ink">
            {headline}
          </h1>
          {qualifier && (
            <p className="mt-3 text-body-sm leading-relaxed max-w-[56ch] text-paper-ink/80">
              {qualifier}
            </p>
          )}
          {sub && (
            <p className="mt-1.5 text-body-sm leading-relaxed max-w-[56ch] text-paper-soft">
              {sub}
            </p>
          )}
          {source && (
            <p className="mt-4 text-micro uppercase tracking-[0.14em] text-paper-soft truncate max-w-full">
              Based on{' '}
              <span className="font-semibold text-paper-ink">{source.name}</span>{' '}
              · {source.uploadedOn}
            </p>
          )}
          <button
            type="button"
            onClick={onPrimaryCTA}
            className="mt-6 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-clay text-paper text-caption font-semibold tracking-tight transition-colors duration-150 ease-in-out hover:bg-clay/90 whitespace-nowrap"
          >
            {ctaLabel}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Score panel — the oversized callout + custom split meter. A
            distinct sub-panel divided by a warm rule (top on mobile, left
            on desktop) so the asymmetry reads as intentional structure. */}
        {onTrackPct !== null && summary && (
          <div className="shrink-0 md:w-60 border-t md:border-t-0 md:border-l border-paper-line p-6 md:p-9 flex flex-col justify-center">
            <div className="flex items-baseline gap-1.5">
              <span className="font-editorial text-[5rem] md:text-[5.5rem] leading-[0.8] text-paper-ink">
                {onTrackPct}
              </span>
              <span className="font-editorial text-3xl leading-none text-paper-soft">
                %
              </span>
            </div>
            <div className="mt-1.5 text-micro uppercase tracking-[0.2em] font-semibold text-paper-soft">
              markers in range
            </div>

            <SplitMeter good={summary.good} total={summary.total} />

            <div className="mt-3.5 flex items-start gap-5">
              <Count value={summary.good} label="in range" tone="forest" />
              <Count
                value={summary.total - summary.good}
                label="to review"
                tone="clay"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Custom split meter — the in-range share (forest) butted against the
 * to-review share (terracotta) in one continuous bar, divided by a warm
 * hairline so the two zones read as a single split rather than a generic
 * progress fill. Domain-specific: it answers "how much of my panel is
 * clear" at a glance, and pairs with the mono counts below it.
 */
function SplitMeter({ good, total }: { good: number; total: number }) {
  const pct = total > 0 ? Math.round((good / total) * 100) : 0;
  return (
    <div
      role="img"
      aria-label={`${good} of ${total} markers in range`}
      className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full border border-paper-line"
    >
      <div className="h-full bg-forest" style={{ width: `${pct}%` }} />
      <div className="h-full flex-1 bg-clay" />
    </div>
  );
}

/**
 * A single dense count — the mono numeral deliberately small + tight
 * against the oversized serif score above it, the radical scale contrast
 * the identity leans on.
 */
function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'forest' | 'clay';
}) {
  return (
    <div>
      <div
        className={`font-mono tabular-nums text-body-lg font-semibold leading-none ${
          tone === 'forest' ? 'text-forest' : 'text-clay'
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-micro uppercase tracking-[0.14em] text-paper-soft">
        {label}
      </div>
    </div>
  );
}

/** Two short lines beat one long sentence under a glance-pace
 *  headline. `qualifier` carries the optional positive-trend clause
 *  (state A only); `sub` carries the count or tagline. */
type Copy = {
  eyebrow: string;
  headline: string;
  qualifier?: string;
  sub?: string;
  ctaLabel: string;
};

function pickCopy(markers: Biomarker[] | null, hasReport: boolean): Copy {
  // State C — no reports at all. Voice: direct and plain. Short sentences,
  // no rhetorical em-dash, no rule-of-three list — the generic-AI cadence
  // those produce is exactly what we're avoiding.
  if (!hasReport || !markers || markers.length === 0) {
    return {
      eyebrow: 'Start here',
      headline: 'Your blood test, in plain English.',
      sub: 'Upload a report. We flag what needs attention and track it every time you re-test.',
      ctaLabel: 'Upload a report',
    };
  }

  const summary = summarizeStatuses(markers);

  // State D — everything is green. Voice: celebrating without sounding
  // like a smug fitness app.
  if (summary.concern === 0 && summary.attention === 0) {
    return {
      eyebrow: 'All clear',
      headline: 'Everything’s in range.',
      sub: 'Re-check in 6 months to be sure.',
      ctaLabel: 'See all markers',
    };
  }

  // State A — at least one marker has 2+ readings, so we can lead with the
  // biggest change. Prefer the worst-declining marker; if none, mention an
  // improving one.
  const newsworthy = pickHeadlineMarker(markers);
  if (newsworthy) {
    const tone = getTrendTone(newsworthy);
    const prev = getPreviousValue(newsworthy);
    const delta = formatDelta(newsworthy);

    if (tone === 'declining' && prev !== undefined && delta) {
      const positive = markers
        .filter((m) => getTrendTone(m) === 'improving')
        .sort((a, b) => {
          const ap = Math.abs(a.value - (getPreviousValue(a) ?? 0));
          const bp = Math.abs(b.value - (getPreviousValue(b) ?? 0));
          return bp - ap;
        })[0];
      const positiveDelta = positive ? formatDelta(positive) : null;
      // The delta is computed against the MOST RECENT prior reading
      // (formatDelta → getPreviousValue → history[last]). The "since X"
      // date must reference that same reading, not history[0] — otherwise
      // "dropped 50 since Jan 2026" would describe a 5-month delta when
      // the actual change was measured against the March reading 6 weeks
      // ago. Clinical misrepresentation, not just a copy nit.
      const priorReadingDate =
        newsworthy.history?.[newsworthy.history.length - 1]?.date;
      const countLine = `${summary.needCare} marker${summary.needCare === 1 ? '' : 's'} still need${summary.needCare === 1 ? 's' : ''} care.`;
      return {
        eyebrow: `Since your last test`,
        headline: `Your ${newsworthy.name} dropped ${formatAbsDelta(newsworthy)} since ${formatRoughDate(priorReadingDate)}.`,
        qualifier:
          positive && positiveDelta
            ? `${positive.name} is ${positiveDelta.startsWith('-') ? 'down' : 'up'} ${stripSign(positiveDelta)} ${positive.unit}. That's working.`
            : undefined,
        sub: countLine,
        ctaLabel: 'See what needs attention',
      };
    }

    if (tone === 'improving' && delta) {
      return {
        eyebrow: 'Trending up',
        headline: `Your ${newsworthy.name} is up ${stripSign(delta)} ${newsworthy.unit}. That's working.`,
        sub: `${summary.needCare} marker${summary.needCare === 1 ? '' : 's'} still need${summary.needCare === 1 ? 's' : ''} care.`,
        ctaLabel: 'See what needs attention',
      };
    }
  }

  // State B — single report (no history we can compare against), but some
  // red markers exist. Count them, lead with the count.
  const flagged = summary.needCare + summary.attention;
  return {
    eyebrow: 'Your latest report',
    headline:
      summary.needCare > 0
        ? `${summary.needCare} marker${summary.needCare === 1 ? '' : 's'} need${summary.needCare === 1 ? 's' : ''} a closer look.`
        : `${flagged} markers to keep an eye on.`,
    sub: `${summary.good} of ${summary.total} markers in range.`,
    ctaLabel: 'See all markers',
  };
}

/* Helpers — kept local so the headline file owns its own copy logic. */

function formatAbsDelta(marker: Biomarker): string {
  const delta = formatDelta(marker);
  if (!delta) return '';
  return `${stripSign(delta)} ${marker.unit}`;
}

function stripSign(s: string): string {
  return s.replace(/^[+-]/, '');
}

function formatRoughDate(iso: string | undefined): string {
  if (!iso) return 'last time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'last time';
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
