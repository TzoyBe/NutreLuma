-- Sign in with Apple: extend the OAuth provider enum used by auth_identities.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'APPLE';
