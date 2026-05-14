import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  Pill as PillIcon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BottomNav from '../components/BottomNav';
import { useApp } from '../AppContext';

export default function ClinicPage() {
  const { back } = useApp();

  return (
    <div className="min-h-screen pb-32 bg-canvas">
      <Header
        variant="page"
        title="The Clinic"
        subtitle="Book a consultation"
        hideDoc
        onBack={back}
      />

      {/* Hero card */}
      <Container className="pt-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card
            raised
            className="!bg-indigo-600 border-indigo-600 text-white !p-7 relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-gold-500/15 blur-2xl" />
            <Pill tone="gold" size="sm">
              <Sparkles size={10} /> Concierge access
            </Pill>
            <h1 className="font-display text-[28px] leading-tight mt-3 text-balance">
              Talk to a doctor who actually
              <br />
              <span className="font-display-italic text-gold-400">
                has time.
              </span>
            </h1>
            <p className="mt-3 text-[13.5px] text-indigo-100 text-pretty leading-relaxed">
              Real consultations — 20 minutes, unhurried, with senior
              clinicians who read your report before the call. Bring your
              questions, leave with a plan.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <ClinicStat label="Avg consult" value="20 min" />
              <ClinicStat label="Rating" value="4.92★" />
              <ClinicStat label="Follow-ups" value="Free" />
            </div>

            <Button
              size="lg"
              variant="gold"
              fullWidth
              className="mt-6"
              trailing={<ArrowRight size={18} />}
            >
              Book a consultation
            </Button>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-indigo-100">
              <span className="relative grid place-items-center w-3 h-3">
                <span className="absolute inset-0 rounded-full bg-good/40 animate-ping" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-good" />
              </span>
              Next slot available today
            </div>
          </Card>
        </motion.div>
      </Container>

      {/* Modes */}
      <Container className="mt-8">
        <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
          Choose your mode
        </div>
        <h2 className="font-display text-[22px] leading-tight mt-1">
          How would you like to meet?
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <ModeCard Icon={Video} label="Video" sub="20 min" featured />
          <ModeCard Icon={PhoneCall} label="Phone" sub="20 min" />
          <ModeCard Icon={MessageSquare} label="Chat" sub="Async" />
        </div>
      </Container>

      {/* How it works */}
      <Container className="mt-8">
        <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
          What happens
        </div>
        <h2 className="font-display text-[22px] leading-tight mt-1">
          Three calm steps
        </h2>

        <Card padded={false} className="mt-4 overflow-hidden">
          {[
            {
              num: '01',
              title: 'Pick a time that fits you',
              body: 'Same-day slots most days. Reschedule any time.',
            },
            {
              num: '02',
              title: 'Your doctor reads your report first',
              body: 'No starting from scratch. They come prepared.',
            },
            {
              num: '03',
              title: 'You leave with a written plan',
              body: 'Sent to your locker. Share with your GP if you want.',
            },
          ].map((row, i, arr) => (
            <div
              key={row.num}
              className={`flex items-start gap-3 p-4 ${
                i < arr.length - 1 ? 'border-b border-line/70' : ''
              }`}
            >
              <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-display text-[13px] shrink-0">
                {row.num}
              </div>
              <div>
                <div className="font-semibold text-[14px]">{row.title}</div>
                <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                  {row.body}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </Container>

      {/* Services */}
      <Container className="mt-8">
        <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
          Other services
        </div>
        <h2 className="font-display text-[22px] leading-tight mt-1">
          Quietly, taken care of
        </h2>

        <div className="mt-4 grid gap-3">
          {[
            {
              Icon: PillIcon,
              title: 'Repeat prescriptions',
              body: 'Order, refill, and track — all from inside the app.',
            },
            {
              Icon: CalendarPlus,
              title: 'At-home lab visits',
              body: 'Phlebotomist comes to you. Results land here automatically.',
            },
            {
              Icon: ShieldCheck,
              title: 'A second opinion',
              body: 'Have a diagnosis? We’ll line up a senior specialist within 48 hours.',
            },
          ].map((s) => (
            <Card key={s.title} interactive>
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0">
                  <s.Icon size={18} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{s.title}</div>
                  <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                    {s.body}
                  </p>
                </div>
                <ArrowRight size={16} className="text-muted shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      </Container>

      {/* Promise */}
      <Container className="mt-8">
        <Card className="!bg-white border-line">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-good-soft text-good shrink-0">
              <Stethoscope size={18} />
            </div>
            <div>
              <div className="font-display text-[16px] leading-tight">
                The Digital Clinic promise
              </div>
              <ul className="mt-2.5 grid gap-1.5">
                {[
                  'Senior clinicians, not a four-minute rush',
                  'Your full report read before the call',
                  'Plain-English written follow-up, every time',
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 text-[13px] text-ink-soft"
                  >
                    <CheckCircle2
                      size={14}
                      className="text-good shrink-0"
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </Container>

      {/* Pricing footnote */}
      <Container className="mt-6">
        <div className="flex items-center justify-between rounded-2xl bg-white border border-line px-4 py-3 shadow-soft">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <Clock size={14} className="text-indigo-600" />
            20-minute consult · ₹1,499
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
            Cancel anytime
          </span>
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}

function ModeCard({
  Icon,
  label,
  sub,
  featured,
}: {
  Icon: React.ElementType;
  label: string;
  sub: string;
  featured?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`rounded-[20px] p-4 cursor-pointer transition-colors text-center ${
        featured
          ? 'bg-indigo-600 text-white shadow-indigo'
          : 'bg-white border border-line shadow-soft text-ink'
      }`}
    >
      <div
        className={`mx-auto grid place-items-center w-10 h-10 rounded-2xl mb-2 ${
          featured
            ? 'bg-indigo-500/40 text-gold-300'
            : 'bg-indigo-50 text-indigo-700'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="font-semibold text-[13px]">{label}</div>
      <div
        className={`text-[11px] mt-0.5 ${
          featured ? 'text-indigo-100' : 'text-muted'
        }`}
      >
        {sub}
      </div>
    </motion.div>
  );
}

function ClinicStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-indigo-700/50 p-3 text-center">
      <div className="font-display text-[18px] leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-indigo-100 mt-1.5">
        {label}
      </div>
    </div>
  );
}
