import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { updateRow, deleteRow } from '@/server/services/admin-db';
import { updateRowSchema } from '@/lib/validation/admin-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ model: string; id: string }> };

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const admin = await requireApiAdmin();
  const { model, id } = await context.params;
  const { data } = updateRowSchema.parse(await request.json());
  return jsonOk({ row: await updateRow(model, id, data, admin.id) });
});

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const admin = await requireApiAdmin();
  const { model, id } = await context.params;
  await deleteRow(model, id, admin.id);
  return jsonOk({ deleted: true });
});
