import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
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

const doctors = [
  {
    id: 'rk',
    name: 'Dr. Rohit Kapoor',
    specialty: 'Men’s Health · Andrology',
    years: '14 yrs',
    available: 'Today · 6:30 PM',
    rating: 4.9,
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ps',
    name: 'Dr. Priya Shah',
    specialty: 'Endocrinology · Metabolism',
    years: '11 yrs',
    available: 'Tomorrow · 11:00 AM',
    rating: 4.8,
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'as',
    name: 'Dr. Arjun Sen',
    specialty: 'Cardiology · Preventive',
    years: '18 yrs',
    available: 'Today · 9:15 PM',
    rating: 5.0,
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=200&q=80',
  },
];

export default function ClinicPage() {
  const { back } = useApp();
  return (
    <div className="min-h-screen pb-32 bg-canvas">
      <Header
        variant="page"
        title="The Clinic"
        subtitle="Your private concierge"
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
          <Card raised className="!bg-indigo-600 border-indigo-600 text-white !p-7 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-gold-500/15 blur-2xl" />
            <Pill tone="gold" size="sm">
              <Sparkles size={10} /> Concierge access
            </Pill>
            <h1 className="font-display text-[28px] leading-tight mt-3 text-balance">
              Talk to a doctor who actually
              <br />
              <span className="font-display-italic text-gold-400">has time.</span>
            </h1>
            <p className="mt-3 text-[13.5px] text-indigo-100 text-pretty leading-relaxed">
              Real consultations — 20 minutes, unhurried, with doctors trained
              in men’s health. Bring your report, leave with a plan.
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
          </Card>
        </motion.div>
      </Container>

      {/* Modes */}
      <Container className="mt-7">
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

      {/* Doctors */}
      <Container className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
              Available now
            </div>
            <h2 className="font-display text-[22px] leading-tight mt-1">
              Doctors who get men
            </h2>
          </div>
          <button className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-700">
            See all
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {doctors.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
            >
              <Card interactive>
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-indigo-100">
                      <img
                        src={d.avatar}
                        alt={d.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-good ring-2 ring-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-ink truncate">
                        {d.name}
                      </div>
                      <Pill tone="gold" size="sm">
                        {d.rating}★
                      </Pill>
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5">
                      {d.specialty}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Pill tone="neutral" size="sm">
                        {d.years}
                      </Pill>
                      <Pill tone="indigo" size="sm" dot>
                        {d.available}
                      </Pill>
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 flex gap-2">
                  <Button size="sm" variant="primary" className="flex-1">
                    Book
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1">
                    View profile
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
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
              <ul className="mt-2 grid gap-1.5">
                {[
                  'Doctors trained in men’s health, not generic GPs',
                  'Real time, not a 4-minute rush',
                  'Plain-English follow-ups, every time',
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 text-[13px] text-ink-soft"
                  >
                    <CheckCircle2 size={14} className="text-good shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
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
          featured ? 'bg-indigo-500/40 text-gold-300' : 'bg-indigo-50 text-indigo-700'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="font-semibold text-[13px]">{label}</div>
      <div
        className={`text-[11px] mt-0.5 ${featured ? 'text-indigo-100' : 'text-muted'}`}
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
