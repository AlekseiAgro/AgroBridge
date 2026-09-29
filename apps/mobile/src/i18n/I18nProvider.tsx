import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { localeFromLanguageCode, type AppLocale } from './locales';
import { translate } from './translate';
import type { MessageKey } from './en';

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function deviceLocale(): AppLocale {
  const code = getLocales()[0]?.languageCode;
  return localeFromLanguageCode(code);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(deviceLocale);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return value;
}
