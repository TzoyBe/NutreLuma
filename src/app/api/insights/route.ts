import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { env } from '@/server/env';
import { getUserTimezone } from '@/server/services/profile';
import { getDailyDataQuality, getPersonalEnergyEstimate, getPersonalPatterns } from '@/server/services/personal-intelligence';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const timezone = await getUserTimezone(user.id);
  const today = todayISO(timezone);
  const [quality, patterns, energy] = await Promise.all([
    env.DATA_CONFIDENCE ? getDailyDataQuality(user.id, today, timezone) : Promise.resolve(null),
    env.PERSONAL_PATTERNS ? getPersonalPatterns(user.id, timezone) : Promise.resolve([]),
    env.ENERGY_ESTIMATE ? getPersonalEnergyEstimate(user.id, timezone) : Promise.resolve(null),
  ]);
  return jsonOk({ today, quality, patterns, energy });
});
