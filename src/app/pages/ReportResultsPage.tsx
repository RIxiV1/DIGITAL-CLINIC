import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Download,
  Info,
  Share2,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BiomarkerBar from '../components/BiomarkerBar';
import BottomNav from '../components/BottomNav';
import { useNavigation, useReports } from '../AppContext';
import {
  biomarkersByCategory,
  bottomLineFor,
  categories,
  statusColor,
  summarizeStatuses,
} from '../data/biomarkers';

type Filter = 'all' | 'concern' | 'attention' | 'good';

export default function ReportResultsPage({ reportId }: { reportId: string }) {
  const { reports } = useReports();
  const { navigate } = useNavigation();
  const report = reports.find((r) => r.id === reportId);
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

  const handleDownload = () => window.print();

  const [shareToast, setShareToast] = useState<string | null>(null);
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: report?.name ?? 'My report',
      text: 'My ForMen · Digital Clinic report',
      url,
    };
    try {
      if (
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share(shareData);
        return;
      }
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
        setShareToast('Link copied to clipboard');
        window.setTimeout(() => setShareToast(null), 2200);
      }
    } catch {
      // User cancelled native share — fail silently.
    }
  };

  if (!report) {
    return (
      <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
        <Header variant="page" title="Report not found" />
        <Container size="wide" className="pt-10 lg:pt-16 text-center">
          <div className="mx-auto max-w-md">
            <h1 className="font-display text-[24px] leading-tight">
              We couldn’t find that report.
            </h1>
            <p className="mt-3 text-[14px] text-ink-soft leading-relaxed">
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
        </Container>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
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

      {/* The Bottom Line — full-width hero */}
      <Container size="wide" className="pt-5 lg:pt-8">
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
            <div className="relative grid lg:grid-cols-3 gap-6 lg:gap-10 items-start">
              {/* Left: pill + line */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2">
                  <Pill tone="dark" size="sm">
                    <Sparkles size={10} /> The Bottom Line
                  </Pill>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-indigo-900/70">
                    {report.uploadedOn}
                  </span>
                </div>

                <p className="mt-4 font-display text-[22px] lg:text-[28px] leading-[1.2] text-balance">
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
                  <button
                    type="button"
                    onClick={handleShare}
                    className="grid place-items-center w-9 h-9 rounded-[12px] bg-indigo-900/15 text-indigo-900 hover:bg-indigo-900/25 transition-colors"
                    aria-label="Share this report"
                    title="Share this report"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Right: status tiles */}
              <div className="grid grid-cols-3 gap-2 lg:gap-2.5">
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
      <Container size="wide" className="mt-6 lg:mt-10">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT — Biomarker groups */}
          <main className="lg:col-span-8">
            {/* Mobile/tablet filters (lg uses sidebar) */}
            <div className="lg:hidden no-print">
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
            </div>

            {groups.length === 0 ? (
              <Card className="text-center !py-10 mt-4 lg:mt-0">
                <div className="font-display text-[20px]">
                  Nothing in that bucket.
                </div>
                <p className="text-[13px] text-ink-soft mt-1">
                  Try a different filter.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 mt-4 lg:mt-0">
                {groups.map(({ category, markers }) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card padded={false}>
                      <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-line">
                        <div className="text-[22px] leading-none">
                          {category.icon}
                        </div>
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

            {/* Disclaimer */}
            <div className="mt-8 rounded-[16px] bg-white border border-line p-4 flex gap-3 print-shadow-none">
              <Info size={16} className="text-muted shrink-0 mt-0.5" />
              <p className="text-[12px] text-ink-soft leading-relaxed">
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
          <aside className="hidden lg:block lg:col-span-4 no-print">
            <div className="sticky top-24 grid gap-5">
              <Card padded={false} className="overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-line">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                    Filter
                  </div>
                  <div className="font-display text-[16px] mt-1">
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
                        className={`w-full text-left px-3 h-10 rounded-xl text-[13px] font-semibold transition-colors ${
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
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
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
                        label={`${c.icon} ${c.name}`}
                        active={activeCategory === c.id}
                        onClick={() => setActiveCategory(c.id)}
                      />
                    ))}
                </div>
              </Card>

              {deepDives.length > 0 && (
                <Card padded={false}>
                  <div className="px-5 pt-5 pb-3 border-b border-line">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                      Suggested deep dives
                    </div>
                    <div className="font-display text-[16px] mt-1">
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
                            <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted truncate">
                              {m.name}
                            </div>
                            <div
                              className={`text-[11px] mt-0.5 ${c.text} font-bold uppercase tracking-[0.1em]`}
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
          <div className="lg:hidden mt-8 no-print">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
              Suggested deep dives
            </div>
            <h2 className="font-display text-[22px] leading-tight mt-1">
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
                        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                          {m.name}
                        </div>
                        <div className="font-semibold leading-tight mt-0.5">
                          {m.status === 'concern'
                            ? 'Action plan + retest cadence'
                            : 'See what to tweak this month'}
                        </div>
                        <div
                          className={`text-[11px] mt-1 ${c.text} font-bold uppercase tracking-[0.1em]`}
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

      {/* Lightweight toast — surfaces clipboard-copy success without a
          framework. Auto-dismisses after 2.2s via the share handler. */}
      {shareToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-24 lg:bottom-8 z-40 grid place-items-center pointer-events-none no-print"
        >
          <div className="pointer-events-auto px-4 py-2.5 rounded-full bg-ink text-white text-[12.5px] font-semibold shadow-pop">
            {shareToast}
          </div>
        </div>
      )}
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
