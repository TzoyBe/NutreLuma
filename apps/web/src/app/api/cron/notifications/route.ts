import { ApiError, jsonOk, withErrorHandling } from '@/server/http';
import { env } from '@/server/env';
import { runMealReminderNotificationsForAllUsers } from '@/server/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Καλείται από cron στο NAS (curl), όχι από logged-in client. Χωρίς αυτό, τα
 * meal-reminder emails/push παράγονταν μόνο όταν ο χρήστης άνοιγε την εφαρμογή
 * (GET /api/notifications), οπότε ανενεργοί χρήστες δεν ειδοποιούνταν ποτέ.
 */
export const POST = withErrorHandling(async (request: Request) => {
  if (!env.CRON_SECRET) {
    throw new ApiError('INTERNAL_ERROR', 'CRON_SECRET is not configured.');
  }
  const header = request.headers.get('authorization') ?? '';
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    throw new ApiError('UNAUTHENTICATED', 'Invalid cron secret.');
  }
  return jsonOk(await runMealReminderNotificationsForAllUsers());
});
