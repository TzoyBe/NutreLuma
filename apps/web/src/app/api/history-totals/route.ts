import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getUserTimezone } from '@/server/services/profile';
import { getGoalForDay } from '@/server/services/goals';
import { getHistoryTotals } from '@/server/services/stats';
import { dayQuerySchema } from '@/lib/validation/meal';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const { date } = dayQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

  const timezone = await getUserTimezone(user.id);
  const dayISO = date ?? todayISO(timezone);
  const target = (await getGoalForDay(user.id, dayISO)).calorieTarget;

  return jsonOk(await getHistoryTotals(user.id, dayISO, timezone, target));
});
