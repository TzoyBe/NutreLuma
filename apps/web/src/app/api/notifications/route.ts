import { z } from 'zod';
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import {
  ensureMealReminderNotifications,
  listNotifications,
  unreadNotificationCount,
} from '@/server/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  await ensureMealReminderNotifications(user.id);
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id, query),
    unreadNotificationCount(user.id),
  ]);
  return jsonOk({ notifications, unreadCount });
});
