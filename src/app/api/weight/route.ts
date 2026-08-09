import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { listWeightEntries, upsertWeightEntry } from '@/server/services/weight';
import { weightEntrySchema, weightQuerySchema } from '@/lib/validation/weight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = weightQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return jsonOk({ entries: await listWeightEntries(user.id, query) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = weightEntrySchema.parse(await request.json());
  return jsonOk({ entry: await upsertWeightEntry(user.id, input) }, 201);
});
