import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { listAlerts } from '@/server/services/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const includeDismissed = new URL(request.url).searchParams.get('includeDismissed') === 'true';
  return jsonOk({ alerts: await listAlerts(user.id, includeDismissed) });
});
