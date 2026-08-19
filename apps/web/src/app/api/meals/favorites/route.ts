import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { favoriteCreateSchema } from '@/lib/validation/meal';
import { addFavorite, getFavorites } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk({ favorites: await getFavorites(user.id) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { ref } = favoriteCreateSchema.parse(await request.json());
  return jsonOk({ favorite: await addFavorite(user.id, ref) }, 201);
});
