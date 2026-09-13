import 'server-only';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ApiError } from '@/server/errors';

// Apple signs its identity tokens with keys published here; jose caches + rotates them.
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

// The audience of a native "Sign in with Apple" identity token is the app's bundle id.
// Override via env only if the iOS bundle identifier changes.
const APPLE_AUDIENCE = process.env.APPLE_BUNDLE_ID?.trim() || 'com.joybeedigital.nutreluma';

interface AppleIdTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce?: string;
}

export interface AppleUserProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
}

function coerceBoolean(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

/**
 * Verifies a native Sign in with Apple identity token (the JWT returned by
 * expo-apple-authentication) and returns the stable Apple user id + email.
 * `fullName` is only provided by Apple on the very first authorization, so the
 * caller passes it through for display when creating a new account.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  fullName?: string | null,
): Promise<AppleUserProfile> {
  if (!identityToken) {
    throw new ApiError('UNAUTHENTICATED', 'Apple sign-in could not be completed.');
  }

  let claims: AppleIdTokenClaims;
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: APPLE_AUDIENCE,
    });
    claims = payload as AppleIdTokenClaims;
  } catch {
    throw new ApiError('UNAUTHENTICATED', 'Apple sign-in could not be verified.');
  }

  if (!claims.sub || !claims.email) {
    // Apple always includes the email claim in the identity token (real or a
    // stable private-relay address), so a missing one means an unusable token.
    throw new ApiError('UNAUTHENTICATED', 'Apple did not return an email address.');
  }

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: coerceBoolean(claims.email_verified),
    name: fullName?.trim() || null,
  };
}
