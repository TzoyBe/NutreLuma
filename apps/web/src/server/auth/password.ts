import 'server-only';
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Σταθερού χρόνου "ψεύτικη" επαλήθευση, ώστε ένα ανύπαρκτο email να μην
 * ξεχωρίζει χρονικά από ένα υπαρκτό με λάθος κωδικό (user enumeration).
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7ZjXBrHhq5Y0d1lFqXrH9hM4o1G0dJm';

export async function fakeVerify(): Promise<void> {
  await bcrypt.compare('not-a-real-password', DUMMY_HASH).catch(() => false);
}
