import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { updateTargets } from '@/server/services/maintenance';
import { updateTargetsSchema } from '@/lib/validation/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = updateTargetsSchema.parse(await request.json());
  return jsonOk(await updateTargets(user.id, input));
});
