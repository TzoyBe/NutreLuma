import 'server-only';
import { cookies } from 'next/headers';
import { env } from '../env';
import {
  createMobileAuthHandoffToken,
  createSessionToken,
  isSessionExpiredByPasswordChange,
  verifyMobileAuthHandoffToken,
  verifySessionToken,
  type SessionPayload,
  type MobileAuthHandoffPayload,
  type VerifiedSession,
} from './jwt';

/**
 * Το `Secure` δένεται στο σχήμα του APP_URL και όχι στο NODE_ENV: ένα
 * production deployment πίσω από απλό http (π.χ. σε τοπικό δίκτυο) δεν θα
 * μπορούσε ποτέ να θέσει Secure cookie και η σύνδεση θα αποτύγχανε σιωπηλά.
 * Το πρόθεμα `__Host-` απαιτεί επίσης Secure, οπότε ακολουθεί το ίδιο flag.
 */
const useSecureCookies = env.APP_URL.startsWith('https://');

export const SESSION_COOKIE = useSecureCookies ? '__Host-cv_session' : 'cv_session';

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function readSession(): Promise<VerifiedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export {
  createMobileAuthHandoffToken,
  createSessionToken,
  verifyMobileAuthHandoffToken,
  verifySessionToken,
  isSessionExpiredByPasswordChange,
};
export type { MobileAuthHandoffPayload, SessionPayload, VerifiedSession };
