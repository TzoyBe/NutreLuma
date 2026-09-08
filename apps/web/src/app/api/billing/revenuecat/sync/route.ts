import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import {
  getBillingOverview,
  syncRevenueCatSubscription,
} from '@/server/services/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await syncRevenueCatSubscription(user.id);
  return jsonOk(await getBillingOverview(user.id));
});
