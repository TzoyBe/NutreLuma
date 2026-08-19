import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { retryAnalysis } from '@/server/services/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/** Επανάληψη ανάλυσης για γεύμα με status FAILED. */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;

  const meal = await retryAnalysis(user.id, id);
  return jsonOk({ meal });
});
