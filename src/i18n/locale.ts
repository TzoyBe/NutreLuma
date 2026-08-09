import 'server-only';
import { DEFAULT_LOCALE, t as translate, type Locale, type TranslationKey } from './index';

/**
 * Επιλογή γλώσσας στον server.
 *
 * Η γλώσσα ζει σε cookie και διαβάζεται ανά αίτημα. ΔΕΝ κρατιέται ποτέ σε
 * module-level μεταβλητή: στα server components το module state μοιράζεται
 * μεταξύ ταυτόχρονων αιτημάτων, οπότε θα έβλεπε ο ένας χρήστης τη γλώσσα του
 * άλλου.
 */
export const LOCALE_COOKIE = 'cv_locale';

export const SUPPORTED_LOCALES: Locale[] = ['en'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

/** English is the sole application locale. */
export function localeFromAcceptLanguage(value: string | null | undefined): Locale | null {
  return value ? 'en' : null;
}

export async function getLocale(): Promise<Locale> {
  return DEFAULT_LOCALE;
}

/**
 * Επιστρέφει συνάρτηση μετάφρασης δεμένη με τη γλώσσα του αιτήματος.
 *
 * Χρήση σε server component:
 *   const t = await getT();
 *   <h1>{t('dashboard.title')}</h1>
 *
 * Το όνομα `t` σκιάζει σκόπιμα το καθολικό `t`, ώστε τα υπάρχοντα call sites
 * να μη χρειάζονται καμία αλλαγή.
 */
export async function getT(): Promise<
  (key: TranslationKey, vars?: Record<string, string | number>) => string
> {
  const locale = await getLocale();
  return (key, vars) => translate(key, locale, vars);
}
