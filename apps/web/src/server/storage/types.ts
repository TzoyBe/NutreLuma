/**
 * Αφαίρεση αποθήκευσης αρχείων.
 * Ο local driver γράφει στο filesystem· ένας μελλοντικός S3 driver υλοποιεί
 * το ίδιο interface χωρίς αλλαγές στα call sites.
 */
export interface StoredObject {
  /** Λογικό κλειδί, π.χ. "meals/<userId>/2026/08/<random>.webp". */
  key: string;
  size: number;
  contentType: string;
}

export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Επιτρεπτά κλειδιά: μόνο ασφαλείς χαρακτήρες, χωρίς ".." ή απόλυτα paths. */
const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,180}\.(jpg|jpeg|png|webp)$/;

export function isSafeStorageKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false;
  if (key.includes('..') || key.includes('//')) return false;
  if (key.startsWith('/') || key.includes('\\')) return false;
  return true;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
