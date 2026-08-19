import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { deleteActivityEntry } from '@/server/services/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;
  await deleteActivityEntry(user.id, id);
  return jsonOk({ deleted: true });
});
