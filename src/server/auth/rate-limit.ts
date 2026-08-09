import 'server-only';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { ApiError } from '../errors';

/**
 * In-memory sliding window. Αρκεί για single-instance deployment (MVP).
 * Για multi-instance αντικαθίσταται με Redis χωρίς αλλαγή στα call sites.
 */
const buckets = new Map<string, number[]>();

export function hitLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);

  // Απλό housekeeping ώστε να μη μεγαλώνει απεριόριστα το map.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return hits.length > limit;
}

export function assertLoginRateLimit(ip: string, email: string): void {
  const windowMs = 15 * 60 * 1000;
  const limit = env.MAX_LOGIN_ATTEMPTS_PER_15MIN;
  const exceeded =
    hitLimit(`login:ip:${ip}`, limit * 3, windowMs) ||
    hitLimit(`login:id:${email.toLowerCase()}`, limit, windowMs);
  if (exceeded) {
    throw new ApiError(
      'RATE_LIMITED',
      'Πολλές προσπάθειες σύνδεσης. Δοκίμασε ξανά σε λίγα λεπτά.',
    );
  }
}

export function assertRegisterRateLimit(ip: string): void {
  if (hitLimit(`register:ip:${ip}`, 10, 60 * 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές εγγραφές από αυτή τη σύνδεση. Δοκίμασε αργότερα.');
  }
}

/**
 * Όριο αιτήσεων επαναφοράς κωδικού.
 *
 * Δύο κλειδιά με διαφορετικό σκοπό:
 *  - ανά IP: εμποδίζει σάρωση της φόρμας για απαρίθμηση λογαριασμών
 *  - ανά email: εμποδίζει να «βομβαρδιστεί» το γραμματοκιβώτιο τρίτου
 */
export function assertPasswordResetRateLimit(ip: string, email: string): void {
  const windowMs = 60 * 60 * 1000;
  const exceeded =
    hitLimit(`reset:ip:${ip}`, 15, windowMs) ||
    hitLimit(`reset:id:${email.toLowerCase()}`, 5, windowMs);
  if (exceeded) {
    throw new ApiError(
      'RATE_LIMITED',
      'Πολλές αιτήσεις επαναφοράς. Δοκίμασε ξανά σε λίγη ώρα.',
    );
  }
}

/** Όριο προσπαθειών εξαργύρωσης token — αποτρέπει μαντεψιά με τη βία. */
export function assertResetAttemptRateLimit(ip: string): void {
  if (hitLimit(`reset-attempt:ip:${ip}`, 20, 60 * 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγη ώρα.');
  }
}

/** Όριο AI κλήσεων ανά χρήστη ανά ώρα (μετράει τα πραγματικά logs στη βάση). */
export async function assertAiRateLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.aiUsageLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= env.MAX_AI_REQUESTS_PER_HOUR) {
    throw new ApiError(
      'RATE_LIMITED',
      `Έφτασες το όριο των ${env.MAX_AI_REQUESTS_PER_HOUR} αναλύσεων ανά ώρα. Δοκίμασε ξανά αργότερα.`,
    );
  }
}

/** Όριο uploads ανά χρήστη ανά 24 ώρες. */
export async function assertUploadRateLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.meal.count({
    where: { userId, createdAt: { gte: since }, imagePath: { not: null } },
  });
  if (count >= env.MAX_UPLOADS_PER_DAY) {
    throw new ApiError(
      'RATE_LIMITED',
      `Έφτασες το όριο των ${env.MAX_UPLOADS_PER_DAY} φωτογραφιών ανά ημέρα.`,
    );
  }
}

/** Όριο quick-pick δημιουργιών ανά χρήστη (in-memory sliding window). */
export function assertQuickPickRateLimit(userId: string): void {
  if (hitLimit(`quickpick:${userId}`, 60, 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές γρήγορες προσθήκες. Δοκίμασε ξανά σε λίγο.');
  }
}

/** Μόνο για tests. */
export function __resetRateLimits(): void {
  buckets.clear();
}
