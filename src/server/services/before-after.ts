import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { processMealImage } from '../images';
import { buildMealImageKey, getStorage } from '../storage';
import { ApiError } from '../errors';

export async function attachAfterMealImage(params: { userId: string; mealId: string; file: Buffer; consumedPercent?: number }) {
  const meal = await prisma.meal.findFirst({ where: { id: params.mealId, userId: params.userId }, select: { id: true, aiEstimatedCalories: true, imagePath: true, status: true } });
  if (!meal) throw new ApiError('NOT_FOUND', 'Meal not found.');
  if (!meal.imagePath || meal.aiEstimatedCalories === null) throw new ApiError('BAD_REQUEST', 'Analyze the before image first.');
  if (meal.status === 'CANCELLED') throw new ApiError('BAD_REQUEST', 'This meal was cancelled.');
  const processed = await processMealImage(params.file);
  const key = buildMealImageKey(params.userId, processed.contentType, 'full').replace('-full.', '-after.');
  await getStorage().put(key, processed.full, processed.contentType);
  const percent = params.consumedPercent === undefined ? null : Math.min(100, Math.max(0, params.consumedPercent));
  const estimate = percent === null ? null : Math.round(meal.aiEstimatedCalories * percent / 100);
  const updated = await prisma.meal.update({ where: { id: meal.id }, data: { afterImagePath: key, beforeEstimateCalories: meal.aiEstimatedCalories, estimatedConsumedPercent: percent, estimatedConsumedCalories: estimate, beforeAfterConfidence: percent === null ? 0.2 : 0.55, finalConfirmedConsumedCalories: null, status: 'REVIEW_REQUIRED', confidenceFactors: { beforeAfter: percent === null ? 'manual_confirmation_required' : 'partial_consumption_estimate' } as Prisma.InputJsonValue } });
  return { id: updated.id, beforeCalories: updated.beforeEstimateCalories, estimatedConsumedCalories: updated.estimatedConsumedCalories, estimatedConsumedPercent: updated.estimatedConsumedPercent, confidence: updated.beforeAfterConfidence, requiresConfirmation: true, fallbackOptions: [25, 50, 75, 100] };
}

export async function confirmConsumedMeal(userId: string, mealId: string, consumedPercent: number) {
  const meal = await prisma.meal.findFirst({ where: { id: mealId, userId }, select: { id: true, aiEstimatedCalories: true, afterImagePath: true } });
  if (!meal || !meal.afterImagePath || meal.aiEstimatedCalories === null) throw new ApiError('NOT_FOUND', 'Before and after scan not found.');
  const percent = Math.min(100, Math.max(0, consumedPercent));
  const calories = Math.round(meal.aiEstimatedCalories * percent / 100);
  await prisma.meal.update({ where: { id: meal.id }, data: { finalConfirmedConsumedCalories: calories, finalCalories: calories, estimatedConsumedPercent: percent, estimatedConsumedCalories: calories, status: 'CONFIRMED', confirmedAt: new Date(), source: 'AI_IMAGE' } });
  return { mealId: meal.id, finalCalories: calories, consumedPercent: percent };
}
