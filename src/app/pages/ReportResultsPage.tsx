import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Download,
  Info,
  Share2,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BiomarkerBar from '../components/BiomarkerBar';
import { useApp } from '../AppContext';
import {
  biomarkersByCategory,
  bottomLineFor,
  categories,
  statusColor,
  summarizeStatuses,
} from '../data/biomarkers';

type Filter = 'all' | 'concern' | 'attention' | 'good';

export default function ReportResultsPage({ reportId }: { reportId: string }) {
  const { reports, navigate } = useApp();
  const report = reports.find((r) => r.id === reportId) ?? reports[0];
  const [filter, setFilter] = useState<Filter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    return report.biomarkers.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (activeCategory !== 'all' && m.category !== activeCategory)
        return false;
      return true;
    });
  }, [report.biomarkers, filter, activeCategory]);

  const summary = useMemo(
    () => summarizeStatuses(report.biomarkers),
    [report.biomarkers],
  );

  const bottomLine = useMemo(
    () => bottomLineFor(report.biomarkers),
    [report.biomarkers],
  );

  const groups = useMemo(() => biomarkersByCategory(filtered), [filtered]);
  const presentCategoryIds = useMemo(
    () => new Set(report.biomarkers.map((m) => m.category)),
    [report.biomarkers],
  );

  const handleDownload = () => window.print();

  return (
    <div className="min-h-screen pb-20 bg-canvas">
      <Header
        variant="page"
        title={report.name}
        subtitle={`${report.uploadedOn} · ${report.lab}`}
        rightSlot={
          <button
            onClick={handleDownload}
            className="grid place-items-center w-9 h-9 rounded-full hover:bg-indigo-50 text-indigo-700 no-print"
            aria-label="Download as PDF"
            title="Download as PDF"
          >
            <Download size={18} />
          </button>
        }
      />

      {/* The Bottom Line — yellow card */}
      <Container className="pt-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            raised
            className="!bg-gold-500 border-gold-500 text-indigo-900 relative overflow-hidden !p-7"
          >
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-gold-400/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Pill tone="dark" size="sm">
                  <Sparkles size={10} /> The Bottom Line
                </Pill>
                <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-indigo-900/70">
                  {report.uploadedOn}
                </span>
              </div>

              <p className="mt-4 font-display text-[22px] leading-[1.25] text-balance">
                {bottomLine}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <BottomLineTile
                  count={summary.good}
                  label="On track"
                  tone="good"
                />
                <BottomLineTile
                  count={summary.attention}
                  label="Worth a look"
                  tone="attention"
                />
                <BottomLineTile
                  count={summary.concern}
                  label="Needs care"
                  tone="concern"
                />
              </div>

              <div className="mt-5 flex items-center gap-2 no-print">
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate({ type: 'clinic' })}
                  leading={<Stethoscope size={14} />}
                >
                  Talk to a Doctor
                </Button>
                <button
                  onClick={handleDownload}
                  className="grid place-items-center w-9 h-9 rounded-[12px] bg-indigo-900/15 text-indigo-900 hover:bg-indigo-900/25"
                  aria-label="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  className="grid place-items-center w-9 h-9 rounded-[12px] bg-indigo-900/15 text-indigo-900 hover:bg-indigo-900/25"
                  aria-label="Share"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      </Container>

      {/* Filters */}
      <Container className="pt-6 no-print">
        <div className="overflow-x-auto scrollbar-none -mx-5 px-5">
          <div className="flex gap-2 w-max">
            {(
              [
                { id: 'all', label: 'All markers' },
                { id: 'concern', label: 'Needs care' },
                { id: 'attention', label: 'Worth a look' },
                { id: 'good', label: 'On track' },
              ] satisfies Array<{ id: Filter; label: string }>
            ).map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3.5 h-9 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white shadow-soft'
                      : 'bg-white border border-line text-ink-soft hover:border-indigo-300'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto scrollbar-none -mx-5 px-5">
          <div className="flex gap-2 w-max">
            <CategoryChip
              label="All categories"
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            />
            {categories
              .filter((c) => presentCategoryIds.has(c.id))
              .map((c) => (
                <CategoryChip
                  key={c.id}
                  label={`${c.icon} ${c.name}`}
                  active={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                />
              ))}
          </div>
        </div>
      </Container>

      {/* Biomarker groups */}
      <Container className="pt-2">
        {groups.length === 0 ? (
          <Card className="text-center !py-10">
            <div className="font-display text-[20px]">Nothing in that bucket.</div>
            <p className="text-[13px] text-ink-soft mt-1">
              Try a different filter.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 mt-4">
            {groups.map(({ category, markers }) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card padded={false}>
                  <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-line">
                    <div className="text-[22px] leading-none">{category.icon}</div>
                    <div className="flex-1">
                      <div className="font-display text-[17px] leading-tight">
                        {category.name}
                      </div>
                      <div className="text-[12.5px] text-ink-soft mt-0.5">
                        {category.description}
                      </div>
                    </div>
                    <Pill tone="neutral" size="sm">
                      {markers.length}
                    </Pill>
                  </div>
                  <div className="divide-y divide-line/70">
                    {markers.map((m) => (
                      <BiomarkerBar
                        key={m.id}
                        marker={m}
                        onClick={
                          m.problemId
                            ? () =>
                                navigate({
                                  type: 'problem',
                                  problemId: m.problemId!,
                                })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </Container>

      {/* Suggested deep dives */}
      <Container className="mt-8 no-print">
        <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
          Suggested deep dives
        </div>
        <h2 className="font-display text-[22px] leading-tight mt-1">
          What I’d look at first
        </h2>

        <div className="mt-4 grid gap-3">
          {report.biomarkers
            .filter((m) => m.problemId && m.status !== 'good')
            .slice(0, 3)
            .map((m) => {
              const c = statusColor(m.status);
              return (
                <Card
                  key={m.id}
                  interactive
                  onClick={() =>
                    navigate({ type: 'problem', problemId: m.problemId! })
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-10 h-10 rounded-2xl bg-gold-100 text-gold-700 shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                        {m.name}
                      </div>
                      <div className="font-semibold leading-tight mt-0.5">
                        {m.status === 'concern'
                          ? 'Action plan + retest cadence'
                          : 'See what to tweak this month'}
                      </div>
                      <div className={`text-[11px] mt-1 ${c.text} font-bold uppercase tracking-[0.1em]`}>
                        {c.label}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted" />
                  </div>
                </Card>
              );
            })}
        </div>
      </Container>

      {/* Disclaimer */}
      <Container className="mt-8">
        <div className="rounded-[16px] bg-white border border-line p-4 flex gap-3 print-shadow-none">
          <Info size={16} className="text-muted shrink-0 mt-0.5" />
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Digital Clinic translates and contextualises your report — it is{' '}
            <strong>not a diagnosis</strong>. Always discuss findings with a
            qualified doctor before changing medication or starting therapy.
          </p>
        </div>

        <div className="mt-5 no-print">
          <Button
            size="lg"
            fullWidth
            variant="outline"
            leading={<Download size={16} />}
            onClick={handleDownload}
          >
            Download report as PDF
          </Button>
        </div>
      </Container>
    </div>
  );
}

function BottomLineTile({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: 'good' | 'attention' | 'concern';
}) {
  const dot =
    tone === 'good'
      ? 'bg-good'
      : tone === 'attention'
        ? 'bg-attention'
        : 'bg-concern';
  return (
    <div className="rounded-[14px] bg-white/65 backdrop-blur p-3">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-indigo-900/80">
          {label}
        </span>
      </div>
      <div className="font-display text-[24px] leading-none mt-1.5 text-indigo-900">
        {count}
      </div>
    </div>
  );
}

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
      onClick={onClick}
      className={`px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-gold-500 text-indigo-900 border border-gold-500'
          : 'bg-white border border-line text-ink-soft'
      }`}
    >
      {label}
    </button>
  );
}
