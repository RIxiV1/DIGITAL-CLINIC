import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import ProgressRing from './ProgressRing';
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
 * Visual treatment: the "engineering monolith" language — structure over
 * decoration. A flat `bg-surface` panel bounded by a single hairline
 * (`border-line`), tight 8px radius, NO drop shadow and NO status-tinted
 * glow blob (both read as generated-SaaS chrome). Hierarchy is carried by
 * type, not effects: a tight-tracked sans headline (NOT the old Playfair
 * display face), an uppercase muted eyebrow, and the score set in
 * tabular monospace so the digits read as precise instrument data. Colour
 * is reserved for meaning — the score ring's track tints to the worst
 * status present; everything else stays neutral ink.
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

  // Two-tone ring: the un-filled remainder is tinted by the worst status,
  // not neutral grey — so a 72% green ring can't be misread as a passing
  // grade while markers still need attention. Green = in range, the rest
  // = the share that needs a look.
  const ringTrack = !summary
    ? 'stroke-line/50'
    : summary.concern > 0 || summary.critical > 0
      ? 'stroke-concern/40'
      : summary.attention > 0
        ? 'stroke-attention/40'
        : 'stroke-line/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg bg-surface border border-line p-6 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        {/* Text column — the narrative. */}
        <div className="order-2 md:order-1 flex-1 min-w-0">
          <div className="text-micro uppercase tracking-eyebrow font-semibold text-muted">
            {eyebrow}
          </div>
          <h1 className="mt-3 text-display-md lg:text-display-lg font-semibold tracking-tight leading-[1.1] text-balance text-ink">
            {headline}
          </h1>
          {qualifier && (
            <p className="mt-2 text-caption lg:text-body-sm text-ink-soft leading-relaxed max-w-[60ch]">
              {qualifier}
            </p>
          )}
          {sub && (
            <p className="mt-1 text-caption lg:text-body-sm text-muted leading-relaxed max-w-[60ch]">
              {sub}
            </p>
          )}
          {source && (
            <p className="mt-2.5 text-micro text-muted truncate max-w-full">
              Based on{' '}
              <span className="font-semibold text-ink-soft">{source.name}</span>{' '}
              · {source.uploadedOn}
            </p>
          )}
          <button
            type="button"
            onClick={onPrimaryCTA}
            className="mt-6 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-gold-500 hover:bg-gold-400 text-on-gold text-caption font-semibold transition-colors duration-150 ease-in-out whitespace-nowrap"
          >
            {ctaLabel}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Score ring — the visual anchor. Same "on-track" language as the
            Health Map. On mobile it leads (order-1) as the hero element;
            on desktop it anchors the right. */}
        {onTrackPct !== null && (
          <div className="order-1 md:order-2 shrink-0 flex flex-col items-start md:items-center gap-2 self-start md:self-center">
            <ProgressRing
              pct={onTrackPct}
              size={120}
              stroke={10}
              trackClass={ringTrack}
            >
              <div className="text-center leading-none">
                <span className="font-mono tabular-nums text-display-md font-semibold tracking-tight text-ink">
                  {onTrackPct}
                </span>
                <span className="font-mono text-body-sm text-muted align-top">
                  %
                </span>
                <div className="text-micro uppercase tracking-eyebrow font-semibold text-muted mt-1.5">
                  in range
                </div>
              </div>
            </ProgressRing>
            {summary && (
              <div className="text-caption text-muted">
                <span className="font-mono tabular-nums font-semibold text-ink-soft">
                  {summary.good}
                </span>{' '}
                of {summary.total} in a healthy range
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
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
