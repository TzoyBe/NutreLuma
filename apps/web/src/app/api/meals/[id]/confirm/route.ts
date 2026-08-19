import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { confirmMeal } from '@/server/services/meal';
import { confirmMealSchema } from '@/lib/validation/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Οριστικοποίηση draft. Μόνο μετά από αυτό το γεύμα μετρά στα ημερήσια σύνολα.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const input = confirmMealSchema.parse(body);

  const meal = await confirmMeal(user.id, id, input.acknowledgeHighCalories);
  return jsonOk({ meal });
});
