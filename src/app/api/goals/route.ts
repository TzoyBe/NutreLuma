import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { getGoalForDay, listGoalHistory, setGoal, suggestGoals } from '@/server/services/goals';
import { getUserTimezone } from '@/server/services/profile';
import { setGoalSchema } from '@/lib/validation/goals';
import { dayQuerySchema } from '@/lib/validation/meal';
import { toZonedDayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ο στόχος που ισχύει για μια ημέρα, μαζί με πρόταση και ιστορικό. */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = dayQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

  const timezone = await getUserTimezone(user.id);
  const day = query.date ?? toZonedDayISO(new Date(), timezone);

  const [goal, suggestion, history] = await Promise.all([
    getGoalForDay(user.id, day),
    suggestGoals(user.id),
    listGoalHistory(user.id),
  ]);

  return jsonOk({ date: day, timezone, goal, suggestion, history });
});

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);

  const input = setGoalSchema.parse(await request.json());
  const timezone = await getUserTimezone(user.id);
  const today = toZonedDayISO(new Date(), timezone);

  const goal = await setGoal(user.id, input, today);
  return jsonOk({ goal });
});
