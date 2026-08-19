export interface EmailMessage {
  to: string;
  subject: string;
  /** Και τα δύο είναι υποχρεωτικά: πολλοί πελάτες email προτιμούν το text. */
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Σφάλμα παρόχου. Το `detail` μένει ΜΟΝΟ στα server logs. */
export class EmailError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'EmailError';
    this.detail = detail;
  }
}
