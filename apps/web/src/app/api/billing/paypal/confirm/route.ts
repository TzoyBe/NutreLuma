import { z } from 'zod';
import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { paypalConfigured } from '@/server/env';
import { attachPayPalSubscription, getBillingOverview } from '@/server/services/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Τα PayPal subscription ids έχουν τη μορφή I-XXXXXXXXXXXX.
  subscriptionId: z
    .string()
    .trim()
    .min(6)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, 'Μη έγκυρο αναγνωριστικό συνδρομής.'),
});

/**
 * Επιβεβαίωση συνδρομής PayPal μετά το `onApprove` στον browser.
 *
 * Το id είναι ΑΝΑΞΙΟΠΙΣΤΟ. Η υπηρεσία ρωτά την ίδια την PayPal και ελέγχει
 * πλάνο, ιδιοκτησία, μοναδικότητα και κατάσταση πριν δώσει πρόσβαση.
 */
export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();

  if (!paypalConfigured) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή μέσω PayPal δεν είναι διαθέσιμη.');
  }

  const { subscriptionId } = bodySchema.parse(await request.json());

  await attachPayPalSubscription(user.id, subscriptionId);
  return jsonOk({ overview: await getBillingOverview(user.id) });
});
