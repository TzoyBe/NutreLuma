import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
const itemSchema = z.object({ name: z.string().trim().min(1).max(100), quantity: z.string().trim().max(60).optional(), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export const GET = withErrorHandling(async () => { const user = await requireApiUser(); return jsonOk({ items: await prisma.pantryItem.findMany({ where: { userId: user.id }, orderBy: { expiresAt: 'asc' } }) }); });
export const POST = withErrorHandling(async (request: Request) => { assertSameOrigin(request); const user = await requireApiUser(); await requireWriteAccess(user.id); const item = itemSchema.parse(await request.json()); return jsonOk({ item: await prisma.pantryItem.create({ data: { userId: user.id, name: item.name, quantity: item.quantity ?? null, expiresAt: item.expiresAt ? new Date(`${item.expiresAt}T00:00:00.000Z`) : null } }) }, 201); });
