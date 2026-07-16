import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Bot,
  EyeOff,
  FileLock2,
  Home,
  Languages,
  Lock,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Container from '../components/ui/Container';
import DataLockSetting from '../components/DataLockSetting';
import Header from '../components/Header';
import Pill from '../components/ui/Pill';
import BottomNav from '../components/BottomNav';
import DataPanelModal from '../components/DataPanelModal';
import {
  useDiscreet,
  useLanguage,
  useNavigation,
  useQuiz,
  useReports,
} from '../AppContext';
import { availableLanguages, type LangCode } from '../i18n/translations';
import { buildLabelMap, findOptionLabel } from '../data/quiz';
import {
  loadAiAutoFallbackSetting,
  loadTheme,
  saveAiAutoFallbackSetting,
  saveTheme,
  type Theme,
} from '../utils/persistence';

export default function ProfilePage() {
  const { quiz, resetQuiz } = useQuiz();
  const { reports } = useReports();
  const { navigate, replace } = useNavigation();
  const { lang, setLang, t } = useLanguage();
  const { discreet, setDiscreet } = useDiscreet();

  const handleSignOut = () => {
    // Anonymous account model — sign out resets the quiz and bounces
    // back to the landing page. Reports persist (they're the user's
    // locker, semantically separate from the session).
    resetQuiz();
    replace({ type: 'landing' });
  };

  // "My data & exports" opens DataPanelModal, which surfaces storage
  // stats and a one-button wipe path.
  const [dataPanelOpen, setDataPanelOpen] = useState(false);

  /** AI auto-fallback preference. Captured via useState initialiser so
   *  the localStorage read happens once at mount (not on every render).
   *  Toggle persists immediately on flip — no Save button needed. */
  const [aiAutoFallback, setAiAutoFallback] = useState<boolean>(() =>
    loadAiAutoFallbackSetting(),
  );
  const toggleAiAutoFallback = () => {
    const next = !aiAutoFallback;
    setAiAutoFallback(next);
    saveAiAutoFallbackSetting(next);
  };

  /** Theme preference. Defaults to dark — see index.html's bootstrap
   *  script and persistence.ts:loadTheme. On flip, persist immediately
   *  AND patch <html data-theme="…"> so the entire app reskins. The
   *  `theme-transitioning` class is added briefly so the 200ms cubic
   *  transition in index.css runs on this swap (but not on every
   *  subsequent render — see the @media (prefers-reduced-motion) rule
   *  for the opt-out path). */
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    saveTheme(next);
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.dataset.theme = next;
    // Keep the mobile-browser top-bar tint in sync with the canvas.
    // The bootstrap script in index.html stamps the matching value on
    // first paint; this handles every runtime flip after that. Hex
    // mirrors `--color-canvas` from the @theme / [data-theme='dark']
    // blocks in index.css — kept hardcoded here (not read from CSS)
    // because the <meta> tag lives outside the document body and
    // CSS variables don't reach it.
    const themeColor = next === 'light' ? '#F7F4EF' : '#0F1320';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);
    window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 240);
  };

  const priorityLabels = useMemo(() => buildLabelMap(), []);

  const ageLabel = quiz.age
    ? (findOptionLabel('age', quiz.age) ?? 'Not set')
    : 'Not set';
  const activityLabel = quiz.activity
    ? (findOptionLabel('activity', quiz.activity) ?? 'Not set')
    : 'Not set';

  return (
    <div className="min-h-dvh pb-28 md:pb-12 bg-canvas">
      <Header variant="page" title="Profile" subtitle="Account & preferences" />

      <Container size="wide" className="pt-5 md:pt-10">
        <div className="hidden md:block mb-7">
          <div className="font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
            Profile
          </div>
          <h1 className="font-display text-display-md lg:text-display-lg leading-tight mt-1">
            Account & preferences
          </h1>
        </div>

        <div className="grid md:grid-cols-12 gap-6 md:gap-8">
          {/* LEFT: Identity + Priorities */}
          <div className="md:col-span-5 grid gap-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                raised
                className="bg-surface border border-line/70 text-ink !p-6 relative overflow-hidden"
              >
                <div className="relative">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-display-md leading-tight">
                        Your account
                      </div>
                      <div className="text-caption text-muted mt-0.5">
                        Anonymous · stored in this browser
                      </div>
                    </div>
                    <button
                      onClick={() => navigate({ type: 'quiz' })}
                      aria-label="Edit profile via quiz"
                      title="Re-do the quiz to update"
                      className="grid place-items-center w-12 h-12 rounded-full bg-canvas/60 hover:bg-canvas text-ink-soft hover:text-ink transition-colors shrink-0"
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
                </div>
              </Card>
            </motion.div>

            {/* Priorities */}
            <section>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
                    Your priorities
                  </div>
                  <h2 className="font-display text-display-md leading-tight mt-1">
                    What we’re watching
                  </h2>
                </div>
                <button
                  onClick={() => navigate({ type: 'quiz' })}
                  className="inline-flex items-center min-h-11 px-2 -mr-2 text-caption font-bold uppercase tracking-label text-indigo-700 hover:text-indigo-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  Edit
                </button>
              </div>

              <Card className="mt-4">
                {quiz.priorities.length === 0 ? (
                  <div>
                    <p className="text-caption text-ink-soft leading-relaxed">
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
          <div className="md:col-span-7 grid gap-5">
            <section>
              <div className="font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
                Settings
              </div>
              <h2 className="font-display text-display-md leading-tight mt-1">
                Account &amp; data
              </h2>

              <Card padded={false} className="mt-4 overflow-hidden">
                {(
                  [
                    {
                      Icon: Home,
                      label: 'Visit homepage',
                      hint: 'See the marketing intro — no sign out',
                      onClick: () => navigate({ type: 'landing' }),
                    },
                    {
                      Icon: Bell,
                      label: 'Notifications',
                      hint: 'Reminders, retest alerts',
                      onClick: undefined,
                    },
                    {
                      Icon: FileLock2,
                      label: 'My data & exports',
                      hint: 'See what we store · delete everything',
                      onClick: () => setDataPanelOpen(true),
                    },
                    {
                      Icon: Lock,
                      label: 'Security & passcode',
                      hint: 'Face ID, app lock',
                      onClick: undefined,
                    },
                    {
                      Icon: ShieldCheck,
                      label: 'Privacy & consent',
                      hint: 'Who sees what, and when',
                      onClick: undefined,
                    },
                  ] as const
                ).map((row, i, arr) => {
                  const isInteractive = !!row.onClick;
                  const borderCls =
                    i < arr.length - 1 ? 'border-b border-line/70' : '';
                  // Interactive rows render as <button>; non-interactive
                  // "Coming soon" rows render as <div role="group"
                  // aria-disabled> so screen readers + keyboard users
                  // are told upfront that the row isn't actionable.
                  // Previously the unwired rows looked identical to
                  // wired ones (same padding, same icon, same hover
                  // affordance) but did nothing on tap — keyboard
                  // users tabbed through dead space without warning.
                  if (isInteractive) {
                    return (
                      <button
                        key={row.label}
                        type="button"
                        onClick={row.onClick}
                        className={`w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors cursor-pointer ${borderCls}`}
                      >
                        <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                          <row.Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-body-sm">
                            {row.label}
                          </div>
                          <div className="text-caption text-muted truncate">
                            {row.hint}
                          </div>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={row.label}
                      role="group"
                      aria-disabled="true"
                      className={`w-full px-5 py-4 flex items-center gap-3 text-left ${borderCls}`}
                    >
                      <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50/60 text-indigo-700/70 shrink-0">
                        <row.Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-body-sm text-ink/70">
                          {row.label}
                        </div>
                        <div className="text-caption text-muted truncate">
                          {row.hint}
                        </div>
                      </div>
                      <span className="inline-flex items-center h-5 px-2 rounded-full bg-canvas border border-line text-micro font-bold uppercase tracking-widest text-muted shrink-0">
                        Soon
                      </span>
                    </div>
                  );
                })}
              </Card>

              {/* Preferences card — separate from Account & data so
                  togglable settings live in their own group. As more
                  toggles get added (notifications cadence, units,
                  etc.) this card can grow without crowding the
                  navigation-style rows above. */}
              <div className="mt-7 font-sans text-caption uppercase tracking-eyebrow text-indigo-700 font-bold">
                Preferences
              </div>
              <h3 className="font-display text-display-sm leading-tight mt-1">
                App
              </h3>

              <Card padded={false} className="mt-4 overflow-hidden">
                {/* Language — UI-chrome i18n. availableLanguages() only
                    lists languages with translations, so a user can't
                    pick one that would silently render English. The native
                    16px-min select rule (index.css) avoids iOS zoom. */}
                <div className="w-full px-5 py-4 flex items-center gap-3 border-b border-line/70">
                  <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                    <Languages size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor="lang-select"
                      className="font-semibold text-body-sm text-ink block"
                    >
                      {t('profile.language')}
                    </label>
                    <div className="text-caption text-muted text-pretty">
                      {t('profile.languageHint')}
                    </div>
                  </div>
                  <select
                    id="lang-select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value as LangCode)}
                    aria-label={t('profile.language')}
                    className="min-h-11 rounded-xl bg-canvas border border-line text-body-sm text-ink px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  >
                    {availableLanguages().map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.native}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={toggleAiAutoFallback}
                  role="switch"
                  aria-checked={aiAutoFallback}
                  aria-label="AI auto-fallback for failed image parses"
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors cursor-pointer border-b border-line/70"
                >
                  <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-body-sm">
                      AI auto-fallback
                    </div>
                    <div className="text-caption text-muted text-pretty">
                      When local read fails on a photo, automatically try Google
                      Gemini. The image leaves your device for that step.
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      aiAutoFallback ? 'bg-indigo-600' : 'bg-line'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                        aiAutoFallback ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>

                {/* At-rest data lock (opt-in PIN). Encrypts saved reports
                    on this device; unlock prompt appears on every cold
                    open once enabled. */}
                <DataLockSetting />

                {/* Discreet Mode. Hides the screen the instant the app
                    loses focus or is backgrounded (app switcher, glance
                    away) and lifts when you return — the PRD's core
                    discretion promise for a user worried someone sees what
                    he's looking at. */}
                <button
                  type="button"
                  onClick={() => setDiscreet(!discreet)}
                  role="switch"
                  aria-checked={discreet}
                  aria-label="Discreet Mode"
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors cursor-pointer border-b border-line/70"
                >
                  <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                    <EyeOff size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-body-sm">
                      Discreet Mode
                    </div>
                    <div className="text-caption text-muted text-pretty">
                      Hide the screen the moment you switch apps or look away —
                      it reveals when you’re back, and shows nothing in the app
                      switcher.
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      discreet ? 'bg-indigo-600' : 'bg-line'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                        discreet ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>

                {/* Dark-theme toggle. Dark is the default brand experience
                    on first load; this switch lets users opt into light
                    for higher readability in bright environments
                    (clinics, outdoor sun). `aria-checked` reads "is dark
                    on?" so a screen reader announces dark as the active
                    state, matching the visual chrome. */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label="Dark theme"
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-canvas/60 transition-colors cursor-pointer"
                >
                  <div className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                    <Moon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-body-sm">Dark theme</div>
                    <div className="text-caption text-muted text-pretty">
                      On by default. Turn off for higher readability in bright
                      environments (outdoor light, clinic fluorescents).
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      theme === 'dark' ? 'bg-indigo-600' : 'bg-line'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </Card>
            </section>

            <Button
              size="md"
              variant="secondary"
              responsiveFullWidth
              leading={<LogOut size={16} />}
              onClick={handleSignOut}
              className="md:self-start"
            >
              Sign out
            </Button>

            <p className="text-center md:text-left text-caption text-muted">
              Digital Clinic · v0.1.0
            </p>
          </div>
        </div>
      </Container>

      <BottomNav />

      <DataPanelModal
        open={dataPanelOpen}
        onClose={() => setDataPanelOpen(false)}
      />
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-canvas/60 border border-line/60 p-3 text-center">
      <div className="font-display text-body leading-tight text-ink truncate">
        {value}
      </div>
      <div className="text-micro uppercase tracking-label font-bold text-muted mt-1.5">
        {label}
      </div>
    </div>
  );
}
