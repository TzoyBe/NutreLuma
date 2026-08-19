import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { quickPickPreviewSchema } from '@/lib/validation/meal';
import { previewQuickPick } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { ref, servingMultiplier } = quickPickPreviewSchema.parse(await request.json());
  return jsonOk(await previewQuickPick(user.id, ref, servingMultiplier));
});
