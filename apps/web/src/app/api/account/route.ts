import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { clearSessionCookie } from '@/server/auth/session';
import { deleteAccount } from '@/server/services/account';
import { updateDisplayName } from '@/server/services/user';
import { deleteAccountSchema } from '@/lib/validation/auth';
import { updateAccountSchema } from '@/lib/validation/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const input = updateAccountSchema.parse(await request.json());
  const updated = await updateDisplayName(user.id, input.displayName);
  return jsonOk({ account: updated });
});

/** Οριστική διαγραφή λογαριασμού μαζί με φωτογραφίες και γεύματα. */
export const DELETE = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const input = deleteAccountSchema.parse(await request.json());

  await deleteAccount(user.id, input.password);
  await clearSessionCookie();

  return jsonOk({ deleted: true });
});
