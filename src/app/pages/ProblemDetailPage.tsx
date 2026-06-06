import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  Info,
  Lightbulb,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import BiomarkerBar from '../components/BiomarkerBar';
import BottomNav from '../components/BottomNav';
import { useNavigation, useReports } from '../AppContext';
import { sampleBiomarkers, type BiomarkerStatus } from '../data/biomarkers';
import { getLatestReadyReport } from '../data/reports';
import { getProblem } from '../data/problems';

export default function ProblemDetailPage({
  problemId,
}: {
  problemId: string;
}) {
  const { back } = useNavigation();
  const { reports } = useReports();
  const p = getProblem(problemId);

  /**
   * The deep-dive page used to hardcode `sampleBiomarkers` for its
   * "Your numbers" visualisation — so a user who'd uploaded a real
   * report would see the SAMPLE testosterone value (280 ng/dL), not
   * their own. Now we source from the most recent ready report, and
   * fall back to sample only when there isn't one (e.g., a user who
   * came straight from the landing CTA without uploading anything).
   */
  const latestReport = useMemo(() => getLatestReadyReport(reports), [reports]);
  const sourceMarkers = useMemo(
    () => latestReport?.biomarkers ?? sampleBiomarkers,
    [latestReport],
  );

  /** Doctor-handoff export. Offered only for a real (non-sample) report —
   *  the deep dive otherwise dead-ends on "Back to my report" with no way
   *  to act on what the user just read. Mirrors ReportResultsPage's lazy
   *  import + ref-dedup so a double-tap doesn't spawn two PDFs while the
   *  jspdf chunk is still resolving. */
  const canDownloadDoctorPdf = !!latestReport && !latestReport.isSample;
  const pdfBusyRef = useRef(false);
  const handleDoctorPdf = async () => {
    if (!latestReport || pdfBusyRef.current) return;
    pdfBusyRef.current = true;
    try {
      const { generateReportPdf } = await import('../services/reportPdf');
      generateReportPdf(latestReport);
    } finally {
      pdfBusyRef.current = false;
    }
  };

  /** Section disclosure. Most users land here from a flagged marker
   *  card on the dashboard — they came for the action plan (which
   *  stays always-visible below the hero) and might want to drill
   *  into the reference content (What / Why / Numbers / Retest). Each
   *  starts collapsed; the header is the toggle. Previously every
   *  section rendered open: a hero + 4 reading cards + the action-plan
   *  grid + the retest card, all stacked vertically, all eager. */
  type SectionId = 'numbers' | 'what' | 'why' | 'retest';
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    () => new Set(),
  );
  const toggleSection = (id: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const isOpen = (id: SectionId) => expandedSections.has(id);

  if (!p) {
    return (
      <div className="min-h-dvh flex flex-col bg-canvas">
        <Header variant="page" title="Not found" />
        <div className="flex-1 grid place-items-center px-6 py-10">
          <div className="text-center max-w-md">
            <p className="text-ink-soft">We couldn’t find that topic.</p>
            <Button className="mt-4" onClick={back}>
              Go back
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const related = sourceMarkers.filter((m) =>
    p.relatedMarkerIds.includes(m.id),
  );

  /** Pick the focal marker for the "Your numbers" section. The URL
   *  doesn't carry which marker triggered this drill-in (just
   *  /problem/:problemId), so we infer the focal from severity: worst
   *  status first, then natural order. The user came here because
   *  something was alarming — show the most-alarming related marker
   *  as the full BiomarkerBar and demote the rest to a compact
   *  inline strip. Previously every related marker rendered with
   *  equal weight, which inverted the Isolation Effect for a page
   *  whose job is to focus the user on one thing. */
  const severityRank = (s: BiomarkerStatus) =>
    s === 'critical' ? 0 : s === 'concern' ? 1 : s === 'attention' ? 2 : 3;
  const focalMarker = related.length
    ? [...related].sort(
        (a, b) => severityRank(a.status) - severityRank(b.status),
      )[0]
    : null;
  const companionMarkers = focalMarker
    ? related.filter((m) => m.id !== focalMarker.id)
    : [];

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Deep dive" subtitle={p.title} />

      {/* Hero. "Personalised for you" pill removed — this is a generic
          deep-dive article (same copy for every visitor with the same
          condition), not personalised content. The pill belonged on
          RecommendedTestsPage where the page is genuinely per-quiz. */}
      <Container size="wide" className="pt-5 md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:max-w-3xl"
        >
          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-3 text-balance">
            {p.title}
          </h1>
          <p className="mt-3 md:mt-4 text-body lg:text-body-lg text-ink leading-relaxed text-pretty">
            {p.summary}
          </p>
        </motion.div>
      </Container>

      {/* Related markers visualisation — collapsed by default. The hero
          + action plan carry the user's primary intent (what to do);
          the numbers context is one tap away. */}
      {related.length > 0 && (
        <Container size="wide" className="mt-6">
          <Card padded={false} className="lg:max-w-3xl">
            <button
              type="button"
              onClick={() => toggleSection('numbers')}
              aria-expanded={isOpen('numbers')}
              aria-controls="problem-section-numbers"
              className="w-full px-5 pt-5 pb-4 flex items-start gap-3 text-left hover:bg-canvas/40 transition-colors"
            >
              <div className="flex-1">
                <div className="text-micro uppercase tracking-label font-bold text-indigo-700">
                  Your numbers
                </div>
                <div className="font-display text-body-lg mt-1">
                  What this looks like in your latest report
                </div>
              </div>
              <ChevronDown
                size={18}
                className={`text-muted shrink-0 transition-transform duration-200 ${
                  isOpen('numbers') ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            {isOpen('numbers') && (
              <div
                id="problem-section-numbers"
                className="border-t border-line"
              >
                {/* Focal: the worst-status related marker. Full
                    BiomarkerBar so the user can see range + position +
                    delta for the one that brought them here. */}
                {focalMarker && (
                  <BiomarkerBar marker={focalMarker} compact />
                )}
                {/* Companions: every other related marker as a compact
                    inline strip — name + value + unit, dot-separated.
                    Reading order matches the focal's pathway, not
                    severity (the user came for the focal; companions
                    are pathway context, not parallel focal points). */}
                {companionMarkers.length > 0 && (
                  <div className="px-5 py-3 border-t border-line/70 bg-canvas/40">
                    <div className="text-micro uppercase tracking-label font-bold text-muted mb-1.5">
                      Related markers
                    </div>
                    <p className="text-caption text-ink-soft leading-relaxed">
                      {companionMarkers.map((m, i) => (
                        <span key={m.id}>
                          {i > 0 && (
                            <span className="text-muted/60"> · </span>
                          )}
                          {m.name}{' '}
                          <span className="tabular-nums font-semibold text-ink">
                            {m.value}
                          </span>
                          {m.unit && (
                            <span className="text-muted"> {m.unit}</span>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Container>
      )}

      {/* What this means — collapsed by default. Reference content; the
          user can open if they want context on the problem itself. */}
      <Container size="wide" className="mt-6">
        <Card padded={false} className="lg:max-w-3xl">
          <button
            type="button"
            onClick={() => toggleSection('what')}
            aria-expanded={isOpen('what')}
            aria-controls="problem-section-what"
            className="w-full p-5 flex items-center gap-3 text-left hover:bg-canvas/40 transition-colors"
          >
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
              <Info size={18} />
            </div>
            <div className="flex-1 font-display text-body-lg">
              What does this actually mean?
            </div>
            <ChevronDown
              size={18}
              className={`text-muted shrink-0 transition-transform duration-200 ${
                isOpen('what') ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {isOpen('what') && (
            <div id="problem-section-what" className="px-5 pb-5 -mt-1">
              <p className="text-body-sm text-ink leading-relaxed">{p.what}</p>
            </div>
          )}
        </Card>
      </Container>

      {/* Why it matters — collapsed by default. Same shape as What. */}
      <Container size="wide" className="mt-3">
        <Card padded={false} className="!bg-gold-50 border-gold-200 lg:max-w-3xl">
          <button
            type="button"
            onClick={() => toggleSection('why')}
            aria-expanded={isOpen('why')}
            aria-controls="problem-section-why"
            className="w-full p-5 flex items-center gap-3 text-left hover:bg-gold-100/50 transition-colors"
          >
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-gold-500 text-indigo-900 shrink-0">
              <Lightbulb size={18} />
            </div>
            <div className="flex-1 font-display text-body-lg">
              Why it’s worth your attention
            </div>
            <ChevronDown
              size={18}
              className={`text-ink-soft shrink-0 transition-transform duration-200 ${
                isOpen('why') ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {isOpen('why') && (
            <div id="problem-section-why" className="px-5 pb-5 -mt-1">
              <p className="text-body-sm text-ink leading-relaxed">
                {p.whyMatters}
              </p>
            </div>
          )}
        </Card>
      </Container>

      {/* Action plan */}
      <Container size="wide" className="mt-7 md:mt-10">
        <div className="lg:max-w-3xl">
          <div className="font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
            Your action plan
          </div>
          <h2 className="font-display text-display-md leading-tight mt-1">
            Doable this month
          </h2>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3 lg:max-w-3xl">
          {p.actions.map((a, i) => (
            // Per-row stagger removed — see #6.7. Action lists rarely
            // exceed 4 items so the stagger was pure cost.
            <div key={a.title}>
              <Card>
                <div className="flex items-start gap-3">
                  <div className="font-display text-indigo-700 text-body-lg shrink-0 w-7">
                    0{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{a.title}</div>
                    <p className="text-caption text-ink-soft mt-1 leading-relaxed">
                      {a.detail}
                    </p>
                  </div>
                  <CheckCircle2
                    size={20}
                    className="text-indigo-300 shrink-0"
                  />
                </div>
              </Card>
            </div>
          ))}
        </div>
      </Container>

      {/* Retest — collapsed by default. Cadence info; user opens when
          they want to schedule the next test. */}
      <Container size="wide" className="mt-6">
        <Card
          padded={false}
          className="!bg-indigo-600 border-indigo-600 text-on-primary lg:max-w-3xl"
        >
          <button
            type="button"
            onClick={() => toggleSection('retest')}
            aria-expanded={isOpen('retest')}
            aria-controls="problem-section-retest"
            className="w-full p-5 flex items-center gap-3 text-left hover:bg-indigo-700/40 transition-colors"
          >
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-500/40 text-gold-300 shrink-0">
              <CalendarClock size={18} />
            </div>
            <div className="flex-1 font-display text-body-lg">
              When to re-check
            </div>
            <ChevronDown
              size={18}
              className={`text-indigo-100 shrink-0 transition-transform duration-200 ${
                isOpen('retest') ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {isOpen('retest') && (
            <div id="problem-section-retest" className="px-5 pb-5 -mt-1">
              <p className="text-caption text-indigo-100 leading-relaxed">
                {p.retest}
              </p>
            </div>
          )}
        </Card>
      </Container>

      <Container size="wide" className="mt-6 md:mt-8 md:pb-12">
        <div className="lg:max-w-3xl">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {canDownloadDoctorPdf && (
              <Button
                size="lg"
                variant="secondary"
                responsiveFullWidth
                leading={<Download size={18} />}
                onClick={handleDoctorPdf}
              >
                Take this to your doctor
              </Button>
            )}
            <Button size="lg" responsiveFullWidth onClick={back}>
              Back to my report
            </Button>
          </div>
          {canDownloadDoctorPdf && (
            <p className="mt-2 text-caption text-muted leading-relaxed">
              Downloads your full latest report as a clean PDF — flagged
              markers, healthy ranges, and plain-English notes — to share at
              your appointment.
            </p>
          )}
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}
