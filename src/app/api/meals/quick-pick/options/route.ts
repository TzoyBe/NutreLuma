import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getUserTimezone } from '@/server/services/profile';
import { getFavorites, getFrequentMeals, getRecentMeals } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const [favorites, frequent, recent] = await Promise.all([
    getFavorites(user.id),
    getFrequentMeals(user.id, { now, hour }),
    getRecentMeals(user.id),
  ]);
  return jsonOk({ favorites, frequent, recent });
});
