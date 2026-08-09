import { z } from 'zod';
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getStatsOverview } from '@/server/services/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const { days } = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return jsonOk(await getStatsOverview(user.id, days));
});
