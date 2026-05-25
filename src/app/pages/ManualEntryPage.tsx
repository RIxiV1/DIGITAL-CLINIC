import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Pencil, Plus } from 'lucide-react';
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
  markerFromTemplate,
  type Biomarker,
  type BiomarkerCategoryId,
  type BiomarkerTemplate,
} from '../data/biomarkers';
import type { Report } from '../data/reports';
import { formatDate } from '../utils/uiUtils';

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
 * Design constraints:
 *   - The catalog has 60+ markers; showing every input at once is
 *     overwhelming. The form groups by category and starts with the
 *     three most commonly-asked categories expanded (Metabolic, Heart,
 *     Vitamins). Others collapse so the page reads as scannable
 *     section headers.
 *   - We never persist empty values — only what the user typed
 *     produces Biomarkers in the resulting report.
 *   - Sanity bound (5x beyond healthy span) drops obvious typos
 *     before they hit the report, mirroring the parser's behavior.
 */

const INITIALLY_EXPANDED: ReadonlyArray<BiomarkerCategoryId> = [
  'metabolic',
  'heart',
  'vitamins',
];

export default function ManualEntryPage() {
  const { navigate, replace } = useNavigation();
  const { addReport } = useReports();

  const [values, setValues] = useState<Record<string, string>>({});
  const [reportName, setReportName] = useState('My lab report');
  const [expanded, setExpanded] = useState<Set<BiomarkerCategoryId>>(
    new Set(INITIALLY_EXPANDED),
  );
  /** Set on save() when the user typed values but every one of them was
   *  out of range — cleared when they edit any input. Prevents the
   *  silent-drop confusion where the save button does nothing because
   *  buildBiomarkers returned []. */
  const [saveError, setSaveError] = useState<string | null>(null);

  // Group catalog by category, in canonical category order.
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

  const updateValue = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    // Editing any input means the previous "everything was out of
    // range" verdict is stale — clear it so the user isn't yelled at
    // for a number they're currently fixing.
    if (saveError) setSaveError(null);
  };

  const toggleCategory = (id: BiomarkerCategoryId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const filledCount = Object.values(values).filter((v) => v.trim() !== '').length;

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
    const now = new Date();
    const report: Report = {
      id: `rep-${Math.random().toString(36).slice(2, 8)}`,
      name: reportName.trim() || 'My lab report',
      lab: 'Manual entry',
      uploadedOn: formatDate(now),
      uploadedAt: now.toISOString().slice(0, 10),
      status: 'ready',
      badge: 'analyzed',
      biomarkers: validBiomarkers,
    };
    addReport(report);
    replace({ type: 'results', reportId: report.id });
  };

  return (
    <div className="min-h-dvh pb-32 bg-canvas">
      <Header variant="page" title="Enter values manually" />

      <Container size="wide" className="pt-5 md:pt-8">
        <div className="lg:max-w-3xl md:mx-auto">
          <Pill tone="indigo" size="sm">
            <Pencil size={11} /> Manual entry
          </Pill>
          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-3 text-balance text-ink">
            Type in the values you have.
          </h1>
          <p className="mt-2 text-body-sm lg:text-body text-ink-soft text-pretty">
            Skip anything that wasn’t in your report — we’ll only show what
            you enter. Numbers outside reasonable ranges are dropped
            automatically to catch typos.
          </p>

          {/* Optional report-name input. Empty falls back to "My lab
              report" at save time. */}
          <div className="mt-5">
            <label
              htmlFor="report-name"
              className="block text-micro font-bold uppercase tracking-[0.14em] text-indigo-700 mb-1.5"
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

        <div className="mt-6 lg:max-w-3xl md:mx-auto grid gap-4">
          {grouped.map(({ category, templates }) => {
            const isOpen = expanded.has(category.id);
            const filledInCategory = templates.filter(
              (t) => (values[t.id] ?? '').trim() !== '',
            ).length;
            return (
              <Card key={category.id} padded={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-5 py-4 border-b border-line/70 hover:bg-canvas/60 transition-colors"
                >
                  <span
                    aria-label={category.name}
                    role="img"
                    className="text-body-lg leading-none shrink-0"
                  >
                    {category.icon}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-display text-body leading-tight">
                      {category.name}
                    </div>
                    <div className="text-caption text-muted mt-0.5 truncate">
                      {category.description}
                    </div>
                  </div>
                  <Pill tone={filledInCategory > 0 ? 'good' : 'neutral'} size="sm">
                    {filledInCategory}/{templates.length}
                  </Pill>
                  <span
                    aria-hidden
                    className={`text-muted shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <Plus size={16} />
                  </span>
                </button>
                {isOpen && (
                  <div className="divide-y divide-line/60">
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
                )}
              </Card>
            );
          })}
        </div>
      </Container>

      {/* Sticky bottom CTA — counts entered values so the user knows
          what the save will produce. Disabled until they've typed at
          least one. */}
      <StickyBottomBar bordered>
        <Container size="narrow">
          {saveError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-[14px] bg-concern-soft border border-concern/30 px-3.5 py-2.5 text-caption text-concern leading-relaxed"
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-stretch gap-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate({ type: 'upload' })}
              responsiveFullWidth
            >
              Try uploading instead
            </Button>
            <Button
              size="lg"
              variant="primary"
              trailing={<ArrowRight size={18} />}
              onClick={save}
              disabled={filledCount === 0}
              fullWidth
            >
              {filledCount === 0
                ? 'Enter at least one value'
                : `See my report (${validCount} value${validCount === 1 ? '' : 's'})`}
            </Button>
          </div>
        </Container>
      </StickyBottomBar>
    </div>
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
