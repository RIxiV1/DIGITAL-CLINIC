import { useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
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
  const buildBiomarkers = (): Biomarker[] => {
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
  };

  const filledCount = Object.values(values).filter((v) => v.trim() !== '').length;

  const save = () => {
    const biomarkers = buildBiomarkers();
    if (biomarkers.length === 0) return;
    const report: Report = {
      id: `rep-${Math.random().toString(36).slice(2, 8)}`,
      name: reportName.trim() || 'My lab report',
      lab: 'Manual entry',
      uploadedOn: formatDate(new Date()),
      status: 'ready',
      badge: 'analyzed',
      biomarkers,
    };
    addReport(report);
    replace({ type: 'results', reportId: report.id });
  };

  return (
    <div className="min-h-dvh pb-32 bg-canvas">
      <Header variant="page" title="Enter values manually" />

      <Container size="wide" className="pt-5 lg:pt-8">
        <div className="lg:max-w-3xl lg:mx-auto">
          <Pill tone="indigo" size="sm">
            <Pencil size={11} /> Manual entry
          </Pill>
          <h1 className="font-display text-[26px] lg:text-[32px] leading-tight mt-3 text-balance text-ink">
            Type in the values you have.
          </h1>
          <p className="mt-2 text-[14px] lg:text-[15px] text-ink-soft text-pretty">
            Skip anything that wasn’t in your report — we’ll only show what
            you enter. Numbers outside reasonable ranges are dropped
            automatically to catch typos.
          </p>

          {/* Optional report-name input. Empty falls back to "My lab
              report" at save time. */}
          <div className="mt-5">
            <label
              htmlFor="report-name"
              className="block text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700 mb-1.5"
            >
              Report name (optional)
            </label>
            <input
              id="report-name"
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="My lab report"
              className="w-full h-12 px-4 rounded-[14px] bg-surface border border-line text-[14px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="mt-6 lg:max-w-3xl lg:mx-auto grid gap-4">
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
                    className="text-[18px] leading-none shrink-0"
                  >
                    {category.icon}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-display text-[16px] leading-tight">
                      {category.name}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5 truncate">
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
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-4 pb-4 safe-bottom border-t border-line/70">
        <Container size="narrow">
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
                : `See my report (${filledCount} value${filledCount === 1 ? '' : 's'})`}
            </Button>
          </div>
        </Container>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single marker input row                                              */
/* ------------------------------------------------------------------ */

function MarkerInputRow({
  template,
  value,
  onChange,
}: {
  template: BiomarkerTemplate;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = `entry-${template.id}`;
  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-[13.5px] font-semibold text-ink leading-tight"
        >
          {template.name}
        </label>
        <div className="text-[11.5px] text-muted mt-0.5">
          Reference {template.min}–{template.max}
          {template.unit ? ` ${template.unit}` : ''}
        </div>
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
          className="w-24 h-11 px-3 text-right text-[14px] tabular-nums rounded-[12px] bg-surface border border-line focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
        />
        {template.unit && (
          <span className="text-[11.5px] text-muted w-14 shrink-0">
            {template.unit}
          </span>
        )}
      </div>
    </div>
  );
}
