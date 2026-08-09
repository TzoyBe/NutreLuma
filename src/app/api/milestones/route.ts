import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { createMilestone, listMilestones } from '@/server/services/milestones';
import { createMilestoneSchema, milestoneListQuerySchema } from '@/lib/validation/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = milestoneListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return jsonOk({ milestones: await listMilestones(user.id, query) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = createMilestoneSchema.parse(await request.json());
  return jsonOk(await createMilestone(user.id, input), 201);
});
