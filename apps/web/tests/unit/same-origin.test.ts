import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/env', () => ({
  env: { APP_URL: 'http://192.168.2.249:8095' },
}));

const { assertSameOrigin, clientIp } = await import('@/server/http');
const { ApiError } = await import('@/server/errors');

/**
 * Μέσα σε container το `request.url` δείχνει πάντα την εσωτερική διεύθυνση,
 * γι' αυτό τα requests φτιάχνονται με localhost:3000 όπως στην παραγωγή.
 */
function req(headers: Record<string, string>, method = 'POST'): Request {
  return new Request('http://localhost:3000/api/auth/register', { method, headers });
}

describe('assertSameOrigin', () => {
  it('δέχεται το origin του APP_URL ακόμη κι αν το host είναι το εσωτερικό', () => {
    assertSameOrigin(req({ origin: 'http://192.168.2.249:8095', host: 'localhost:3000' }));
  });

  it('δέχεται πρόσβαση με hostname αντί για IP', () => {
    assertSameOrigin(req({ origin: 'http://tzoybe-nas:8095', host: 'tzoybe-nas:8095' }));
  });

  it('δέχεται πρόσβαση από άλλο subnet/IP', () => {
    assertSameOrigin(req({ origin: 'http://192.168.1.249:8095', host: '192.168.1.249:8095' }));
  });

  it('δέχεται host πίσω από reverse proxy μέσω x-forwarded-host', () => {
    assertSameOrigin(
      req({
        origin: 'https://nutreluma.example.com',
        host: 'localhost:3000',
        'x-forwarded-host': 'nutreluma.example.com, internal:3000',
      }),
    );
  });

  it('αγνοεί διαφορές πεζών/κεφαλαίων στο host', () => {
    assertSameOrigin(req({ origin: 'http://TzoyBe-NAS:8095', host: 'tzoybe-nas:8095' }));
  });

  it('απορρίπτει origin τρίτου site (CSRF)', () => {
    expect(() =>
      assertSameOrigin(req({ origin: 'http://evil.example', host: 'tzoybe-nas:8095' })),
    ).toThrow(ApiError);
  });

  it('απορρίπτει ίδιο hostname σε διαφορετική θύρα', () => {
    expect(() =>
      assertSameOrigin(req({ origin: 'http://tzoybe-nas:9000', host: 'tzoybe-nas:8095' })),
    ).toThrow(ApiError);
  });

  it('απορρίπτει κακοδιατυπωμένο origin', () => {
    expect(() => assertSameOrigin(req({ origin: 'not-a-url', host: 'tzoybe-nas:8095' }))).toThrow(
      ApiError,
    );
  });

  it('χρησιμοποιεί το referer όταν λείπει το origin', () => {
    assertSameOrigin(req({ referer: 'http://tzoybe-nas:8095/register', host: 'tzoybe-nas:8095' }));
    expect(() =>
      assertSameOrigin(req({ referer: 'http://evil.example/x', host: 'tzoybe-nas:8095' })),
    ).toThrow(ApiError);
  });

  it('επιτρέπει clients χωρίς origin/referer (curl, native app)', () => {
    assertSameOrigin(req({ host: 'tzoybe-nas:8095' }));
  });

  it('δεν ελέγχει τα GET/HEAD/OPTIONS', () => {
    assertSameOrigin(req({ origin: 'http://evil.example', host: 'tzoybe-nas:8095' }, 'GET'));
    assertSameOrigin(req({ origin: 'http://evil.example', host: 'tzoybe-nas:8095' }, 'HEAD'));
  });
});

describe('clientIp', () => {
  function req(headers: Record<string, string>): Request {
    return new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers });
  }

  it('προτιμά το CF-Connecting-IP', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('ΔΕΝ εμπιστεύεται πλαστογραφημένο X-Forwarded-For πίσω από Cloudflare', () => {
    // Ο επιτιθέμενος στέλνει δικό του XFF· η Cloudflare προσθέτει στο τέλος.
    // Χωρίς αυτόν τον έλεγχο θα άλλαζε «IP» σε κάθε αίτημα και θα παρέκαμπτε
    // το rate limiting του login.
    const ip = clientIp(
      req({
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '10.0.0.1, 203.0.113.9',
      }),
    );
    expect(ip).toBe('203.0.113.9');
    expect(ip).not.toBe('10.0.0.1');
  });

  it('πέφτει στο X-Forwarded-For χωρίς Cloudflare', () => {
    expect(clientIp(req({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }))).toBe('198.51.100.4');
  });

  it('πέφτει στο X-Real-IP και τελικά σε unknown', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(req({}))).toBe('unknown');
  });
});
