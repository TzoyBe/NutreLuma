import 'server-only';
import { type NotificationType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  milestoneId: string | null;
  dedupeKey: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  milestoneId?: string | null;
  dedupeKey?: string | null;
}

function toView(row: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  milestoneId: string | null;
  dedupeKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    milestoneId: row.milestoneId,
    dedupeKey: row.dedupeKey,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
): Promise<NotificationView> {
  const data = {
    userId,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    milestoneId: input.milestoneId ?? null,
    dedupeKey: input.dedupeKey ?? null,
  };
  if (!data.title || !data.body) {
    throw new ApiError('VALIDATION_ERROR', 'Ο τίτλος και το μήνυμα είναι υποχρεωτικά.');
  }

  const row = data.dedupeKey
    ? await prisma.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: data.dedupeKey } },
        create: data,
        update: {},
      })
    : await prisma.notification.create({ data });
  return toView(row);
}

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationView[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const rows = await prisma.notification.findMany({
    where: { userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toView);
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}
