import { assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertRegisterRateLimit } from '@/server/auth/rate-limit';
import { createUser } from '@/server/services/user';
import { sendEmailVerification } from '@/server/services/email-verification';
import { registerSchema } from '@/lib/validation/auth';
import { getLocale } from '@/i18n/locale';

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

  const locale = await getLocale();
  await sendEmailVerification(user.id, locale);

  return jsonOk(
    { id: user.id, displayName: user.displayName, requiresEmailVerification: true },
    201,
  );
});
