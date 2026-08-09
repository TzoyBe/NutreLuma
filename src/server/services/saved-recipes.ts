import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma, type MealType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma';

const recipeInputSchema = z.object({
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  title: z.string().min(1).max(120),
  description: z.string().max(400),
  estimatedCalories: z.coerce.number().positive().max(2500),
  macros: z.object({ proteinGrams: z.coerce.number().nonnegative(), carbohydrateGrams: z.coerce.number().nonnegative(), fatGrams: z.coerce.number().nonnegative(), fiberGrams: z.coerce.number().nonnegative() }),
  preparationTimeMinutes: z.coerce.number().int().min(0).max(300),
  difficulty: z.string().max(20),
  ingredients: z.array(z.object({ name: z.string().min(1).max(120), quantity: z.coerce.number().positive().max(10000), unit: z.string().max(20), estimatedCalories: z.coerce.number().nonnegative().max(2500) })).min(1).max(20),
  steps: z.array(z.string().min(1).max(300)).min(1).max(12),
  allergenWarnings: z.array(z.string().max(160)).max(8),
  substitutions: z.array(z.object({ original: z.string(), replacement: z.string(), reason: z.string() })).max(8),
});

export type SavedRecipeInput = z.infer<typeof recipeInputSchema>;

export function parseSavedRecipe(value: unknown): SavedRecipeInput {
  return recipeInputSchema.parse(value);
}

function fingerprint(recipe: SavedRecipeInput): string {
  return createHash('sha256').update(JSON.stringify(recipe)).digest('hex');
}

export async function saveRecipe(userId: string, input: SavedRecipeInput) {
  const key = fingerprint(input);
  return prisma.savedRecipe.upsert({
    where: { userId_fingerprint: { userId, fingerprint: key } },
    create: { userId, fingerprint: key, title: input.title, mealType: input.mealType as MealType, payload: input as unknown as Prisma.InputJsonValue },
    update: { title: input.title, payload: input as unknown as Prisma.InputJsonValue },
  });
}

export async function listSavedRecipes(userId: string) {
  return prisma.savedRecipe.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function deleteSavedRecipe(userId: string, id: string) {
  return prisma.savedRecipe.deleteMany({ where: { id, userId } });
}
