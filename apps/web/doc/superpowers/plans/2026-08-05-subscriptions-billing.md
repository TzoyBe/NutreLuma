# Συνδρομές & Χρέωση — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Νέοι λογαριασμοί παίρνουν δοκιμή 3 ημερών· μετά πληρώνουν 3€/μήνα μέσω Stripe Subscriptions ή ενεργοποιούνται χειροκίνητα από ADMIN (IRIS/IBAN)· όταν λήξει η πρόσβαση, ο λογαριασμός δεν δέχεται **νέα** δεδομένα αλλά παραμένει πλήρως αναγνώσιμος.

**Architecture:** Μία εγγραφή `Subscription` ανά χρήστη, με το `accessUntil` ως μοναδική πηγή αλήθειας για την πρόσβαση. Η επιβεβαίωση πληρωμής γίνεται με **εξερχόμενες** κλήσεις προς το Stripe (`reconcileSubscription`) αντί για webhooks, επειδή η εφαρμογή δεν έχει δημόσιο URL. Ο έλεγχος εγγραφής επιβάλλεται σε τρία μόνο endpoints μέσω ενός φύλακα.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma + PostgreSQL, Zod, Vitest, Stripe REST v1 (Subscriptions).

**Spec:** `docs/superpowers/specs/2026-08-05-subscriptions-billing-design.md`

## Global Constraints

- Όλες οι ημερομηνίες αποθηκεύονται σε **UTC**· η εμφάνιση χρησιμοποιεί το timezone του προφίλ.
- Τα ποσά είναι **ακέραια cents** (`Int`), ποτέ float.
- Κάθε mutating endpoint καλεί ήδη `assertSameOrigin(request)` και `requireApiUser()` — μη τα αφαιρέσεις.
- Το UI είναι **ελληνικό**· κάθε νέο κείμενο μπαίνει και στο `src/i18n/el.ts` και στο `src/i18n/en.ts` (ίδια κλειδιά, αλλιώς σπάει ο τύπος `Translations`).
- **Καμία λεπτομέρεια παρόχου δεν φτάνει στον client**: raw σφάλματα Stripe μόνο σε server logs.
- Τα tests τρέχουν με `npx vitest run`· τα αρχεία πάνε σε `tests/unit/*.test.ts`.
- Ο τύπος `SubscriptionProvider` έχει **δύο** τιμές: `STRIPE`, `MANUAL`. Η δοκιμή έχει `provider = null`.
- Μονάδα χρόνου χάριτος και δοκιμής: **ημέρες**, από `env`.

---

## File Structure

| Αρχείο | Ευθύνη |
|---|---|
| `prisma/schema.prisma` | Μοντέλα `Subscription`, `Payment`, enums, σχέσεις στον `User` |
| `prisma/migrations/20260805000000_billing/migration.sql` | Πίνακες + ADMIN + backfill |
| `src/lib/billing/access.ts` | **Καθαρή** λογική κατάστασης πρόσβασης (χωρίς I/O) |
| `src/lib/validation/billing.ts` | Zod schemas για admin extend |
| `src/server/billing/stripe.ts` | HTTP client Stripe (token, get, create, cancel) |
| `src/server/services/subscription.ts` | Domain logic: trial, reconcile, cancel, manual extend |
| `src/server/auth/guards.ts` | `requireWriteAccess()` |
| `src/server/errors.ts` | Κωδικός `SUBSCRIPTION_REQUIRED` → 402 |
| `src/server/env.ts` | Νέες μεταβλητές |
| `src/app/api/billing/route.ts` | GET κατάσταση συνδρομής |
| `src/app/api/billing/stripe/subscribe/route.ts` | POST έναρξη |
| `src/app/api/billing/stripe/return/route.ts` | GET επιστροφή + επαλήθευση |
| `src/app/api/billing/cancel/route.ts` | POST ακύρωση |
| `src/app/api/admin/subscriptions/extend/route.ts` | POST χειροκίνητη παράταση |
| `src/components/billing/subscription-banner.tsx` | Banner κατάστασης |
| `src/components/billing/billing-panel.tsx` | Σελίδα συνδρομής (client) |
| `src/app/(app)/billing/page.tsx` | Σελίδα `/billing` |
| `src/app/(app)/admin/users/page.tsx` | Λίστα χρηστών (ADMIN) |
| `src/components/admin/user-list.tsx` | Πίνακας + κουμπί παράτασης |

---

### Task 1: Schema, migration και ρυθμίσεις

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260805000000_billing/migration.sql`
- Modify: `src/server/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: τίποτα (πρώτο task)
- Produces: Prisma types `Subscription`, `Payment`, `SubscriptionProvider`, `SubscriptionStatus`· πεδία `env.BILLING_ENABLED: boolean`, `env.TRIAL_DAYS: number`, `env.SUBSCRIPTION_GRACE_DAYS: number`, `env.SUBSCRIPTION_PRICE_CENTS: number`, `env.STRIPE_ENV: 'sandbox' | 'live'`, `env.STRIPE_CLIENT_ID: string`, `env.STRIPE_CLIENT_SECRET: string`, `env.STRIPE_PLAN_ID: string`

- [ ] **Step 1: Πρόσθεσε τα μοντέλα στο schema**

Στο τέλος του `prisma/schema.prisma`:

```prisma
enum SubscriptionProvider {
  STRIPE
  MANUAL
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  CANCELLED
  EXPIRED
}

model Subscription {
  id            String                @id @default(cuid())
  userId        String                @unique
  status        SubscriptionStatus    @default(TRIALING)
  provider      SubscriptionProvider?
  accessUntil   DateTime
  autoRenew     Boolean               @default(false)
  externalId    String?               @unique
  cancelledAt   DateTime?
  lastSyncedAt  DateTime?
  lastSyncError String?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([accessUntil])
  @@map("subscriptions")
}

model Payment {
  id          String               @id @default(cuid())
  userId      String
  provider    SubscriptionProvider
  externalId  String?              @unique
  amountCents Int
  currency    String               @default("EUR")
  paidAt      DateTime
  note        String?
  createdAt   DateTime             @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, paidAt])
  @@map("payments")
}
```

Και στο `model User`, μέσα στο block των σχέσεων (μετά το `aiUsageLogs`):

```prisma
  subscription  Subscription?
  payments      Payment[]
```

- [ ] **Step 2: Γράψε το migration SQL**

Δημιούργησε `prisma/migrations/20260805000000_billing/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" "SubscriptionProvider",
    "accessUntil" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "externalId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "subscriptions_externalId_key" ON "subscriptions"("externalId");
CREATE INDEX "subscriptions_accessUntil_idx" ON "subscriptions"("accessUntil");
CREATE UNIQUE INDEX "payments_externalId_key" ON "payments"("externalId");
CREATE INDEX "payments_userId_paidAt_idx" ON "payments"("userId", "paidAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ο ιδιοκτήτης γίνεται ADMIN (μόνιμη παράκαμψη χρέωσης)
UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = 'tzoybe@msn.com';

-- Backfill: κάθε υπάρχων χρήστης παίρνει δοκιμή 3 ημερών
INSERT INTO "subscriptions" ("id", "userId", "status", "accessUntil", "createdAt", "updatedAt")
SELECT
  'sub_' || substr(md5(random()::text || u."id"), 1, 20),
  u."id",
  'TRIALING',
  NOW() + INTERVAL '3 days',
  NOW(),
  NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."userId" = u."id");
```

- [ ] **Step 3: Πρόσθεσε τις μεταβλητές στο `env.ts`**

Στο `envSchema` του `src/server/env.ts`, μετά το μπλοκ των rate limits:

```ts
  BILLING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  TRIAL_DAYS: intFromEnv(3),
  SUBSCRIPTION_GRACE_DAYS: intFromEnv(3),
  SUBSCRIPTION_PRICE_CENTS: intFromEnv(300),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PRICE_ID: z.string().optional().default(''),
```

Στο αντικείμενο που περνά στο `safeParse`, πρόσθεσε τις αντίστοιχες γραμμές:

```ts
    BILLING_ENABLED: process.env.BILLING_ENABLED,
    TRIAL_DAYS: process.env.TRIAL_DAYS,
    SUBSCRIPTION_GRACE_DAYS: process.env.SUBSCRIPTION_GRACE_DAYS,
    SUBSCRIPTION_PRICE_CENTS: process.env.SUBSCRIPTION_PRICE_CENTS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
```

Και στο τέλος του αρχείου:

```ts
/** true μόνο όταν υπάρχουν όλα όσα χρειάζεται μια κλήση Stripe. */
export const stripeConfigured =
  env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_PRICE_ID.length > 0;

/** Το πρόθεμα του κλειδιού ΕΙΝΑΙ ο διακόπτης περιβάλλοντος — δεν υπάρχει άλλη ρύθμιση. */
export const stripeIsLive = env.STRIPE_SECRET_KEY.startsWith('sk_live_');

export const STRIPE_API_BASE = 'https://api.stripe.com';
```

- [ ] **Step 4: Ενημέρωσε το `.env.example`**

Πρόσθεσε στο τέλος:

```env
# --- Συνδρομές ---------------------------------------------------
BILLING_ENABLED=true
TRIAL_DAYS=3
SUBSCRIPTION_GRACE_DAYS=3
SUBSCRIPTION_PRICE_CENTS=300

# Το πρόθεμα του κλειδιού ορίζει το περιβάλλον: sk_test_… (δοκιμή) ή sk_live_… (πραγματικά χρήματα)
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
```

- [ ] **Step 5: Επαλήθευσε ότι το schema και οι τύποι είναι έγκυρα**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: καμία έξοδος σφάλματος από το tsc.

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/server/env.ts .env.example
git commit -m "feat(billing): προσθήκη schema συνδρομών, migration και ρυθμίσεων"
```

---

### Task 2: Καθαρή λογική κατάστασης πρόσβασης

Αυτή είναι η καρδιά της απόφασης πρόσβασης και **δεν κάνει I/O**, ώστε να δοκιμάζεται εξαντλητικά χωρίς βάση ή δίκτυο.

**Files:**
- Create: `src/lib/billing/access.ts`
- Test: `tests/unit/billing-access.test.ts`

**Interfaces:**
- Consumes: enums από Task 1
- Produces:
  - `type AccessStateKind = 'UNLIMITED' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LOCKED'`
  - `interface AccessState { kind: AccessStateKind; canWrite: boolean; accessUntil: Date | null; daysRemaining: number | null; autoRenew: boolean }`
  - `function resolveAccessState(input: AccessInput, now?: Date): AccessState`
  - `interface AccessInput { role: string; billingEnabled: boolean; graceDays: number; subscription: SubscriptionSnapshot | null }`
  - `interface SubscriptionSnapshot { status: 'TRIALING'|'ACTIVE'|'CANCELLED'|'EXPIRED'; provider: 'STRIPE'|'MANUAL'|null; accessUntil: Date; autoRenew: boolean }`

- [ ] **Step 1: Γράψε τα failing tests**

Δημιούργησε `tests/unit/billing-access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveAccessState, type AccessInput } from '@/lib/billing/access';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const base: AccessInput = {
  role: 'USER',
  billingEnabled: true,
  graceDays: 3,
  subscription: {
    status: 'TRIALING',
    provider: null,
    accessUntil: days(2),
    autoRenew: false,
  },
};

describe('resolveAccessState', () => {
  it('ο ADMIN έχει πάντα πρόσβαση χωρίς συνδρομή', () => {
    const state = resolveAccessState({ ...base, role: 'ADMIN', subscription: null }, NOW);
    expect(state.kind).toBe('UNLIMITED');
    expect(state.canWrite).toBe(true);
  });

  it('με BILLING_ENABLED=false όλοι γράφουν', () => {
    const state = resolveAccessState(
      { ...base, billingEnabled: false, subscription: null },
      NOW,
    );
    expect(state.kind).toBe('UNLIMITED');
    expect(state.canWrite).toBe(true);
  });

  it('χρήστης χωρίς συνδρομή είναι κλειδωμένος', () => {
    const state = resolveAccessState({ ...base, subscription: null }, NOW);
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ενεργή δοκιμή επιτρέπει εγγραφή και μετρά ημέρες', () => {
    const state = resolveAccessState(base, NOW);
    expect(state.kind).toBe('TRIAL');
    expect(state.canWrite).toBe(true);
    expect(state.daysRemaining).toBe(2);
  });

  it('ληγμένη δοκιμή ΔΕΝ παίρνει χάρη', () => {
    const state = resolveAccessState(
      { ...base, subscription: { ...base.subscription!, accessUntil: days(-1) } },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ενεργή συνδρομή επιτρέπει εγγραφή', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(20),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('ACTIVE');
    expect(state.canWrite).toBe(true);
    expect(state.autoRenew).toBe(true);
  });

  it('ληγμένη ενεργή συνδρομή με autoRenew παίρνει χάρη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(-1),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('GRACE');
    expect(state.canWrite).toBe(true);
  });

  it('μετά το τέλος της χάριτος κλειδώνει', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(-4),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ακυρωμένη συνδρομή ΔΕΝ παίρνει χάρη μετά τη λήξη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'CANCELLED',
          provider: 'STRIPE',
          accessUntil: days(-1),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
  });

  it('ακυρωμένη συνδρομή διατηρεί πρόσβαση μέχρι τη λήξη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'CANCELLED',
          provider: 'STRIPE',
          accessUntil: days(10),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('ACTIVE');
    expect(state.canWrite).toBe(true);
  });

  it('χειροκίνητη συνδρομή ΔΕΝ παίρνει χάρη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'MANUAL',
          accessUntil: days(-1),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
  });
});
```

- [ ] **Step 2: Τρέξε τα tests για να δεις ότι αποτυγχάνουν**

Run: `npx vitest run tests/unit/billing-access.test.ts`
Expected: FAIL με `Cannot find module '@/lib/billing/access'`

- [ ] **Step 3: Γράψε την υλοποίηση**

Δημιούργησε `src/lib/billing/access.ts`:

```ts
/**
 * Καθαρή λογική πρόσβασης — χωρίς βάση, χωρίς δίκτυο, χωρίς `now()`.
 * Ο χρόνος περνά ως παράμετρος ώστε η συμπεριφορά να είναι ντετερμινιστική.
 */

export type AccessStateKind = 'UNLIMITED' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LOCKED';

export interface SubscriptionSnapshot {
  status: 'TRIALING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  provider: 'STRIPE' | 'MANUAL' | null;
  accessUntil: Date;
  autoRenew: boolean;
}

export interface AccessInput {
  role: string;
  billingEnabled: boolean;
  graceDays: number;
  subscription: SubscriptionSnapshot | null;
}

export interface AccessState {
  kind: AccessStateKind;
  canWrite: boolean;
  accessUntil: Date | null;
  daysRemaining: number | null;
  autoRenew: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function resolveAccessState(input: AccessInput, now: Date = new Date()): AccessState {
  const unlimited: AccessState = {
    kind: 'UNLIMITED',
    canWrite: true,
    accessUntil: null,
    daysRemaining: null,
    autoRenew: false,
  };

  if (input.role === 'ADMIN' || !input.billingEnabled) return unlimited;

  const sub = input.subscription;
  if (!sub) {
    return { kind: 'LOCKED', canWrite: false, accessUntil: null, daysRemaining: null, autoRenew: false };
  }

  const active = sub.accessUntil.getTime() > now.getTime();
  if (active) {
    return {
      kind: sub.status === 'TRIALING' ? 'TRIAL' : 'ACTIVE',
      canWrite: true,
      accessUntil: sub.accessUntil,
      daysRemaining: Math.max(0, daysBetween(now, sub.accessUntil)),
      autoRenew: sub.autoRenew,
    };
  }

  // Χάρη ΜΟΝΟ όταν αναμένεται αυτόματη ανανέωση που μπορεί να καθυστερεί.
  // Δοκιμή, ακυρωμένη και χειροκίνητη συνδρομή δεν τη δικαιούνται.
  const eligibleForGrace =
    sub.status === 'ACTIVE' && sub.autoRenew && sub.provider === 'STRIPE';
  const graceEnds = new Date(sub.accessUntil.getTime() + input.graceDays * DAY_MS);

  if (eligibleForGrace && graceEnds.getTime() > now.getTime()) {
    return {
      kind: 'GRACE',
      canWrite: true,
      accessUntil: sub.accessUntil,
      daysRemaining: 0,
      autoRenew: sub.autoRenew,
    };
  }

  return {
    kind: 'LOCKED',
    canWrite: false,
    accessUntil: sub.accessUntil,
    daysRemaining: 0,
    autoRenew: sub.autoRenew,
  };
}
```

- [ ] **Step 4: Τρέξε τα tests**

Run: `npx vitest run tests/unit/billing-access.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/access.ts tests/unit/billing-access.test.ts
git commit -m "feat(billing): καθαρή λογική κατάστασης πρόσβασης με πλήρη tests"
```

---

### Task 3: Stripe HTTP client

**Files:**
- Create: `src/server/billing/stripe.ts`
- Test: `tests/unit/stripe-client.test.ts`

**Interfaces:**
- Consumes: `env`, `stripeConfigured`, `STRIPE_API_BASE` (Task 1)
- Produces:
  - `interface StripeInvoice { id: string; amountPaidCents: number; paidAt: Date | null }`
  - `interface StripeSubscription { id: string; status: string; ownerUserId: string | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean; latestInvoice: StripeInvoice | null }`
  - `interface StripeCheckoutSession { id: string; clientReferenceId: string | null; complete: boolean; subscriptionId: string | null }`
  - `async function createCheckoutSession(userId: string, successUrl: string, cancelUrl: string): Promise<{ id: string; url: string }>`
  - `async function getCheckoutSession(id: string): Promise<StripeCheckoutSession>`
  - `async function getSubscription(id: string): Promise<StripeSubscription>`
  - `async function cancelAtPeriodEnd(id: string): Promise<void>`
  - `class StripeError extends Error { readonly detail: string }`

> **Σημείωση API**: το Stripe δέχεται **form-encoded** σώματα, όχι JSON, και οι ένθετες
> παράμετροι γράφονται με αγκύλες (`line_items[0][price]`). Δεν υπάρχει βήμα OAuth —
> το secret key πάει απευθείας ως `Authorization: Bearer`.

- [ ] **Step 1: Γράψε τα failing tests**

Δημιούργησε `tests/unit/stripe-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_PRICE_ID = 'price_123';

const {
  createCheckoutSession,
  getCheckoutSession,
  getSubscription,
  cancelAtPeriodEnd,
  StripeError,
} = await import('@/server/billing/stripe');

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('createCheckoutSession', () => {
  it('στέλνει form-encoded σώμα με client_reference_id και επιστρέφει URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'cs_1', url: 'https://checkout/x' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCheckoutSession('user-7', 'https://app/ok', 'https://app/no');
    expect(result).toEqual({ id: 'cs_1', url: 'https://checkout/x' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.authorization).toBe('Bearer sk_test_dummy');
    expect(init.headers['content-type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(init.body as string);
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('client_reference_id')).toBe('user-7');
    expect(body.get('line_items[0][price]')).toBe('price_123');
    expect(body.get('subscription_data[metadata][userId]')).toBe('user-7');
  });

  it('πετάει StripeError σε σφάλμα', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ error: { message: 'nope' } }, 400)));
    await expect(createCheckoutSession('u', 'a', 'b')).rejects.toBeInstanceOf(StripeError);
  });
});

describe('getCheckoutSession', () => {
  it('χαρτογραφεί ολοκληρωμένη συνεδρία', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          id: 'cs_1',
          client_reference_id: 'user-7',
          status: 'complete',
          subscription: 'sub_123',
        }),
      ),
    );
    const session = await getCheckoutSession('cs_1');
    expect(session.clientReferenceId).toBe('user-7');
    expect(session.complete).toBe(true);
    expect(session.subscriptionId).toBe('sub_123');
  });

  it('δέχεται subscription ως αντικείμενο (expanded)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({ id: 'cs_1', client_reference_id: 'u', status: 'open', subscription: { id: 'sub_9' } }),
      ),
    );
    const session = await getCheckoutSession('cs_1');
    expect(session.subscriptionId).toBe('sub_9');
    expect(session.complete).toBe(false);
  });
});

describe('getSubscription', () => {
  it('χαρτογραφεί ενεργή συνδρομή με τιμολόγιο', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1788000000,
          metadata: { userId: 'user-7' },
          latest_invoice: {
            id: 'in_42',
            amount_paid: 300,
            status_transitions: { paid_at: 1785400000 },
          },
        }),
      ),
    );

    const sub = await getSubscription('sub_1');
    expect(sub.status).toBe('active');
    expect(sub.ownerUserId).toBe('user-7');
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.currentPeriodEnd?.getTime()).toBe(1788000000 * 1000);
    expect(sub.latestInvoice).toEqual({
      id: 'in_42',
      amountPaidCents: 300,
      paidAt: new Date(1785400000 * 1000),
    });
  });

  it('ανέχεται συνδρομή χωρίς τιμολόγιο ή period end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({ id: 'sub_1', status: 'canceled', cancel_at_period_end: true, metadata: {} }),
      ),
    );
    const sub = await getSubscription('sub_1');
    expect(sub.currentPeriodEnd).toBeNull();
    expect(sub.latestInvoice).toBeNull();
    expect(sub.ownerUserId).toBeNull();
  });
});

describe('cancelAtPeriodEnd', () => {
  it('στέλνει cancel_at_period_end=true ώστε να μη χαθεί ο πληρωμένος χρόνος', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'sub_1', cancel_at_period_end: true }));
    vi.stubGlobal('fetch', fetchMock);

    await cancelAtPeriodEnd('sub_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(new URLSearchParams(init.body as string).get('cancel_at_period_end')).toBe('true');
  });
});
```

- [ ] **Step 2: Τρέξε τα tests για να δεις ότι αποτυγχάνουν**

Run: `npx vitest run tests/unit/stripe-client.test.ts`
Expected: FAIL με `Cannot find module '@/server/billing/stripe'`

- [ ] **Step 3: Γράψε την υλοποίηση**

Δημιούργησε `src/server/billing/stripe.ts`:

```ts
import 'server-only';
import { env, STRIPE_API_BASE, stripeConfigured } from '../env';

/** Σφάλμα παρόχου. Το `detail` μένει ΜΟΝΟ στα server logs. */
export class StripeError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'StripeError';
    this.detail = detail;
  }
}

export interface StripeInvoice {
  id: string;
  amountPaidCents: number;
  paidAt: Date | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  ownerUserId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  latestInvoice: StripeInvoice | null;
}

export interface StripeCheckoutSession {
  id: string;
  clientReferenceId: string | null;
  complete: boolean;
  subscriptionId: string | null;
}

/** Το Stripe δέχεται form-encoded σώματα με ένθετα κλειδιά σε αγκύλες. */
function formEncode(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

async function call(
  path: string,
  init: { method: 'GET' | 'POST'; body?: Record<string, string | number | boolean> },
): Promise<unknown> {
  if (!stripeConfigured) {
    throw new StripeError('Stripe not configured', 'missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID');
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    ...(init.body ? { body: formEncode(init.body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new StripeError(
      'Stripe request failed',
      `path=${path} status=${response.status} body=${text.slice(0, 300)}`,
    );
  }
  return response.json();
}

function unixToDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}

export async function createCheckoutSession(
  userId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ id: string; url: string }> {
  const data = (await call('/v1/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'subscription',
      'line_items[0][price]': env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': 1,
      // Δύο ανεξάρτητοι σύνδεσμοι με τον λογαριασμό μας:
      // - client_reference_id: το διαβάζουμε στο return για επαλήθευση ιδιοκτησίας
      // - subscription metadata: επιβιώνει σε κάθε μελλοντική ανανέωση
      client_reference_id: userId,
      'subscription_data[metadata][userId]': userId,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      locale: 'el',
    },
  })) as { id: string; url?: string };

  if (!data.url) {
    throw new StripeError('Stripe request failed', 'checkout session has no url');
  }
  return { id: data.id, url: data.url };
}

export async function getCheckoutSession(id: string): Promise<StripeCheckoutSession> {
  const data = (await call(`/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    method: 'GET',
  })) as {
    id: string;
    client_reference_id?: string | null;
    status?: string;
    subscription?: string | { id: string } | null;
  };

  const subscription = data.subscription;
  return {
    id: data.id,
    clientReferenceId: data.client_reference_id ?? null,
    complete: data.status === 'complete',
    subscriptionId: typeof subscription === 'string' ? subscription : (subscription?.id ?? null),
  };
}

export async function getSubscription(id: string): Promise<StripeSubscription> {
  const data = (await call(`/v1/subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`, {
    method: 'GET',
  })) as {
    id: string;
    status: string;
    cancel_at_period_end?: boolean;
    current_period_end?: number;
    metadata?: Record<string, string>;
    latest_invoice?: {
      id: string;
      amount_paid?: number;
      status_transitions?: { paid_at?: number };
    } | null;
  };

  const invoice = data.latest_invoice;
  return {
    id: data.id,
    status: data.status,
    ownerUserId: data.metadata?.userId ?? null,
    currentPeriodEnd: unixToDate(data.current_period_end),
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    latestInvoice: invoice
      ? {
          id: invoice.id,
          amountPaidCents: invoice.amount_paid ?? 0,
          paidAt: unixToDate(invoice.status_transitions?.paid_at),
        }
      : null,
  };
}

/**
 * Ακύρωση στο ΤΕΛΟΣ της περιόδου — όχι άμεση.
 * Ο χρήστης πλήρωσε τον μήνα· τον κρατά μέχρι να τελειώσει.
 */
export async function cancelAtPeriodEnd(id: string): Promise<void> {
  await call(`/v1/subscriptions/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: { cancel_at_period_end: true },
  });
}
```

- [ ] **Step 4: Τρέξε τα tests**

Run: `npx vitest run tests/unit/stripe-client.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/server/billing/stripe.ts tests/unit/stripe-client.test.ts
git commit -m "feat(billing): Stripe client (Checkout, subscriptions, ακύρωση στο τέλος περιόδου)"
```

---

### Task 4: Υπηρεσία συνδρομών

**Files:**
- Create: `src/server/services/subscription.ts`
- Modify: `src/server/services/user.ts` (δημιουργία δοκιμής στην εγγραφή)
- Test: `tests/unit/subscription-service.test.ts`

**Interfaces:**
- Consumes: `resolveAccessState` (Task 2), Stripe client (Task 3), `prisma`
- Produces:
  - `async function createTrialForUser(tx: Prisma.TransactionClient, userId: string): Promise<void>`
  - `async function getAccessState(userId: string): Promise<AccessState>`
  - `async function reconcileSubscription(userId: string): Promise<AccessState>`
  - `async function attachStripeCheckout(userId: string, sessionId: string): Promise<void>`
  - `async function cancelUserSubscription(userId: string): Promise<void>`
  - `async function extendManually(userId: string, months: number, note: string): Promise<void>`
  - `async function getBillingOverview(userId: string): Promise<BillingOverview>`

- [ ] **Step 1: Γράψε τα failing tests**

Δημιούργησε `tests/unit/subscription-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

interface FakeSub {
  userId: string;
  status: string;
  provider: string | null;
  accessUntil: Date;
  autoRenew: boolean;
  externalId: string | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  cancelledAt: Date | null;
}

const store: {
  subs: FakeSub[];
  payments: Array<Record<string, unknown>>;
  users: Array<{ id: string; role: string }>;
} = { subs: [], payments: [], users: [] };

const fakePrisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      store.users.find((u) => u.id === where.id) ?? null,
    ),
  },
  subscription: {
    findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
      store.subs.find((s) => s.userId === where.userId) ?? null,
    ),
    update: vi.fn(
      async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
        const sub = store.subs.find((s) => s.userId === where.userId)!;
        Object.assign(sub, data);
        return sub;
      },
    ),
  },
  payment: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.externalId && store.payments.some((p) => p.externalId === data.externalId)) {
        const error = new Error('Unique constraint failed') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      }
      store.payments.push(data);
      return data;
    }),
    findMany: vi.fn(async () => store.payments),
  },
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));

const getSubscriptionMock = vi.fn();
const getCheckoutSessionMock = vi.fn();
const cancelAtPeriodEndMock = vi.fn(async () => undefined);

vi.mock('@/server/billing/stripe', () => ({
  getSubscription: (...a: unknown[]) => getSubscriptionMock(...(a as [])),
  getCheckoutSession: (...a: unknown[]) => getCheckoutSessionMock(...(a as [])),
  cancelAtPeriodEnd: (...a: unknown[]) => cancelAtPeriodEndMock(...(a as [])),
  createCheckoutSession: vi.fn(),
  StripeError: class StripeError extends Error {
    detail = '';
  },
}));

const { getAccessState, reconcileSubscription, extendManually, attachStripeCheckout } =
  await import('@/server/services/subscription');

beforeEach(() => {
  store.subs = [];
  store.payments = [];
  store.users = [{ id: 'user-1', role: 'USER' }];
  getSubscriptionMock.mockReset();
  getCheckoutSessionMock.mockReset();
  cancelAtPeriodEndMock.mockClear();
});

function seedSub(overrides: Partial<FakeSub> = {}) {
  store.subs.push({
    userId: 'user-1',
    status: 'TRIALING',
    provider: null,
    accessUntil: new Date(Date.now() + 2 * DAY),
    autoRenew: false,
    externalId: null,
    lastSyncedAt: null,
    lastSyncError: null,
    cancelledAt: null,
    ...overrides,
  });
}

function activeStripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    ownerUserId: 'user-1',
    currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    cancelAtPeriodEnd: false,
    latestInvoice: { id: 'in_1', amountPaidCents: 300, paidAt: new Date() },
    ...overrides,
  };
}

describe('getAccessState', () => {
  it('επιστρέφει TRIAL για ενεργή δοκιμή χωρίς κλήση Stripe', async () => {
    seedSub();
    const state = await getAccessState('user-1');
    expect(state.kind).toBe('TRIAL');
    expect(getSubscriptionMock).not.toHaveBeenCalled();
  });

  it('ο ADMIN δεν ελέγχεται καθόλου', async () => {
    store.users = [{ id: 'user-1', role: 'ADMIN' }];
    const state = await getAccessState('user-1');
    expect(state.kind).toBe('UNLIMITED');
  });
});

describe('reconcileSubscription', () => {
  it('ανανεώνει το accessUntil όταν το Stripe λέει active', async () => {
    const next = new Date(Date.now() + 30 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub({ currentPeriodEnd: next }));

    const state = await reconcileSubscription('user-1');
    expect(state.canWrite).toBe(true);
    expect(store.subs[0].accessUntil.getTime()).toBe(next.getTime());
    expect(store.payments).toHaveLength(1);
    expect(store.payments[0].externalId).toBe('in_1');
  });

  it('δεν καταγράφει δεύτερη φορά το ίδιο τιμολόγιο', async () => {
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub());

    await reconcileSubscription('user-1');
    store.subs[0].lastSyncedAt = null;
    store.subs[0].accessUntil = new Date(Date.now() - DAY);
    await reconcileSubscription('user-1');

    expect(store.payments).toHaveLength(1);
  });

  it('σε σφάλμα Stripe δεν αλλάζει το accessUntil', async () => {
    const expired = new Date(Date.now() - DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: expired,
    });
    getSubscriptionMock.mockRejectedValue(new Error('network down'));

    const state = await reconcileSubscription('user-1');
    expect(store.subs[0].accessUntil.getTime()).toBe(expired.getTime());
    expect(state.kind).toBe('GRACE');
  });

  it('χρησιμοποιεί fallback +1 μήνα όταν λείπει το current_period_end', async () => {
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(
      activeStripeSub({ currentPeriodEnd: null, latestInvoice: null }),
    );

    await reconcileSubscription('user-1');
    expect(store.subs[0].accessUntil.getTime()).toBeGreaterThan(Date.now() + 27 * DAY);
  });

  it('το cancel_at_period_end γίνεται CANCELLED χωρίς απώλεια χρόνου', async () => {
    const until = new Date(Date.now() + 5 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(
      activeStripeSub({ cancelAtPeriodEnd: true, currentPeriodEnd: until }),
    );

    await reconcileSubscription('user-1');
    expect(store.subs[0].status).toBe('CANCELLED');
    expect(store.subs[0].autoRenew).toBe(false);
    expect(store.subs[0].accessUntil.getTime()).toBe(until.getTime());
  });
});

describe('attachStripeCheckout', () => {
  it('απορρίπτει συνεδρία που ανήκει σε άλλον χρήστη', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'someone-else',
      complete: true,
      subscriptionId: 'sub_1',
    });

    await expect(attachStripeCheckout('user-1', 'cs_1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.subs[0].provider).toBeNull();
  });

  it('απορρίπτει μη ολοκληρωμένη συνεδρία', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'user-1',
      complete: false,
      subscriptionId: null,
    });

    await expect(attachStripeCheckout('user-1', 'cs_1')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('ενεργοποιεί τη συνδρομή όταν όλα επαληθεύονται', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'user-1',
      complete: true,
      subscriptionId: 'sub_1',
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub());

    await attachStripeCheckout('user-1', 'cs_1');
    expect(store.subs[0].provider).toBe('STRIPE');
    expect(store.subs[0].status).toBe('ACTIVE');
    expect(store.subs[0].externalId).toBe('sub_1');
    expect(store.payments).toHaveLength(1);
  });
});

describe('extendManually', () => {
  it('προσθέτει χρόνο αντί να τον χάνει όταν πληρώνει νωρίς', async () => {
    const future = new Date(Date.now() + 10 * DAY);
    seedSub({ status: 'ACTIVE', provider: 'MANUAL', accessUntil: future });

    await extendManually('user-1', 1, 'IRIS 05/08');

    expect(store.subs[0].accessUntil.getTime()).toBeGreaterThan(future.getTime() + 25 * DAY);
    expect(store.payments).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Τρέξε τα tests για να δεις ότι αποτυγχάνουν**

Run: `npx vitest run tests/unit/subscription-service.test.ts`
Expected: FAIL με `Cannot find module '@/server/services/subscription'`

- [ ] **Step 3: Γράψε την υπηρεσία**

Δημιούργησε `src/server/services/subscription.ts`:

```ts
import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env, stripeConfigured } from '../env';
import { ApiError } from '../errors';
import { logger } from '../logger';
import {
  cancelAtPeriodEnd,
  getCheckoutSession,
  getSubscription,
  type StripeSubscription,
} from '../billing/stripe';
import {
  resolveAccessState,
  type AccessState,
  type SubscriptionSnapshot,
} from '@/lib/billing/access';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Σταθερά κώδικα (όχι ρύθμιση): μία ερώτηση στο Stripe ανά χρήστη ανά 5 λεπτά. */
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/** Καλείται ΜΕΣΑ στο transaction εγγραφής — χρήστης χωρίς συνδρομή δεν υπάρχει. */
export async function createTrialForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.subscription.create({
    data: {
      userId,
      status: 'TRIALING',
      accessUntil: new Date(Date.now() + env.TRIAL_DAYS * DAY_MS),
    },
  });
}

async function loadInput(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  const snapshot: SubscriptionSnapshot | null = subscription
    ? {
        status: subscription.status,
        provider: subscription.provider,
        accessUntil: subscription.accessUntil,
        autoRenew: subscription.autoRenew,
      }
    : null;

  return {
    subscription,
    input: {
      role: user?.role ?? 'USER',
      billingEnabled: env.BILLING_ENABLED,
      graceDays: env.SUBSCRIPTION_GRACE_DAYS,
      subscription: snapshot,
    },
  };
}

/** Γρήγορος έλεγχος — καμία κλήση δικτύου αν η πρόσβαση ισχύει. */
export async function getAccessState(userId: string): Promise<AccessState> {
  const { input } = await loadInput(userId);
  const state = resolveAccessState(input);
  if (state.canWrite && state.kind !== 'GRACE') return state;
  return reconcileSubscription(userId);
}

async function applyRemote(userId: string, remote: StripeSubscription): Promise<void> {
  const accessUntil = remote.currentPeriodEnd ?? addMonths(new Date(), 1);

  if (remote.status === 'active' || remote.status === 'trialing') {
    await prisma.subscription.update({
      where: { userId },
      data: {
        // cancel_at_period_end σημαίνει «πληρωμένος μέχρι τη λήξη, μετά τέλος»
        status: remote.cancelAtPeriodEnd ? 'CANCELLED' : 'ACTIVE',
        provider: 'STRIPE',
        accessUntil,
        autoRenew: !remote.cancelAtPeriodEnd,
        cancelledAt: remote.cancelAtPeriodEnd ? new Date() : null,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    await recordPaymentIfNew(userId, remote);
    return;
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: remote.status === 'canceled' ? 'CANCELLED' : 'EXPIRED',
      autoRenew: false,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    },
  });
}

/**
 * Η μοναδική συνάρτηση που συγχρονίζει με τον πάροχο.
 * Όταν υπάρξει δημόσιο URL, το webhook route θα καλεί ΑΥΤΗΝ — τίποτα άλλο δεν αλλάζει.
 */
export async function reconcileSubscription(userId: string): Promise<AccessState> {
  const { subscription, input } = await loadInput(userId);
  const current = resolveAccessState(input);

  if (current.kind === 'UNLIMITED') return current;
  if (!subscription) return current;
  if (subscription.provider !== 'STRIPE' || !subscription.externalId) return current;
  if (subscription.accessUntil.getTime() > Date.now()) return current;

  const lastSynced = subscription.lastSyncedAt?.getTime() ?? 0;
  if (Date.now() - lastSynced < SYNC_COOLDOWN_MS) return current;

  try {
    const remote = await getSubscription(subscription.externalId);
    await applyRemote(userId, remote);
  } catch (error) {
    // ΔΕΝ αλλάζουμε το accessUntil: ο χρήστης δεν φταίει για σφάλμα δικτύου.
    // Η περίοδος χάριτος στο resolveAccessState τον καλύπτει.
    logger.error('subscription_sync_failed', {
      userId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    await prisma.subscription.update({
      where: { userId },
      data: { lastSyncError: 'SYNC_FAILED', lastSyncedAt: new Date() },
    });
  }

  const refreshed = await loadInput(userId);
  return resolveAccessState(refreshed.input);
}

async function recordPaymentIfNew(userId: string, remote: StripeSubscription): Promise<void> {
  const invoice = remote.latestInvoice;
  if (!invoice || invoice.amountPaidCents <= 0) return;
  try {
    await prisma.payment.create({
      data: {
        userId,
        provider: 'STRIPE',
        // Το Stripe δίνει πραγματικό μοναδικό id τιμολογίου — το unique
        // constraint κάνει το idempotency χωρίς συνθετικό κλειδί.
        externalId: invoice.id,
        amountCents: invoice.amountPaidCents,
        paidAt: invoice.paidAt ?? new Date(),
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'P2002') throw error;
  }
}

/** Καλείται στο success URL. Επαληθεύει ΙΔΙΟΚΤΗΣΙΑ πριν ενεργοποιήσει. */
export async function attachStripeCheckout(userId: string, sessionId: string): Promise<void> {
  const session = await getCheckoutSession(sessionId);

  if (session.clientReferenceId !== userId) {
    logger.warn('stripe_session_owner_mismatch', { userId });
    throw new ApiError('FORBIDDEN', 'Η πληρωμή δεν αντιστοιχεί σε αυτόν τον λογαριασμό.');
  }
  if (!session.complete || !session.subscriptionId) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή δεν ολοκληρώθηκε ακόμη. Δοκίμασε ξανά σε λίγο.');
  }

  const remote = await getSubscription(session.subscriptionId);
  await prisma.subscription.update({
    where: { userId },
    data: { provider: 'STRIPE', externalId: session.subscriptionId },
  });
  await applyRemote(userId, remote);
  logger.info('subscription_activated', { userId });
}

export async function cancelUserSubscription(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription?.externalId || subscription.provider !== 'STRIPE') {
    throw new ApiError('BAD_REQUEST', 'Δεν υπάρχει ενεργή συνδρομή προς ακύρωση.');
  }

  await cancelAtPeriodEnd(subscription.externalId);

  // Το accessUntil ΔΕΝ αλλάζει: ο πληρωμένος μήνας ολοκληρώνεται.
  await prisma.subscription.update({
    where: { userId },
    data: { status: 'CANCELLED', autoRenew: false, cancelledAt: new Date() },
  });
  logger.info('subscription_cancelled', { userId });
}

export async function extendManually(
  userId: string,
  months: number,
  note: string,
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) throw new ApiError('NOT_FOUND', 'Ο χρήστης δεν βρέθηκε.');

  const now = new Date();
  // max(): πρόωρη πληρωμή ΠΡΟΣΘΕΤΕΙ χρόνο αντί να τον χάνει.
  const from = subscription.accessUntil.getTime() > now.getTime() ? subscription.accessUntil : now;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: 'ACTIVE',
      provider: 'MANUAL',
      accessUntil: addMonths(from, months),
      autoRenew: false,
    },
  });
  await prisma.payment.create({
    data: {
      userId,
      provider: 'MANUAL',
      amountCents: months * env.SUBSCRIPTION_PRICE_CENTS,
      paidAt: now,
      note: note.slice(0, 300),
    },
  });
  logger.info('subscription_extended_manually', { userId, months });
}

export interface BillingOverview {
  state: AccessState;
  status: string;
  provider: string | null;
  priceCents: number;
  stripeAvailable: boolean;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    paidAt: string;
    note: string | null;
  }>;
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const state = await getAccessState(userId);
  const [subscription, payments] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: 'desc' }, take: 24 }),
  ]);

  return {
    state,
    status: subscription?.status ?? 'EXPIRED',
    provider: subscription?.provider ?? null,
    priceCents: env.SUBSCRIPTION_PRICE_CENTS,
    stripeAvailable: stripeConfigured,
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      paidAt: payment.paidAt.toISOString(),
      note: payment.note,
    })),
  };
}
```

- [ ] **Step 4: Σύνδεσε τη δοκιμή με την εγγραφή**

Στο `src/server/services/user.ts`, πρόσθεσε `import { createTrialForUser } from './subscription';` και αντικατέστησε το `prisma.user.create(...)` μέσα στη `createUser` με:

```ts
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          consentAcceptedAt: new Date(),
        },
        select: { id: true, email: true, displayName: true, role: true },
      });
      await createTrialForUser(tx, created.id);
      return created;
    });
```

- [ ] **Step 5: Τρέξε όλα τα tests**

Run: `npx vitest run`
Expected: PASS — όλα, συμπεριλαμβανομένων των προηγούμενων

- [ ] **Step 6: Commit**

```bash
git add src/server/services/subscription.ts src/server/services/user.ts tests/unit/subscription-service.test.ts
git commit -m "feat(billing): υπηρεσία συνδρομών με συμφιλίωση Stripe και χειροκίνητη παράταση"
```

---

### Task 5: Φύλακας εγγραφής και επιβολή στα endpoints

**Files:**
- Modify: `src/server/errors.ts`
- Modify: `src/server/auth/guards.ts`
- Modify: `src/app/api/meals/route.ts`
- Modify: `src/app/api/meals/[id]/analyze/route.ts`
- Modify: `src/app/api/weight/route.ts`
- Test: `tests/unit/write-access-guard.test.ts`

**Interfaces:**
- Consumes: `getAccessState` (Task 4)
- Produces: `async function requireWriteAccess(userId: string): Promise<void>` — πετάει `ApiError('SUBSCRIPTION_REQUIRED')`

- [ ] **Step 1: Πρόσθεσε τον κωδικό σφάλματος**

Στο `src/server/errors.ts`, στο union `ApiErrorCode` πρόσθεσε `| 'SUBSCRIPTION_REQUIRED'` και στο `HTTP_STATUS`:

```ts
  SUBSCRIPTION_REQUIRED: 402,
```

- [ ] **Step 2: Γράψε το failing test**

Δημιούργησε `tests/unit/write-access-guard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessStateMock = vi.fn();
vi.mock('@/server/services/subscription', () => ({
  getAccessState: (...a: unknown[]) => getAccessStateMock(...(a as [])),
}));
vi.mock('@/server/db/prisma', () => ({ prisma: {} }));

const { requireWriteAccess } = await import('@/server/auth/guards');
const { ApiError } = await import('@/server/errors');

beforeEach(() => getAccessStateMock.mockReset());

describe('requireWriteAccess', () => {
  it('επιτρέπει όταν η κατάσταση δίνει δικαίωμα εγγραφής', async () => {
    getAccessStateMock.mockResolvedValue({ kind: 'TRIAL', canWrite: true });
    await expect(requireWriteAccess('user-1')).resolves.toBeUndefined();
  });

  it('πετάει SUBSCRIPTION_REQUIRED όταν είναι κλειδωμένος', async () => {
    getAccessStateMock.mockResolvedValue({ kind: 'LOCKED', canWrite: false });
    await expect(requireWriteAccess('user-1')).rejects.toBeInstanceOf(ApiError);
    await expect(requireWriteAccess('user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_REQUIRED',
      status: 402,
    });
  });
});
```

- [ ] **Step 3: Τρέξε το test για να δεις ότι αποτυγχάνει**

Run: `npx vitest run tests/unit/write-access-guard.test.ts`
Expected: FAIL — `requireWriteAccess is not a function`

- [ ] **Step 4: Γράψε τον φύλακα**

Στο τέλος του `src/server/auth/guards.ts`:

```ts
import { getAccessState } from '../services/subscription';

/**
 * Επιβάλλεται ΜΟΝΟ στα τρία endpoints που δημιουργούν νέα δεδομένα.
 * Δεν μπαίνει σε middleware: το edge runtime δεν έχει πρόσβαση στη βάση,
 * και έλεγχος μοιρασμένος σε δύο επίπεδα κάποια στιγμή αποκλίνει.
 */
export async function requireWriteAccess(userId: string): Promise<void> {
  const state = await getAccessState(userId);
  if (state.canWrite) return;
  throw new ApiError(
    'SUBSCRIPTION_REQUIRED',
    'Η συνδρομή σου έληξε. Ανανέωσέ την για να προσθέσεις νέα δεδομένα.',
  );
}
```

- [ ] **Step 5: Εφάρμοσε τον φύλακα στα τρία endpoints**

Σε καθένα από τα παρακάτω, αμέσως **μετά** το `const user = await requireApiUser();`:

`src/app/api/meals/route.ts` (μόνο στο `POST`), `src/app/api/meals/[id]/analyze/route.ts`, `src/app/api/weight/route.ts` (μόνο στο `POST`):

```ts
  await requireWriteAccess(user.id);
```

Πρόσθεσε στο import: `import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';`

**Μην** το προσθέσεις σε `PATCH`, `DELETE`, `GET`, `PUT /api/profile` ή στο export.

- [ ] **Step 6: Τρέξε τα tests και τον typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, καμία έξοδος από tsc

- [ ] **Step 7: Commit**

```bash
git add src/server/errors.ts src/server/auth/guards.ts src/app/api/meals src/app/api/weight tests/unit/write-access-guard.test.ts
git commit -m "feat(billing): φύλακας εγγραφής με 402 στα τρία endpoints νέων δεδομένων"
```

---

### Task 6: API routes χρέωσης

**Files:**
- Create: `src/app/api/billing/route.ts`
- Create: `src/app/api/billing/stripe/subscribe/route.ts`
- Create: `src/app/api/billing/stripe/return/route.ts`
- Create: `src/app/api/billing/cancel/route.ts`
- Create: `src/app/api/admin/subscriptions/extend/route.ts`
- Create: `src/lib/validation/billing.ts`

**Interfaces:**
- Consumes: υπηρεσία Task 4
- Produces: HTTP endpoints· `extendSubscriptionSchema` (Zod)

- [ ] **Step 1: Γράψε το Zod schema**

Δημιούργησε `src/lib/validation/billing.ts`:

```ts
import { z } from 'zod';

export const extendSubscriptionSchema = z.object({
  userId: z.string().cuid('Μη έγκυρο αναγνωριστικό χρήστη.'),
  months: z.coerce
    .number()
    .int('Οι μήνες πρέπει να είναι ακέραιος.')
    .min(1, 'Τουλάχιστον 1 μήνας.')
    .max(24, 'Το πολύ 24 μήνες.'),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export type ExtendSubscriptionInput = z.infer<typeof extendSubscriptionSchema>;
```

- [ ] **Step 2: GET κατάσταση**

Δημιούργησε `src/app/api/billing/route.ts`:

```ts
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getBillingOverview } from '@/server/services/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk(await getBillingOverview(user.id));
});
```

- [ ] **Step 3: POST έναρξη συνδρομής**

Δημιούργησε `src/app/api/billing/stripe/checkout/route.ts`:

```ts
import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { createCheckoutSession } from '@/server/billing/stripe';
import { env, stripeConfigured } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();

  if (!stripeConfigured) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή με κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή.');
  }

  const { url } = await createCheckoutSession(
    user.id,
    `${env.APP_URL}/api/billing/stripe/return`,
    `${env.APP_URL}/billing?cancelled=1`,
  );

  return jsonOk({ url });
});
```

- [ ] **Step 4: GET επιστροφή με επαλήθευση**

Δημιούργησε `src/app/api/billing/stripe/return/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { attachStripeCheckout } from '@/server/services/subscription';
import { env } from '@/server/env';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Το session_id έρχεται από το URL, άρα είναι είσοδος χρήστη.
 * Η attachStripeCheckout ρωτά το Stripe ποιανού είναι πριν ενεργοποιήσει.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const sessionId = new URL(request.url).searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(`${env.APP_URL}/billing?error=missing`);
  }

  try {
    await attachStripeCheckout(user.id, sessionId);
    return NextResponse.redirect(`${env.APP_URL}/billing?activated=1`);
  } catch (error) {
    logger.warn('stripe_return_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(`${env.APP_URL}/billing?error=verify`);
  }
});
```

- [ ] **Step 5: POST ακύρωση**

Δημιούργησε `src/app/api/billing/cancel/route.ts`:

```ts
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { cancelUserSubscription } from '@/server/services/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await cancelUserSubscription(user.id);
  return jsonOk({ cancelled: true });
});
```

- [ ] **Step 6: POST χειροκίνητη παράταση (ADMIN)**

Δημιούργησε `src/app/api/admin/subscriptions/extend/route.ts`:

```ts
import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { extendManually } from '@/server/services/subscription';
import { extendSubscriptionSchema } from '@/lib/validation/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  if (user.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN', 'Απαιτούνται δικαιώματα διαχειριστή.');
  }

  const input = extendSubscriptionSchema.parse(await request.json());
  await extendManually(input.userId, input.months, input.note || 'Χειροκίνητη ενεργοποίηση');
  return jsonOk({ extended: true });
});
```

- [ ] **Step 7: Typecheck και commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: καθαρό

```bash
git add src/app/api/billing src/app/api/admin src/lib/validation/billing.ts
git commit -m "feat(billing): API routes για συνδρομή, ακύρωση και χειροκίνητη παράταση"
```

---

### Task 7: UI χρήστη — banner και σελίδα `/billing`

**Files:**
- Modify: `src/i18n/el.ts`, `src/i18n/en.ts`
- Create: `src/components/billing/subscription-banner.tsx`
- Create: `src/components/billing/billing-panel.tsx`
- Create: `src/app/(app)/billing/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/components/app-nav.tsx`

**Interfaces:**
- Consumes: `getBillingOverview`, `getAccessState` (Task 4)
- Produces: `<SubscriptionBanner state kind daysRemaining accessUntilLabel />`, `<BillingPanel overview />`

- [ ] **Step 1: Πρόσθεσε τα κείμενα**

Στο `src/i18n/el.ts`, νέα ενότητα πριν το `errors`:

```ts
  billing: {
    title: 'Συνδρομή',
    subtitle: 'Κατάσταση πρόσβασης και πληρωμές.',
    navLabel: 'Συνδρομή',
    trialActive: 'Δοκιμαστική περίοδος — απομένουν {days} ημέρες',
    trialLastDay: 'Δοκιμαστική περίοδος — τελευταία ημέρα',
    activeUntil: 'Ενεργή έως {date}',
    graceNotice: 'Επιβεβαιώνουμε τη συνδρομή σου. Η πρόσβαση συνεχίζεται στο μεταξύ.',
    locked: 'Η συνδρομή έληξε. Μπορείς να βλέπεις και να εξάγεις τα δεδομένα σου, αλλά όχι να προσθέτεις νέα.',
    subscribe: 'Συνδρομή {price}/μήνα',
    subscribing: 'Μεταφορά στο Stripe…',
    cancel: 'Ακύρωση ανανέωσης',
    cancelConfirmTitle: 'Ακύρωση αυτόματης ανανέωσης;',
    cancelConfirmBody: 'Η πρόσβασή σου συνεχίζεται μέχρι το τέλος της πληρωμένης περιόδου.',
    cancelled: 'Η αυτόματη ανανέωση ακυρώθηκε.',
    autoRenewOn: 'Ανανεώνεται αυτόματα κάθε μήνα.',
    autoRenewOff: 'Δεν θα ανανεωθεί αυτόματα.',
    paymentsTitle: 'Ιστορικό πληρωμών',
    paymentsEmpty: 'Καμία πληρωμή ακόμη.',
    stripeUnavailable: 'Η αυτόματη πληρωμή δεν είναι ρυθμισμένη. Επικοινώνησε για ενεργοποίηση.',
    activated: 'Η συνδρομή ενεργοποιήθηκε.',
    verifyFailed: 'Δεν μπορέσαμε να επιβεβαιώσουμε την πληρωμή. Δοκίμασε ξανά.',
    lockedAction: 'Χρειάζεται ενεργή συνδρομή.',
  },
```

Στο `src/i18n/en.ts`, **ακριβώς τα ίδια κλειδιά** με αγγλικά κείμενα (αλλιώς σπάει ο τύπος `Translations`):

```ts
  billing: {
    title: 'Subscription',
    subtitle: 'Access status and payments.',
    navLabel: 'Subscription',
    trialActive: 'Trial period — {days} days remaining',
    trialLastDay: 'Trial period — last day',
    activeUntil: 'Active until {date}',
    graceNotice: 'We are confirming your subscription. Access continues meanwhile.',
    locked: 'Your subscription has expired. You can view and export your data, but not add new entries.',
    subscribe: 'Subscribe {price}/month',
    subscribing: 'Redirecting to Stripe…',
    cancel: 'Cancel renewal',
    cancelConfirmTitle: 'Cancel automatic renewal?',
    cancelConfirmBody: 'Your access continues until the end of the paid period.',
    cancelled: 'Automatic renewal cancelled.',
    autoRenewOn: 'Renews automatically every month.',
    autoRenewOff: 'Will not renew automatically.',
    paymentsTitle: 'Payment history',
    paymentsEmpty: 'No payments yet.',
    stripeUnavailable: 'Automatic payment is not configured. Contact us to activate.',
    activated: 'Subscription activated.',
    verifyFailed: 'We could not verify the payment. Please try again.',
    lockedAction: 'An active subscription is required.',
  },
```

- [ ] **Step 2: Γράψε το banner**

Δημιούργησε `src/components/billing/subscription-banner.tsx`:

```tsx
import Link from 'next/link';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';
import type { AccessStateKind } from '@/lib/billing/access';

export function SubscriptionBanner({
  kind,
  daysRemaining,
  accessUntilLabel,
}: {
  kind: AccessStateKind;
  daysRemaining: number | null;
  accessUntilLabel: string | null;
}) {
  if (kind === 'UNLIMITED' || kind === 'ACTIVE') return null;

  const locked = kind === 'LOCKED';
  const message =
    kind === 'TRIAL'
      ? daysRemaining !== null && daysRemaining <= 1
        ? t('billing.trialLastDay')
        : t('billing.trialActive', undefined, { days: String(daysRemaining ?? 0) })
      : kind === 'GRACE'
        ? t('billing.graceNotice')
        : t('billing.locked');

  return (
    <div
      role={locked ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        locked ? 'border-destructive/40 bg-destructive/10' : 'border-accent/40 bg-accent/10',
      )}
    >
      {locked ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      )}
      <div className="flex-1">
        <p>{message}</p>
        {accessUntilLabel && kind !== 'LOCKED' ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{accessUntilLabel}</p>
        ) : null}
      </div>
      <Link
        href="/billing"
        className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
      >
        {t('billing.navLabel')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Επέκτεινε την `t()` ώστε να δέχεται μεταβλητές χωρίς locale**

Στο `src/i18n/index.ts` η υπογραφή είναι ήδη `t(key, locale?, vars?)`. Επαλήθευσε ότι το `t('billing.trialActive', undefined, { days: '2' })` αντικαθιστά το `{days}`. Αν όχι, διόρθωσε το regex ώστε να καλύπτει `{days}`.

Run: `npx tsc --noEmit`

- [ ] **Step 4: Γράψε το panel της σελίδας**

Δημιούργησε `src/components/billing/billing-panel.tsx`:

```tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { t } from '@/i18n';

export interface BillingOverviewView {
  kind: 'UNLIMITED' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LOCKED';
  accessUntilLabel: string | null;
  autoRenew: boolean;
  priceLabel: string;
  stripeAvailable: boolean;
  payments: Array<{ id: string; amountLabel: string; paidAtLabel: string; note: string | null }>;
}

export function BillingPanel({ overview }: { overview: BillingOverviewView }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (params.get('activated')) toast.push(t('billing.activated'), 'success');
    if (params.get('error')) toast.push(t('billing.verifyFailed'), 'error');
  }, [params, toast]);

  async function subscribe() {
    if (loading) return;
    setLoading(true);
    try {
      const { approveUrl } = await api.post<{ approveUrl: string }>('/api/billing/stripe/subscribe');
      window.location.href = approveUrl;
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setLoading(false);
    }
  }

  async function cancel() {
    setLoading(true);
    try {
      await api.post('/api/billing/cancel');
      toast.push(t('billing.cancelled'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.title')}</CardTitle>
          <CardDescription>{overview.accessUntilLabel ?? t('billing.locked')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge tone={overview.kind === 'LOCKED' ? 'danger' : 'primary'}>{overview.kind}</Badge>
          <p className="text-sm text-muted-foreground">
            {overview.autoRenew ? t('billing.autoRenewOn') : t('billing.autoRenewOff')}
          </p>

          {overview.kind !== 'UNLIMITED' ? (
            overview.stripeAvailable ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {!overview.autoRenew ? (
                  <Button onClick={subscribe} loading={loading} className="sm:flex-1">
                    {t('billing.subscribe', undefined, { price: overview.priceLabel })}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setConfirming(true)} disabled={loading}>
                    {t('billing.cancel')}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('billing.stripeUnavailable')}</p>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t('billing.paymentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.payments.length === 0 ? (
            <EmptyState title={t('billing.paymentsEmpty')} />
          ) : (
            <ul className="divide-y divide-border">
              {overview.payments.map((payment) => (
                <li key={payment.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm">{payment.paidAtLabel}</span>
                  <span className="tabular-nums font-medium">{payment.amountLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={t('billing.cancelConfirmTitle')}
        body={t('billing.cancelConfirmBody')}
        confirmLabel={t('billing.cancel')}
        destructive
        loading={loading}
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Γράψε τη σελίδα**

Δημιούργησε `src/app/(app)/billing/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requirePageUser } from '@/server/auth/guards';
import { getBillingOverview } from '@/server/services/subscription';
import { getUserTimezone } from '@/server/services/profile';
import { formatDateInTz } from '@/lib/dates';
import { BillingPanel } from '@/components/billing/billing-panel';
import { Skeleton } from '@/components/ui/misc';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('billing.title') };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const user = await requirePageUser();
  const [overview, timezone] = await Promise.all([
    getBillingOverview(user.id),
    getUserTimezone(user.id),
  ]);

  const euro = (cents: number) => `${(cents / 100).toFixed(2)}€`;

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('billing.subtitle')}</p>
      </div>

      <Suspense fallback={<Skeleton className="h-64" />}>
        <BillingPanel
          overview={{
            kind: overview.state.kind,
            accessUntilLabel: overview.state.accessUntil
              ? t('billing.activeUntil', undefined, {
                  date: formatDateInTz(overview.state.accessUntil, timezone),
                })
              : null,
            autoRenew: overview.state.autoRenew,
            priceLabel: euro(overview.priceCents),
            stripeAvailable: overview.stripeAvailable,
            payments: overview.payments.map((payment) => ({
              id: payment.id,
              amountLabel: euro(payment.amountCents),
              paidAtLabel: formatDateInTz(new Date(payment.paidAt), timezone),
              note: payment.note,
            })),
          }}
        />
      </Suspense>
    </>
  );
}
```

- [ ] **Step 6: Σύνδεσε banner και κλείδωμα κουμπιού στο dashboard**

Στο `src/app/(app)/dashboard/page.tsx`:

```tsx
import { getAccessState } from '@/server/services/subscription';
import { SubscriptionBanner } from '@/components/billing/subscription-banner';
// ...
  const access = await getAccessState(user.id);
```

Αμέσως μετά το `<h1>` block, πρόσθεσε:

```tsx
      <SubscriptionBanner
        kind={access.kind}
        daysRemaining={access.daysRemaining}
        accessUntilLabel={
          access.accessUntil ? formatDateInTz(access.accessUntil, profile.timezone) : null
        }
      />
```

Και αντικατέστησε τον σύνδεσμο «Προσθήκη γεύματος» ώστε να είναι ανενεργός όταν `!access.canWrite`:

```tsx
      {access.canWrite ? (
        <Link href="/meals/new" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('dashboard.addMeal')}
        </Link>
      ) : (
        <div className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-muted text-base font-semibold text-muted-foreground">
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('billing.lockedAction')}
        </div>
      )}
```

- [ ] **Step 7: Πρόσθεσε τη «Συνδρομή» στο μενού**

Στο `src/components/app-nav.tsx`, στο `LINKS` πρόσθεσε μετά το `weight`:

```ts
  { href: '/billing', label: t('billing.navLabel'), Icon: CreditCard },
```

Πρόσθεσε το `CreditCard` στο import από `lucide-react`. Επειδή το bottom nav είναι `grid-cols-5`, άλλαξέ το σε `grid-cols-6`.

- [ ] **Step 8: Typecheck, tests, commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add src/i18n src/components/billing src/app/\(app\)/billing src/app/\(app\)/dashboard src/components/app-nav.tsx
git commit -m "feat(billing): banner κατάστασης, σελίδα συνδρομής και κλείδωμα κουμπιού"
```

---

### Task 8: UI διαχειριστή για IRIS/IBAN

**Files:**
- Create: `src/app/(app)/admin/users/page.tsx`
- Create: `src/components/admin/user-list.tsx`
- Modify: `src/i18n/el.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `POST /api/admin/subscriptions/extend` (Task 6)
- Produces: σελίδα `/admin/users`

- [ ] **Step 1: Πρόσθεσε τα κείμενα**

Στο `el.ts`, νέα ενότητα `admin`:

```ts
  admin: {
    usersTitle: 'Χρήστες',
    usersSubtitle: 'Κατάσταση συνδρομής και χειροκίνητη ενεργοποίηση.',
    extend: 'Παράταση',
    months: 'Μήνες',
    note: 'Σημείωση (π.χ. IRIS 05/08, ref ABC123)',
    extended: 'Η πρόσβαση παρατάθηκε.',
    accessUntil: 'Πρόσβαση έως',
    noAccess: 'Χωρίς πρόσβαση',
  },
```

Στο `en.ts` τα ίδια κλειδιά:

```ts
  admin: {
    usersTitle: 'Users',
    usersSubtitle: 'Subscription status and manual activation.',
    extend: 'Extend',
    months: 'Months',
    note: 'Note (e.g. IRIS 05/08, ref ABC123)',
    extended: 'Access extended.',
    accessUntil: 'Access until',
    noAccess: 'No access',
  },
```

- [ ] **Step 2: Γράψε τη λίστα**

Δημιούργησε `src/components/admin/user-list.tsx`:

```tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { t } from '@/i18n';

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  accessUntilLabel: string | null;
}

export function AdminUserList({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [months, setMonths] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  async function extend(userId: string) {
    setPending(userId);
    try {
      await api.post('/api/admin/subscriptions/extend', {
        userId,
        months: Number(months[userId] ?? '1'),
        note: notes[userId] ?? '',
      });
      toast.push(t('admin.extended'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="space-y-3">
      {users.map((user) => (
        <li key={user.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <p className="text-sm">
              {user.accessUntilLabel
                ? `${t('admin.accessUntil')} ${user.accessUntilLabel}`
                : t('admin.noAccess')}
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[6rem,1fr,auto]">
            <Input
              type="number"
              min={1}
              max={24}
              value={months[user.id] ?? '1'}
              onChange={(e) => setMonths((m) => ({ ...m, [user.id]: e.target.value }))}
              aria-label={t('admin.months')}
            />
            <Input
              value={notes[user.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [user.id]: e.target.value }))}
              placeholder={t('admin.note')}
              maxLength={300}
              aria-label={t('admin.note')}
            />
            <Button
              onClick={() => extend(user.id)}
              loading={pending === user.id}
              disabled={pending !== null}
            >
              {t('admin.extend')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Γράψε τη σελίδα**

Δημιούργησε `src/app/(app)/admin/users/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getUserTimezone } from '@/server/services/profile';
import { formatDateInTz } from '@/lib/dates';
import { AdminUserList } from '@/components/admin/user-list';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('admin.usersTitle') };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await requirePageUser();
  if (user.role !== 'ADMIN') notFound();

  const [users, timezone] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        subscription: { select: { accessUntil: true } },
      },
    }),
    getUserTimezone(user.id),
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">{t('admin.usersTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.usersSubtitle')}</p>
      </div>

      <AdminUserList
        users={users.map((row) => ({
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          accessUntilLabel: row.subscription
            ? formatDateInTz(row.subscription.accessUntil, timezone)
            : null,
        }))}
      />
    </>
  );
}
```

- [ ] **Step 4: Typecheck, tests, commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add src/app/\(app\)/admin src/components/admin src/i18n
git commit -m "feat(billing): σελίδα διαχειριστή για χειροκίνητη ενεργοποίηση IRIS/IBAN"
```

---

### Task 9: Ανάπτυξη και δοκιμή σε Stripe test mode

**Files:**
- Modify: `.env` στο NAS
- Modify: `OPERATIONS.md`
- Create: `STRIPE-SETUP.md`

- [ ] **Step 1: Δημιούργησε προϊόν και τιμή στο Stripe (test mode)**

Στο <https://dashboard.stripe.com> ενεργοποίησε τον διακόπτη **Test mode** (πάνω δεξιά),
μετά Developers → API keys → αντίγραψε το `sk_test_…`.

Με αυτό το κλειδί, δημιούργησε προϊόν και επαναλαμβανόμενη τιμή:

```bash
STRIPE_KEY=sk_test_XXX

# 1) Προϊόν
curl -sS https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" -d name="NutreLuma" -d "description=Καταγραφή θερμίδων"

# 2) Τιμή 3€/μήνα (βάλε το prod_… από πάνω)
curl -sS https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d product=prod_XXX \
  -d unit_amount=300 \
  -d currency=eur \
  -d "recurring[interval]=month"
```

Κράτησε το `price_…` ως `STRIPE_PRICE_ID`.

- [ ] **Step 2: Ρύθμισε το `.env` στο NAS**

```sh
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy; export DOCKER_CONFIG=$HOME/.docker
cd /share/CACHEDEV1_DATA/Container/nutreluma
```

Πρόσθεσε `BILLING_ENABLED`, `TRIAL_DAYS`, `SUBSCRIPTION_GRACE_DAYS`,
`SUBSCRIPTION_PRICE_CENTS`, `STRIPE_SECRET_KEY` (το `sk_test_…`), `STRIPE_PRICE_ID`.

- [ ] **Step 3: Χτίσε και ανέπτυξε με retry**

```sh
n=1; while [ $n -le 4 ]; do
  docker compose --env-file .env up --build -d && { echo OK; break; }
  n=$((n+1)); sleep 5
done
```

Expected: `OK`. Το migration εφαρμόζεται αυτόματα από το entrypoint.
**Έλεγξε το exit code, όχι μόνο το healthcheck** — αποτυχημένο build αφήνει το
προηγούμενο image να τρέχει και το container δείχνει healthy.

- [ ] **Step 4: Επαλήθευσε το migration**

```sh
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c \
  "SELECT email, role FROM users;" < /dev/null
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c \
  "SELECT u.email, s.status, s.\"accessUntil\" FROM subscriptions s JOIN users u ON u.id=s.\"userId\";" < /dev/null
```

Expected: ο `tzoybe@msn.com` έχει `role=ADMIN`· κάθε χρήστης έχει γραμμή `TRIALING`.

- [ ] **Step 5: Δοκίμασε το κλείδωμα**

```sh
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c \
  "UPDATE subscriptions SET \"accessUntil\" = NOW() - INTERVAL '1 day' WHERE \"userId\" = (SELECT id FROM users WHERE email='demo@nutreluma.local');" < /dev/null
```

Ως demo χρήστης, δοκίμασε upload γεύματος.
Expected: **HTTP 402** με `code: "SUBSCRIPTION_REQUIRED"`, ανενεργό κουμπί στο dashboard.

- [ ] **Step 6: Δοκίμασε χειροκίνητη παράταση ως ADMIN**

Από το `/admin/users`, «Παράταση» 1 μήνα με σημείωση «IRIS test».
Expected: `accessUntil` +1 μήνας, πληρωμή στο `/billing`, upload ξαναδουλεύει.

- [ ] **Step 7: Δοκίμασε τη ροή Stripe Checkout**

Πάτα «Συνδρομή 3,00€/μήνα» → στη σελίδα Stripe χρησιμοποίησε **δοκιμαστική κάρτα**
`4242 4242 4242 4242`, οποιαδήποτε μελλοντική ημερομηνία και CVC.

Expected: redirect στο `/billing?activated=1`, κατάσταση `ACTIVE`, `autoRenew` ενεργό,
μία πληρωμή 3,00€ στο ιστορικό.

**Κατάγραψε ακριβώς τι παρατηρήθηκε.** Αν κάτι αποκλίνει, μην το χαρακτηρίσεις επιτυχία.

- [ ] **Step 8: Δοκίμασε την ακύρωση**

Πάτα «Ακύρωση ανανέωσης».
Expected: `autoRenew=false`, κατάσταση `CANCELLED`, αλλά **το `accessUntil` παραμένει**
και ο χρήστης συνεχίζει να μπορεί να προσθέτει γεύματα.

- [ ] **Step 9: Γράψε το `STRIPE-SETUP.md`**

Στη ρίζα του project, με: τα βήματα του Dashboard, τις δοκιμαστικές κάρτες, τη
μετάβαση test→live (μόνο αλλαγή `STRIPE_SECRET_KEY` και `STRIPE_PRICE_ID`), και
προειδοποίηση ότι το live κλειδί κινεί πραγματικά χρήματα.

- [ ] **Step 10: Πρόσθεσε ενότητα συνδρομών στο `OPERATIONS.md`**

Με τη διαδικασία χειροκίνητου ξεκλειδώματος σε έκτακτη ανάγκη:

```sh
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c \
  "UPDATE subscriptions SET \"accessUntil\" = NOW() + INTERVAL '1 month', status='ACTIVE', provider='MANUAL' WHERE \"userId\"='<id>';" < /dev/null
```

- [ ] **Step 11: Commit**

```bash
git add OPERATIONS.md STRIPE-SETUP.md .env.example
git commit -m "docs(billing): οδηγίες Stripe και λειτουργίας συνδρομών"
```

---

## Self-Review

**Κάλυψη spec:**

| Απαίτηση spec | Task |
|---|---|
| Μοντέλα `Subscription`, `Payment`, enums | 1 |
| Migration + ADMIN + backfill | 1 |
| Ρυθμίσεις `BILLING_ENABLED`, `TRIAL_DAYS`, `STRIPE_*` | 1 |
| Κανόνας πρόσβασης + χάρη + ρητοί αποκλεισμοί | 2 |
| Stripe client (checkout, get, cancel) | 3 |
| Δοκιμή στην εγγραφή (ίδιο transaction) | 4 |
| `reconcileSubscription` + cooldown + fallback | 4 |
| Έλεγχος `client_reference_id` (ιδιοκτησία) | 4 |
| Idempotency πληρωμών | 4 |
| Ακύρωση χωρίς απώλεια πληρωμένου χρόνου | 4 |
| Χειροκίνητη παράταση με `max()` | 4 |
| `SUBSCRIPTION_REQUIRED` → 402 | 5 |
| Κλείδωμα ακριβώς 3 endpoints | 5 |
| API routes χρέωσης | 6 |
| Banner + `/billing` + ανενεργό κουμπί | 7 |
| `/admin/users` για IRIS/IBAN | 8 |
| Test-mode δοκιμή + τεκμηρίωση | 9 |

**Placeholders:** κανένα — κάθε βήμα περιέχει εκτελέσιμο κώδικα ή εντολή.

**Συνέπεια τύπων:** `AccessState`/`AccessStateKind` (Task 2) χρησιμοποιούνται αυτούσια σε Tasks 4, 5, 7. `StripeSubscription` (Task 3) καταναλώνεται στο Task 4 με τα ίδια ονόματα πεδίων (`ownerUserId`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `latestInvoice`). `requireWriteAccess` (Task 5) καλείται με την ίδια υπογραφή στα endpoints.
