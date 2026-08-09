import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { updateRange } from '@/server/services/maintenance';
import { updateRangeSchema } from '@/lib/validation/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = updateRangeSchema.parse(await request.json());
  return jsonOk(await updateRange(user.id, input));
});
