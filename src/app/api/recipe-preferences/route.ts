import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { getRecipePreference, saveRecipePreference } from '@/server/services/recipe-plans';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export const GET = withErrorHandling(async () => { const user = await requireApiUser(); return jsonOk({ preference: await getRecipePreference(user.id) }); });
export const PUT = withErrorHandling(async (request: Request) => { assertSameOrigin(request); const user = await requireApiUser(); await requireWriteAccess(user.id); return jsonOk({ preference: await saveRecipePreference(user.id, await request.json()) }); });
