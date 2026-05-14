import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileLock2,
  Lock,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Pill from '../components/Pill';
import BottomNav from '../components/BottomNav';
import { useApp } from '../AppContext';
import { quizSteps } from '../data/quiz';

export default function ProfilePage() {
  const { quiz, navigate, reports } = useApp();

  const priorityLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const step of quizSteps) {
      for (const o of step.options) map.set(o.id, o.label);
    }
    return map;
  }, []);

  const ageLabel =
    quizSteps[0].options.find((o) => o.id === quiz.age)?.label ?? 'Not set';
  const activityLabel =
    quizSteps[1].options.find((o) => o.id === quiz.activity)?.label ?? 'Not set';

  return (
    <div className="min-h-screen pb-28 lg:pb-12 bg-canvas">
      <Header
        variant="page"
        title="Profile"
        subtitle="Account & preferences"
        hideDoc
      />

      <Container size="wide" className="pt-5 lg:pt-10">
        <div className="hidden lg:block mb-7">
          <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
            Profile
          </div>
          <h1 className="font-display text-[28px] lg:text-[34px] leading-tight mt-1">
            Account & preferences
          </h1>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT: Identity + Priorities */}
          <div className="lg:col-span-5 grid gap-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card raised className="!p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl grid place-items-center bg-indigo-600 text-white font-display text-[24px]">
                      S
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold-500 grid place-items-center text-indigo-900">
                      <Sparkles size={10} strokeWidth={3} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[20px] leading-tight">
                      Suhaib
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">
                      Member since Apr 2026
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Pill tone="gold" size="sm">
                        <Sparkles size={10} /> Founder’s Circle
                      </Pill>
                    </div>
                  </div>
                  <button
                    aria-label="Edit"
                    className="grid place-items-center w-9 h-9 rounded-full hover:bg-canvas text-indigo-700"
                  >
                    <Pencil size={16} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <ProfileStat
                    label="Reports"
                    value={String(reports.length)}
                  />
                  <ProfileStat
                    label="Age band"
                    value={quiz.age ? ageLabel : '—'}
                  />
                  <ProfileStat label="Activity" value={activityLabel} />
                </div>
              </Card>
            </motion.div>

            {/* Priorities */}
            <section>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
                    Your priorities
                  </div>
                  <h2 className="font-display text-[20px] leading-tight mt-1">
                    What we’re watching
                  </h2>
                </div>
                <button
                  onClick={() => navigate({ type: 'quiz' })}
                  className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-700 hover:text-indigo-800"
                >
                  Edit
                </button>
              </div>

              <Card className="mt-4">
                {quiz.priorities.length === 0 ? (
                  <div>
                    <p className="text-[13.5px] text-ink-soft leading-relaxed">
                      You haven’t set priorities yet. Take the quiz so we can
                      tailor your dashboard.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => navigate({ type: 'quiz' })}
                    >
                      Take the quiz
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {quiz.priorities.map((p) => (
                      <Pill key={p} tone="indigo" size="md">
                        {priorityLabels.get(p) ?? p}
                      </Pill>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </div>

          {/* RIGHT: Settings + sign out */}
          <div className="lg:col-span-7 grid gap-5">
            <section>
              <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-bold">
                Settings
              </div>
              <h2 className="font-display text-[20px] leading-tight mt-1">
                Account &amp; data
              </h2>

              <Card padded={false} className="mt-4 overflow-hidden">
                {[
                  {
                    Icon: Bell,
                    label: 'Notifications',
                    hint: 'Reminders, retest alerts',
                  },
                  {
                    Icon: FileLock2,
                    label: 'My data & exports',
                    hint: 'Download or delete everything',
                  },
                  {
                    Icon: CreditCard,
                    label: 'Membership',
                    hint: 'Founder’s Circle · active',
                  },
                  {
                    Icon: Lock,
                    label: 'Security & passcode',
                    hint: 'Face ID, app lock',
                  },
                  {
                    Icon: ShieldCheck,
                    label: 'Privacy & consent',
                    hint: 'Who sees what, and when',
                  },
                ].map((row, i, arr) => (
                  <button
                    key={row.label}
                    className={`w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors ${
                      i < arr.length - 1 ? 'border-b border-line/70' : ''
                    }`}
                  >
                    <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                      <row.Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px]">
                        {row.label}
                      </div>
                      <div className="text-[12px] text-muted truncate">
                        {row.hint}
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-muted shrink-0"
                    />
                  </button>
                ))}
              </Card>
            </section>

            <Button
              size="md"
              variant="secondary"
              fullWidth
              leading={<LogOut size={16} />}
              className="lg:!w-auto lg:self-start"
            >
              Sign out
            </Button>

            <p className="text-center lg:text-left text-[11px] text-muted">
              Digital Clinic · v0.1.0
            </p>
          </div>
        </div>
      </Container>

      <BottomNav />
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-canvas p-3 text-center border border-line/70">
      <div className="font-display text-[16px] leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted mt-1.5">
        {label}
      </div>
    </div>
  );
}
