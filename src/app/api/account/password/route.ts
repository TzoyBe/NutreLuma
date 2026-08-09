import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { changePassword } from '@/server/services/user';
import { setSessionCookie } from '@/server/auth/session';
import { changePasswordSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const input = changePasswordSchema.parse(await request.json());

  await changePassword(user.id, input.currentPassword, input.newPassword);
  // Ανανέωση session μετά την αλλαγή κωδικού.
  await setSessionCookie({ sub: user.id, email: user.email, role: user.role });

  return jsonOk({ changed: true });
});
