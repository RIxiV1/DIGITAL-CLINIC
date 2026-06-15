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
 * Visual treatment: a premium, dark-native elevated card — NOT the old
 * time-of-day gradient, which rebound to a washed-out pastel banner in
 * dark theme and read like generic SaaS chrome against the dark cards
 * below it. The card now sits on `bg-surface` like the rest of the page,
 * lifted by a soft status-tinted glow (the only colour, and it MEANS
 * something — warm when markers need care, calm indigo when on track)
 * and a slim on-track bar that echoes the Health Map's score language.
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

  // Glow tint follows the worst status present — the card's one colour
  // carries meaning instead of decoration. No report yet → calm indigo.
  const glow =
    !summary || summary.concern > 0 || summary.critical > 0
      ? summary && (summary.concern > 0 || summary.critical > 0)
        ? 'bg-concern/15'
        : 'bg-indigo-500/15'
      : summary.attention > 0
        ? 'bg-attention/15'
        : 'bg-good/15';

  const onTrackPct =
    summary && summary.total > 0
      ? Math.round((summary.good / summary.total) * 100)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-[28px] bg-surface border border-line/70 p-6 md:p-8 shadow-pop"
    >
      {/* Soft status-tinted glow — the card's only colour, and it means
          something. Sits behind the content, never intercepts taps. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full blur-3xl ${glow}`}
      />

      <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        {/* Text column — the narrative. */}
        <div className="order-2 md:order-1 flex-1 min-w-0">
          <div className="text-micro uppercase tracking-eyebrow font-bold text-indigo-600">
            {eyebrow}
          </div>
          <h1 className="mt-2.5 font-display text-display-md lg:text-display-lg leading-[1.12] text-balance text-ink">
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
            className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-gold-500 hover:bg-gold-400 text-indigo-900 text-caption font-semibold shadow-soft transition-colors whitespace-nowrap"
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
            <ProgressRing pct={onTrackPct} size={120} stroke={10}>
              <div className="text-center leading-none">
                <span className="font-display text-display-md text-ink">
                  {onTrackPct}
                </span>
                <span className="font-display text-body-sm text-muted align-top">
                  %
                </span>
                <div className="text-micro uppercase tracking-eyebrow font-bold text-muted mt-1.5">
                  on track
                </div>
              </div>
            </ProgressRing>
            {summary && (
              <div className="text-caption text-muted">
                <span className="font-semibold text-ink-soft">
                  {summary.good}
                </span>{' '}
                of {summary.total} markers
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
  // State C — no reports at all. Voice: warm, specific, matches the
  // landing page's "your X, your Y, your Z" register rather than the
  // flat-clinical "Upload your first report to get your health snapshot"
  // it used to say.
  if (!hasReport || !markers || markers.length === 0) {
    return {
      eyebrow: 'Get started',
      headline: 'Drop in a report — we’ll translate the numbers.',
      sub: 'Plain English, what matters flagged, and we’ll track the trend the next time you test.',
      ctaLabel: 'Upload a report',
    };
  }

  const summary = summarizeStatuses(markers);

  // State D — everything is green. Voice: celebrating without sounding
  // like a smug fitness app.
  if (summary.concern === 0 && summary.attention === 0) {
    return {
      eyebrow: 'On track',
      headline: 'Everything’s in range. Whatever you’re doing — keep going.',
      sub: 'Re-test in 6 months to confirm the trend holds.',
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
      const countLine = `${summary.concern} marker${summary.concern === 1 ? '' : 's'} still need${summary.concern === 1 ? 's' : ''} attention.`;
      return {
        eyebrow: `Since your last test`,
        headline: `Your ${newsworthy.name} dropped ${formatAbsDelta(newsworthy)} since ${formatRoughDate(priorReadingDate)}.`,
        qualifier:
          positive && positiveDelta
            ? `${positive.name} is ${positiveDelta.startsWith('-') ? 'down' : 'up'} ${stripSign(positiveDelta)} ${positive.unit} — that's working.`
            : undefined,
        sub: countLine,
        ctaLabel: 'See what needs attention',
      };
    }

    if (tone === 'improving' && delta) {
      return {
        eyebrow: 'Trending up',
        headline: `Your ${newsworthy.name} is up ${stripSign(delta)} ${newsworthy.unit} — that's working.`,
        sub: `${summary.concern} marker${summary.concern === 1 ? '' : 's'} still need${summary.concern === 1 ? 's' : ''} attention.`,
        ctaLabel: 'See what needs attention',
      };
    }
  }

  // State B — single report (no history we can compare against), but some
  // red markers exist. Count them, lead with the count.
  const flagged = summary.concern + summary.attention;
  return {
    eyebrow: 'Your latest report',
    headline:
      summary.concern > 0
        ? `${summary.concern} marker${summary.concern === 1 ? '' : 's'} need${summary.concern === 1 ? 's' : ''} attention — here's where to start.`
        : `${flagged} markers worth a closer look.`,
    sub: `${summary.good} of ${summary.total} markers on track. ${summary.attention > 0 ? `${summary.attention} borderline · ` : ''}${summary.concern > 0 ? `${summary.concern} need${summary.concern === 1 ? 's' : ''} care.` : ''}`,
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
