import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { listRows } from '@/server/services/admin-db';
import { rowsQuerySchema } from '@/lib/validation/admin-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ model: string }> };

export const GET = withErrorHandling(async (request: Request, context: Context) => {
  await requireApiAdmin();
  const { model } = await context.params;
  const url = new URL(request.url);
  const query = rowsQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return jsonOk(await listRows(model, query));
});
