/**
 * Lightweight, dependency-free i18n for the app's UI CHROME.
 *
 * Scope (deliberate): navigation, buttons, settings labels — the
 * non-clinical surface. Clinical interpretation copy (biomarker `plain`
 * text, problem write-ups, risk wording) is intentionally NOT routed
 * through here: those need clinician-reviewed translations, not a
 * dictionary an engineer fills in. English is the source of truth and the
 * fallback for every key, so a partially-translated language degrades to
 * English rather than showing blanks.
 *
 * Adding a language: populate its object below with the keys you have
 * reviewed translations for. `availableLanguages()` only surfaces a
 * language in the picker once it has at least one translated string, so
 * users never select a language that would just render English.
 */

export type LangCode = 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';

export const LANGUAGES: ReadonlyArray<{
  code: LangCode;
  /** English name (for a11y / fallback). */
  label: string;
  /** Endonym — shown in the picker so speakers recognise their own. */
  native: string;
}> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

/**
 * English source of truth — every key lives here. `as const` so the key
 * union (`TranslationKey`) is derived and `t()` is type-checked.
 */
export const en = {
  'nav.home': 'Home',
  'nav.quiz': 'Quiz',
  'nav.profile': 'Profile',
  'profile.language': 'Language',
  'profile.languageHint': 'Choose your app language',
} as const;

export type TranslationKey = keyof typeof en;

/**
 * Hindi — reviewed UI-chrome strings. (Drafted; should get a final
 * native-speaker pass before launch, like any production copy.)
 */
const hi: Partial<Record<TranslationKey, string>> = {
  'nav.home': 'होम',
  'nav.quiz': 'क्विज़',
  'nav.profile': 'प्रोफ़ाइल',
  'profile.language': 'भाषा',
  'profile.languageHint': 'ऐप की भाषा चुनें',
};

/* Regional scaffolding — structure is ready; populate with reviewed
 * translations to light each one up in the picker. */
const ta: Partial<Record<TranslationKey, string>> = {};
const te: Partial<Record<TranslationKey, string>> = {};
const bn: Partial<Record<TranslationKey, string>> = {};
const mr: Partial<Record<TranslationKey, string>> = {};

export const translations: Record<
  LangCode,
  Partial<Record<TranslationKey, string>>
> = { en, hi, ta, te, bn, mr };

/**
 * Resolve a key for a language with an English fallback chain:
 * requested language → English → the raw key (never blank). Pure, so the
 * fallback behaviour is unit-testable without mounting the context.
 */
export function translate(lang: LangCode, key: TranslationKey): string {
  return translations[lang][key] ?? translations.en[key] ?? key;
}

/**
 * Languages safe to show in the picker: English plus any with at least
 * one translated string. Prevents offering a language that would just
 * render English (a misleading dead end) until it's actually populated.
 */
export function availableLanguages(): typeof LANGUAGES {
  return LANGUAGES.filter(
    (l) => l.code === 'en' || Object.keys(translations[l.code]).length > 0,
  ) as typeof LANGUAGES;
}
