import * as SecureStore from 'expo-secure-store';
import type { MobileUser } from './api';

export interface StoredSession {
  token: string;
  user: MobileUser;
  needsProfile: boolean;
}

const SESSION_KEY = 'nutreluma.session.v1';

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSession>;
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 20 &&
    typeof candidate.needsProfile === 'boolean' &&
    !!candidate.user &&
    typeof candidate.user === 'object' &&
    typeof candidate.user.id === 'string' &&
    typeof candidate.user.email === 'string' &&
    typeof candidate.user.displayName === 'string' &&
    typeof candidate.user.role === 'string'
  );
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isStoredSession(parsed)) return parsed;
  } catch {
    // Invalid local data is treated as signed out.
  }

  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
  return null;
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
}
