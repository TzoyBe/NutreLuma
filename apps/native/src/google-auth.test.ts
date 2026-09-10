import { describe, expect, it } from 'vitest';
import { parseGoogleAuthCallback } from './google-auth';

describe('Google auth callback', () => {
  it('returns the handoff token from the native deep link', () => {
    expect(parseGoogleAuthCallback('nutreluma://auth/callback?token=abc%20123&next=%2Fdashboard')).toEqual({
      token: 'abc 123',
      error: null,
    });
  });

  it('returns a useful error from a failed native OAuth start', () => {
    expect(parseGoogleAuthCallback('nutreluma://auth/callback?error=google_unavailable')).toEqual({
      token: null,
      error: 'Google sign-in is temporarily unavailable.',
    });
  });

  it('ignores unrelated URLs', () => {
    expect(parseGoogleAuthCallback('nutreluma://dashboard')).toEqual({ token: null, error: null });
  });
});
