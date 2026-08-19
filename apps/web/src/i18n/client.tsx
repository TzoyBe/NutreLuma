'use client';

import * as React from 'react';
import { DEFAULT_LOCALE, t as translate, type Locale, type TranslationKey } from './index';

/**
 * Επιλογή γλώσσας στον client.
 *
 * Η γλώσσα έρχεται από τον server (cookie) μέσω του root layout, ώστε να μην
 * υπάρχει flash λάθος γλώσσας στο πρώτο render και το SSR markup να ταιριάζει
 * με το client markup.
 */
const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

export type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

/**
 * Χρήση σε client component:
 *   const t = useT();
 *   <button>{t('common.save')}</button>
 *
 * Το όνομα `t` σκιάζει σκόπιμα το καθολικό `t`, ώστε τα υπάρχοντα call sites
 * να μη χρειάζονται καμία αλλαγή.
 */
export function useT(): TranslateFn {
  const locale = useLocale();
  return React.useCallback(
    (key, vars) => translate(key, locale, vars),
    [locale],
  );
}
