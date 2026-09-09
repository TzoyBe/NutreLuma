import { z } from 'zod';
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { hardDeleteUser } from '@/server/services/admin-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ confirmEmail: z.string().trim().min(1) });

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  assertSameOrigin(request);
  const admin = await requireApiAdmin();
  const { id } = await context.params;
  const { confirmEmail } = bodySchema.parse(await request.json());
  await hardDeleteUser(id, admin.id, confirmEmail);
  return jsonOk({ hardDeleted: true });
});
