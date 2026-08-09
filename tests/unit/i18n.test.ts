import { describe, expect, it } from 'vitest';
import { el, en, localeTag, t } from '@/i18n';
import { localeFromAcceptLanguage } from '@/i18n/locale';

type Dict = Record<string, Record<string, string>>;

const elDict = el as unknown as Dict;
const enDict = en as unknown as Dict;

describe('πληρότητα λεξικών', () => {
  it('τα δύο λεξικά έχουν τις ίδιες ενότητες', () => {
    expect(Object.keys(enDict).sort()).toEqual(Object.keys(elDict).sort());
  });

  it('κάθε ενότητα έχει ακριβώς τα ίδια κλειδιά', () => {
    for (const section of Object.keys(elDict)) {
      expect(Object.keys(enDict[section] ?? {}).sort(), `ενότητα: ${section}`).toEqual(
        Object.keys(elDict[section]!).sort(),
      );
    }
  });

  it('καμία τιμή δεν είναι κενή', () => {
    for (const [locale, dict] of [
      ['el', elDict],
      ['en', enDict],
    ] as const) {
      for (const [section, entries] of Object.entries(dict)) {
        for (const [key, value] of Object.entries(entries)) {
          expect(typeof value, `${locale}.${section}.${key}`).toBe('string');
          expect(value.trim().length, `${locale}.${section}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('τα αγγλικά κείμενα δεν έχουν μείνει στα ελληνικά', () => {
    const greek = /[Ͱ-Ͽἀ-῿]/;
    const leftovers: string[] = [];
    for (const [section, entries] of Object.entries(enDict)) {
      for (const [key, value] of Object.entries(entries)) {
        if (greek.test(value)) leftovers.push(`${section}.${key}`);
      }
    }
    expect(leftovers).toEqual([]);
  });
});

describe('t()', () => {
  it('επιστρέφει το κείμενο της ζητούμενης γλώσσας', () => {
    expect(t('common.save', 'el')).toBe(elDict.common!.save);
    expect(t('common.save', 'en')).toBe(enDict.common!.save);
    expect(t('common.save', 'el')).not.toBe(t('common.save', 'en'));
  });

  it('πέφτει στην προεπιλογή για άγνωστη γλώσσα', () => {
    expect(t('common.save', 'de' as never)).toBe(enDict.common!.save);
  });

  it('επιστρέφει το κλειδί όταν λείπει η μετάφραση', () => {
    expect(t('does.notExist' as never, 'el')).toBe('does.notExist');
  });

  it('αντικαθιστά μεταβλητές', () => {
    const withVar = t('billing.trialActive', 'en', { days: 3 });
    expect(withVar).not.toContain('{days}');
    expect(withVar).toContain('3');
  });

  it('αφήνει άθικτη μεταβλητή που δεν δόθηκε', () => {
    expect(t('billing.trialActive', 'en')).toContain('{days}');
  });
});

describe('localeTag', () => {
  it('δίνει έγκυρα BCP-47 tags', () => {
    expect(localeTag('el')).toBe('en-GB');
    expect(localeTag('en')).toBe('en-GB');
  });
});

describe('browser locale detection', () => {
  it('supports Greek and English regional variants only', () => {
    expect(localeFromAcceptLanguage('en-US,en;q=0.8')).toBe('en');
    expect(localeFromAcceptLanguage('el-GR,el;q=0.9,en;q=0.5')).toBe('en');
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9')).toBe('en');
  });

  it('respects quality ordering among supported languages', () => {
    expect(localeFromAcceptLanguage('en;q=0.4,el;q=0.9')).toBe('en');
  });
});

describe('όροι χρήσης', () => {
  it('υπάρχουν και οι 20 ενότητες σε κάθε γλώσσα', () => {
    for (const [locale, dict] of [
      ['el', elDict],
      ['en', enDict],
    ] as const) {
      for (let n = 1; n <= 20; n += 1) {
        expect(dict.terms?.[`s${n}Title`], `${locale}.terms.s${n}Title`).toBeTruthy();
        expect(dict.terms?.[`s${n}Body`], `${locale}.terms.s${n}Body`).toBeTruthy();
      }
    }
  });

  it('διατηρούν τη ρήτρα που δεν αποκλείει ό,τι ο νόμος απαγορεύει', () => {
    // Χωρίς αυτή την επιφύλαξη ολόκληρη η ρήτρα περιορισμού ευθύνης
    // κινδυνεύει να κριθεί καταχρηστική.
    expect(elDict.terms!.s15Body).toContain('βαριά αμέλεια');
    expect(enDict.terms!.s15Body).toContain('gross negligence');
  });
});
