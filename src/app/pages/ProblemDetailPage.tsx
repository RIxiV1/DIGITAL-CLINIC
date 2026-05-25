import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock,
  CheckCircle2,
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
import { sampleBiomarkers } from '../data/biomarkers';
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
  const sourceMarkers = useMemo(() => {
    return getLatestReadyReport(reports)?.biomarkers ?? sampleBiomarkers;
  }, [reports]);

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

  return (
    <div className="min-h-dvh pb-28 lg:pb-12 bg-canvas">
      <Header variant="page" title="Deep dive" subtitle={p.title} />

      {/* Hero. "Personalised for you" pill removed — this is a generic
          deep-dive article (same copy for every visitor with the same
          condition), not personalised content. The pill belonged on
          RecommendedTestsPage where the page is genuinely per-quiz. */}
      <Container size="wide" className="pt-5 lg:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:max-w-3xl"
        >
          <h1 className="font-display text-h2-lg lg:text-display leading-tight mt-3 text-balance">
            {p.title}
          </h1>
          <p className="mt-3 lg:mt-4 text-ui lg:text-lead text-ink leading-relaxed text-pretty">
            {p.summary}
          </p>
        </motion.div>
      </Container>

      {/* Related markers visualisation */}
      {related.length > 0 && (
        <Container size="wide" className="mt-6">
          <Card padded={false} className="lg:max-w-3xl">
            <div className="px-5 pt-5 pb-3 border-b border-line">
              <div className="text-eyebrow uppercase tracking-[0.14em] font-bold text-indigo-700">
                Your numbers
              </div>
              <div className="font-display text-lead mt-1">
                What this looks like in your latest report
              </div>
            </div>
            <div className="divide-y divide-line/70">
              {related.map((m) => (
                <BiomarkerBar key={m.id} marker={m} compact />
              ))}
            </div>
          </Card>
        </Container>
      )}

      {/* What this means */}
      <Container size="wide" className="mt-6">
        <Card className="lg:max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
              <Info size={18} />
            </div>
            <div>
              <div className="font-display text-lead">
                What does this actually mean?
              </div>
              <p className="text-ui-sm text-ink leading-relaxed mt-2">
                {p.what}
              </p>
            </div>
          </div>
        </Card>
      </Container>

      {/* Why it matters */}
      <Container size="wide" className="mt-3">
        <Card className="!bg-gold-50 border-gold-200 lg:max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-gold-500 text-indigo-900 shrink-0">
              <Lightbulb size={18} />
            </div>
            <div>
              <div className="font-display text-lead">
                Why it’s worth your attention
              </div>
              <p className="text-ui-sm text-ink leading-relaxed mt-2">
                {p.whyMatters}
              </p>
            </div>
          </div>
        </Card>
      </Container>

      {/* Action plan */}
      <Container size="wide" className="mt-7 lg:mt-10">
        <div className="lg:max-w-3xl">
          <div className="font-sans text-caption uppercase tracking-[0.2em] text-indigo-700 font-bold">
            Your action plan
          </div>
          <h2 className="font-display text-h3 lg:text-h2-lg leading-tight mt-1">
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
                    <p className="text-meta text-ink-soft mt-1 leading-relaxed">
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

      {/* Retest */}
      <Container size="wide" className="mt-6">
        <Card className="!bg-indigo-600 border-indigo-600 text-white lg:max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-500/40 text-gold-300 shrink-0">
              <CalendarClock size={18} />
            </div>
            <div>
              <div className="font-display text-lead">When to re-check</div>
              <p className="text-meta text-indigo-100 mt-1.5 leading-relaxed">
                {p.retest}
              </p>
            </div>
          </div>
        </Card>
      </Container>

      <Container size="wide" className="mt-6 lg:mt-8 lg:pb-12">
        <div className="lg:max-w-3xl">
          <Button
            size="lg"
            responsiveFullWidth
            onClick={back}
          >
            Back to my report
          </Button>
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}
