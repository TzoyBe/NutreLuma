import type { Locale } from '@/i18n';
import type { EmailMessage } from './types';

/**
 * Πρότυπα email.
 *
 * Το HTML είναι σκόπιμα απλό, με πίνακες και inline styles: οι πελάτες email
 * (ιδίως το Outlook) αγνοούν εξωτερικά stylesheets, flexbox και σύγχρονο CSS.
 * Στόχος είναι να διαβάζεται παντού, όχι να εντυπωσιάζει.
 */

/** Αποτρέπει HTML injection από τιμές που παρεμβάλλονται στο πρότυπο. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ResetCopy {
  subject: string;
  heading: string;
  greeting: (name: string) => string;
  intro: string;
  button: string;
  fallback: string;
  expiry: (minutes: number) => string;
  ignore: string;
  signature: string;
}

const COPY: Record<Locale, ResetCopy> = {
  el: {
    subject: 'Επαναφορά κωδικού — NutreLuma',
    heading: 'Επαναφορά κωδικού',
    greeting: (name) => `Γεια σου ${name},`,
    intro: 'Λάβαμε αίτημα επαναφοράς του κωδικού σου. Πάτησε το κουμπί για να ορίσεις νέο.',
    button: 'Ορισμός νέου κωδικού',
    fallback: 'Αν το κουμπί δεν λειτουργεί, αντίγραψε αυτόν τον σύνδεσμο στον browser σου:',
    expiry: (minutes) =>
      `Ο σύνδεσμος ισχύει για ${minutes} λεπτά και μπορεί να χρησιμοποιηθεί μία μόνο φορά.`,
    ignore:
      'Αν δεν ζήτησες εσύ επαναφορά, αγνόησε αυτό το email. Ο κωδικός σου παραμένει αμετάβλητος.',
    signature: 'Η ομάδα του NutreLuma',
  },
  en: {
    subject: 'Password reset — NutreLuma',
    heading: 'Password reset',
    greeting: (name) => `Hi ${name},`,
    intro: 'We received a request to reset your password. Use the button below to set a new one.',
    button: 'Set a new password',
    fallback: 'If the button does not work, copy this link into your browser:',
    expiry: (minutes) => `The link is valid for ${minutes} minutes and can be used only once.`,
    ignore:
      'If you did not request this, simply ignore this email. Your password remains unchanged.',
    signature: 'The NutreLuma team',
  },
};

export function buildPasswordResetEmail(params: {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale: Locale;
}): EmailMessage {
  const copy = COPY[params.locale] ?? COPY.el;
  const safeName = escapeHtml(params.displayName);
  const safeUrl = escapeHtml(params.resetUrl);

  const text = [
    copy.greeting(params.displayName),
    '',
    copy.intro,
    '',
    params.resetUrl,
    '',
    copy.expiry(params.expiresInMinutes),
    copy.ignore,
    '',
    copy.signature,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${params.locale}">
<body style="margin:0;padding:24px;background:#f4f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#12211c;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background:#0f7a63;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:600;">
        NutreLuma
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">${escapeHtml(copy.heading)}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${copy.greeting(safeName)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(copy.intro)}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td style="border-radius:999px;background:#0f7a63;">
              <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(copy.button)}</a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 6px;font-size:13px;color:#4a5f58;">${escapeHtml(copy.fallback)}</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${safeUrl}" style="color:#0f7a63;">${safeUrl}</a></p>

        <p style="margin:0 0 8px;font-size:13px;color:#4a5f58;">${escapeHtml(copy.expiry(params.expiresInMinutes))}</p>
        <p style="margin:0 0 24px;font-size:13px;color:#4a5f58;">${escapeHtml(copy.ignore)}</p>

        <p style="margin:0;font-size:14px;">${escapeHtml(copy.signature)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to: params.to, subject: copy.subject, html, text };
}

interface VerificationCopy {
  subject: string;
  heading: string;
  greeting: (name: string) => string;
  intro: string;
  button: string;
  fallback: string;
  expiry: (hours: number) => string;
  ignore: string;
  signature: string;
}

const VERIFICATION_COPY: Record<Locale, VerificationCopy> = {
  el: {
    subject: 'Verify your email - NutreLuma',
    heading: 'Verify your email',
    greeting: (name) => `Hi ${name},`,
    intro: 'Thanks for creating a NutreLuma account. Confirm your email to activate your login.',
    button: 'Verify email',
    fallback: 'If the button does not work, copy this link into your browser:',
    expiry: (hours) => `The link is valid for ${hours} hours and can be used only once.`,
    ignore: 'If you did not create this account, you can ignore this email.',
    signature: 'The NutreLuma team',
  },
  en: {
    subject: 'Verify your email - NutreLuma',
    heading: 'Verify your email',
    greeting: (name) => `Hi ${name},`,
    intro: 'Thanks for creating a NutreLuma account. Confirm your email to activate your login.',
    button: 'Verify email',
    fallback: 'If the button does not work, copy this link into your browser:',
    expiry: (hours) => `The link is valid for ${hours} hours and can be used only once.`,
    ignore: 'If you did not create this account, you can ignore this email.',
    signature: 'The NutreLuma team',
  },
};

export function buildEmailVerificationEmail(params: {
  to: string;
  displayName: string;
  verifyUrl: string;
  expiresInHours: number;
  locale: Locale;
}): EmailMessage {
  const copy = VERIFICATION_COPY[params.locale] ?? VERIFICATION_COPY.en;
  const safeName = escapeHtml(params.displayName);
  const safeUrl = escapeHtml(params.verifyUrl);

  const text = [
    copy.greeting(params.displayName),
    '',
    copy.intro,
    '',
    params.verifyUrl,
    '',
    copy.expiry(params.expiresInHours),
    copy.ignore,
    '',
    copy.signature,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${params.locale}">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1020;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background:#0b1020;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">
        Nutre<span style="color:#ffb703;">Luma</span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0b1020;">${escapeHtml(copy.heading)}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${copy.greeting(safeName)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(copy.intro)}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td style="border-radius:999px;background:#2563eb;">
              <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${escapeHtml(copy.button)}</a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 6px;font-size:13px;color:#4b5563;">${escapeHtml(copy.fallback)}</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${safeUrl}" style="color:#2563eb;">${safeUrl}</a></p>

        <p style="margin:0 0 8px;font-size:13px;color:#4b5563;">${escapeHtml(copy.expiry(params.expiresInHours))}</p>
        <p style="margin:0 0 24px;font-size:13px;color:#4b5563;">${escapeHtml(copy.ignore)}</p>

        <p style="margin:0;font-size:14px;">${escapeHtml(copy.signature)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to: params.to, subject: copy.subject, html, text };
}

export function buildNotificationEmail(params: {
  to: string;
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
}): EmailMessage {
  const safeTitle = escapeHtml(params.title);
  const safeBody = escapeHtml(params.body);
  const safeUrl = escapeHtml(params.actionUrl);
  const safeActionLabel = escapeHtml(params.actionLabel);

  const text = [
    params.title,
    '',
    params.body,
    '',
    params.actionUrl,
    '',
    'NutreLuma',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1020;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background:#0b1020;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">
        Nutre<span style="color:#ffb703;">Luma</span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0b1020;">${safeTitle}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${safeBody}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td style="border-radius:999px;background:#2563eb;">
              <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${safeActionLabel}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${safeUrl}" style="color:#2563eb;">${safeUrl}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to: params.to, subject: params.title, html, text };
}
