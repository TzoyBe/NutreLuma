import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getRecentMeals } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 8);
  const meals = await getRecentMeals(user.id, Math.min(Math.max(limit, 1), 20));
  return jsonOk({ meals });
});
