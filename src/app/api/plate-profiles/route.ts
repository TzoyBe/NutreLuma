import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { env } from '@/server/env';
import { prisma } from '@/server/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  if (!env.PLATE_CALIBRATION) throw new Error('Feature disabled');
  return jsonOk({ profiles: await prisma.plateProfile.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request); const user = await requireApiUser(); await requireWriteAccess(user.id);
  if (!env.PLATE_CALIBRATION) throw new Error('Feature disabled');
  const body = await request.json();
  const diameterMm = Number(body.diameterMm);
  if (!body.name || !Number.isInteger(diameterMm) || diameterMm < 100 || diameterMm > 500) throw new Error('Invalid plate profile');
  return jsonOk({ profile: await prisma.plateProfile.create({ data: { userId: user.id, name: String(body.name).slice(0, 80), diameterMm, shape: String(body.shape ?? 'round').slice(0, 30) } }) }, 201);
});
