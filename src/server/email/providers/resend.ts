import { env } from '../../env';
import { EmailError, type EmailMessage, type EmailProvider } from '../types';

const API_URL = 'https://api.resend.com/emails';

/**
 * Resend. 3.000 email/μήνα δωρεάν, με δυνατότητα επιλογής περιοχής ΕΕ.
 *
 * Ίδια λογική με τον Brevo: HTTP API, καμία εξωτερική εξάρτηση.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.EMAIL_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new EmailError(
        'Email delivery failed',
        `resend status=${response.status} body=${detail.slice(0, 300)}`,
      );
    }
  }
}
