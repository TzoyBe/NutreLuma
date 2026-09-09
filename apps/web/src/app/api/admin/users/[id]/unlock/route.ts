import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { unlockUser } from '@/server/services/admin-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const admin = await requireApiAdmin();
  const { id } = await context.params;
  await unlockUser(id, admin.id);
  return jsonOk({ unlocked: true });
});
