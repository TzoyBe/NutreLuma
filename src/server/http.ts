import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';
import { env } from './env';

import { ApiError, HTTP_STATUS as STATUS, type ApiErrorCode } from './errors';

export { ApiError };
export type { ApiErrorCode };

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

const nonEnglishText = /[\u0370-\u03FF\u1F00-\u1FFF]/u;

function publicMessage(message: string): string {
  return nonEnglishText.test(message) ? 'Please check the entered information.' : message;
}

export function jsonError(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message: publicMessage(message), ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}

function zodDetails(error: ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: publicMessage(i.message) }));
}

/**
 * Τυλίγει έναν route handler: μετατρέπει γνωστά σφάλματα σε συνεπές JSON και
 * κρύβει κάθε εσωτερική λεπτομέρεια/stack trace από τον client.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        if (STATUS[error.code] >= 500) {
          logger.error('api_error', { code: error.code, message: error.message });
        }
        return jsonError(error.code, error.message, error.details);
      }
      if (error instanceof ZodError) {
        return jsonError(
          'VALIDATION_ERROR',
          'Τα δεδομένα που στάλθηκαν δεν είναι έγκυρα.',
          zodDetails(error),
        );
      }
      // Σφάλματα παρόχων κουβαλούν `detail` με το πραγματικό μήνυμα του API.
      // Μένει ΜΟΝΟ εδώ, στα server logs — ο client δεν το βλέπει ποτέ.
      const detail =
        error instanceof Error && 'detail' in error && typeof error.detail === 'string'
          ? error.detail
          : undefined;
      logger.error('unhandled_error', {
        message: error instanceof Error ? error.message : 'unknown',
        ...(detail ? { detail } : {}),
      });
      return jsonError('INTERNAL_ERROR', 'Παρουσιάστηκε απρόσμενο σφάλμα. Δοκίμασε ξανά.');
    }
  };
}

/**
 * Ποιο host ζήτησε ΟΝΤΩΣ ο browser. Δεν χρησιμοποιούμε το `request.url`:
 * μέσα σε container το Next βλέπει την εσωτερική διεύθυνση (localhost:3000),
 * όχι αυτή που πληκτρολόγησε ο χρήστης.
 */
function requestedHost(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded) return forwarded.split(',')[0]!.trim().toLowerCase();
  return request.headers.get('host')?.toLowerCase() ?? null;
}

/**
 * CSRF: για κάθε mutating request απαιτούμε same-origin.
 * Το session cookie είναι SameSite=Lax, οπότε αυτό είναι ο δεύτερος έλεγχος.
 *
 * Συγκρίνουμε το `Origin` με το `Host` του ίδιου του αιτήματος — τον κανονικό
 * έλεγχο same-origin. Έτσι δουλεύει με ΟΠΟΙΟΔΗΠΟΤΕ όνομα ή IP χρησιμοποιεί ο
 * χρήστης (IP, hostname του NAS, domain πίσω από proxy) χωρίς να χαλαρώνει η
 * προστασία: επιτιθέμενη σελίδα δεν μπορεί να πλαστογραφήσει το `Origin` που
 * στέλνει ο browser του θύματος.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  // Ο browser στέλνει πάντα Origin σε state-changing fetch. Απουσία του
  // σημαίνει μη-browser client (curl, mobile app), που δεν κινδυνεύει από CSRF.
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (!source) return;

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host.toLowerCase();
  } catch {
    throw new ApiError('FORBIDDEN', 'Μη έγκυρη προέλευση αιτήματος.');
  }

  const allowedHosts = new Set<string>();
  const host = requestedHost(request);
  if (host) allowedHosts.add(host);
  try {
    allowedHosts.add(new URL(env.APP_URL).host.toLowerCase());
  } catch {
    /* λανθασμένο APP_URL δεν πρέπει να ρίχνει το αίτημα */
  }

  if (!allowedHosts.has(sourceHost)) {
    throw new ApiError('FORBIDDEN', 'Μη έγκυρη προέλευση αιτήματος.');
  }
}

/**
 * IP του πελάτη, για rate limiting.
 *
 * ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ ΜΕ ΝΟΗΜΑ ΑΣΦΑΛΕΙΑΣ:
 *
 * Το `CF-Connecting-IP` το γράφει πάντα η ίδια η Cloudflare και αντικαθιστά
 * ό,τι έστειλε ο client — δεν πλαστογραφείται.
 *
 * Το `X-Forwarded-For` ΔΕΝ έχει την ίδια εγγύηση: αν ο client στείλει δικό του,
 * η Cloudflare απλώς προσθέτει τη δική της τιμή στο τέλος. Παίρνοντας το πρώτο
 * στοιχείο θα δεχόμασταν τιμή ελεγχόμενη από τον επιτιθέμενο, ο οποίος θα
 * άλλαζε «IP» σε κάθε αίτημα και θα παρέκαμπτε το rate limiting του login.
 *
 * Γι' αυτό το `X-Forwarded-For` χρησιμοποιείται μόνο ως έσχατη λύση, όταν δεν
 * υπάρχει καθόλου Cloudflare μπροστά.
 */
export function clientIp(request: Request): string {
  const cloudflare = request.headers.get('cf-connecting-ip');
  if (cloudflare) return cloudflare.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();

  return request.headers.get('x-real-ip') ?? 'unknown';
}
