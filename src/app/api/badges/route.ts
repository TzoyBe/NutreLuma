import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { listBadges, upsertBadgeCatalog } from '@/server/services/badges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  await upsertBadgeCatalog();
  return jsonOk({ badges: await listBadges(user.id) });
});
