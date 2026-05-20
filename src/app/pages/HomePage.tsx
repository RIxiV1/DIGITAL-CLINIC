import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Upload } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Pill from '../components/Pill';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import StatusBadge from '../components/StatusBadge';
import DashboardHeadline from '../components/DashboardHeadline';
import MarkerAttentionCard from '../components/MarkerAttentionCard';
import TrendRow from '../components/TrendRow';
import LearnMoreModal from '../components/LearnMoreModal';
import { useNavigation, useReports } from '../AppContext';
import {
  getTrend,
  type Biomarker,
  type BiomarkerCategoryId,
} from '../data/biomarkers';
import { badgeFor, getSampleReportForDashboard } from '../data/reports';
import { getMarkerInfo } from '../data/markerInfo';

/**
 * Dashboard (HomePage) restructured per the dashboard brief.
 *
 * Four zones, top to bottom:
 *   1. Dynamic headline insight (data-driven, 4 states)
 *   2. Markers that need attention (red + amber, trend + action + LearnMore)
 *   3. Trends over time (sparklines grouped by pathway)
 *   4. The locker (upload + stored reports)
 *
 * The "Focused on you / Your priorities" section is gone — its gamified
 * progress bars measured nothing and obscured the actual signal.
 */
export default function HomePage() {
  const { reports, addReport } = useReports();
  const { navigate } = useNavigation();

  /** Loads the curated sample report into the user's locker so the
   *  empty dashboard becomes a populated dashboard in one click — no
   *  upload required. Lets people see what the product actually does
   *  before doing the work of finding a real report. */
  const loadSampleData = () => {
    if (reports.some((r) => r.id === 'rep-001')) return;
    addReport(getSampleReportForDashboard());
  };

  const ready = useMemo(() => reports.find((r) => r.status === 'ready'), [reports]);
  const biomarkers = useMemo(() => ready?.biomarkers ?? [], [ready]);

  // Markers that need attention — red + amber, latest report only.
  const attentionMarkers = useMemo(
    () =>
      biomarkers
        .filter((m) => m.status === 'concern' || m.status === 'attention')
        // concern first, then attention, then by "biggest absolute delta vs prev"
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'concern' ? -1 : 1;
          return 0;
        })
        .slice(0, 6),
    [biomarkers],
  );

  // Markers with trend data — group by pathway for Zone 3.
  const trendsByPathway = useMemo(() => {
    const withHistory = biomarkers.filter((m) => getTrend(m) !== null);
    return PATHWAYS.map((p) => ({
      ...p,
      markers: withHistory.filter((m) => p.categories.includes(m.category)),
    })).filter((p) => p.markers.length > 0);
  }, [biomarkers]);

  // Learn More modal state — shared across attention cards + trend rows.
  const [openMarkerName, setOpenMarkerName] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openMarkerLM = openMarkerName ? getMarkerInfo(openMarkerName) ?? null : null;

  const openLearnMore = (name: string) => (e: React.MouseEvent) => {
    triggerRef.current = e.currentTarget as HTMLElement;
    setOpenMarkerName(name);
  };
  const closeLearnMore = () => {
    setOpenMarkerName(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  // Primary CTA on the headline always lands on something useful.
  const primaryCTA = () => {
    if (!ready) {
      navigate({ type: 'upload' });
      return;
    }
    navigate({ type: 'results', reportId: ready.id });
  };

  // Per-marker action handler — only navigable when the marker has a
  // problemId (we have a real action plan to open). Otherwise the
  // action label renders as muted/informational text — no fake link
  // that promises a destination we don't have.
  const onMarkerAction = (marker: Biomarker) =>
    marker.problemId
      ? () => navigate({ type: 'problem', problemId: marker.problemId! })
      : undefined;

  return (
    <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
      <Header variant="home" />

      {/* ZONE 1 · Dynamic headline (with embedded health ring) */}
      <Container size="wide" className="pt-5 lg:pt-8 relative">
        <DashboardHeadline
          markers={ready ? biomarkers : null}
          hasReport={!!ready}
          onPrimaryCTA={primaryCTA}
        />
      </Container>

      {/* BENTO ROW · Attention markers (left) + Trends (right) on lg+ */}
      {(attentionMarkers.length > 0 || trendsByPathway.length > 0) && (
        <Container size="wide" className="mt-6 lg:mt-8">
          <div className="grid lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Attention block — col-span-7 on lg, full width otherwise */}
            {attentionMarkers.length > 0 && (
              <section
                className={`${
                  trendsByPathway.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                }`}
              >
                <SectionHeading
                  eyebrow="Needs attention"
                  title="Markers to act on first"
                />
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  {attentionMarkers.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                      className="h-full"
                    >
                      <MarkerAttentionCard
                        marker={m}
                        onAction={onMarkerAction(m)}
                        onLearnMore={
                          getMarkerInfo(m.name) ? openLearnMore(m.name) : undefined
                        }
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Trends block — col-span-5 on lg, stacks below on mobile */}
            {trendsByPathway.length > 0 && (
              <section
                className={`${
                  attentionMarkers.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
                }`}
              >
                <SectionHeading
                  eyebrow="Your trends"
                  title="How your numbers have moved"
                />
                <div className="mt-4 grid gap-3">
                  {trendsByPathway.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-[18px] bg-surface border border-line/70 shadow-soft overflow-hidden backdrop-blur-sm"
                    >
                      <div className="px-5 pt-5 pb-2 flex items-center gap-2">
                        <span className="text-[18px] leading-none">
                          {group.icon}
                        </span>
                        <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-700">
                          {group.name}
                        </div>
                      </div>
                      <div className="px-5 pb-2">
                        {group.markers.map((m) => (
                          <TrendRow
                            key={m.id}
                            marker={m}
                            onLearnMore={
                              getMarkerInfo(m.name)
                                ? openLearnMore(m.name)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Container>
      )}

      {/* ZONE 4 · Your locker */}
      <Container size="wide" className="mt-6 lg:mt-8">
        <SectionHeading
          eyebrow="Your locker"
          title="All your reports, one place"
          rightSlot={
            <button
              type="button"
              onClick={() => navigate({ type: 'upload' })}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-indigo-600 text-white text-[12px] font-semibold shadow-soft hover:bg-indigo-700"
            >
              <Plus size={14} /> Upload
            </button>
          }
        />

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.length === 0 ? (
            <Card className="text-center !py-10 sm:col-span-2 lg:col-span-3">
              <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
                <FileText size={20} />
              </div>
              <div className="font-display text-[20px]">No reports yet.</div>
              <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
                Drop a report and we'll translate it into plain English — or open
                the sample first to see exactly what you'll get.
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
                  onClick={loadSampleData}
                >
                  Load sample data
                </Button>
              </div>
            </Card>
          ) : (
            reports.map((r, i) => (
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
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </Container>

      <BottomNav />

      {/* Learn More modal — shared across Zone 2 and Zone 3 marker references */}
      <LearnMoreModal
        open={!!openMarkerLM}
        title={openMarkerName ?? ''}
        subtitle="Marker · Learn more"
        info={openMarkerLM}
        onClose={closeLearnMore}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

type Pathway = {
  id: string;
  name: string;
  icon: string;
  categories: BiomarkerCategoryId[];
};

/** Pathway grouping per the brief: Hormonal · Metabolic · Nutritional.
 *  Heart is folded into Metabolic since LDL is the man's primary
 *  metabolic-vascular risk signal, not a standalone pathway here. */
const PATHWAYS: Pathway[] = [
  { id: 'hormonal',    name: 'Hormonal',   icon: '🔥', categories: ['hormones'] },
  { id: 'metabolic',   name: 'Metabolic',  icon: '⚡', categories: ['metabolic', 'heart'] },
  { id: 'nutritional', name: 'Nutritional', icon: '☀️', categories: ['vitamins'] },
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  rightSlot,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <Pill tone="indigo" size="sm">
          {eyebrow}
        </Pill>
        <h2 className="font-display text-[22px] lg:text-[26px] leading-tight mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] text-ink-soft mt-1">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
