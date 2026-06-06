import { describe, it, expect } from 'vitest';
import {
  availableLanguages,
  en,
  translate,
  translations,
} from './translations';

describe('translate — English-fallback chain', () => {
  it('returns the language string when present', () => {
    expect(translate('hi', 'nav.home')).toBe('होम');
    expect(translate('en', 'nav.home')).toBe('Home');
  });

  it('falls back to English when a language lacks the key', () => {
    // Tamil is scaffolded but unpopulated → English.
    expect(translate('ta', 'nav.home')).toBe('Home');
  });

  it('never returns blank — falls back to English for every key/lang', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      for (const lang of Object.keys(translations) as Array<
        keyof typeof translations
      >) {
        expect(translate(lang, key).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('availableLanguages', () => {
  it('lists only English + languages that have translations', () => {
    const codes = availableLanguages().map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    // Unpopulated regional scaffolds stay hidden until translated.
    expect(codes).not.toContain('ta');
  });
});
