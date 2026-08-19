import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { getActiveGoalMode, setGoalMode, listModeHistory } from '@/server/services/goal-mode';
import { changeModeSchema } from '@/lib/validation/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const [mode, history] = await Promise.all([
    getActiveGoalMode(user.id),
    listModeHistory(user.id),
  ]);
  return jsonOk({ mode, history });
});

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = changeModeSchema.parse(await request.json());
  const result = await setGoalMode(user.id, input.mode, {
    reason: input.reason,
    targetWeightKg: input.targetWeightKg ?? null,
  });
  return jsonOk(result);
});
