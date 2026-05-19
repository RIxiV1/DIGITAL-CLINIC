import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Pill from '../components/Pill';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { useApp } from '../AppContext';
import { buildLabelMap } from '../data/quiz';
import { summarizeStatuses } from '../data/biomarkers';
import { badgeFor } from '../data/reports';

const priorityCopy: Record<
  string,
  { headline: string; sub: string; bar: number }
> = {
  sexual: {
    headline: 'Reclaim your drive',
    sub: 'Testosterone, prolactin, and estradiol — the three levers behind libido and performance.',
    bar: 42,
  },
  'hair-scalp': {
    headline: 'Keep your hairline',
    sub: 'DHT drives most male hair loss. Iron and thyroid quietly accelerate it.',
    bar: 38,
  },
  energy: {
    headline: 'Steady, all-day energy',
    sub: 'Most energy dips trace to D3, B12, or thyroid. We’ll watch those.',
    bar: 36,
  },
  fertility: {
    headline: 'Set up for fatherhood',
    sub: 'LH, FSH, and semen analysis — two tracks, both worth checking.',
    bar: 45,
  },
  weight: {
    headline: 'Get the metabolism back',
    sub: 'Insulin and estrogen run body composition more than calories do.',
    bar: 28,
  },
  sleep: {
    headline: 'Deeper, repairing sleep',
    sub: 'Cortisol rhythm + low T form a loop. We’ll surface what’s out of sync.',
    bar: 30,
  },
  mood: {
    headline: 'Lift mood from the inside',
    sub: 'Vitamin D, B12, thyroid and cortisol sit behind surprising amounts of mood drag.',
    bar: 33,
  },
  hormonal: {
    headline: 'The complete picture',
    sub: 'Every key hormone measured in one draw — the full HPG axis read.',
    bar: 55,
  },
};

export default function HomePage() {
  const { quiz, reports, navigate } = useApp();

  const ready = reports.find((r) => r.status === 'ready');
  const summary = useMemo(
    () => (ready ? summarizeStatuses(ready.biomarkers) : null),
    [ready],
  );

  const priorityLabels = useMemo(() => buildLabelMap(), []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const topPriorities = quiz.priorities.slice(0, 3);
  const worthALook =
    ready?.biomarkers
      .filter(
        (m) =>
          (m.status === 'concern' || m.status === 'attention') && m.problemId,
      )
      .slice(0, 3) ?? [];

  return (
    <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
      <Header variant="home" />

      {/* Greeting */}
      <Container size="wide" className="pt-6 lg:pt-10">
        <div className="text-[12px] uppercase tracking-[0.16em] font-bold text-muted">
          {greeting}
        </div>
        <h1 className="font-display text-[28px] lg:text-[36px] leading-tight mt-1">
          Let’s look after you today.
        </h1>
      </Container>

      {/* Health summary hero card */}
      <Container size="wide" className="mt-5 lg:mt-7">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            raised
            className="!bg-indigo-600 border-indigo-600 text-white !p-6 lg:!p-8 overflow-hidden relative"
          >
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-400/25 blur-3xl pointer-events-none" />
            <div className="relative grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
              {/* Left: title + lab + button */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-100">
                  Your latest report
                </div>
                <div className="font-display text-[22px] lg:text-[28px] mt-2 leading-tight text-balance">
                  {ready ? ready.name : 'No report yet'}
                </div>
                {ready && (
                  <div className="text-[12px] lg:text-[13px] text-indigo-100 mt-1.5">
                    {ready.uploadedOn} · {ready.lab}
                  </div>
                )}
                {ready && (
                  <p className="hidden lg:block mt-5 text-[14px] leading-relaxed text-indigo-50 max-w-[40ch]">
                    Two markers to act on first — focus there and let
                    everything else stay good. The Bottom Line on your report
                    has the full read.
                  </p>
                )}
                <div className="mt-5 flex flex-col sm:flex-row gap-2.5 lg:items-center">
                  <Button
                    variant="gold"
                    size="md"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      ready
                        ? navigate({ type: 'results', reportId: ready.id })
                        : navigate({ type: 'upload' })
                    }
                    trailing={<ArrowRight size={16} />}
                  >
                    {ready ? 'See full breakdown' : 'Upload a report'}
                  </Button>
                  {!ready && reports.length === 0 && (
                    <button
                      onClick={() =>
                        navigate({ type: 'results', reportId: 'rep-001' })
                      }
                      className="inline-flex items-center justify-center gap-1 px-2 text-[13px] font-semibold text-indigo-100 hover:text-white transition-colors"
                    >
                      Or see a sample report
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Right: score + tiles */}
              {summary && (
                <div className="lg:pl-8 lg:border-l lg:border-indigo-400/30">
                  <div className="flex items-baseline gap-3">
                    <div className="font-display text-[42px] lg:text-[56px] leading-none">
                      {summary.good}
                      <span className="text-indigo-200 text-[20px] lg:text-[24px]">
                        /{summary.total}
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-indigo-100">
                      Markers
                      <br />
                      on track
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <StatusTile
                      label="On track"
                      count={summary.good}
                      tone="good"
                    />
                    <StatusTile
                      label="Look"
                      count={summary.attention}
                      tone="attention"
                    />
                    <StatusTile
                      label="Care"
                      count={summary.concern}
                      tone="concern"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </Container>

      {/* Two-column body — Left: Locker + Worth a look. Right: Priorities */}
      <Container size="wide" className="mt-9 lg:mt-12">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT — Locker + Worth a look */}
          <div className="lg:col-span-7 grid gap-9 lg:gap-12">
            {/* Locker */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
                    Your Locker
                  </div>
                  <h2 className="font-display text-[22px] lg:text-[26px] leading-tight mt-1">
                    All your reports, one place
                  </h2>
                </div>
                <button
                  onClick={() => navigate({ type: 'upload' })}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-indigo-600 text-white text-[12px] font-semibold shadow-soft hover:bg-indigo-700"
                >
                  <Plus size={14} /> Upload
                </button>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {reports.length === 0 ? (
                  <Card className="text-center !py-10 sm:col-span-2">
                    <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
                      <FileText size={20} />
                    </div>
                    <div className="font-display text-[20px]">
                      No reports yet.
                    </div>
                    <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
                      Drop a report and we’ll translate it into plain English —
                      or open the sample first to see exactly what you’ll get.
                    </p>
                    <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
                      <Button
                        size="md"
                        onClick={() => navigate({ type: 'upload' })}
                        leading={<Upload size={14} />}
                      >
                        Upload a report
                      </Button>
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() =>
                          navigate({
                            type: 'results',
                            reportId: 'rep-001',
                          })
                        }
                      >
                        Try a sample
                      </Button>
                    </div>
                  </Card>
                ) : (
                  reports.map((r, i) => {
                    const s =
                      r.status === 'ready'
                        ? summarizeStatuses(r.biomarkers)
                        : null;
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.35 }}
                      >
                        <Card
                          interactive={r.status === 'ready'}
                          onClick={() =>
                            r.status === 'ready'
                              ? navigate({ type: 'results', reportId: r.id })
                              : navigate({ type: 'processing' })
                          }
                          className="h-full"
                        >
                          <div className="flex items-start gap-3">
                            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-ink truncate">
                                  {r.name}
                                </div>
                                <StatusBadge status={badgeFor(r)} />
                              </div>
                              <div className="text-[11px] text-muted mt-1">
                                {r.uploadedOn} · {r.lab}
                              </div>
                              {s && (
                                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                                  {s.concern > 0 && (
                                    <Pill tone="concern" size="sm" dot>
                                      {s.concern} need care
                                    </Pill>
                                  )}
                                  {s.attention > 0 && (
                                    <Pill tone="attention" size="sm" dot>
                                      {s.attention} watch
                                    </Pill>
                                  )}
                                  <Pill tone="good" size="sm" dot>
                                    {s.good} on track
                                  </Pill>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Worth a look */}
            {ready && worthALook.length > 0 && (
              <section>
                <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
                  Worth a look
                </div>
                <h2 className="font-display text-[22px] lg:text-[26px] leading-tight mt-1">
                  From your latest report
                </h2>

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  {worthALook.map((m) => (
                    <Card
                      key={m.id}
                      interactive
                      onClick={() =>
                        navigate({ type: 'problem', problemId: m.problemId! })
                      }
                      className="h-full"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-1.5 h-14 rounded-full ${
                            m.status === 'concern'
                              ? 'bg-concern'
                              : 'bg-attention'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                            {m.name}
                          </div>
                          <div className="font-display text-[17px] leading-tight mt-0.5">
                            {m.value} {m.unit}
                          </div>
                          <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed line-clamp-2">
                            {m.plain}
                          </p>
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-muted shrink-0"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT — Priorities sidebar */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
                    Focused on you
                  </div>
                  <h2 className="font-display text-[22px] lg:text-[24px] leading-tight mt-1">
                    {topPriorities.length > 0
                      ? 'Your priorities'
                      : 'Tell us what to focus on'}
                  </h2>
                </div>
                {topPriorities.length > 0 && (
                  <button
                    onClick={() => navigate({ type: 'quiz' })}
                    className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-700 hover:text-indigo-800"
                  >
                    Re-do quiz
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {topPriorities.length === 0 ? (
                  <Card>
                    <div className="flex items-start gap-3">
                      <div className="grid place-items-center w-10 h-10 rounded-2xl bg-gold-100 text-gold-700 shrink-0">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="font-semibold">No priorities yet</div>
                        <div className="text-[13px] text-ink-soft mt-1">
                          Take the 2-minute quiz so we can personalise your
                          dashboard.
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => navigate({ type: 'quiz' })}
                        >
                          Take the quiz
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  topPriorities.map((id, idx) => {
                    const copy = priorityCopy[id] ?? {
                      headline: priorityLabels.get(id) ?? 'Focus area',
                      sub: 'We’re watching the right markers for this.',
                      bar: 30,
                    };
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.35 }}
                      >
                        <Card>
                          <Pill tone="indigo" size="sm">
                            {priorityLabels.get(id)}
                          </Pill>
                          <div className="font-display text-[17px] mt-2 leading-snug">
                            {copy.headline}
                          </div>
                          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                            {copy.sub}
                          </p>
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5">
                              <span className="text-muted">This month</span>
                              <span className="text-indigo-700">
                                {copy.bar}%
                              </span>
                            </div>
                            <ProgressBar value={copy.bar} tone="indigo" />
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}

function StatusTile({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'good' | 'attention' | 'concern';
}) {
  const dotBg =
    tone === 'good'
      ? 'bg-good'
      : tone === 'attention'
        ? 'bg-attention'
        : 'bg-concern';
  return (
    <div className="rounded-[14px] bg-indigo-700/50 p-3">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotBg}`} />
        <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-indigo-100">
          {label}
        </span>
      </div>
      <div className="font-display text-[22px] mt-1">{count}</div>
    </div>
  );
}
