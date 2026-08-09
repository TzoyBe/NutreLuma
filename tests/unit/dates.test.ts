import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  ageFromBirthDate,
  localDateTimeToUtc,
  toZonedDayISO,
  utcToLocalDateTimeInput,
  zonedDayRangeUtc,
} from '@/lib/dates';

describe('zonedDayRangeUtc', () => {
  it('υπολογίζει σωστό εύρος για θερινή ώρα Ελλάδας (UTC+3)', () => {
    const { start, end } = zonedDayRangeUtc('2026-08-04', 'Europe/Athens');
    expect(start.toISOString()).toBe('2026-08-03T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-04T21:00:00.000Z');
  });

  it('υπολογίζει σωστό εύρος για χειμερινή ώρα (UTC+2)', () => {
    const { start } = zonedDayRangeUtc('2026-01-15', 'Europe/Athens');
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('λειτουργεί για UTC', () => {
    const { start, end } = zonedDayRangeUtc('2026-08-04', 'UTC');
    expect(start.toISOString()).toBe('2026-08-04T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  it('το εύρος διαρκεί περίπου 24 ώρες', () => {
    const { start, end } = zonedDayRangeUtc('2026-03-29', 'Europe/Athens');
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    // Ημέρα αλλαγής σε θερινή ώρα -> 23 ώρες.
    expect(hours).toBeGreaterThanOrEqual(22);
    expect(hours).toBeLessThanOrEqual(25);
  });
});

describe('toZonedDayISO', () => {
  it('αντιστοιχεί ένα βράδυ UTC στην επόμενη τοπική ημέρα', () => {
    // 21:30 UTC = 00:30 τοπική (επόμενη ημέρα) σε UTC+3
    expect(toZonedDayISO(new Date('2026-08-03T21:30:00.000Z'), 'Europe/Athens')).toBe('2026-08-04');
  });
});

describe('localDateTimeToUtc / utcToLocalDateTimeInput', () => {
  it('μετατρέπει τοπική ώρα σε UTC', () => {
    const utc = localDateTimeToUtc('2026-08-04T13:30', 'Europe/Athens');
    expect(utc.toISOString()).toBe('2026-08-04T10:30:00.000Z');
  });

  it('κάνει round-trip χωρίς απώλεια', () => {
    const value = '2026-11-20T07:45';
    const utc = localDateTimeToUtc(value, 'Europe/Athens');
    expect(utcToLocalDateTimeInput(utc, 'Europe/Athens')).toBe(value);
  });

  it('χειρίζεται μεσάνυχτα σωστά', () => {
    const value = '2026-06-01T00:00';
    const utc = localDateTimeToUtc(value, 'Europe/Athens');
    expect(utcToLocalDateTimeInput(utc, 'Europe/Athens')).toBe(value);
  });
});

describe('addDaysISO', () => {
  it('προσθέτει και αφαιρεί ημέρες με αλλαγή μήνα', () => {
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('ageFromBirthDate', () => {
  it('υπολογίζει ηλικία πριν τα γενέθλια', () => {
    expect(
      ageFromBirthDate(new Date('1990-12-31T00:00:00.000Z'), new Date('2026-08-04T00:00:00.000Z')),
    ).toBe(35);
  });

  it('υπολογίζει ηλικία μετά τα γενέθλια', () => {
    expect(
      ageFromBirthDate(new Date('1990-01-01T00:00:00.000Z'), new Date('2026-08-04T00:00:00.000Z')),
    ).toBe(36);
  });
});
