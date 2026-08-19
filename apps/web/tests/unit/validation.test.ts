import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { healthProfileSchema } from '@/lib/validation/profile';
import {
  createMealSchema,
  updateMealSchema,
  quickPickCreateSchema,
  mealHistoryQuerySchema,
} from '@/lib/validation/meal';
import { weightEntrySchema } from '@/lib/validation/weight';
import {
  activityEntrySchema,
  trackingListQuerySchema,
  waterEntrySchema,
} from '@/lib/validation/tracking';

const validRegistration = {
  email: 'User@Example.com',
  displayName: 'Μαρία',
  password: 'SuperSecret1',
  passwordConfirm: 'SuperSecret1',
  consent: true as const,
};

describe('registration validation', () => {
  it('δέχεται έγκυρη εγγραφή και κανονικοποιεί το email', () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.email).toBe('user@example.com');
  });

  it('απορρίπτει κωδικό χωρίς κεφαλαίο ή αριθμό', () => {
    const weak = registerSchema.safeParse({
      ...validRegistration,
      password: 'onlylowercase',
      passwordConfirm: 'onlylowercase',
    });
    expect(weak.success).toBe(false);
  });

  it('απορρίπτει κωδικό μικρότερο των 10 χαρακτήρων', () => {
    const short = registerSchema.safeParse({
      ...validRegistration,
      password: 'Short1a',
      passwordConfirm: 'Short1a',
    });
    expect(short.success).toBe(false);
  });

  it('απαιτεί ταύτιση των δύο κωδικών', () => {
    const mismatch = registerSchema.safeParse({
      ...validRegistration,
      passwordConfirm: 'DifferentPass1',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((i) => i.path.includes('passwordConfirm'))).toBe(true);
    }
  });

  it('απαιτεί ρητή συγκατάθεση', () => {
    const noConsent = registerSchema.safeParse({ ...validRegistration, consent: false });
    expect(noConsent.success).toBe(false);
  });

  it('απορρίπτει μη έγκυρο email', () => {
    expect(registerSchema.safeParse({ ...validRegistration, email: 'not-an-email' }).success).toBe(
      false,
    );
  });
});

describe('login validation', () => {
  it('δέχεται έγκυρα στοιχεία', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('απαιτεί κωδικό', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('profile validation', () => {
  const base = {
    firstName: 'Νίκος',
    birthDate: '1990-05-14',
    gender: 'MALE',
    heightCm: 180,
    currentWeightKg: 82,
    activityLevel: 'MODERATE',
    goal: 'LOSE',
    preferredUnits: 'METRIC',
    timezone: 'Europe/Athens',
  };

  it('δέχεται έγκυρο προφίλ', () => {
    expect(healthProfileSchema.safeParse(base).success).toBe(true);
  });

  it('απορρίπτει μη ρεαλιστικό ύψος', () => {
    expect(healthProfileSchema.safeParse({ ...base, heightCm: 5 }).success).toBe(false);
  });

  it('απορρίπτει μελλοντική ημερομηνία γέννησης', () => {
    expect(healthProfileSchema.safeParse({ ...base, birthDate: '2999-01-01' }).success).toBe(false);
  });

  it('απορρίπτει άγνωστη ζώνη ώρας', () => {
    expect(healthProfileSchema.safeParse({ ...base, timezone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('επιτρέπει μη δήλωση φύλου', () => {
    const parsed = healthProfileSchema.safeParse({ ...base, gender: 'UNDISCLOSED' });
    expect(parsed.success).toBe(true);
  });
});

describe('meal validation', () => {
  it('δέχεται έγκυρα meta δεδομένα upload', () => {
    const parsed = createMealSchema.safeParse({
      mealType: 'LUNCH',
      mealDateTime: '2026-08-04T13:30',
    });
    expect(parsed.success).toBe(true);
  });

  it('απορρίπτει λανθασμένη μορφή ημερομηνίας', () => {
    expect(
      createMealSchema.safeParse({ mealType: 'LUNCH', mealDateTime: '04/08/2026' }).success,
    ).toBe(false);
  });

  it('απορρίπτει αρνητικές θερμίδες', () => {
    const parsed = updateMealSchema.safeParse({ finalCalories: -100 });
    expect(parsed.success).toBe(false);
  });

  it('απορρίπτει θερμίδες πάνω από το απόλυτο όριο', () => {
    expect(updateMealSchema.safeParse({ finalCalories: 999_999 }).success).toBe(false);
  });

  it('απορρίπτει μη ακέραιες θερμίδες', () => {
    expect(updateMealSchema.safeParse({ finalCalories: 120.5 }).success).toBe(false);
  });
});

describe('weight validation', () => {
  it('δέχεται έγκυρη καταχώριση', () => {
    expect(
      weightEntrySchema.safeParse({ weightKg: 82.4, entryDate: '2026-08-04' }).success,
    ).toBe(true);
  });

  it('απορρίπτει μη ρεαλιστικό βάρος', () => {
    expect(weightEntrySchema.safeParse({ weightKg: 5, entryDate: '2026-08-04' }).success).toBe(
      false,
    );
  });
});

describe('tracking validation', () => {
  it('accepts valid water and activity entries', () => {
    expect(waterEntrySchema.safeParse({ entryDate: '2026-08-07', volumeMl: '750' }).success).toBe(
      true,
    );
    expect(
      activityEntrySchema.safeParse({
        entryDate: '2026-08-07',
        kind: 'WALK',
        steps: '5000',
        note: '  walk  ',
      }).success,
    ).toBe(true);
  });

  it('rejects impossible dates and activity without steps or duration', () => {
    expect(waterEntrySchema.safeParse({ entryDate: '2026-02-31', volumeMl: 250 }).success).toBe(
      false,
    );
    expect(activityEntrySchema.safeParse({ entryDate: '2026-08-07', kind: 'OTHER' }).success).toBe(
      false,
    );
  });

  it('bounds tracking list queries and rejects reversed ranges', () => {
    expect(trackingListQuerySchema.parse({}).limit).toBe(50);
    expect(trackingListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      trackingListQuerySchema.safeParse({ from: '2026-08-08', to: '2026-08-07' }).success,
    ).toBe(false);
  });
});

describe('quick-pick create validation', () => {
  const cuid = 'clc1234567890abcdefghijkl';
  const sha = 'a'.repeat(64);

  it('δέχεται έγκυρο favorite ref με προεπιλεγμένο multiplier', () => {
    const r = quickPickCreateSchema.parse({
      ref: { kind: 'favorite', id: cuid },
      mealType: 'LUNCH',
    });
    expect(r.servingMultiplier).toBe(1);
    expect(r.ref).toEqual({ kind: 'favorite', id: cuid });
  });

  it('δέχεται frequent ref με έγκυρο fingerprint', () => {
    const r = quickPickCreateSchema.safeParse({
      ref: { kind: 'frequent', fingerprint: sha },
      mealType: 'DINNER',
      servingMultiplier: 1.5,
    });
    expect(r.success).toBe(true);
  });

  it('απορρίπτει άγνωστο kind στο ref', () => {
    const r = quickPickCreateSchema.safeParse({
      ref: { kind: 'other', id: cuid },
      mealType: 'LUNCH',
    });
    expect(r.success).toBe(false);
  });

  it('απορρίπτει μη έγκυρο fingerprint', () => {
    const r = quickPickCreateSchema.safeParse({
      ref: { kind: 'frequent', fingerprint: 'not-a-hash' },
      mealType: 'LUNCH',
    });
    expect(r.success).toBe(false);
  });

  it('απορρίπτει multiplier εκτός ορίων', () => {
    expect(
      quickPickCreateSchema.safeParse({
        ref: { kind: 'favorite', id: cuid },
        mealType: 'LUNCH',
        servingMultiplier: 99,
      }).success,
    ).toBe(false);
  });
});

describe('meal history calorie range', () => {
  it('κάνει coerce σε ακέραιους minCalories/maxCalories', () => {
    const r = mealHistoryQuerySchema.parse({ minCalories: '100', maxCalories: '800' });
    expect(r.minCalories).toBe(100);
    expect(r.maxCalories).toBe(800);
  });

  it('απορρίπτει αρνητικές τιμές', () => {
    expect(mealHistoryQuerySchema.safeParse({ minCalories: '-5' }).success).toBe(false);
  });
});
