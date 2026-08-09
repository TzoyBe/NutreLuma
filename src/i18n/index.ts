import { el, type Dictionary } from './el';
import { en, type Translations } from './en';

export type Locale = 'el' | 'en';

const DICTIONARIES: Record<Locale, Translations> = {
  el: el as unknown as Translations,
  en,
};

/**
 * Προεπιλεγμένη γλώσσα. Για να προστεθεί δεύτερη γλώσσα στο UI αρκεί να
 * περαστεί `locale` στο `t()` (ή να τυλιχθεί σε provider) — όλα τα κείμενα
 * βρίσκονται ήδη σε λεξικά ανά γλώσσα.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Translations {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function localeTag(locale: Locale = DEFAULT_LOCALE): string {
  return 'en-GB';
}

/**
 * Τυποποιημένη αναζήτηση κειμένου: t('meal.analyze').
 * Αν το κλειδί δεν υπάρχει επιστρέφεται το ίδιο το κλειδί (ορατό σε dev).
 */
export function t(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>,
): string {
  const [section, entry] = key.split('.') as [keyof Translations, string];
  const dict = getDictionary(locale);
  const value = (dict[section] as Record<string, string> | undefined)?.[entry];
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type SectionKeys<S extends keyof Dictionary> = `${S & string}.${keyof Dictionary[S] & string}`;
export type TranslationKey = { [S in keyof Dictionary]: SectionKeys<S> }[keyof Dictionary];

export { el, en };
