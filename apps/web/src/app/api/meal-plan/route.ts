import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { generateDailyRecipePlan, getCurrentRecipePlan } from '@/server/services/recipe-plans';
import { todayISO } from '@/lib/dates';
import { getUserTimezone } from '@/server/services/profile';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 120;
export const GET = withErrorHandling(async (request: Request) => { const user = await requireApiUser(); const timezone = await getUserTimezone(user.id); const date = new URL(request.url).searchParams.get('date') ?? todayISO(timezone); return jsonOk({ plan: await getCurrentRecipePlan(user.id, date) }); });
export const POST = withErrorHandling(async (request: Request) => { assertSameOrigin(request); const user = await requireApiUser(); await requireWriteAccess(user.id); const timezone = await getUserTimezone(user.id); const body = await request.json().catch(() => ({})); const date = typeof body.date === 'string' ? body.date : todayISO(timezone); return jsonOk({ plan: await generateDailyRecipePlan(user.id, date, Boolean(body.force)) }); });
