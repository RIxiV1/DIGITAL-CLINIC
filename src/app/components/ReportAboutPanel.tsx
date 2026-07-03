import { ChevronRight } from 'lucide-react';
import {
  REPORT_LIMITATIONS,
  REPORT_LIMITATIONS_SOURCES,
  CRITICAL_LIMITATION_CAVEAT,
  HOW_WE_READ,
} from '../clinical';

/**
 * "About these results" — one calm, collapsed reveal holding both the limits
 * of a single report (over-trust guard) and how we read it (skeptic/doctor
 * trust). Extracted from ReportResultsPage to keep that page from sprawling;
 * it's self-contained and reads its content straight from the clinical layer.
 *
 * Native <details> keeps it accessible and zero-JS; collapsed by default so
 * at rest the user sees one quiet line, not a meta pile-up.
 */
export default function ReportAboutPanel({
  hasCritical,
}: {
  hasCritical: boolean;
}) {
  return (
    <details className="mt-3 group rounded-xl border border-line/70 bg-surface/60">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-caption font-semibold text-ink-soft select-none">
        <ChevronRight
          size={15}
          className="text-muted shrink-0 transition-transform group-open:rotate-90"
          aria-hidden
        />
        About these results
      </summary>
      <div className="border-t border-line/60 divide-y divide-line/60">
        {/* What a single report can't tell you — over-trust limits. */}
        <section className="px-4 py-4">
          <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
            What a single report can’t tell you
          </div>
          <div className="mt-2 space-y-3">
            {/* Critical-aware fence: a same-day-care result must not be
                softened by the false-positive framing below. */}
            {hasCritical && (
              <p className="rounded-lg border border-concern/40 bg-concern-soft/50 px-3 py-2 text-caption font-medium leading-snug text-concern-ink">
                {CRITICAL_LIMITATION_CAVEAT}
              </p>
            )}
            {REPORT_LIMITATIONS.map((l) => (
              <div key={l.title}>
                <div className="text-caption font-semibold text-ink">
                  {l.title}
                </div>
                <p className="mt-0.5 text-caption leading-snug text-ink-soft">
                  {l.body}
                </p>
              </div>
            ))}
            <p className="text-micro text-muted leading-snug">
              Sources:{' '}
              {REPORT_LIMITATIONS_SOURCES.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ' · '}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 decoration-indigo-300 hover:text-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded-sm"
                  >
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* How we read your report — visible method (skeptic/doctor). */}
        <section className="px-4 py-4">
          <div className="text-micro font-bold uppercase tracking-label text-indigo-700">
            How we read your report
          </div>
          <ol className="mt-2 space-y-3">
            {HOW_WE_READ.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span
                  className="font-display text-indigo-700 text-body-lg leading-none shrink-0 w-5 tabular-nums"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <div className="text-caption font-semibold text-ink">
                    {s.title}
                  </div>
                  <p className="mt-0.5 text-caption leading-snug text-ink-soft">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </details>
  );
}
