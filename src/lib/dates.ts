/**
 * Χειρισμός ημερομηνιών.
 * Κανόνας: όλα αποθηκεύονται σε UTC· ο υπολογισμός ορίων ημέρας και η εμφάνιση
 * γίνονται πάντα με βάση το timezone του χρήστη.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Μετατόπιση (ms) της ζώνης `tz` για τη δεδομένη χρονική στιγμή. */
export function timezoneOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "2026-08-04" + tz -> η στιγμή (UTC) που ξεκινά αυτή η τοπική ημέρα. */
export function zonedDayStartUtc(dayISO: string, tz: string): Date {
  const [y, m, d] = dayISO.split('-').map(Number);
  const naive = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  // Δύο περάσματα: το πρώτο δίνει προσέγγιση, το δεύτερο διορθώνει σε αλλαγές DST.
  let ts = naive - timezoneOffsetMs(new Date(naive), tz);
  ts = naive - timezoneOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** Εύρος [start, end) σε UTC για μία τοπική ημέρα. */
export function zonedDayRangeUtc(dayISO: string, tz: string): { start: Date; end: Date } {
  const start = zonedDayStartUtc(dayISO, tz);
  const end = zonedDayStartUtc(addDaysISO(dayISO, 1), tz);
  return { start, end };
}

/** Η τοπική ημερομηνία (YYYY-MM-DD) μιας στιγμής UTC. */
export function toZonedDayISO(date: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(date);
}

export function todayISO(tz: string): string {
  return toZonedDayISO(new Date(), tz);
}

export function addDaysISO(dayISO: string, days: number): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  const ts = Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + days * DAY_MS;
  const dt = new Date(ts);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Λίστα ημερομηνιών [from..to] (συμπεριλαμβανομένων). */
export function dayRangeList(fromISO: string, toISO: string, max = 400): string[] {
  const out: string[] = [];
  let cur = fromISO;
  while (cur <= toISO && out.length < max) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

export function formatTimeInTz(date: Date, tz: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateInTz(date: Date, tz: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDayISOHuman(dayISO: string, locale = 'en-GB'): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

/**
 * Συνδυάζει τοπική ημερομηνία + ώρα (από datetime-local input) σε UTC Date,
 * λαμβάνοντας υπόψη το timezone του χρήστη και όχι του server.
 */
export function localDateTimeToUtc(value: string, tz: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart!.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const naive = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  let ts = naive - timezoneOffsetMs(new Date(naive), tz);
  ts = naive - timezoneOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** UTC Date -> τιμή για <input type="datetime-local"> στο timezone του χρήστη. */
export function utcToLocalDateTimeInput(date: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = String(Number(parts.hour) % 24).padStart(2, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Ηλικία σε έτη με βάση ημερομηνία γέννησης (UTC-safe). */
export function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}
