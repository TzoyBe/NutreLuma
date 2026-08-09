import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { env } from '@/server/env';
import { attachAfterMealImage, confirmConsumedMeal } from '@/server/services/before-after';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  if (!env.BEFORE_AFTER_SCAN) throw new Error('Feature disabled');
  const user = await requireApiUser(); await requireWriteAccess(user.id);
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('After image is required');
  const raw = String(form.get('consumedPercent') ?? '');
  const consumedPercent = raw === '' ? undefined : Number(raw);
  return jsonOk(await attachAfterMealImage({ userId: user.id, mealId: id, file: Buffer.from(await file.arrayBuffer()), consumedPercent }));
});

export const PUT = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  if (!env.BEFORE_AFTER_SCAN) throw new Error('Feature disabled');
  const user = await requireApiUser(); await requireWriteAccess(user.id);
  const { id } = await context.params;
  const body = await request.json();
  return jsonOk(await confirmConsumedMeal(user.id, id, Number(body.consumedPercent)));
});
