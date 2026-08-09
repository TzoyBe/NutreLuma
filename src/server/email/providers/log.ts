import { logger } from '../../logger';
import type { EmailMessage, EmailProvider } from '../types';

/**
 * Πάροχος για development και για εγκαταστάσεις χωρίς ρυθμισμένο email.
 *
 * Δεν στέλνει τίποτα — γράφει το μήνυμα στα logs ώστε η ροή να παραμένει
 * πλήρως λειτουργική και δοκιμάσιμη τοπικά. Ο σύνδεσμος επαναφοράς φαίνεται
 * στα logs του container:
 *
 *   docker compose logs web | grep email_not_sent
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';

  async send(message: EmailMessage): Promise<void> {
    logger.warn('email_not_sent_logged_only', {
      to: message.to,
      subject: message.subject,
      // Το text σώμα περιέχει τον σύνδεσμο — χρήσιμο ακριβώς για δοκιμή.
      body: message.text,
    });
  }
}
