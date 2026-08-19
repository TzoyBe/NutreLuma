import 'server-only';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { ApiError } from '../errors';

/**
 * In-memory sliding window for low-risk UI throttles.
 * Sensitive auth flows use the database-backed helpers below.
 */
const buckets = new Map<string, number[]>();

export function hitLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 5000) {
    for (const [bucketKey, values] of buckets) {
      if (values.every((t) => now - t >= windowMs)) buckets.delete(bucketKey);
    }
  }
  return hits.length > limit;
}

async function hitPersistentLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const count = await prisma.$transaction(async (tx) => {
    const current = await tx.rateLimitBucket.findUnique({
      where: { key },
      select: { count: true, expiresAt: true },
    });

    if (!current || current.expiresAt <= now) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return 1;
    }

    const updated = await tx.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
      select: { count: true },
    });
    return updated.count;
  });

  void prisma.rateLimitBucket
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);

  return count > limit;
}

export async function assertLoginRateLimit(ip: string, email: string): Promise<void> {
  const windowMs = 15 * 60 * 1000;
  const limit = env.MAX_LOGIN_ATTEMPTS_PER_15MIN;
  const exceeded =
    (await hitPersistentLimit(`login:ip:${ip}`, limit * 3, windowMs)) ||
    (await hitPersistentLimit(`login:id:${email.toLowerCase()}`, limit, windowMs));
  if (exceeded) {
    throw new ApiError(
      'RATE_LIMITED',
      'Πολλές προσπάθειες σύνδεσης. Δοκίμασε ξανά σε λίγα λεπτά.',
    );
  }
}

export async function assertRegisterRateLimit(ip: string): Promise<void> {
  if (await hitPersistentLimit(`register:ip:${ip}`, 10, 60 * 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές εγγραφές από αυτή τη σύνδεση. Δοκίμασε αργότερα.');
  }
}

export async function assertPasswordResetRateLimit(ip: string, email: string): Promise<void> {
  const windowMs = 60 * 60 * 1000;
  const exceeded =
    (await hitPersistentLimit(`reset:ip:${ip}`, 15, windowMs)) ||
    (await hitPersistentLimit(`reset:id:${email.toLowerCase()}`, 5, windowMs));
  if (exceeded) {
    throw new ApiError(
      'RATE_LIMITED',
      'Πολλές αιτήσεις επαναφοράς. Δοκίμασε ξανά σε λίγη ώρα.',
    );
  }
}

export async function assertResetAttemptRateLimit(ip: string): Promise<void> {
  if (await hitPersistentLimit(`reset-attempt:ip:${ip}`, 20, 60 * 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγη ώρα.');
  }
}

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

export function assertQuickPickRateLimit(userId: string): void {
  if (hitLimit(`quickpick:${userId}`, 60, 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές γρήγορες προσθήκες. Δοκίμασε ξανά σε λίγο.');
  }
}

export function __resetRateLimits(): void {
  buckets.clear();
}
