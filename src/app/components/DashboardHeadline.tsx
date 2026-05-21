import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  formatDelta,
  getPreviousValue,
  getTrendTone,
  pickHeadlineMarker,
  summarizeStatuses,
  type Biomarker,
} from '../data/biomarkers';
import HealthRing from './HealthRing';

type Props = {
  /** Markers from the latest analyzed report, or null/[] if none. */
  markers: Biomarker[] | null;
  /** Whether the user has ANY analyzed report. */
  hasReport: boolean;
  onPrimaryCTA: () => void;
};

function gradientForHour(h: number): string {
  if (h < 12) {
    // Morning — warm sunrise edge
    return 'linear-gradient(135deg, var(--color-indigo-700) 0%, var(--color-indigo-600) 45%, var(--color-gold-700) 100%)';
  }
  if (h < 18) {
    // Afternoon — confident brand indigo
    return 'linear-gradient(135deg, var(--color-indigo-700) 0%, var(--color-indigo-600) 60%, var(--color-blue-700) 100%)';
  }
  // Evening — cool, deep
  return 'linear-gradient(135deg, var(--color-indigo-900) 0%, var(--color-indigo-700) 55%, var(--color-blue-800) 100%)';
}

/** Time-of-day-aware gradient. Morning warms toward gold; afternoon is
 *  pure brand indigo; evening cools toward deep blue.
 *
 *  Recomputes once per hour while the page is open — without this, a
 *  user who opens the dashboard at 11:55am sees morning warmth past
 *  noon. The interval is light (one Date.getHours() check, ~no work)
 *  and is registered against the tab's wall clock so DST / sleep-wake
 *  don't desync it. */
function useGradientForTimeOfDay() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    // Check once a minute — cheap, and avoids the "user crossed an
    // hour boundary 59 minutes ago and the gradient is stale" race
    // that a longer interval would introduce.
    const id = window.setInterval(() => {
      const h = new Date().getHours();
      setHour((prev) => (prev === h ? prev : h));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => gradientForHour(hour), [hour]);
}

/**
 * Top-of-page headline per the dashboard brief.
 *
 * Four data-driven states:
 *   A. 2+ readings on at least one marker  → call out the biggest change
 *      (and add a positive trend if one exists)
 *   B. 1 report, some red markers          → "[N] markers need attention"
 *   C. 0 reports                           → "Upload your first report"
 *   D. all green                           → celebrate, recommend retest
 */
export default function DashboardHeadline({
  markers,
  hasReport,
  onPrimaryCTA,
}: Props) {
  const { eyebrow, headline, sub, ctaLabel } = pickCopy(markers, hasReport);
  const gradient = useGradientForTimeOfDay();
  const summary = markers && markers.length > 0 ? summarizeStatuses(markers) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-[24px] text-white p-6 lg:p-8 shadow-pop"
      style={{ background: gradient }}
    >
      <div className="relative grid lg:grid-cols-[1fr_auto] gap-5 lg:gap-8 lg:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-indigo-100">
            <Sparkles size={11} />
            {eyebrow}
          </div>
          <h1 className="mt-2.5 font-display text-[22px] sm:text-[26px] lg:text-[32px] leading-[1.15] text-balance">
            {headline}
          </h1>
          {sub && (
            <p className="mt-2 text-[13.5px] lg:text-[14.5px] text-indigo-100 leading-relaxed max-w-[60ch]">
              {sub}
            </p>
          )}
          <button
            type="button"
            onClick={onPrimaryCTA}
            className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-gold-500 hover:bg-gold-400 text-indigo-900 text-[13.5px] font-semibold shadow-soft transition-colors whitespace-nowrap"
          >
            {ctaLabel}
            <ArrowRight size={14} />
          </button>
        </div>

        {summary && (
          <div className="flex justify-center lg:justify-end">
            <HealthRing
              good={summary.good}
              attention={summary.attention}
              concern={summary.concern}
              size={160}
              thickness={12}
              tone="onDark"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function pickCopy(markers: Biomarker[] | null, hasReport: boolean) {
  // State C — no reports at all.
  if (!hasReport || !markers || markers.length === 0) {
    return {
      eyebrow: 'Get started',
      headline: 'Upload your first report to get your health snapshot.',
      sub: 'We translate the numbers into plain English, flag what matters, and track changes over time.',
      ctaLabel: 'Upload a report',
    };
  }

  const summary = summarizeStatuses(markers);

  // State D — everything is green.
  if (summary.concern === 0 && summary.attention === 0) {
    return {
      eyebrow: 'On track',
      headline: 'All markers on track. Keep doing what you’re doing.',
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

      return {
        eyebrow: `Since your last test`,
        headline: `Your ${newsworthy.name} dropped ${formatAbsDelta(newsworthy)} since ${formatRoughDate(newsworthy.history?.[0]?.date)}.`,
        sub: positive && positiveDelta
          ? `${positive.name} is ${positiveDelta.startsWith('-') ? 'down' : 'up'} ${stripSign(positiveDelta)} ${positive.unit} — that's working. ${summary.concern} marker${summary.concern === 1 ? '' : 's'} still need${summary.concern === 1 ? 's' : ''} attention.`
          : `${summary.concern} marker${summary.concern === 1 ? '' : 's'} still need${summary.concern === 1 ? 's' : ''} attention.`,
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
