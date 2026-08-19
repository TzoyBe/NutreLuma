import { cookies } from 'next/headers';
import { z } from 'zod';
import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { env } from '@/server/env';
import { isLocale, LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/i18n/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  locale: z.enum(['el', 'en']),
});

/**
 * Αλλαγή γλώσσας. Δεν απαιτεί σύνδεση: η γλώσσα είναι προτίμηση εμφάνισης και
 * πρέπει να δουλεύει και στις δημόσιες σελίδες (login, όροι, απόρρητο).
 *
 * Το cookie δεν είναι HttpOnly — δεν περιέχει τίποτα ευαίσθητο και επιτρέπει
 * σε μελλοντικό client-side κώδικα να το διαβάσει χωρίς επιπλέον αίτημα.
 */
export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);

  const body = await request.json().catch(() => ({}));
  const { locale } = bodySchema.parse(body);

  if (!isLocale(locale)) {
    throw new ApiError('VALIDATION_ERROR', 'Μη υποστηριζόμενη γλώσσα.');
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.APP_URL.startsWith('https://'),
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return jsonOk({ locale, supported: SUPPORTED_LOCALES });
});
