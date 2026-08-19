import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { deleteSavedRecipe } from '@/server/services/saved-recipes';

export const runtime = 'nodejs';

export const DELETE = withErrorHandling(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const { id } = await context.params;
  await deleteSavedRecipe(user.id, id);
  return jsonOk({ deleted: true });
});
