import 'server-only';
import { prisma } from '../db/prisma';
import { BADGES, type BadgeDef } from '@/lib/achievements-catalog';
import { createNotification } from './notifications';

export interface BadgeView extends BadgeDef {
  unlockedAt: string | null;
  unlocked: boolean;
}

export async function upsertBadgeCatalog(): Promise<void> {
  await prisma.$transaction(
    BADGES.map((badge, index) =>
      prisma.badgeDefinition.upsert({
        where: { code: badge.code },
        create: { ...badge, sortOrder: index },
        update: { ...badge, sortOrder: index },
      }),
    ),
  );
}

export async function awardBadge(userId: string, badgeCode: string): Promise<{ awarded: boolean }> {
  const badge = BADGES.find((item) => item.code === badgeCode);
  if (!badge) return { awarded: false };

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeCode: { userId, badgeCode } },
  });
  if (existing) return { awarded: false };

  await prisma.userBadge.create({ data: { userId, badgeCode } });
  await createNotification(userId, {
    type: 'BADGE_UNLOCKED',
    title: badge.name,
    body: badge.description,
    dedupeKey: `badge:${badgeCode}`,
  });
  return { awarded: true };
}

export async function listBadges(userId: string): Promise<BadgeView[]> {
  const unlocked = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeCode: true, unlockedAt: true },
  });
  const byCode = new Map(unlocked.map((row) => [row.badgeCode, row.unlockedAt]));
  return BADGES.map((badge) => {
    const unlockedAt = byCode.get(badge.code) ?? null;
    return {
      ...badge,
      unlocked: unlockedAt !== null,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
    };
  });
}
