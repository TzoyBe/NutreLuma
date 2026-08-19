import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { dismissAlert } from '@/server/services/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;
  await dismissAlert(user.id, id);
  return jsonOk({ dismissed: true });
});
