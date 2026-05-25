import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Download,
  Info,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BiomarkerBar from '../components/BiomarkerBar';
import BottomNav from '../components/BottomNav';
import Emoji from '../components/Emoji';
import { useNavigation, useReports } from '../AppContext';
import {
  biomarkersByCategory,
  bottomLineFor,
  categories,
  statusColor,
  summarizeStatuses,
} from '../data/biomarkers';
import { findReport } from '../data/reports';

type Filter = 'all' | 'concern' | 'attention' | 'good';

export default function ReportResultsPage({ reportId }: { reportId: string }) {
  const { reports } = useReports();
  const { navigate } = useNavigation();
  // findReport falls back to the curated sample-reports list, so links
  // like /results/rep-001 keep working even though the user's locker
  // starts empty.
  const report = findReport(reports, reportId);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Hooks must be called unconditionally — derive everything off an empty
  // biomarker list when the report isn't found, then render the "not found"
  // view below. This keeps hook order stable across renders.
  const biomarkers = report?.biomarkers ?? [];

  const filtered = useMemo(() => {
    return biomarkers.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (activeCategory !== 'all' && m.category !== activeCategory)
        return false;
      return true;
    });
  }, [biomarkers, filter, activeCategory]);

  const summary = useMemo(
    () => summarizeStatuses(biomarkers),
    [biomarkers],
  );

  const bottomLine = useMemo(
    () => bottomLineFor(biomarkers),
    [biomarkers],
  );

  const groups = useMemo(() => biomarkersByCategory(filtered), [filtered]);
  const presentCategoryIds = useMemo(
    () => new Set(biomarkers.map((m) => m.category)),
    [biomarkers],
  );

  const deepDives = useMemo(
    () =>
      biomarkers
        .filter((m) => m.problemId && m.status !== 'good')
        .slice(0, 4),
    [biomarkers],
  );

  // Ref-based dedup so a double-tap on the download button doesn't
  // produce two PDFs while the lazy chunk is still resolving.
  const pdfBusyRef = useRef(false);
  const handleDownload = async () => {
    if (!report || pdfBusyRef.current) return;
    pdfBusyRef.current = true;
    try {
      // Lazy import — jspdf + its peer html2canvas add ~400KB to the
      // bundle, and most sessions never hit the download button. Keep
      // it out of the main chunk; load only on first click.
      const { generateReportPdf } = await import('../services/reportPdf');
      generateReportPdf(report);
    } finally {
      pdfBusyRef.current = false;
    }
  };

  if (!report) {
    return (
      <div className="min-h-dvh flex flex-col bg-canvas">
        <Header variant="page" title="Report not found" />
        {/* Centered in the available viewport — without flex-1, this short
            "not found" message floats near the top of a tall screen with
            empty grey scroll below. */}
        <div className="flex-1 grid place-items-center px-6 py-10">
          <div className="text-center max-w-md">
            <h1 className="font-display text-display-md leading-tight">
              We couldn’t find that report.
            </h1>
            <p className="mt-3 text-body-sm text-ink-soft leading-relaxed">
              It may have been removed, or the link may be out of date. Head
              back to your dashboard to pick another one.
            </p>
            <Button
              className="mt-6"
              onClick={() => navigate({ type: 'home' })}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header
        variant="page"
        title={report.name}
        subtitle={`${report.uploadedOn} · ${report.lab}`}
        rightSlot={
          <button
            onClick={handleDownload}
            className="grid place-items-center w-12 h-12 -mr-2 rounded-full hover:bg-indigo-50 text-indigo-700 no-print"
            aria-label="Download as PDF"
            title="Download as PDF"
          >
            <Download size={18} />
          </button>
        }
      />

      {/* The Bottom Line — full-width hero */}
      <Container size="wide" className="pt-5 md:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            raised
            className="!bg-gold-500 border-gold-500 text-indigo-900 relative overflow-hidden !p-6 lg:!p-8"
          >
            <div className="absolute -top-8 -right-8 w-40 h-40 lg:w-56 lg:h-56 rounded-full bg-gold-400/40 blur-2xl pointer-events-none" />
            <div className="relative grid md:grid-cols-3 gap-6 md:gap-10 items-start">
              {/* Left: pill + line */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Pill tone="dark" size="sm">
                    <Sparkles size={10} /> The Bottom Line
                  </Pill>
                  <span className="text-micro uppercase tracking-[0.14em] font-bold text-indigo-900/70">
                    {report.uploadedOn}
                  </span>
                </div>

                <p className="mt-4 font-display text-display-md lg:text-display-md leading-[1.2] text-balance">
                  {bottomLine}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2 no-print">
                  <Button
                    variant="dark"
                    size="sm"
                    leading={<Download size={14} />}
                    onClick={handleDownload}
                  >
                    Download as PDF
                  </Button>
                  {/* Share button removed — the URL doesn't carry the
                      report data (reports live in localStorage on this
                      device), so a "share" produced a link that resolved
                      to the curated sample report or a not-found page
                      on the recipient's side. Send the PDF instead;
                      Download as PDF is the legitimate share path. */}
                </div>
              </div>

              {/* Right: status tiles */}
              <div className="grid grid-cols-3 gap-2 md:gap-2.5">
                <BottomLineTile
                  count={summary.good}
                  label="On track"
                  tone="good"
                />
                <BottomLineTile
                  count={summary.attention}
                  label="Needs attention"
                  tone="attention"
                />
                <BottomLineTile
                  count={summary.concern}
                  label="Needs care"
                  tone="concern"
                />
              </div>
            </div>
          </Card>
        </motion.div>
      </Container>

      {/* Body: 2-col on lg — left biomarkers, right sticky filters + deep dives */}
      <Container size="wide" className="mt-6 md:mt-10">
        <div className="grid md:grid-cols-12 gap-6 md:gap-8">
          {/* LEFT — Biomarker groups */}
          <main className="md:col-span-8">
            {/* Mobile/tablet filters (lg uses sidebar) */}
            <div className="md:hidden no-print">
              <div className="overflow-x-auto scrollbar-none -mx-5 px-5">
                <div className="flex gap-2 w-max">
                  {(
                    [
                      { id: 'all', label: 'All markers' },
                      { id: 'concern', label: 'Needs care' },
                      { id: 'attention', label: 'Needs attention' },
                      { id: 'good', label: 'On track' },
                    ] satisfies Array<{ id: Filter; label: string }>
                  ).map((f) => {
                    const active = filter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-4 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white shadow-soft'
                            : 'bg-surface border border-line text-ink-soft hover:border-indigo-300'
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
                        emoji={c.icon}
                        label={c.name}
                        active={activeCategory === c.id}
                        onClick={() => setActiveCategory(c.id)}
                      />
                    ))}
                </div>
              </div>
            </div>

            {groups.length === 0 ? (
              <Card className="text-center !py-10 mt-4 md:mt-0">
                <div className="font-display text-display-md">
                  Nothing in that bucket.
                </div>
                <p className="text-caption text-ink-soft mt-1">
                  Try a different filter.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 mt-4 md:mt-0">
                {groups.map(({ category, markers }) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card padded={false}>
                      <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-line">
                        <Emoji
                          label={category.name}
                          className="text-display-md leading-none"
                        >
                          {category.icon}
                        </Emoji>
                        <div className="flex-1">
                          <div className="font-display text-body-lg leading-tight">
                            {category.name}
                          </div>
                          <div className="text-caption text-ink-soft mt-0.5">
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

            {/* Disclaimer */}
            <div className="mt-8 rounded-[16px] bg-surface border border-line p-4 flex gap-3 print-shadow-none">
              <Info size={16} className="text-muted shrink-0 mt-0.5" />
              <p className="text-caption text-ink-soft leading-relaxed">
                Digital Clinic translates and contextualises your report — it
                is <strong>not a diagnosis</strong>. Always discuss findings
                with a qualified doctor before changing medication or starting
                therapy.
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
          </main>

          {/* RIGHT — Sticky sidebar (filters + deep dives) */}
          <aside className="hidden md:block md:col-span-4 no-print">
            <div className="sticky top-24 grid gap-5">
              <Card padded={false} className="overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-line">
                  <div className="text-micro font-bold uppercase tracking-[0.14em] text-indigo-700">
                    Filter
                  </div>
                  <div className="font-display text-body mt-1">
                    Refine view
                  </div>
                </div>
                <div className="p-4 grid gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All markers' },
                      { id: 'concern', label: 'Needs care' },
                      { id: 'attention', label: 'Needs attention' },
                      { id: 'good', label: 'On track' },
                    ] satisfies Array<{ id: Filter; label: string }>
                  ).map((f) => {
                    const active = filter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`w-full text-left px-3 h-10 rounded-xl text-caption font-semibold transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-canvas/60 text-ink-soft hover:bg-indigo-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <div className="px-5 pt-4 pb-3 border-t border-line">
                  <div className="text-micro font-bold uppercase tracking-[0.14em] text-indigo-700">
                    Categories
                  </div>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                  <CategoryChip
                    label="All"
                    active={activeCategory === 'all'}
                    onClick={() => setActiveCategory('all')}
                  />
                  {categories
                    .filter((c) => presentCategoryIds.has(c.id))
                    .map((c) => (
                      <CategoryChip
                        key={c.id}
                        emoji={c.icon}
                        label={c.name}
                        active={activeCategory === c.id}
                        onClick={() => setActiveCategory(c.id)}
                      />
                    ))}
                </div>
              </Card>

              {deepDives.length > 0 && (
                <Card padded={false}>
                  <div className="px-5 pt-5 pb-3 border-b border-line">
                    <div className="text-micro font-bold uppercase tracking-[0.14em] text-indigo-700">
                      Suggested deep dives
                    </div>
                    <div className="font-display text-body mt-1">
                      What to look at first
                    </div>
                  </div>
                  <div className="divide-y divide-line/70">
                    {deepDives.map((m) => {
                      const c = statusColor(m.status);
                      return (
                        <button
                          key={m.id}
                          onClick={() =>
                            navigate({
                              type: 'problem',
                              problemId: m.problemId!,
                            })
                          }
                          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-canvas/60 transition-colors"
                        >
                          <div className="grid place-items-center w-9 h-9 rounded-xl bg-gold-100 text-gold-700 shrink-0">
                            <Sparkles size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-micro uppercase tracking-[0.12em] font-bold text-muted truncate">
                              {m.name}
                            </div>
                            <div
                              className={`text-caption mt-0.5 ${c.text} font-bold uppercase tracking-[0.1em]`}
                            >
                              {c.label}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-muted shrink-0"
                          />
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          </aside>
        </div>

        {/* Mobile-only suggested deep dives (sidebar handles lg+) */}
        {deepDives.length > 0 && (
          <div className="md:hidden mt-8 no-print">
            <div className="font-sans text-caption uppercase tracking-[0.2em] text-indigo-700 font-bold">
              Suggested deep dives
            </div>
            <h2 className="font-display text-display-md leading-tight mt-1">
              What I’d look at first
            </h2>

            <div className="mt-4 grid gap-3">
              {deepDives.slice(0, 3).map((m) => {
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
                        <div className="text-micro uppercase tracking-[0.12em] font-bold text-muted">
                          {m.name}
                        </div>
                        <div className="font-semibold leading-tight mt-0.5">
                          {m.status === 'concern'
                            ? 'Action plan + retest cadence'
                            : 'See what to tweak this month'}
                        </div>
                        <div
                          className={`text-caption mt-1 ${c.text} font-bold uppercase tracking-[0.1em]`}
                        >
                          {c.label}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </Container>

      <BottomNav />

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
    <div className="rounded-[14px] bg-white/80 p-3">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-micro uppercase tracking-[0.14em] font-bold text-indigo-900/80">
          {label}
        </span>
      </div>
      <div className="font-display text-display-md leading-none mt-1.5 text-indigo-900">
        {count}
      </div>
    </div>
  );
}

function CategoryChip({
  emoji,
  label,
  active,
  onClick,
}: {
  /** Optional emoji glyph rendered inside an accessible <Emoji /> wrapper.
   *  Omit for chips like "All" / "All categories" that have no glyph. */
  emoji?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      // min-h-12 (48px) hit target — the visible chip stays compact but
      // taps don't miss on touch.
      className={`inline-flex items-center gap-1 px-3 min-h-12 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-gold-500 text-indigo-900 border border-gold-500'
          : 'bg-surface border border-line text-ink-soft'
      }`}
    >
      {emoji && (
        <Emoji label={label} className="text-caption leading-none">
          {emoji}
        </Emoji>
      )}
      {label}
    </button>
  );
}
