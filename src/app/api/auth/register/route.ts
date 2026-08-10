import { assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertRegisterRateLimit } from '@/server/auth/rate-limit';
import { setSessionCookie } from '@/server/auth/session';
import { createUser } from '@/server/services/user';
import { registerSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  await assertRegisterRateLimit(clientIp(request));

  const body = await request.json();
  const input = registerSchema.parse(body);

  const user = await createUser({
    email: input.email,
    displayName: input.displayName,
    password: input.password,
  });

  await setSessionCookie({ sub: user.id, email: user.email, role: user.role });

  return jsonOk({ id: user.id, displayName: user.displayName, needsProfile: true }, 201);
});
