import { motion } from 'framer-motion';
import {
  ChevronRight,
  FileText,
  FolderHeart,
  Plus,
  Upload,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import StatusBadge from '../components/StatusBadge';
import BottomNav from '../components/BottomNav';
import { useApp } from '../AppContext';
import { summarizeStatuses } from '../data/biomarkers';
import { badgeFor } from '../data/reports';

export default function ReportLockerPage() {
  const { reports, navigate } = useApp();
  const isEmpty = reports.length === 0;

  return (
    <div className="min-h-screen pb-28 bg-canvas">
      <Header
        variant="page"
        title="Your Locker"
        subtitle={
          isEmpty ? 'Reports will live here' : `${reports.length} reports`
        }
        rightSlot={
          !isEmpty ? (
            <button
              onClick={() => navigate({ type: 'upload' })}
              className="grid place-items-center w-9 h-9 rounded-full bg-indigo-600 text-white shadow-soft"
              aria-label="Upload"
            >
              <Plus size={18} />
            </button>
          ) : undefined
        }
      />

      {isEmpty ? (
        <Container size="wide" className="pt-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="mx-auto grid place-items-center w-20 h-20 rounded-3xl bg-gold-100 text-gold-700">
              <FolderHeart size={32} />
            </div>
            <h2 className="font-display text-[24px] leading-tight mt-5 text-balance">
              Drop in your first report — we’ll make sense of it.
            </h2>
            <p className="mt-2 text-[14px] text-ink-soft text-pretty">
              PDF, photo, or screenshot. Anything from any lab works. Most
              reports finish in under a minute.
            </p>

            <Button
              size="lg"
              fullWidth
              className="mt-8"
              onClick={() => navigate({ type: 'upload' })}
              leading={<Upload size={18} />}
            >
              Upload your first report
            </Button>

            <div className="mt-7 grid gap-2 text-left">
              {[
                'Privacy first — nothing is shared',
                'All major Indian labs supported',
                'Old reports work too',
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-center gap-2 text-[13px] text-ink-soft"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {line}
                </div>
              ))}
            </div>
          </motion.div>
        </Container>
      ) : (
        <Container size="wide" className="pt-4 lg:pt-8">
          <div className="hidden lg:block mb-6">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
              Your locker
            </div>
            <h1 className="font-display text-[28px] lg:text-[34px] leading-tight mt-1">
              All your reports, one place
            </h1>
            <p className="mt-2 text-[14px] text-ink-soft max-w-[44ch]">
              {reports.length} report{reports.length === 1 ? '' : 's'} stored
              securely. Tap any to see the full breakdown.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map((r, i) => {
              const summary =
                r.status === 'ready' ? summarizeStatuses(r.biomarkers) : null;
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
                        {summary && (
                          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                            {summary.concern > 0 && (
                              <Pill tone="concern" size="sm" dot>
                                {summary.concern} need care
                              </Pill>
                            )}
                            {summary.attention > 0 && (
                              <Pill tone="attention" size="sm" dot>
                                {summary.attention} watch
                              </Pill>
                            )}
                            <Pill tone="good" size="sm" dot>
                              {summary.good} on track
                            </Pill>
                          </div>
                        )}
                      </div>
                      {r.status === 'ready' && (
                        <ChevronRight
                          size={18}
                          className="text-muted shrink-0 mt-1"
                        />
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Button
            size="lg"
            variant="outline"
            fullWidth
            className="mt-6 lg:!w-auto"
            onClick={() => navigate({ type: 'upload' })}
            leading={<Upload size={16} />}
          >
            Upload another report
          </Button>
        </Container>
      )}

      <BottomNav />
    </div>
  );
}
