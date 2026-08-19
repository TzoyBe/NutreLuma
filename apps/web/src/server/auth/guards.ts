import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { isSessionExpiredByPasswordChange, readSession } from './session';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  consentAcceptedAt: Date | null;
}

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  consentAcceptedAt: true,
  passwordChangedAt: true,
} as const;

/**
 * Φορτώνει τον χρήστη της συνεδρίας και επικυρώνει ότι η συνεδρία ισχύει ακόμη.
 *
 * Δύο λόγοι ακύρωσης:
 *  - ο χρήστης δεν υπάρχει πια (διαγραμμένος λογαριασμός)
 *  - ο κωδικός άλλαξε μετά την έκδοση του token (επαναφορά κωδικού), οπότε
 *    κάθε παλιό cookie — ακόμη και κλεμμένο — παύει να ισχύει
 */
async function loadSessionUser(): Promise<AuthenticatedUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: USER_SELECT,
  });
  if (!user) return null;

  if (isSessionExpiredByPasswordChange(session, user.passwordChangedAt)) return null;

  const { passwordChangedAt: _ignored, ...rest } = user;
  return rest;
}

/** Για API routes: επιστρέφει τον χρήστη ή πετάει 401. */
export async function requireApiUser(): Promise<AuthenticatedUser> {
  const user = await loadSessionUser();
  if (!user) {
    throw new ApiError('UNAUTHENTICATED', 'Απαιτείται σύνδεση.');
  }
  return user;
}

/** Για server components: κάνει redirect στο login αντί να πετάξει σφάλμα. */
export async function requirePageUser(): Promise<AuthenticatedUser> {
  const user = await loadSessionUser();
  if (!user) redirect('/login');
  return user;
}

export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  return loadSessionUser();
}

/**
 * Για admin API routes: απαιτεί συνδεδεμένο ADMIN. Πετάει NOT_FOUND (όχι 403)
 * ώστε να μην αποκαλύπτεται καν η ύπαρξη admin endpoint σε μη-admin.
 */
export async function requireApiAdmin(): Promise<AuthenticatedUser> {
  const user = await requireApiUser();
  if (user.role !== 'ADMIN') {
    throw new ApiError('NOT_FOUND', 'Not found.');
  }
  return user;
}

/**
 * Επιβάλλεται ΜΟΝΟ στα endpoints που δημιουργούν νέα δεδομένα.
 * Δεν μπαίνει σε middleware: το edge runtime δεν έχει πρόσβαση στη βάση, και
 * έλεγχος μοιρασμένος σε δύο επίπεδα κάποια στιγμή αποκλίνει.
 */
export async function requireWriteAccess(userId: string): Promise<void> {
  const { getAccessState } = await import('../services/subscription');
  const state = await getAccessState(userId);
  if (state.canWrite) return;
  throw new ApiError(
    'SUBSCRIPTION_REQUIRED',
    'Η συνδρομή σου έληξε. Ανανέωσέ την για να προσθέσεις νέα δεδομένα.',
  );
}
