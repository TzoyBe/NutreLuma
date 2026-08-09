import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { getMilestoneForUser, updateMilestone } from '@/server/services/milestones';
import { updateMilestoneSchema } from '@/lib/validation/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  return jsonOk({ milestone: await getMilestoneForUser(user.id, id) });
});

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;
  const input = updateMilestoneSchema.parse(await request.json());
  return jsonOk(await updateMilestone(user.id, id, input));
});
