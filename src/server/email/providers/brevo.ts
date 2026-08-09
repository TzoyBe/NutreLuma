import { env } from '../../env';
import { EmailError, type EmailMessage, type EmailProvider } from '../types';

const API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Brevo (πρώην Sendinblue). Γαλλική εταιρεία, δεδομένα σε ΕΕ, 300 email/ημέρα
 * δωρεάν.
 *
 * Χρησιμοποιείται το HTTP API αντί για SMTP: δεν απαιτεί εξωτερική εξάρτηση,
 * περνά από firewalls που κλείνουν τη θύρα 587, και επιστρέφει καθαρά σφάλματα.
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'api-key': env.EMAIL_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new EmailError(
        'Email delivery failed',
        `brevo status=${response.status} body=${detail.slice(0, 300)}`,
      );
    }
  }
}
