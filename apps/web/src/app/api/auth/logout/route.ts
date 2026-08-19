import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { clearSessionCookie } from '@/server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  await clearSessionCookie();
  return jsonOk({ loggedOut: true });
});
