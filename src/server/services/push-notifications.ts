import 'server-only';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { logger } from '../logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export interface RegisterPushTokenInput {
  token: string;
  platform?: string;
  deviceName?: string;
}

export function isValidExpoPushToken(token: string): boolean {
  return PUSH_TOKEN_PATTERN.test(token);
}

export async function registerPushToken(
  userId: string,
  input: RegisterPushTokenInput,
): Promise<{ registered: true }> {
  await prisma.pushToken.upsert({
    where: { token: input.token },
    create: {
      userId,
      token: input.token,
      platform: input.platform ?? null,
      deviceName: input.deviceName ?? null,
    },
    update: {
      userId,
      platform: input.platform ?? null,
      deviceName: input.deviceName ?? null,
      disabledAt: null,
      lastError: null,
    },
  });
  return { registered: true };
}

export async function unregisterPushToken(
  userId: string,
  token: string,
): Promise<{ deleted: boolean }> {
  const result = await prisma.pushToken.deleteMany({ where: { userId, token } });
  return { deleted: result.count > 0 };
}

export async function sendPushNotificationForNotification(notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      userId: true,
      title: true,
      body: true,
      type: true,
      pushedAt: true,
    },
  });
  if (!notification || notification.pushedAt) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: notification.userId, disabledAt: null },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: { notificationId: notification.id, type: notification.type },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> }
      | null;

    if (!response.ok) {
      logger.warn('push_send_failed', { notificationId, status: response.status });
      return;
    }

    const tickets = payload?.data ?? [];
    await Promise.all(
      tickets.map(async (ticket, index) => {
        if (ticket.status === 'ok') return;
        const token = tokens[index]?.token;
        if (!token) return;
        const error = ticket.details?.error ?? ticket.message ?? 'push_failed';
        if (error === 'DeviceNotRegistered') {
          await prisma.pushToken.updateMany({
            where: { token },
            data: { disabledAt: new Date(), lastError: error },
          });
        } else {
          await prisma.pushToken.updateMany({ where: { token }, data: { lastError: error } });
        }
      }),
    );

    await prisma.notification.update({
      where: { id: notification.id },
      data: { pushedAt: new Date() },
    });
    logger.info('push_notification_sent', { notificationId, tokenCount: tokens.length });
  } catch (error) {
    logger.warn('push_send_exception', {
      notificationId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
