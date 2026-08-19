import { z } from 'zod';
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { markNotificationsRead } from '@/server/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ ids: z.array(z.string()).optional() });

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({}));
  const { ids } = bodySchema.parse(body);
  return jsonOk(await markNotificationsRead(user.id, ids));
});
