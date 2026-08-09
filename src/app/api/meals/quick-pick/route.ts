import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { assertQuickPickRateLimit } from '@/server/auth/rate-limit';
import { getUserTimezone } from '@/server/services/profile';
import { quickPickCreateSchema } from '@/lib/validation/meal';
import { createQuickPick } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  assertQuickPickRateLimit(user.id);
  const input = quickPickCreateSchema.parse(await request.json());
  const timezone = await getUserTimezone(user.id);
  const { meal, duplicated } = await createQuickPick(user.id, input, timezone);
  return jsonOk({ meal, duplicated }, duplicated ? 200 : 201);
});
