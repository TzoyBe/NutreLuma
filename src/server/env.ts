import 'server-only';
import { z } from 'zod';

/**
 * Κεντρική, τυποποιημένη ανάγνωση των environment variables.
 * Δεν εκτίθεται ποτέ σε client bundle (server-only).
 */
const intFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = Number.parseInt(v ?? '', 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET πρέπει να έχει τουλάχιστον 16 χαρακτήρες'),
  SESSION_MAX_AGE_DAYS: intFromEnv(30),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),

  AI_PROVIDER: z.enum(['anthropic', 'openai', 'gemini', 'mock']).default('mock'),
  AI_API_KEY: z.string().optional().default(''),
  AI_API_BASE_URL: z.string().optional().default('https://api.anthropic.com'),
  AI_MODEL: z.string().optional().default('claude-sonnet-5'),
  AI_TIMEOUT_MS: intFromEnv(60_000),

  // Εφεδρικός πάροχος (OpenAI-compatible) που ενεργοποιείται μόνο όταν ο κύριος
  // πάροχος αποτύχει σκληρά (PROVIDER_ERROR/TIMEOUT). Κενό κλειδί = χωρίς fallback.
  AI_FALLBACK_API_KEY: z.string().optional().default(''),
  AI_FALLBACK_MODEL: z.string().optional().default('gpt-4o-mini'),
  AI_FALLBACK_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().default('/app/uploads'),
  MAX_UPLOAD_SIZE_MB: intFromEnv(10),

  MAX_AI_REQUESTS_PER_HOUR: intFromEnv(20),
  MAX_UPLOADS_PER_DAY: intFromEnv(50),
  MAX_LOGIN_ATTEMPTS_PER_15MIN: intFromEnv(8),

  BILLING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  TRIAL_DAYS: intFromEnv(3),
  SUBSCRIPTION_GRACE_DAYS: intFromEnv(3),
  SUBSCRIPTION_ORIGINAL_PRICE_CENTS: intFromEnv(399),
  SUBSCRIPTION_DISCOUNT_PERCENT: intFromEnv(25),
  SUBSCRIPTION_PRICE_CENTS: intFromEnv(299),
  SUBSCRIPTION_YEARLY_ORIGINAL_PRICE_CENTS: intFromEnv(3999),
  SUBSCRIPTION_YEARLY_PRICE_CENTS: intFromEnv(1999),
  SUBSCRIPTION_COUPON_CODES: z.string().optional().default(''),
  SUBSCRIPTION_COUPON_PRICE_CENTS: intFromEnv(199),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PRICE_ID: z.string().optional().default(''),
  STRIPE_YEARLY_PRICE_ID: z.string().optional().default(''),
  STRIPE_COUPON_PROMOTION_CODE_ID: z.string().optional().default(''),

  // Το client id είναι εκ σχεδιασμού δημόσιο (μπαίνει στο JS του browser).
  // Το secret ΔΕΝ φεύγει ποτέ από τον server.
  PAYPAL_CLIENT_ID: z.string().optional().default(''),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(''),
  PAYPAL_PLAN_ID: z.string().optional().default(''),
  PAYPAL_YEARLY_PLAN_ID: z.string().optional().default(''),
  PAYPAL_COUPON_PLAN_ID: z.string().optional().default(''),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).optional().default('sandbox'),

  // EMAIL_PROVIDER=log γράφει το μήνυμα στα logs αντί να το στείλει —
  // πλήρως λειτουργικό για δοκιμή χωρίς λογαριασμό σε πάροχο.
  EMAIL_PROVIDER: z.enum(['log', 'brevo', 'resend']).optional().default('log'),
  EMAIL_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  EMAIL_FROM_NAME: z.string().optional().default('NutreLuma'),
  PASSWORD_RESET_TTL_MINUTES: intFromEnv(60),
  EMAIL_VERIFICATION_TTL_HOURS: intFromEnv(24),

  DEFAULT_DAILY_WATER_TARGET_ML: intFromEnv(2500),

  DEFAULT_LOCALE: z.literal('en').default('en'),
  DEFAULT_TIMEZONE: z.string().default('Europe/Athens'),
  PERSONAL_CALIBRATION: z.string().optional().transform((v) => v !== 'false'),
  BEFORE_AFTER_SCAN: z.string().optional().transform((v) => v !== 'false'),
  DATA_CONFIDENCE: z.string().optional().transform((v) => v !== 'false'),
  PERSONAL_PATTERNS: z.string().optional().transform((v) => v !== 'false'),
  ENERGY_ESTIMATE: z.string().optional().transform((v) => v !== 'false'),
  WEIGHT_EXPLAINER: z.string().optional().transform((v) => v !== 'false'),
  CAN_I_EAT_THIS: z.string().optional().transform((v) => v !== 'false'),
  FIX_MY_DAY: z.string().optional().transform((v) => v !== 'false'),
  FLEXIBLE_WEEKLY_BUDGET: z.string().optional().transform((v) => v !== 'false'),
  PLATE_CALIBRATION: z.string().optional().transform((v) => v !== 'false'),
  DAILY_RECIPE_PLAN: z.string().optional().transform((v) => v !== 'false'),
  MAX_DAILY_RECIPE_PLANS: intFromEnv(3),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function load() {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET:
      process.env.AUTH_SECRET ||
      (process.env.NODE_ENV !== 'production' ? 'dev-only-insecure-secret-value' : undefined),
    SESSION_MAX_AGE_DAYS: process.env.SESSION_MAX_AGE_DAYS,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_API_BASE_URL: process.env.AI_API_BASE_URL,
    AI_MODEL: process.env.AI_MODEL,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
    AI_FALLBACK_API_KEY: process.env.AI_FALLBACK_API_KEY,
    AI_FALLBACK_MODEL: process.env.AI_FALLBACK_MODEL,
    AI_FALLBACK_BASE_URL: process.env.AI_FALLBACK_BASE_URL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB,
    MAX_AI_REQUESTS_PER_HOUR: process.env.MAX_AI_REQUESTS_PER_HOUR,
    MAX_UPLOADS_PER_DAY: process.env.MAX_UPLOADS_PER_DAY,
    MAX_LOGIN_ATTEMPTS_PER_15MIN: process.env.MAX_LOGIN_ATTEMPTS_PER_15MIN,
    BILLING_ENABLED: process.env.BILLING_ENABLED,
    TRIAL_DAYS: process.env.TRIAL_DAYS,
    SUBSCRIPTION_GRACE_DAYS: process.env.SUBSCRIPTION_GRACE_DAYS,
    SUBSCRIPTION_ORIGINAL_PRICE_CENTS: process.env.SUBSCRIPTION_ORIGINAL_PRICE_CENTS,
    SUBSCRIPTION_DISCOUNT_PERCENT: process.env.SUBSCRIPTION_DISCOUNT_PERCENT,
    SUBSCRIPTION_PRICE_CENTS: process.env.SUBSCRIPTION_PRICE_CENTS,
    SUBSCRIPTION_YEARLY_ORIGINAL_PRICE_CENTS: process.env.SUBSCRIPTION_YEARLY_ORIGINAL_PRICE_CENTS,
    SUBSCRIPTION_YEARLY_PRICE_CENTS: process.env.SUBSCRIPTION_YEARLY_PRICE_CENTS,
    SUBSCRIPTION_COUPON_CODES: process.env.SUBSCRIPTION_COUPON_CODES,
    SUBSCRIPTION_COUPON_PRICE_CENTS: process.env.SUBSCRIPTION_COUPON_PRICE_CENTS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    STRIPE_YEARLY_PRICE_ID: process.env.STRIPE_YEARLY_PRICE_ID,
    STRIPE_COUPON_PROMOTION_CODE_ID: process.env.STRIPE_COUPON_PROMOTION_CODE_ID,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_PLAN_ID: process.env.PAYPAL_PLAN_ID,
    PAYPAL_YEARLY_PLAN_ID: process.env.PAYPAL_YEARLY_PLAN_ID,
    PAYPAL_COUPON_PLAN_ID: process.env.PAYPAL_COUPON_PLAN_ID,
    PAYPAL_ENV: process.env.PAYPAL_ENV,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    PASSWORD_RESET_TTL_MINUTES: process.env.PASSWORD_RESET_TTL_MINUTES,
    EMAIL_VERIFICATION_TTL_HOURS: process.env.EMAIL_VERIFICATION_TTL_HOURS,
    DEFAULT_DAILY_WATER_TARGET_ML: process.env.DEFAULT_DAILY_WATER_TARGET_ML,
    DEFAULT_LOCALE: process.env.DEFAULT_LOCALE,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PERSONAL_CALIBRATION: process.env.PERSONAL_CALIBRATION,
    BEFORE_AFTER_SCAN: process.env.BEFORE_AFTER_SCAN,
    DATA_CONFIDENCE: process.env.DATA_CONFIDENCE,
    PERSONAL_PATTERNS: process.env.PERSONAL_PATTERNS,
    ENERGY_ESTIMATE: process.env.ENERGY_ESTIMATE,
    WEIGHT_EXPLAINER: process.env.WEIGHT_EXPLAINER,
    CAN_I_EAT_THIS: process.env.CAN_I_EAT_THIS,
    FIX_MY_DAY: process.env.FIX_MY_DAY,
    FLEXIBLE_WEEKLY_BUDGET: process.env.FLEXIBLE_WEEKLY_BUDGET,
    PLATE_CALIBRATION: process.env.PLATE_CALIBRATION,
    DAILY_RECIPE_PLAN: process.env.DAILY_RECIPE_PLAN,
    MAX_DAILY_RECIPE_PLANS: process.env.MAX_DAILY_RECIPE_PLANS,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Μη έγκυρη διαμόρφωση environment: ${issues}`);
  }
  return parsed.data;
}

export const env = load();

export const isProduction = env.NODE_ENV === 'production';
export const maxUploadBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const googleAuthConfigured =
  env.GOOGLE_CLIENT_ID.length > 0 && env.GOOGLE_CLIENT_SECRET.length > 0;

/** true μόνο όταν υπάρχουν όλα όσα χρειάζεται μια κλήση Stripe. */
export const stripeConfigured =
  env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_PRICE_ID.length > 0;

export const stripeYearlyConfigured =
  env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_YEARLY_PRICE_ID.length > 0;

/**
 * Το πρόθεμα του κλειδιού ΕΙΝΑΙ ο διακόπτης περιβάλλοντος — δεν υπάρχει άλλη
 * ρύθμιση που μπορείς να ξεχάσεις να αλλάξεις.
 */
export const stripeIsLive = env.STRIPE_SECRET_KEY.startsWith('sk_live_');

export const STRIPE_API_BASE = 'https://api.stripe.com';

/**
 * true μόνο όταν υπάρχουν και τα τρία που χρειάζεται μια επαληθεύσιμη
 * συνδρομή PayPal. Χωρίς το secret δεν μπορούμε να επιβεβαιώσουμε τίποτα
 * server-side, οπότε δεν προσφέρουμε καθόλου την επιλογή.
 */
export const paypalConfigured =
  env.PAYPAL_CLIENT_ID.length > 0 &&
  env.PAYPAL_CLIENT_SECRET.length > 0 &&
  env.PAYPAL_PLAN_ID.length > 0;

export const paypalYearlyConfigured =
  env.PAYPAL_CLIENT_ID.length > 0 &&
  env.PAYPAL_CLIENT_SECRET.length > 0 &&
  env.PAYPAL_YEARLY_PLAN_ID.length > 0;

export const paypalIsLive = env.PAYPAL_ENV === 'live';

/**
 * true μόνο όταν υπάρχουν όλα όσα χρειάζεται μια πραγματική αποστολή.
 * Χωρίς αυτά η εφαρμογή πέφτει στον log provider αντί να σκάει.
 */
export const emailConfigured =
  env.EMAIL_PROVIDER !== 'log' && env.EMAIL_API_KEY.length > 0 && env.EMAIL_FROM.length > 0;

export const PAYPAL_API_BASE = paypalIsLive
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
