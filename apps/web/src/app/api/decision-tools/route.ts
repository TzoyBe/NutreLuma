import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { env } from '@/server/env';
import { fixMyDay, getMealFit, getWeightChangeInsight, saveWeeklyBudget } from '@/server/services/decision-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser(); const mode = new URL(request.url).searchParams.get('mode') ?? 'fix-day';
  if (mode === 'weight') return jsonOk(await getWeightChangeInsight(user.id));
  if (!env.FIX_MY_DAY) throw new Error('Feature disabled');
  return jsonOk(await fixMyDay(user.id));
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request); const user = await requireApiUser(); await requireWriteAccess(user.id);
  const body = await request.json();
  if (body.mode === 'meal-fit') { if (!env.CAN_I_EAT_THIS) throw new Error('Feature disabled'); return jsonOk(await getMealFit(user.id, Number(body.calories), Number(body.protein ?? 0))); }
  if (!env.FLEXIBLE_WEEKLY_BUDGET) throw new Error('Feature disabled');
  return jsonOk(await saveWeeklyBudget(user.id, new Date(`${body.weekStart}T00:00:00.000Z`), Number(body.totalCalories), body.dailyPlan, Boolean(body.enabled)));
});
