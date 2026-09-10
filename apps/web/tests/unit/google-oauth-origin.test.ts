import { describe, expect, it } from 'vitest';
import { resolveGoogleOauthOrigin } from '@/server/auth/google-origin';

describe('Google OAuth public origin', () => {
  it('uses the configured public origin in production instead of the container URL', () => {
    const request = new Request('http://localhost:3000/api/auth/google');

    expect(resolveGoogleOauthOrigin(request, 'https://nutreluma.com', true)).toBe(
      'https://nutreluma.com',
    );
  });

  it('honors proxy headers outside production', () => {
    const request = new Request('http://localhost:3000/api/auth/google', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'preview.nutreluma.com',
      },
    });

    expect(resolveGoogleOauthOrigin(request, 'http://localhost:3000', false)).toBe(
      'https://preview.nutreluma.com',
    );
  });
});
