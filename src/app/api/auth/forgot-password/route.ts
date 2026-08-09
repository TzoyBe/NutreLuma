import { assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertPasswordResetRateLimit } from '@/server/auth/rate-limit';
import { requestPasswordReset } from '@/server/services/password-reset';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { getLocale } from '@/i18n/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Αίτηση επαναφοράς κωδικού.
 *
 * Επιστρέφει ΠΑΝΤΑ την ίδια απάντηση, είτε το email αντιστοιχεί σε λογαριασμό
 * είτε όχι. Διαφορετική απάντηση θα μετέτρεπε τη φόρμα σε εργαλείο απαρίθμησης
 * πελατών — κάποιος θα δοκίμαζε λίστα διευθύνσεων και θα μάθαινε ποιες είναι
 * εγγεγραμμένες.
 */
export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);

  const input = forgotPasswordSchema.parse(await request.json());
  assertPasswordResetRateLimit(clientIp(request), input.email);

  const locale = await getLocale();
  await requestPasswordReset(input.email, locale);

  return jsonOk({ accepted: true });
});
