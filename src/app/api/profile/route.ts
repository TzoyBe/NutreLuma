import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getProfile, upsertProfile } from '@/server/services/profile';
import { healthProfileSchema } from '@/lib/validation/profile';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const profile = await getProfile(user.id);
  return jsonOk({ profile });
});

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();

  const body = await request.json();
  const input = healthProfileSchema.parse(body);

  const profile = await upsertProfile(user.id, input, todayISO(input.timezone));
  return jsonOk({ profile });
});
