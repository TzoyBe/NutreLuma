import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { addActivityEntry, listActivityEntries } from '@/server/services/activity';
import { activityEntrySchema, trackingListQuerySchema } from '@/lib/validation/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = trackingListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return jsonOk({ entries: await listActivityEntries(user.id, query) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = activityEntrySchema.parse(await request.json());
  return jsonOk({ entry: await addActivityEntry(user.id, input) }, 201);
});
