import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

process.env.APP_URL = 'https://www.nutreluma.com';
process.env.PASSWORD_RESET_TTL_MINUTES = '60';

interface FakeUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordChangedAt: Date | null;
}

interface FakeToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const store = { users: [] as FakeUser[], tokens: [] as FakeToken[] };
let idCounter = 0;
const nextId = (p: string) => `${p}-${(idCounter += 1)}`;

const fakePrisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
      return (
        store.users.find(
          (u) =>
            (where.email !== undefined && u.email === where.email) ||
            (where.id !== undefined && u.id === where.id),
        ) ?? null
      );
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const user = store.users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return user;
      },
    ),
  },
  passwordResetToken: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const token: FakeToken = {
        id: nextId('tok'),
        userId: String(data.userId),
        tokenHash: String(data.tokenHash),
        expiresAt: data.expiresAt as Date,
        usedAt: null,
      };
      store.tokens.push(token);
      return token;
    }),
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      return store.tokens.find((t) => t.tokenHash === where.tokenHash) ?? null;
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const token = store.tokens.find((t) => t.id === where.id)!;
        Object.assign(token, data);
        return token;
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const before = store.tokens.length;
      store.tokens = store.tokens.filter((t) => {
        if (where.userId !== undefined && t.userId !== where.userId) return true;
        if (where.usedAt === null && t.usedAt !== null) return true;
        return false;
      });
      return { count: before - store.tokens.length };
    }),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(fakePrisma);
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));

interface SentMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const sendEmailMock = vi.fn(async (_message: SentMessage) => true);
vi.mock('@/server/email', () => ({
  sendEmail: (message: SentMessage) => sendEmailMock(message),
}));

const { requestPasswordReset, resetPassword } = await import(
  '@/server/services/password-reset'
);
const { verifyPassword } = await import('@/server/auth/password');

function seedUser(overrides: Partial<FakeUser> = {}) {
  const user: FakeUser = {
    id: 'user-1',
    email: 'demo@example.com',
    displayName: 'Demo',
    passwordHash: 'old-hash',
    passwordChangedAt: null,
    ...overrides,
  };
  store.users.push(user);
  return user;
}

/** Ανακτά το token από τον σύνδεσμο που στάλθηκε στο email. */
function tokenFromLastEmail(): string {
  const message = sendEmailMock.mock.calls.at(-1)?.[0];
  const match = message?.text.match(/token=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? '';
}

beforeEach(() => {
  store.users = [];
  store.tokens = [];
  sendEmailMock.mockClear();
});

describe('αίτηση επαναφοράς — αποτροπή απαρίθμησης λογαριασμών', () => {
  it('επιστρέφει επιτυχία για άγνωστο email χωρίς να στείλει email', async () => {
    const result = await requestPasswordReset('den-yparxei@example.com', 'el');

    expect(result.accepted).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(store.tokens).toHaveLength(0);
  });

  it('επιστρέφει το ΙΔΙΟ αποτέλεσμα για υπαρκτό email', async () => {
    seedUser();
    const result = await requestPasswordReset('demo@example.com', 'el');

    expect(result.accepted).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('δεν επηρεάζεται από πεζά/κεφαλαία ή κενά', async () => {
    seedUser();
    await requestPasswordReset('  DEMO@Example.com  ', 'el');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe('αποθήκευση token', () => {
  it('αποθηκεύει ΜΟΝΟ το hash, ποτέ το ίδιο το token', async () => {
    seedUser();
    await requestPasswordReset('demo@example.com', 'el');

    const token = tokenFromLastEmail();
    expect(token.length).toBeGreaterThan(20);

    const stored = store.tokens[0]!;
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('νέα αίτηση ακυρώνει την προηγούμενη', async () => {
    seedUser();
    await requestPasswordReset('demo@example.com', 'el');
    const first = tokenFromLastEmail();
    await requestPasswordReset('demo@example.com', 'el');

    expect(store.tokens).toHaveLength(1);
    await expect(resetPassword(first, 'NewPassword123')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('ο σύνδεσμος δείχνει στο APP_URL', async () => {
    seedUser();
    await requestPasswordReset('demo@example.com', 'el');
    const message = sendEmailMock.mock.calls[0]![0];
    expect(message.text).toContain('https://www.nutreluma.com/reset-password?token=');
  });
});

describe('ολοκλήρωση επαναφοράς', () => {
  async function issueToken() {
    seedUser();
    await requestPasswordReset('demo@example.com', 'el');
    return tokenFromLastEmail();
  }

  it('αλλάζει τον κωδικό και σημειώνει τη στιγμή αλλαγής', async () => {
    const token = await issueToken();
    await resetPassword(token, 'BrandNewPass123');

    const user = store.users[0]!;
    expect(user.passwordHash).not.toBe('old-hash');
    expect(await verifyPassword('BrandNewPass123', user.passwordHash)).toBe(true);
    // Ακυρώνει κάθε προϋπάρχουσα συνεδρία.
    expect(user.passwordChangedAt).toBeInstanceOf(Date);
  });

  it('το token είναι ΜΙΑΣ χρήσης', async () => {
    const token = await issueToken();
    await resetPassword(token, 'BrandNewPass123');

    await expect(resetPassword(token, 'AnotherPass123')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('απορρίπτει ληγμένο token', async () => {
    const token = await issueToken();
    store.tokens[0]!.expiresAt = new Date(Date.now() - 1000);

    await expect(resetPassword(token, 'BrandNewPass123')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(store.users[0]!.passwordHash).toBe('old-hash');
  });

  it('απορρίπτει άγνωστο token', async () => {
    await issueToken();
    await expect(resetPassword('completely-made-up-token', 'BrandNewPass123')).rejects.toMatchObject(
      { code: 'BAD_REQUEST' },
    );
  });

  it('το μήνυμα σφάλματος δεν ξεχωρίζει άγνωστο από ληγμένο', async () => {
    const token = await issueToken();
    const unknownError = await resetPassword('made-up', 'X').catch((e) => e.message);
    store.tokens[0]!.expiresAt = new Date(Date.now() - 1000);
    const expiredError = await resetPassword(token, 'BrandNewPass123').catch((e) => e.message);

    expect(unknownError).toBe(expiredError);
  });
});
