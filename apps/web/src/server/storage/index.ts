import 'server-only';
import { randomUUID } from 'node:crypto';
import { env } from '../env';
import { LocalDiskStorage } from './local';
import type { StorageDriver } from './types';

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  switch (env.STORAGE_DRIVER) {
    case 'local':
    default:
      driver = new LocalDiskStorage(env.UPLOAD_DIR);
      return driver;
  }
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Παράγει τυχαίο, μη-μαντεύσιμο κλειδί. Το αρχικό όνομα του αρχείου του χρήστη
 * δεν χρησιμοποιείται ποτέ (ούτε για το path, ούτε για την ανάλυση).
 */
export function buildMealImageKey(userId: string, mime: string, variant: 'full' | 'thumb'): string {
  const ext = EXT_BY_MIME[mime] ?? 'webp';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `meals/${safeUser}/${yyyy}/${mm}/${randomUUID()}-${variant}.${ext}`;
}

export type { StorageDriver, StoredObject } from './types';
export { isSafeStorageKey, StorageError } from './types';
