import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { deleteMeal, getMealForUser, updateMeal } from '@/server/services/meal';
import { getUserTimezone } from '@/server/services/profile';
import { updateMealSchema } from '@/lib/validation/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  return jsonOk({ meal: await getMealForUser(user.id, id) });
});

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;

  const input = updateMealSchema.parse(await request.json());
  const timezone = await getUserTimezone(user.id);

  return jsonOk({ meal: await updateMeal(user.id, id, input, timezone) });
});

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;

  await deleteMeal(user.id, id);
  return jsonOk({ deleted: true });
});
