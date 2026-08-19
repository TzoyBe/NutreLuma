import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { listSavedRecipes, parseSavedRecipe, saveRecipe } from '@/server/services/saved-recipes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const recipes = await listSavedRecipes(user.id);
  return jsonOk({ recipes: recipes.map((recipe) => ({ id: recipe.id, createdAt: recipe.createdAt, recipe: recipe.payload })) });
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  const recipe = parseSavedRecipe(await request.json());
  const saved = await saveRecipe(user.id, recipe);
  return jsonOk({ id: saved.id, recipe: saved.payload }, 201);
});
