import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
} from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Container from '../../components/Container';
import Logo from '../../components/Logo';
import Pill from '../../components/Pill';
import StickyBottomBar from '../../components/StickyBottomBar';
import {
  categories as biomarkerCategories,
  type Biomarker,
} from '../../data/biomarkers';
import { editStateOf, regradeMarker } from '../../utils/confirmEdits';
import { OCR_LOW_CONFIDENCE_THRESHOLD } from '../../services/pdfParser';
import SummaryChip from './SummaryChip';
import MarkerRow from './MarkerRow';

/* ================================================================== */
/* Inline confirm state — parser succeeded, user verifies before commit */
/* ================================================================== */

export default function ConfirmExtractedValuesView({
  biomarkers,
  fileName,
  rawText,
  unrecognizedRows,
  ignoredCategory,
  ocrPagesAttempted,
  ocrPagesSkipped,
  ocrConfidence,
  semenStandardMismatch,
  onConfirm,
  onReject,
}: {
  biomarkers: Biomarker[];
  fileName: string;
  rawText?: string;
  unrecognizedRows?: string[];
  ignoredCategory?: 'viral' | 'imaging' | 'physical-exam';
  ocrPagesAttempted?: number;
  ocrPagesSkipped?: number;
  ocrConfidence?: number;
  semenStandardMismatch?: boolean;
  /** Receives the confirmed markers — carrying any inline corrections the
   *  user made to fix an OCR misread. */
  onConfirm: (markers: Biomarker[]) => void;
  onReject: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  /* ---- Inline corrections ----
   * Client-side OCR can misread a decimal (0.8 → 8) or grab a reference-
   * range limit instead of the result. Rather than force a full re-upload
   * or hand-entry, each value is editable here: a corrected number is
   * re-graded in place (status, mini-range, and the verdict counts all
   * update live) and the corrected set is what gets committed. Keyed by
   * marker id; empty until the user actually edits something. */
  const [edits, setEdits] = useState<Record<string, string>>({});

  // The set we'd commit, and a lookup for live per-row display. Computed
  // each render (cheap) so edits reflect immediately; row ORDER stays
  // pinned to the original grouping below so a value never jumps out from
  // under the cursor mid-edit. editStateOf / regradeMarker live in
  // utils/confirmEdits.ts so the re-grade behaviour is unit-tested.
  const confirmedBiomarkers = biomarkers.map((m) =>
    regradeMarker(m, edits[m.id]),
  );
  const confirmedById = new Map(
    confirmedBiomarkers.map((m) => [m.id, m] as const),
  );

  // Status summary — four counts, recomputed off the corrected set so the
  // verdict tracks the user's edits in real time.
  const counts = (() => {
    let critical = 0;
    let concern = 0;
    let attention = 0;
    let good = 0;
    for (const m of confirmedBiomarkers) {
      if (m.status === 'critical') critical += 1;
      else if (m.status === 'concern') concern += 1;
      else if (m.status === 'attention') attention += 1;
      else good += 1;
    }
    return { critical, concern, attention, good };
  })();

  /** Per-category expansion mirrors the ReportResults pattern. Default-
   *  open: any category with a `critical` or `concern` marker.
   *  Everything else collapses on first paint so the user can scan
   *  category headers + the SummaryChips up top to verify "did we get
   *  the numbers right?" without staring at 30+ MarkerRows. */
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => {
      const initial = new Set<string>();
      for (const m of biomarkers) {
        if (m.status === 'critical' || m.status === 'concern') {
          initial.add(m.category);
        }
      }
      return initial;
    },
  );
  const toggleCategory = (id: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group by category in canonical order so the user reads the values
  // in the same sequence as the eventual report. Within each category,
  // sort by severity (concern → attention → good) so the markers that
  // need verification most appear at the top of every section.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Biomarker[]>();
    for (const m of biomarkers) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }
    const severityRank: Record<Biomarker['status'], number> = {
      critical: 0,
      concern: 1,
      attention: 2,
      good: 3,
    };
    return biomarkerCategories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({
        category: c,
        markers: (byCategory.get(c.id) ?? [])
          .slice()
          .sort((a, b) => severityRank[a.status] - severityRank[b.status]),
      }));
  }, [biomarkers]);

  return (
    <div className="min-h-dvh bg-canvas pb-36">
      <Container size="narrow" className="pt-6">
        <Logo />
      </Container>

      <Container size="wide" className="mt-6 md:mt-10">
        {/* ---- Hero ---- */}
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="gold" size="sm">
            <Check size={11} strokeWidth={3} /> Extraction complete
          </Pill>
          <h1 className="font-display text-display-md lg:text-display-lg leading-[1.05] mt-3 text-balance text-ink">
            {unrecognizedRows && unrecognizedRows.length > 0 ? (
              <>
                We read{' '}
                <span className="text-indigo-700">
                  {biomarkers.length + unrecognizedRows.length}
                </span>{' '}
                results — and interpret{' '}
                <span className="text-indigo-700">{biomarkers.length}</span> of
                them.
              </>
            ) : (
              <>
                We found{' '}
                <span className="text-indigo-700">{biomarkers.length}</span>{' '}
                {biomarkers.length === 1 ? 'value' : 'values'} in your report.
              </>
            )}
          </h1>
          <p className="mt-3 text-body-sm lg:text-body text-ink-soft text-pretty max-w-xl">
            Check each number against your report — and tap any value to fix it
            if we misread it. We deliberately only show what we could pull out;
            if a marker you expected isn’t listed, it wasn’t in our catalog or
            our parser couldn’t find a match.
          </p>

          {/* Status summary chips. Rendered ONLY when the category-card
              grid below would otherwise be empty (e.g., parser returned
              markers whose category IDs aren't in biomarkerCategories,
              so `grouped` is empty but `counts` is non-zero — an edge
              case, but real). In the normal case the category cards
              below already carry status via colored borders + per-card
              count pills, so showing chips here too is double-coding
              the same totals on the same screen. Single source of
              count signal in the dominant case; safety net in the
              degenerate one. */}
          {grouped.length === 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {counts.critical > 0 && (
                <SummaryChip
                  tone="critical"
                  count={counts.critical}
                  label="see a doctor"
                />
              )}
              {counts.concern > 0 && (
                <SummaryChip
                  tone="concern"
                  count={counts.concern}
                  label="need care"
                />
              )}
              {counts.attention > 0 && (
                <SummaryChip
                  tone="attention"
                  count={counts.attention}
                  label="to watch"
                />
              )}
              {counts.good > 0 && (
                <SummaryChip tone="good" count={counts.good} label="healthy" />
              )}
            </div>
          )}

          {/* File pill — replaces the bare "FILE filename" line. The
              card-shaped container gives the metadata real visual
              weight without making it compete with the headline. */}
          <div className="mt-5 inline-flex items-center gap-2.5 max-w-full pl-2.5 pr-3.5 py-2 rounded-[12px] bg-surface border border-line/70 shadow-soft">
            <div className="grid place-items-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
              <FileText size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-micro uppercase tracking-eyebrow font-bold text-muted leading-none">
                File parsed
              </div>
              <div className="mt-0.5 text-caption text-ink font-medium truncate">
                {fileName}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 lg:max-w-3xl lg:mx-auto grid gap-4">
          {/* Critical-tier callout — highest-priority banner. Appears
              when any marker landed in the 'critical' tier (severe
              hypoglycemia, potassium >6.0, platelet <50,000, etc.).
              Same-day-care copy supersedes the 12-week-plan tone we
              use elsewhere. */}
          {counts.critical > 0 && (
            <Card padded={false} className="overflow-hidden border-concern">
              <div className="px-5 py-4 bg-concern text-on-status flex items-start gap-3">
                <span aria-hidden role="img" className="text-body-lg leading-none">
                  🚨
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-body-sm leading-tight">
                    {(() => {
                      const names = biomarkers
                        .filter((m) => m.status === 'critical')
                        .map((m) => m.name);
                      return names.length === 1
                        ? `One reading needs same-day attention: ${names[0]}`
                        : `${names.length} readings need same-day attention: ${names.join(', ')}`;
                    })()}
                  </div>
                  <p className="mt-1 text-caption text-white/85 leading-relaxed">
                    These values are far enough outside the healthy range that
                    magnitude itself is a clinical signal. Don't wait for a
                    follow-up — contact a doctor today.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* WHO standard mismatch — surfaced when the report mentions
              WHO 2010 / 5th edition AND we matched a fertility marker.
              Our catalog uses WHO 2021 (6th edition) reference ranges;
              an older report's "Low / Borderline" verdicts may
              disagree with ours and the user deserves to know why. */}
          {semenStandardMismatch && (
            <Card padded={false} className="overflow-hidden border-indigo-200/70">
              <div className="px-5 py-4 bg-indigo-50/60 flex items-start gap-3">
                <span aria-hidden role="img" className="text-body-lg leading-none">
                  ℹ️
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-body-sm leading-tight">
                    Your report uses WHO 2010 reference ranges
                  </div>
                  <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                    We score semen-axis markers against the WHO 2021 (6th
                    edition) standard. Your lab's "Low / Borderline / Normal"
                    calls may disagree with ours — that's a real
                    reference-standard difference, not a parser bug. The numbers
                    are the numbers; the verdicts are where the standards
                    diverge.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* OCR skip banner — surfaces when Tesseract couldn't finish
              one or more pages (timeout or render failure). Without
              this, a partial result on a multi-page report looks
              complete and the user trusts a half-extraction. */}
          {ocrPagesAttempted &&
            ocrPagesSkipped !== undefined &&
            ocrPagesSkipped > 0 && (
              <Card padded={false} className="overflow-hidden border-attention/30">
                <div className="px-5 py-4 bg-attention-soft/50 flex items-start gap-3">
                  <span
                    aria-hidden
                    role="img"
                    className="text-body-lg leading-none"
                  >
                    ⚠️
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-body-sm leading-tight">
                      Some pages couldn’t be read
                    </div>
                    <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                      {ocrPagesSkipped} of {ocrPagesAttempted} page
                      {ocrPagesAttempted === 1 ? '' : 's'} failed during text
                      extraction (OCR timeout). Any values on those pages aren’t
                      in the list below. If the report looks short, try
                      re-uploading or use manual entry.
                    </p>
                  </div>
                </div>
              </Card>
            )}

          {/* Low-confidence OCR banner. When the report had no readable
              text layer we fall back to image OCR, which can misread
              digits and decimals (8↔3, 7.5↔75). Below the confidence
              threshold we can't vouch for the numbers, so we tell the
              user to verify against the original rather than presenting a
              shaky read as authoritative. */}
          {ocrConfidence !== undefined &&
            ocrConfidence <= OCR_LOW_CONFIDENCE_THRESHOLD && (
              <Card padded={false} className="overflow-hidden border-attention/30">
                <div className="px-5 py-4 bg-attention-soft/50 flex items-start gap-3">
                  <span
                    aria-hidden
                    role="img"
                    className="text-body-lg leading-none"
                  >
                    ⚠️
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-body-sm leading-tight">
                      Please double-check these values
                    </div>
                    <p className="mt-1 text-caption text-ink-soft leading-relaxed">
                      This file had no readable text, so we read it from the
                      image — and the scan quality was low. A few numbers may be
                      misread. Compare each value against your original report
                      before relying on it, or use manual entry to be sure.
                    </p>
                  </div>
                </div>
              </Card>
            )}

          {grouped.map(({ category, markers }) => {
            const open = expandedCategoryIds.has(category.id);
            return (
              <Card key={category.id} padded={false} className="overflow-hidden">
                {/* Tinted category header — clickable to toggle the
                    marker list. Default-open for categories with any
                    concern marker; collapsed otherwise. Icon badge +
                    description stay; existing count Pill + a chevron
                    on the right. */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={open}
                  aria-controls={`confirm-category-${category.id}`}
                  className={`w-full px-5 pt-4 pb-4 flex items-center gap-3 bg-indigo-50/50 text-left hover:bg-indigo-50/70 transition-colors ${
                    open ? 'border-b border-line/60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-body leading-tight text-ink">
                      {category.name}
                    </div>
                    <div className="text-caption text-muted mt-0.5 truncate">
                      {category.description}
                    </div>
                  </div>
                  <Pill tone="indigo" size="sm" className="shrink-0">
                    {markers.length} {markers.length === 1 ? 'value' : 'values'}
                  </Pill>
                  <ChevronDown
                    size={18}
                    className={`text-muted shrink-0 transition-transform duration-200 ${
                      open ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {open && (
                  <ul id={`confirm-category-${category.id}`}>
                    {markers.map((m, i) => {
                      const state = editStateOf(m, edits[m.id]);
                      return (
                        <MarkerRow
                          key={m.id}
                          // Re-graded marker drives the tint, status, and
                          // mini-range so they update live as the value is
                          // corrected; row order stays pinned to `markers`.
                          marker={confirmedById.get(m.id) ?? m}
                          inputValue={edits[m.id] ?? String(m.value)}
                          onValueChange={(v) =>
                            setEdits((prev) => ({ ...prev, [m.id]: v }))
                          }
                          invalid={state === 'empty' || state === 'out-of-range'}
                          hint={
                            state === 'out-of-range'
                              ? `Outside the plausible range (${m.min}–${m.max}${m.unit ? ` ${m.unit}` : ''}). Check for a typo or wrong unit.`
                              : state === 'empty'
                                ? 'Enter a number, or re-upload to start over.'
                                : undefined
                          }
                          showTopBorder={i > 0}
                        />
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}

          {/* "We ignored these sections" notice — appears when the
              upload bundles in-scope panels (CBC, hormones, …) with an
              out-of-scope panel (viral, imaging, dental). Without this,
              the dengue/X-ray rows would surface in the unrecognized-
              rows panel below as if the parser had missed them — but
              we deliberately don't analyze those sections. */}
          {ignoredCategory && (
            <Card padded={false} className="overflow-hidden border-indigo-200/70">
              <div className="px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50/40 flex items-center gap-2">
                <span aria-hidden role="img" className="text-body leading-none">
                  ℹ️
                </span>
                <div className="font-display text-body-sm leading-tight">
                  We ignored some sections of this report
                </div>
              </div>
              <div className="px-5 py-3">
                <p className="text-caption text-ink-soft leading-relaxed">
                  Your file also contained{' '}
                  <span className="font-semibold text-ink">
                    {ignoredCategory === 'viral'
                      ? 'infectious-disease / viral panel'
                      : ignoredCategory === 'imaging'
                        ? 'imaging or ECG'
                        : 'physical-exam'}{' '}
                    results
                  </span>
                  . Those aren’t part of the metabolic / HPA-axis analysis we
                  cover, so we didn’t try to interpret them. The values above
                  are everything we extracted from the in-scope sections.
                </p>
              </div>
            </Card>
          )}

          {/* Unrecognized-rows notice — diagnostic / power-user content,
              not action-driving. A user verifying their values cares
              about the marker grid above; the rows we couldn't map are
              informational (the difference between "your parser missed
              things" and "your lab uses markers we don't cover yet").
              Wrapped in `<details>` so the row list is collapsed by
              default — the header still shows the count, the body
              expands on intent. Mirrors the raw-text disclosure below. */}
          {unrecognizedRows && unrecognizedRows.length > 0 && (
            <Card padded={false} className="overflow-hidden border-amber-200/70">
              <details className="group">
                <summary className="cursor-pointer list-none px-5 pt-4 pb-3 bg-amber-50/40 flex items-center gap-2 hover:bg-amber-50/60 transition-colors">
                  <span aria-hidden role="img" className="text-body leading-none">
                    🔍
                  </span>
                  <div className="font-display text-body-sm leading-tight">
                    We saw these rows but couldn’t map them
                  </div>
                  <Pill tone="neutral" size="sm" className="ml-auto">
                    {unrecognizedRows.length}
                  </Pill>
                  <ChevronDown
                    size={16}
                    className="text-muted shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="px-5 py-3 border-t border-amber-100">
                  <p className="text-caption text-ink-soft leading-relaxed mb-2">
                    Your report mentioned these values, but they aren’t in our
                    catalog yet. Nothing was discarded — they just won’t appear
                    in the dashboard. If any of these look important to you, let
                    us know and we’ll add them.
                  </p>
                  <ul className="text-caption font-mono text-ink-soft space-y-1">
                    {unrecognizedRows.map((row, i) => (
                      <li key={`${row}-${i}`} className="break-words">
                        · {row}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </Card>
          )}

          {/* "Show what we read" diagnostic — useful for both the user
              (seeing whether OCR garbled values they care about) and
              for us debugging an off-by-one parse. Hidden by default so
              the success state stays tidy. */}
          {rawText && (
            <details
              className="mt-2 group"
              onToggle={(e) => setShowRaw(e.currentTarget.open)}
            >
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-caption font-bold uppercase tracking-label text-muted hover:text-ink transition-colors w-fit">
                {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Show what we read from the file
              </summary>
              <pre className="mt-3 p-3 bg-surface border border-line rounded-[12px] text-caption text-ink-soft leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto font-mono">
                {rawText.slice(0, 8000)}
                {rawText.length > 8000 && '\n…(truncated)'}
              </pre>
            </details>
          )}
        </div>
      </Container>

      {/* Sticky bottom CTAs. The previous layout used `flex-col-reverse
          sm:flex-row items-stretch` with both buttons stretching to
          half-width on sm+, which crammed the long-copy secondary
          ("Wrong file — start over") into a 3-line wrap on narrow
          desktop containers. New layout: secondary becomes an icon-
          only button on mobile and a compact pill on sm+, primary
          dominates as flex-1 so it always reads in one line. */}
      <StickyBottomBar bordered>
        <Container size="narrow">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={onReject}
              aria-label="Wrong file — start over"
              title="Wrong file — start over"
              className="shrink-0 inline-flex items-center gap-1.5 h-14 px-4 sm:px-5 rounded-[14px] bg-surface border border-line text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 text-body-sm font-semibold shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Re-upload</span>
            </button>
            <Button
              size="lg"
              variant="primary"
              trailing={<ArrowRight size={18} />}
              onClick={() => onConfirm(confirmedBiomarkers)}
              fullWidth
            >
              Looks right — see my report
            </Button>
          </div>
        </Container>
      </StickyBottomBar>
    </div>
  );
}
