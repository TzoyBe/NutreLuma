import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { answerClarifications } from '@/server/services/meal';
import { clarificationAnswersSchema } from '@/lib/validation/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/**
 * Απαντήσεις στις διευκρινιστικές ερωτήσεις. Μπορεί να πυροδοτήσει δεύτερη
 * κλήση στο AI, γι' αυτό περνά από τον ίδιο έλεγχο ορίων με την ανάλυση.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const input = clarificationAnswersSchema.parse(body);

  const meal = await answerClarifications(user.id, id, input);
  return jsonOk({ meal });
});
