/**
 * UI-language context. Holds the selected language, persists it, and
 * exposes a type-checked `t(key)` that resolves through the
 * English-fallback chain (see i18n/translations.ts).
 *
 * Deliberately NOT a pre-paint bootstrap like the theme: language doesn't
 * change first-paint correctness (English is the safe default and the
 * fallback), so a normal Context with a localStorage-seeded initial value
 * is enough — no inline <head> script needed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadLang, saveLang } from '../utils/persistence';
import {
  translate,
  type LangCode,
  type TranslationKey,
} from '../i18n/translations';

type LanguageValue = {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => loadLang());

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    saveLang(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translate(lang, key),
    [lang],
  );

  const value = useMemo<LanguageValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
