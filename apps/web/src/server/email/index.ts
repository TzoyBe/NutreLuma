import 'server-only';
import { env, emailConfigured } from '../env';
import { logger } from '../logger';
import { BrevoEmailProvider } from './providers/brevo';
import { LogEmailProvider } from './providers/log';
import { ResendEmailProvider } from './providers/resend';
import { EmailError, type EmailMessage, type EmailProvider } from './types';

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  // Χωρίς πλήρη ρύθμιση δεν έχει νόημα να ξεκινήσει πραγματικός πάροχος:
  // πέφτουμε ελεγχόμενα στον log provider ώστε η εφαρμογή να παραμένει
  // λειτουργική και ο σύνδεσμος επαναφοράς να είναι ορατός στα logs.
  if (env.EMAIL_PROVIDER === 'log' || !emailConfigured) {
    if (env.EMAIL_PROVIDER !== 'log') {
      logger.warn('email_provider_fallback_to_log', { requested: env.EMAIL_PROVIDER });
    }
    cached = new LogEmailProvider();
    return cached;
  }

  cached = env.EMAIL_PROVIDER === 'resend' ? new ResendEmailProvider() : new BrevoEmailProvider();
  return cached;
}

/**
 * Στέλνει email και επιστρέφει αν στάλθηκε.
 *
 * ΔΕΝ πετάει ποτέ προς τα πάνω: η αποτυχία αποστολής δεν πρέπει να αποκαλύψει
 * στον επισκέπτη ότι κάτι πήγε στραβά (θα φανέρωνε αν το email υπάρχει) ούτε
 * να ρίξει τη ροή. Το πραγματικό σφάλμα μένει στα server logs.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = getEmailProvider();
  try {
    await provider.send(message);
    logger.info('email_sent', { provider: provider.name, subject: message.subject });
    return true;
  } catch (error) {
    logger.error('email_failed', {
      provider: provider.name,
      detail: error instanceof EmailError ? error.detail : 'unknown',
    });
    return false;
  }
}

/** Μόνο για tests: επιτρέπει επαναρχικοποίηση του cached provider. */
export function __resetEmailProvider(): void {
  cached = null;
}

export type { EmailMessage, EmailProvider };
export { EmailError };
