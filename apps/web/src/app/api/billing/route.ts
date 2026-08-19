import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getBillingOverview } from '@/server/services/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk(await getBillingOverview(user.id));
});
