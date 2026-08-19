import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value: number, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Τυχαίο κλειδί για idempotency των uploads.
 *
 * Το `crypto.randomUUID()` είναι διαθέσιμο ΜΟΝΟ σε secure context (https ή
 * localhost). Σε deployment πάνω από plain http (π.χ. IP τοπικού δικτύου) είναι
 * undefined και θα έσκαγε η φόρμα. Το `crypto.getRandomValues()` δεν έχει αυτόν
 * τον περιορισμό, οπότε το χρησιμοποιούμε ως πρώτο fallback.
 */
export function generateRequestKey(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Έσχατο fallback — δεν είναι κρυπτογραφικά ισχυρό, αλλά το κλειδί
  // χρησιμοποιείται μόνο για deduplication αιτημάτων του ίδιου χρήστη.
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2).padEnd(12, '0')}`;
}

/** Ασφαλής μετατροπή Prisma Decimal | string | number σε number. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : 0;
}
