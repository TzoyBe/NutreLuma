import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import {
  createSessionToken,
  isSessionExpiredByPasswordChange,
  verifySessionToken,
} from '@/server/auth/jwt';
import { __resetRateLimits, assertLoginRateLimit, hitLimit } from '@/server/auth/rate-limit';
import { ApiError } from '@/server/errors';

describe('password hashing', () => {
  it('παράγει hash διαφορετικό από τον κωδικό', async () => {
    const hash = await hashPassword('SuperSecret1');
    expect(hash).not.toContain('SuperSecret1');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('επαληθεύει σωστό κωδικό', async () => {
    const hash = await hashPassword('SuperSecret1');
    expect(await verifyPassword('SuperSecret1', hash)).toBe(true);
  });

  it('απορρίπτει λάθος κωδικό', async () => {
    const hash = await hashPassword('SuperSecret1');
    expect(await verifyPassword('WrongPassword1', hash)).toBe(false);
  });

  it('παράγει διαφορετικό hash για τον ίδιο κωδικό (salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('SuperSecret1'), hashPassword('SuperSecret1')]);
    expect(a).not.toBe(b);
  });

  it('δεν πετάει σε κατεστραμμένο hash', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});

describe('session tokens', () => {
  it('κάνει round-trip του payload', async () => {
    const token = await createSessionToken({ sub: 'user-1', email: 'a@b.com', role: 'USER' });
    const payload = await verifySessionToken(token);
    expect(payload).toMatchObject({ sub: 'user-1', email: 'a@b.com', role: 'USER' });
  });

  it('απορρίπτει παραποιημένο token', async () => {
    const token = await createSessionToken({ sub: 'user-1', email: 'a@b.com', role: 'USER' });
    const tampered = `${token.slice(0, -3)}abc`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it('απορρίπτει σκουπίδια', async () => {
    expect(await verifySessionToken('garbage')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    __resetRateLimits();
  });

  it('επιτρέπει μέχρι το όριο και μετά μπλοκάρει', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(hitLimit('test-key', 3, 60_000)).toBe(false);
    }
    expect(hitLimit('test-key', 3, 60_000)).toBe(true);
  });

  it('κρατά ξεχωριστούς μετρητές ανά κλειδί', () => {
    expect(hitLimit('a', 1, 60_000)).toBe(false);
    expect(hitLimit('b', 1, 60_000)).toBe(false);
  });

  it('μπλοκάρει επαναλαμβανόμενες αποτυχημένες συνδέσεις', () => {
    const attempt = () => assertLoginRateLimit('1.2.3.4', 'user@example.com');
    for (let i = 0; i < 8; i += 1) attempt();
    expect(attempt).toThrow(ApiError);
  });
});

describe('ακύρωση συνεδρίας μετά από αλλαγή κωδικού', () => {
  const at = (iso: string) => new Date(iso);
  const issued = (iso: string) => ({ issuedAt: Math.floor(at(iso).getTime() / 1000) });

  it('χωρίς αλλαγή κωδικού η συνεδρία ισχύει', () => {
    expect(isSessionExpiredByPasswordChange(issued('2026-08-06T10:00:00Z'), null)).toBe(false);
  });

  it('token ΠΡΙΝ την αλλαγή ακυρώνεται', () => {
    expect(
      isSessionExpiredByPasswordChange(
        issued('2026-08-06T10:00:00Z'),
        at('2026-08-06T11:00:00Z'),
      ),
    ).toBe(true);
  });

  it('token ΜΕΤΑ την αλλαγή ισχύει', () => {
    expect(
      isSessionExpiredByPasswordChange(
        issued('2026-08-06T12:00:00Z'),
        at('2026-08-06T11:00:00Z'),
      ),
    ).toBe(false);
  });

  it('ανέχεται τη στρογγυλοποίηση δευτερολέπτου του iat', () => {
    // Το `iat` έχει ακρίβεια δευτερολέπτου. Το cookie που εκδίδεται αμέσως
    // μετά την αλλαγή δεν πρέπει να ακυρώνεται από τα χιλιοστά.
    expect(
      isSessionExpiredByPasswordChange(
        issued('2026-08-06T11:00:00Z'),
        at('2026-08-06T11:00:00.800Z'),
      ),
    ).toBe(false);
  });

  it('token χωρίς iat θεωρείται άκυρο όταν έχει γίνει αλλαγή', () => {
    expect(
      isSessionExpiredByPasswordChange({ issuedAt: null }, at('2026-08-06T11:00:00Z')),
    ).toBe(true);
  });
});
