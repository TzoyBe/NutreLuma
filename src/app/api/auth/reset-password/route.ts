import { assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertResetAttemptRateLimit } from '@/server/auth/rate-limit';
import { resetPassword } from '@/server/services/password-reset';
import { clearSessionCookie } from '@/server/auth/session';
import { resetPasswordSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ολοκλήρωση επαναφοράς κωδικού.
 *
 * Δεν συνδέει αυτόματα τον χρήστη: αν ο σύνδεσμος έφτασε σε λάθος χέρια, η
 * αυτόματη σύνδεση θα έδινε αμέσως πρόσβαση. Ο χρήστης συνδέεται ρητά με τον
 * νέο κωδικό.
 */
export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  await assertResetAttemptRateLimit(clientIp(request));

  const input = resetPasswordSchema.parse(await request.json());
  await resetPassword(input.token, input.password);

  // Τυχόν παλιά συνεδρία στον ίδιο browser δεν ισχύει πλέον· καθαρίζουμε και
  // το cookie ώστε να μη μείνει άχρηστο.
  await clearSessionCookie();

  return jsonOk({ reset: true });
});
