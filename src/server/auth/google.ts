import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env, googleAuthConfigured } from '@/server/env';
import { ApiError } from '@/server/errors';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const useSecureCookies = env.APP_URL.startsWith('https://');
const GOOGLE_OAUTH_COOKIE = useSecureCookies ? '__Host-cv_google_oauth' : 'cv_google_oauth';
const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;

interface GoogleOauthCookieValue {
  state: string;
  codeVerifier: string;
  nonce: string;
  nextPath: string;
  origin: string;
  appMode: 'web' | 'capacitor';
}

export interface GoogleUserProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
}

interface GoogleIdTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomUrlSafe(size = 32): string {
  return base64Url(randomBytes(size));
}

function buildCodeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function buildGoogleRedirectUri(origin: string): string {
  return `${normalizeOrigin(origin)}/api/auth/google/callback`;
}

export function sanitizeNextPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;
  return path;
}

async function writeOauthCookie(value: GoogleOauthCookieValue): Promise<void> {
  const store = await cookies();
  store.set(GOOGLE_OAUTH_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_OAUTH_TTL_SECONDS,
  });
}

export async function clearGoogleOauthCookie(): Promise<void> {
  const store = await cookies();
  store.set(GOOGLE_OAUTH_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

async function readOauthCookie(): Promise<GoogleOauthCookieValue | null> {
  const store = await cookies();
  const raw = store.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<GoogleOauthCookieValue>;
    if (
      typeof parsed.state === 'string' &&
      typeof parsed.codeVerifier === 'string' &&
      typeof parsed.nonce === 'string' &&
      typeof parsed.nextPath === 'string' &&
      typeof parsed.origin === 'string'
    ) {
      return parsed as GoogleOauthCookieValue;
    }
  } catch {
    return null;
  }
  return null;
}

export async function buildGoogleAuthorizationUrl(
  origin: string,
  nextPath?: string,
  appMode: 'web' | 'capacitor' = 'web',
): Promise<string> {
  if (!googleAuthConfigured) {
    throw new ApiError('INTERNAL_ERROR', 'Google login is not configured.');
  }

  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = buildCodeChallenge(codeVerifier);
  const redirectUri = buildGoogleRedirectUri(origin);
  const safeNextPath = sanitizeNextPath(nextPath);

  await writeOauthCookie({
    state,
    nonce,
    codeVerifier,
    nextPath: safeNextPath,
    origin: normalizeOrigin(origin),
    appMode,
  });

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCodeForTokens(code: string, codeVerifier: string, origin: string) {
  const redirectUri = buildGoogleRedirectUri(origin);
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        id_token?: string;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !json?.id_token || !json.access_token) {
    throw new ApiError(
      'UNAUTHENTICATED',
      json?.error_description || 'Google sign-in could not be completed.',
    );
  }

  return { accessToken: json.access_token, idToken: json.id_token };
}

async function verifyGoogleIdToken(idToken: string, nonce: string): Promise<GoogleIdTokenClaims> {
  const verified = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience: env.GOOGLE_CLIENT_ID,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });

  const claims = verified.payload as GoogleIdTokenClaims;
  if (!claims.sub) {
    throw new ApiError('UNAUTHENTICATED', 'Google sign-in response was incomplete.');
  }
  if (claims.nonce !== nonce) {
    throw new ApiError('FORBIDDEN', 'Google sign-in verification failed.');
  }
  return claims;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserProfile | null> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const json = (await response.json().catch(() => null)) as
    | {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      }
    | null;

  if (!json?.sub || !json.email) return null;
  return {
    sub: json.sub,
    email: json.email,
    emailVerified: Boolean(json.email_verified),
    name: json.name ?? null,
  };
}

export async function resolveGoogleUserFromCallback(params: URLSearchParams): Promise<{
  profile: GoogleUserProfile;
  nextPath: string;
  appMode: 'web' | 'capacitor';
}> {
  const state = params.get('state');
  const code = params.get('code');
  const issuer = params.get('iss');

  const cookie = await readOauthCookie();
  await clearGoogleOauthCookie();

  if (!googleAuthConfigured) {
    throw new ApiError('INTERNAL_ERROR', 'Google login is not configured.');
  }
  if (!cookie || !state || state !== cookie.state) {
    throw new ApiError('FORBIDDEN', 'Google sign-in session is invalid or expired.');
  }
  if (issuer && issuer !== 'https://accounts.google.com') {
    throw new ApiError('FORBIDDEN', 'Unexpected Google issuer.');
  }
  if (!code) {
    throw new ApiError('UNAUTHENTICATED', 'Google did not return an authorization code.');
  }

  const { accessToken, idToken } = await exchangeCodeForTokens(code, cookie.codeVerifier, cookie.origin);
  const claims = await verifyGoogleIdToken(idToken, cookie.nonce);
  const userInfo = await fetchGoogleUserInfo(accessToken);

  const profile: GoogleUserProfile = {
    sub: claims.sub,
    email: userInfo?.email ?? claims.email ?? '',
    emailVerified: userInfo?.emailVerified ?? Boolean(claims.email_verified),
    name: userInfo?.name ?? claims.name ?? null,
  };

  if (!profile.email) {
    throw new ApiError('UNAUTHENTICATED', 'Google did not return an email address.');
  }

  if (userInfo && userInfo.sub !== claims.sub) {
    throw new ApiError('FORBIDDEN', 'Google account verification failed.');
  }

  return {
    profile,
    nextPath: sanitizeNextPath(cookie.nextPath),
    appMode: cookie.appMode ?? 'web',
  };
}
