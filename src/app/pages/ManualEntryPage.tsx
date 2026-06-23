import { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Pencil, Search, X } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import StickyBottomBar from '../components/StickyBottomBar';
import { useNavigation, useReports } from '../AppContext';
import {
  biomarkerCatalog,
  categories as biomarkerCategories,
  deriveComputedMarkers,
  markerFromTemplate,
  type Biomarker,
  type BiomarkerCategoryId,
  type BiomarkerTemplate,
} from '../data/biomarkers';
import { makeReportId, type Report } from '../data/reports';
import { formatDate } from '../utils/uiUtils';
import { sanitizeFilename } from '../utils/sanitizeFilename';

/**
 * Returns 'out-of-range' when the typed value is beyond the parser's
 * 5x sanity span (and would silently be dropped by buildBiomarkers),
 * 'empty' for blank or non-numeric input, 'ok' otherwise. The 5x
 * threshold mirrors extractMarkerValue in pdfParser.ts so the manual
 * path enforces the same correctness floor.
 */
type EntryState = 'ok' | 'empty' | 'out-of-range';
function entryState(t: BiomarkerTemplate, raw: string): EntryState {
  const trimmed = raw.trim();
  if (!trimmed) return 'empty';
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) return 'empty';
  const span = t.max - t.min || 1;
  if (num < t.min - 5 * span || num > t.max + 5 * span) return 'out-of-range';
  return 'ok';
}

/**
 * Manual entry — the typing-it-in fallback for users whose lab PDF the
 * parser couldn't read, or who'd rather just enter the handful of
 * values they care about.
 *
 * Previous version put every category behind a collapsible accordion
 * with three default-open. That made sense for "discovery" but the
 * actual user here is *transcribing* — they have a report in hand and
 * know which markers exist on it. Speed beats discovery: forcing a
 * tap-to-expand on every category they want to fill is friction.
 *
 * New layout:
 *   - Sticky search input at the top. Filters across all categories
 *     by name AND alias (so "TSH" matches "Thyroid Stimulating
 *     Hormone"). Live, deferred for snappy typing.
 *   - Continuous scroll, no accordions. Every input row is reachable
 *     by scrolling — no click before typing.
 *   - Sticky section headers so the user always knows which category
 *     they're in while scanning.
 *   - Empty-matches card when the search returns zero.
 *   - Bottom bar uses `solid` so the gradient fade doesn't bleed over
 *     white input rows. `bordered` for the hard top edge.
 *
 * Sanity bound (5x beyond healthy span) still drops obvious typos
 * before they hit the report.
 */

export default function ManualEntryPage() {
  const { navigate, replace } = useNavigation();
  const { addReport } = useReports();

  const [values, setValues] = useState<Record<string, string>>({});
  const [reportName, setReportName] = useState('My lab report');
  const [searchQuery, setSearchQuery] = useState('');
  /** Category filter. The fallback's biggest friction is landing on ~80
   *  markers across 11 categories when you only need one panel's worth
   *  (e.g. a CBC = ~13). Tapping a category chip collapses the form to
   *  just that category; 'all' shows everything. Composes with search. */
  const [activeCategory, setActiveCategory] = useState<
    BiomarkerCategoryId | 'all'
  >('all');
  /** Defer the query so typing stays snappy on phones — the filtered
   *  list re-renders against a slightly stale value while the user is
   *  mid-keystroke. */
  const deferredQuery = useDeferredValue(searchQuery);
  /** Set on save() when the user typed values but every one of them was
   *  out of range — cleared when they edit any input. Prevents the
   *  silent-drop confusion where the save button does nothing because
   *  buildBiomarkers returned []. */
  const [saveError, setSaveError] = useState<string | null>(null);

  // Group catalog by category, in canonical category order. Computed
  // once — the catalog is static.
  const grouped = useMemo(() => {
    const byCategory = new Map<BiomarkerCategoryId, BiomarkerTemplate[]>();
    for (const t of biomarkerCatalog) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }
    return biomarkerCategories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ category: c, templates: byCategory.get(c.id) ?? [] }));
  }, []);

  /** Filtered view, by category chip THEN search query. Category filter
   *  narrows to a single panel; the query then matches templates whose
   *  name OR any alias contains it (case-insensitive). Categories whose
   *  templates all filter out are dropped. */
  const filteredGrouped = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return grouped
      .filter(
        ({ category }) =>
          activeCategory === 'all' || category.id === activeCategory,
      )
      .map(({ category, templates }) => ({
        category,
        templates: q
          ? templates.filter((t) => {
              if (t.name.toLowerCase().includes(q)) return true;
              for (const alias of t.aliases) {
                if (alias.toLowerCase().includes(q)) return true;
              }
              return false;
            })
          : templates,
      }))
      .filter(({ templates }) => templates.length > 0);
  }, [grouped, deferredQuery, activeCategory]);

  const hasSearchTerm = deferredQuery.trim().length > 0;
  const noMatches = hasSearchTerm && filteredGrouped.length === 0;

  const updateValue = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    // Editing any input means the previous "everything was out of
    // range" verdict is stale — clear it so the user isn't yelled at
    // for a number they're currently fixing.
    if (saveError) setSaveError(null);
  };

  // Convert the typed values into a Biomarker[]. Skips empty / NaN /
  // wildly-out-of-range entries silently — typos get dropped rather
  // than producing a "Hemoglobin 1500 g/dL" tier=critical card.
  const validBiomarkers = useMemo((): Biomarker[] => {
    const out: Biomarker[] = [];
    for (const t of biomarkerCatalog) {
      const raw = values[t.id]?.trim();
      if (!raw) continue;
      const num = parseFloat(raw);
      if (Number.isNaN(num)) continue;
      const span = t.max - t.min || 1;
      if (num < t.min - 5 * span || num > t.max + 5 * span) continue;
      out.push(markerFromTemplate(t, num));
    }
    return out;
  }, [values]);

  const validCount = validBiomarkers.length;
  const filledCount = Object.values(values).filter(
    (v) => v.trim() !== '',
  ).length;

  const save = () => {
    if (validBiomarkers.length === 0) {
      // Were any non-empty values typed at all? If yes, every one was
      // dropped by the sanity bound — tell the user instead of letting
      // the disabled-button heuristic silently swallow the click.
      const typedAny = Object.values(values).some((v) => v.trim() !== '');
      if (typedAny) {
        setSaveError(
          'Every value you entered is outside reasonable clinical bounds. Please check for typos before continuing.',
        );
      }
      return;
    }
    // uploadedAt makes the manual report a first-class citizen of the
    // history-merge pipeline — without it, a user who manually enters
    // values then later uploads a real PDF wouldn't see any trend
    // because mergeHistoryFromPriorReports skips reports without an
    // ISO date.
    // Sanitize user-typed name through the same gate uploads use: cap
    // length, strip control / bidi / HTML-suspicious chars, collapse
    // whitespace. Without this a 250-char paste survives in memory but
    // fails ReportSchema.name.max(200) on next app boot — the tolerant
    // loader would drop only this report, but the user would silently
    // lose their manual entry after a refresh.
    const safeName = sanitizeFilename(
      reportName.trim() || 'My lab report',
      200,
    );
    const now = new Date();
    const report: Report = {
      id: makeReportId(),
      name: safeName,
      lab: 'Manual entry',
      uploadedOn: formatDate(now),
      uploadedAt: now.toISOString().slice(0, 10),
      status: 'ready',
      badge: 'analyzed',
      // Run through the shared derivation step so a manually-entered
      // Total T + SHBG (or glucose + insulin) yields calculated free-T /
      // HOMA-IR, exactly like the PDF and AI paths. Derived markers are
      // appended here (not in validBiomarkers) so the entry-count UI keeps
      // reflecting what the user actually typed.
      biomarkers: deriveComputedMarkers(validBiomarkers),
    };
    addReport(report);
    replace({ type: 'results', reportId: report.id });
  };

  return (
    <div className="min-h-dvh pb-32 bg-canvas">
      <Header variant="page" title="Enter values manually" />

      <Container size="wide" className="pt-5 md:pt-8">
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="indigo" size="sm">
            <Pencil size={11} /> Manual entry
          </Pill>
          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-3 text-balance text-ink">
            Type in the values you have.
          </h1>
          <p className="mt-2 text-body-sm lg:text-body text-ink-soft text-pretty">
            Skip anything that wasn’t in your report — we’ll only show what you
            enter. Numbers outside reasonable ranges are dropped automatically
            to catch typos.
          </p>

          {/* Optional report-name input. Empty falls back to "My lab
              report" at save time. */}
          <div className="mt-5">
            <label
              htmlFor="report-name"
              className="block text-micro font-bold uppercase tracking-label text-indigo-700 mb-1.5"
            >
              Report name (optional)
            </label>
            <input
              id="report-name"
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="My lab report"
              className="w-full h-12 px-4 rounded-[14px] bg-surface border border-line text-body-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
            />
          </div>
        </div>
      </Container>

      {/* Sticky search bar. Sits below the page Header (h-14 / h-16)
          and stays visible while the user scrolls the long form. The
          bg-canvas wrapper occludes content scrolling past underneath
          so the input doesn't visually bleed into the form rows. The
          padding adds breathing room around the input as it sticks. */}
      <div className="sticky top-14 lg:top-16 z-20 bg-canvas">
        <Container size="wide" className="pt-3 pb-3">
          <div className="lg:max-w-3xl lg:mx-auto relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              // `type="text"` not "search" so WebKit doesn't render its
              // own cancel button next to our custom X (would be a
              // double-X in Safari/Chrome).
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search markers — TSH, glucose, vitamin D…"
              aria-label="Search markers by name or alias"
              className="w-full h-12 pl-10 pr-12 rounded-[14px] bg-surface border border-line text-body-sm placeholder:text-muted text-ink focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-12 h-12 rounded-full text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Container>
      </div>

      {/* Category filter chips. The fallback's biggest friction is
          hunting through ~80 markers for the ~13 on your report; tapping
          a category collapses the form to just that panel. Horizontally
          scrollable; composes with the search above. Non-sticky on
          purpose — once a category is picked the list is short, so the
          chips stay within easy reach near the top. */}
      <Container size="wide" className="pt-1 pb-1">
        <div
          className="lg:max-w-3xl lg:mx-auto flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter markers by category"
        >
          <CategoryChip
            label="All"
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {grouped.map(({ category }) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
        </div>
      </Container>

      <Container size="wide" className="pb-6">
        {noMatches ? (
          <div className="lg:max-w-3xl lg:mx-auto mt-4">
            <Card className="text-center !py-10">
              <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
                <Search size={20} />
              </div>
              <div className="font-display text-display-md">
                Nothing matched.
              </div>
              <p className="text-caption text-ink-soft mt-2 max-w-sm mx-auto leading-relaxed">
                No marker in our catalog matches{' '}
                <span className="font-semibold text-ink">
                  “{deferredQuery.trim()}”
                </span>
                . Try a shorter term or a common abbreviation.
              </p>
              <div className="mt-5 flex justify-center">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="lg:max-w-3xl lg:mx-auto">
            {filteredGrouped.map(({ category, templates }) => {
              const filledInCategory = templates.filter(
                (t) => (values[t.id] ?? '').trim() !== '',
              ).length;
              return (
                <section key={category.id} className="mt-2 first:mt-0">
                  {/* Sticky section header — sits below the page Header
                      and the search bar. The bg-canvas occlusion lets
                      the form rows scroll past beneath without bleeding
                      through the header. Border-bottom anchors the
                      header visually to the rows it labels. */}
                  <div className="sticky top-[6.5rem] lg:top-[7.5rem] z-10 bg-canvas pt-1 pb-2">
                    <div className="flex items-center gap-3 border-b border-line/70 pb-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-body leading-tight">
                          {category.name}
                        </div>
                      </div>
                      <Pill
                        tone={filledInCategory > 0 ? 'good' : 'neutral'}
                        size="sm"
                        className="shrink-0"
                      >
                        {filledInCategory}/{templates.length}
                      </Pill>
                    </div>
                  </div>
                  <div className="mt-2 bg-surface rounded-[14px] border border-line/70 overflow-hidden divide-y divide-line/60">
                    {templates.map((t) => (
                      <MarkerInputRow
                        key={t.id}
                        template={t}
                        value={values[t.id] ?? ''}
                        state={entryState(t, values[t.id] ?? '')}
                        onChange={(v) => updateValue(t.id, v)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Container>

      {/* Sticky bottom CTA — counts entered values so the user knows
          what the save will produce. When some typed values are
          out-of-range, the warning row spells out exactly how many
          will be excluded BEFORE the user clicks — otherwise the
          row-level red tint is easy to miss when scrolling and the
          save silently drops 3 of 5. `solid` swaps the default top-
          fading gradient for an opaque `bg-canvas`: without it, the
          gradient lets the white input rows above bleed through and
          the CTAs read as floating mid-page. */}
      <StickyBottomBar bordered solid>
        <Container size="narrow">
          {saveError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-[14px] bg-concern-soft border border-concern/30 px-3.5 py-2.5 text-caption text-concern leading-relaxed"
            >
              <AlertTriangle
                size={14}
                className="shrink-0 mt-0.5"
                aria-hidden
              />
              <span>{saveError}</span>
            </div>
          )}
          {filledCount > validCount && (
            <div
              role="status"
              aria-live="polite"
              className="mb-3 flex items-start gap-2 rounded-[14px] bg-attention-soft border border-attention/30 px-3.5 py-2.5 text-caption text-attention leading-relaxed"
            >
              <AlertTriangle
                size={14}
                className="shrink-0 mt-0.5"
                aria-hidden
              />
              <span>
                {filledCount - validCount} value
                {filledCount - validCount === 1 ? ' is' : 's are'} outside the
                plausible range and{' '}
                {filledCount - validCount === 1 ? "won't" : "won't"} be saved.
                Fix or clear {filledCount - validCount === 1 ? 'it' : 'them'}{' '}
                above to include{' '}
                {filledCount - validCount === 1 ? 'it' : 'them'}.
              </span>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate({ type: 'upload' })}
              className="w-full sm:w-auto shrink-0"
            >
              Try uploading instead
            </Button>
            <Button
              size="lg"
              variant="primary"
              trailing={<ArrowRight size={18} />}
              onClick={save}
              disabled={validCount === 0}
              className="w-full sm:flex-1"
            >
              {filledCount === 0
                ? 'Enter at least one value'
                : validCount === 0
                  ? 'Fix at least one value to continue'
                  : filledCount > validCount
                    ? `See my report (${validCount} of ${filledCount} values)`
                    : `See my report (${validCount} value${validCount === 1 ? '' : 's'})`}
            </Button>
          </div>
        </Container>
      </StickyBottomBar>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category filter chip                                                 */
/* ------------------------------------------------------------------ */

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 h-9 px-3.5 rounded-full text-caption font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
        active
          ? 'bg-indigo-600 text-on-primary'
          : 'bg-surface border border-line text-ink-soft hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Single marker input row                                              */
/* ------------------------------------------------------------------ */

function MarkerInputRow({
  template,
  value,
  state,
  onChange,
}: {
  template: BiomarkerTemplate;
  value: string;
  state: EntryState;
  onChange: (next: string) => void;
}) {
  const id = `entry-${template.id}`;
  const isOOR = state === 'out-of-range';
  // Cheap helper text — the user often doesn't remember the unit if
  // they're typing from a screenshot, so showing the expected band
  // closes the loop without us having to compute a "did you mean".
  const oorHint = isOOR
    ? `Outside the plausible range (${template.min}-${template.max}${
        template.unit ? ' ' + template.unit : ''
      }). Check for a typo or wrong unit.`
    : null;
  return (
    <div
      className={`px-5 py-3 flex items-start gap-3 ${
        isOOR ? 'bg-concern-soft/30' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-caption font-semibold text-ink leading-tight"
        >
          {template.name}
        </label>
        <div className="text-caption text-muted mt-0.5">
          Reference {template.min}–{template.max}
          {template.unit ? ` ${template.unit}` : ''}
        </div>
        {oorHint && (
          <div
            id={`${id}-error`}
            className="mt-1 text-caption text-concern font-medium leading-snug"
          >
            {oorHint}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          aria-label={`${template.name}${template.unit ? ' in ' + template.unit : ''}`}
          aria-invalid={isOOR ? true : undefined}
          aria-describedby={isOOR ? `${id}-error` : undefined}
          className={`w-24 h-11 px-3 text-right text-body-sm tabular-nums rounded-[12px] focus:outline-none focus:ring-2 ${
            isOOR
              ? 'bg-concern-soft border border-concern/60 text-concern focus:ring-concern/40 focus:border-concern'
              : 'bg-surface border border-line focus:ring-indigo-400/60 focus:border-indigo-400'
          }`}
        />
        {template.unit && (
          <span className="text-caption text-muted w-14 shrink-0">
            {template.unit}
          </span>
        )}
      </div>
    </div>
  );
}
