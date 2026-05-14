import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Info,
  Lightbulb,
  Stethoscope,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BiomarkerBar from '../components/BiomarkerBar';
import { useApp } from '../AppContext';
import { sampleBiomarkers } from '../data/biomarkers';
import { getProblem } from '../data/problems';

export default function ProblemDetailPage({
  problemId,
}: {
  problemId: string;
}) {
  const { back, navigate } = useApp();
  const p = getProblem(problemId);

  if (!p) {
    return (
      <div className="min-h-screen bg-canvas">
        <Header variant="page" title="Not found" />
        <Container size="wide" className="pt-10 text-center">
          <p className="text-ink-soft">We couldn’t find that topic.</p>
          <Button className="mt-4" onClick={back}>
            Go back
          </Button>
        </Container>
      </div>
    );
  }

  const related = sampleBiomarkers.filter((m) =>
    p.relatedMarkerIds.includes(m.id),
  );

  return (
    <div className="min-h-screen pb-20 bg-canvas">
      <Header variant="page" title="Deep dive" subtitle={p.title} />

      {/* Hero */}
      <Container size="wide" className="pt-5 lg:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:max-w-3xl"
        >
          <Pill tone="gold" size="md">
            Personalised for you
          </Pill>
          <h1 className="font-display text-[30px] lg:text-[40px] leading-tight mt-3 text-balance">
            {p.title}
          </h1>
          <p className="mt-3 lg:mt-4 text-[15px] lg:text-[17px] text-ink leading-relaxed text-pretty">
            {p.summary}
          </p>
        </motion.div>
      </Container>

      {/* Related markers visualisation */}
      {related.length > 0 && (
        <Container size="wide" className="mt-6">
          <Card padded={false} className="lg:max-w-3xl">
            <div className="px-5 pt-5 pb-3 border-b border-line">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-indigo-700">
                Your numbers
              </div>
              <div className="font-display text-[17px] mt-1">
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
              <div className="font-display text-[17px]">
                What does this actually mean?
              </div>
              <p className="text-[14px] text-ink leading-relaxed mt-2">
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
              <div className="font-display text-[17px]">
                Why it’s worth your attention
              </div>
              <p className="text-[14px] text-ink leading-relaxed mt-2">
                {p.whyMatters}
              </p>
            </div>
          </div>
        </Card>
      </Container>

      {/* Action plan */}
      <Container size="wide" className="mt-7 lg:mt-10">
        <div className="lg:max-w-3xl">
          <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
            Your action plan
          </div>
          <h2 className="font-display text-[22px] lg:text-[28px] leading-tight mt-1">
            Doable this month
          </h2>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3 lg:max-w-3xl">
          {p.actions.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <Card>
                <div className="flex items-start gap-3">
                  <div className="font-display text-indigo-700 text-[18px] shrink-0 w-7">
                    0{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{a.title}</div>
                    <p className="text-[13.5px] text-ink-soft mt-1 leading-relaxed">
                      {a.detail}
                    </p>
                  </div>
                  <CheckCircle2
                    size={20}
                    className="text-indigo-300 shrink-0"
                  />
                </div>
              </Card>
            </motion.div>
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
              <div className="font-display text-[17px]">When to re-check</div>
              <p className="text-[13.5px] text-indigo-100 mt-1.5 leading-relaxed">
                {p.retest}
              </p>
            </div>
          </div>
        </Card>
      </Container>

      {/* Talk to a doctor */}
      <Container size="wide" className="mt-4">
        <Card className="lg:max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
              <Stethoscope size={18} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Talk this through</div>
              <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                Bigger changes — like starting medication — belong with your
                doctor. Bring this page to your next consult.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => navigate({ type: 'clinic' })}
                trailing={<ArrowRight size={14} />}
              >
                Book a clinician consult
              </Button>
            </div>
          </div>
        </Card>
      </Container>

      <Container size="wide" className="mt-6 lg:mt-8 lg:pb-12">
        <div className="lg:max-w-3xl">
          <Button
            size="lg"
            fullWidth
            onClick={back}
            className="lg:!w-auto"
          >
            Back to my report
          </Button>
        </div>
      </Container>
    </div>
  );
}
