import { z } from 'zod';
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { lockUser } from '@/server/services/admin-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ reason: z.string().trim().max(300).optional() });

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const admin = await requireApiAdmin();
  const { id } = await context.params;
  const { reason } = bodySchema.parse(await request.json().catch(() => ({})));
  await lockUser(id, admin.id, reason);
  return jsonOk({ locked: true });
});
