import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { suggestMilestones } from '@/server/services/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk({ suggestions: await suggestMilestones(user.id) });
});
