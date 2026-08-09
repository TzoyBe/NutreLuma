import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiAdmin } from '@/server/auth/guards';
import { listModels } from '@/server/services/admin-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  await requireApiAdmin();
  return jsonOk({ models: await listModels() });
});
