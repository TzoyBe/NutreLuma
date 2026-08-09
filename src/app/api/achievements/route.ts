import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { evaluateAchievementsForUser } from '@/server/services/achievements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk({ achievements: await evaluateAchievementsForUser(user.id) });
});
