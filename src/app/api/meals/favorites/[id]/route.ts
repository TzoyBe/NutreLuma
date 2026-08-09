import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { removeFavorite } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (request: Request, { params }: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await params;
  await removeFavorite(user.id, id);
  return jsonOk({ ok: true });
});
