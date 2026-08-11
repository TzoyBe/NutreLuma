import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

/**
 * Καθαρή JWT λογική, χωρίς εξάρτηση από `next/headers`, ώστε να είναι
 * δοκιμάσιμη εκτός request context.
 */
const secret = new TextEncoder().encode(env.AUTH_SECRET);
const ISSUER = 'nutreluma';
const AUDIENCE = 'nutreluma-web';
const MOBILE_HANDOFF_AUDIENCE = 'nutreluma-mobile-handoff';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
}

export interface VerifiedSession extends SessionPayload {
  /**
   * Στιγμή έκδοσης (epoch seconds) από το `iat`. Συγκρίνεται με το
   * `passwordChangedAt` του χρήστη, ώστε η επαναφορά κωδικού να ακυρώνει κάθε
   * προϋπάρχουσα συνεδρία. `null` μόνο αν λείπει το `iat`.
   */
  issuedAt: number | null;
}

export interface MobileAuthHandoffPayload extends SessionPayload {
  nextPath: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_MAX_AGE_DAYS}d`)
    .sign(secret);
}

export async function createMobileAuthHandoffToken(
  payload: MobileAuthHandoffPayload,
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, nextPath: payload.nextPath })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(MOBILE_HANDOFF_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

/**
 * Ένα JWT που εκδόθηκε ΠΡΙΝ από την τελευταία αλλαγή κωδικού δεν ισχύει πλέον.
 * Έτσι η επαναφορά κωδικού πετάει έξω και όποιον έχει κλέψει session cookie.
 *
 * Το `iat` έχει ακρίβεια δευτερολέπτου, οπότε αφήνουμε ένα δευτερόλεπτο
 * περιθώριο: αλλιώς το ίδιο το cookie που εκδίδεται αμέσως μετά την αλλαγή θα
 * μπορούσε να απορριφθεί λόγω στρογγυλοποίησης.
 */
export function isSessionExpiredByPasswordChange(
  session: { issuedAt: number | null },
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false;
  if (session.issuedAt === null) return true;
  return session.issuedAt * 1000 < passwordChangedAt.getTime() - 1000;
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'USER'),
      issuedAt: typeof payload.iat === 'number' ? payload.iat : null,
    };
  } catch {
    return null;
  }
}

export async function verifyMobileAuthHandoffToken(
  token: string,
): Promise<MobileAuthHandoffPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: MOBILE_HANDOFF_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.nextPath !== 'string') return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'USER'),
      nextPath: payload.nextPath,
    };
  } catch {
    return null;
  }
}
