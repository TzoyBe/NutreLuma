import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Σημειώνει ότι ο χρήστης είδε την ξενάγηση — μία φορά, δεν επανεμφανίζεται. */
export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await prisma.user.updateMany({
    where: { id: user.id, tourSeenAt: null },
    data: { tourSeenAt: new Date() },
  });
  return jsonOk({ ok: true });
});
