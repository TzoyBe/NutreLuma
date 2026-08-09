import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { activateMaintenance } from '@/server/services/maintenance';
import { activateMaintenanceSchema } from '@/lib/validation/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const input = activateMaintenanceSchema.parse(await request.json());
  return jsonOk(await activateMaintenance(user.id, input), 201);
});
