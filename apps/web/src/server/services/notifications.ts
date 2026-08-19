import 'server-only';
import { MealStatus, MealType, type NotificationType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { sendEmail } from '../email';
import { buildNotificationEmail } from '../email/templates';
import { sendPushNotificationForNotification } from './push-notifications';
import { todayISO, zonedDayRangeUtc } from '@/lib/dates';

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  milestoneId: string | null;
  dedupeKey: string | null;
  readAt: string | null;
  emailedAt: string | null;
  pushedAt: string | null;
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
  emailedAt: Date | null;
  pushedAt: Date | null;
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
    emailedAt: row.emailedAt ? row.emailedAt.toISOString() : null,
    pushedAt: row.pushedAt ? row.pushedAt.toISOString() : null,
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
  if (!row.pushedAt) {
    void sendPushNotificationForNotification(row.id);
  }
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

function localHour(now: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
}

const MEAL_REMINDERS = [
  {
    mealType: MealType.BREAKFAST,
    afterHour: 10,
    title: 'Breakfast not logged',
    body: 'If you had breakfast, add it now while it is still fresh in your mind.',
  },
  {
    mealType: MealType.LUNCH,
    afterHour: 15,
    title: 'Lunch not logged',
    body: 'A quick lunch log keeps your day accurate without extra work later.',
  },
  {
    mealType: MealType.DINNER,
    afterHour: 21,
    title: 'Dinner not logged',
    body: 'Wrap up your day by logging dinner before the details fade.',
  },
] as const;

export async function ensureMealReminderNotifications(userId: string): Promise<void> {
  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: {
      timezone: true,
      user: { select: { email: true, emailVerifiedAt: true } },
    },
  });
  if (!profile) return;

  const now = new Date();
  const dayISO = todayISO(profile.timezone);
  const hour = localHour(now, profile.timezone);
  const { start, end } = zonedDayRangeUtc(dayISO, profile.timezone);

  for (const reminder of MEAL_REMINDERS) {
    if (hour < reminder.afterHour) continue;

    const mealCount = await prisma.meal.count({
      where: {
        userId,
        mealType: reminder.mealType,
        mealDateTime: { gte: start, lt: end },
        status: { not: MealStatus.CANCELLED },
      },
    });
    if (mealCount > 0) continue;

    const dedupeKey = `meal-reminder:${dayISO}:${reminder.mealType}`;
    const notification = await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey } },
      create: {
        userId,
        type: 'MEAL_REMINDER',
        title: reminder.title,
        body: reminder.body,
        dedupeKey,
      },
      update: {},
    });

    if (!notification.pushedAt) {
      void sendPushNotificationForNotification(notification.id);
    }

    if (notification.emailedAt || !profile.user.emailVerifiedAt) continue;

    const sent = await sendEmail(
      buildNotificationEmail({
        to: profile.user.email,
        title: reminder.title,
        body: reminder.body,
        actionLabel: 'Add meal',
        actionUrl: `${env.APP_URL.replace(/\/+$/, '')}/meals/add`,
      }),
    );

    if (sent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailedAt: new Date() },
      });
    }
    logger.info('meal_reminder_notification_created', {
      userId,
      mealType: reminder.mealType,
      emailSent: sent,
    });
  }
}
