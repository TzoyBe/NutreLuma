import { assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertPasswordResetRateLimit } from '@/server/auth/rate-limit';
import { resendEmailVerification } from '@/server/services/email-verification';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { getLocale } from '@/i18n/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);

  const input = forgotPasswordSchema.parse(await request.json());
  await assertPasswordResetRateLimit(clientIp(request), input.email);

  const locale = await getLocale();
  await resendEmailVerification(input.email, locale);

  return jsonOk({ accepted: true });
});
