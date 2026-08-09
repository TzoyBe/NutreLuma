import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { extendManually } from '@/server/services/subscription';
import { extendSubscriptionSchema } from '@/lib/validation/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  if (user.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN', 'Απαιτούνται δικαιώματα διαχειριστή.');
  }

  const input = extendSubscriptionSchema.parse(await request.json());
  await extendManually(input.userId, input.months, input.note || 'Χειροκίνητη ενεργοποίηση');
  return jsonOk({ extended: true });
});
