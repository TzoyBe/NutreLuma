import { z } from 'zod';
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import {
  recordCustomMilestoneProgress,
  recomputeMilestoneProgress,
} from '@/server/services/milestone-progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const progressSchema = z.object({
  value: z.coerce.number().finite().min(0).optional(),
});

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  return jsonOk({ progress: await recomputeMilestoneProgress(user.id, id) });
});

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;
  const { value } = progressSchema.parse(await request.json());
  const progress =
    value === undefined
      ? await recomputeMilestoneProgress(user.id, id)
      : await recordCustomMilestoneProgress(user.id, id, value);
  return jsonOk({ progress });
});
