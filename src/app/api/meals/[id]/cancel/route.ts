import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { cancelMeal } from '@/server/services/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Ακύρωση draft. Δεν απαιτεί δικαίωμα εγγραφής: η ακύρωση αφαιρεί δεδομένα από
 * τα σύνολα, οπότε πρέπει να είναι δυνατή ακόμη και με ληγμένη συνδρομή.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;

  const meal = await cancelMeal(user.id, id);
  return jsonOk({ meal });
});
