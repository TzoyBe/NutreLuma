import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type MealType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { ApiError } from '../errors';
import { assertAiRateLimit } from '../auth/rate-limit';
import { getVisionProvider } from '../ai';
import { getGoalForDay } from './goals';
import { getUserTimezone } from './profile';
import { zonedDayRangeUtc } from '@/lib/dates';

const recipeSchema = z.object({
  date: z.string(),
  dailyTarget: z.object({ calories: z.coerce.number().nonnegative(), proteinGrams: z.coerce.number().nonnegative(), carbohydrateGrams: z.coerce.number().nonnegative(), fatGrams: z.coerce.number().nonnegative(), fiberGrams: z.coerce.number().nonnegative() }),
  remainingTarget: z.object({ calories: z.coerce.number().nonnegative(), proteinGrams: z.coerce.number().nonnegative(), carbohydrateGrams: z.coerce.number().nonnegative(), fatGrams: z.coerce.number().nonnegative(), fiberGrams: z.coerce.number().nonnegative() }),
  meals: z.array(z.object({ mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']), title: z.string().min(1).max(120), description: z.string().max(400), targetCalories: z.coerce.number().positive().max(2500), estimatedCalories: z.coerce.number().positive().max(2500), macros: z.object({ proteinGrams: z.coerce.number().nonnegative(), carbohydrateGrams: z.coerce.number().nonnegative(), fatGrams: z.coerce.number().nonnegative(), fiberGrams: z.coerce.number().nonnegative() }), servings: z.coerce.number().positive().max(20), preparationTimeMinutes: z.coerce.number().int().min(0).max(300), difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']), ingredients: z.array(z.object({ name: z.string().min(1).max(120), quantity: z.coerce.number().positive().max(10000), unit: z.string().max(20), estimatedCalories: z.coerce.number().nonnegative().max(2500) })).min(1).max(20), steps: z.array(z.string().min(1).max(300)).min(1).max(12), allergenWarnings: z.array(z.string().max(160)).max(8), substitutions: z.array(z.object({ original: z.string(), replacement: z.string(), reason: z.string() })).max(8) })).max(3),
  estimatedDailyTotal: z.object({ calories: z.coerce.number().nonnegative(), proteinGrams: z.coerce.number().nonnegative(), carbohydrateGrams: z.coerce.number().nonnegative(), fatGrams: z.coerce.number().nonnegative(), fiberGrams: z.coerce.number().nonnegative() }),
});
export type RecipePlan = z.infer<typeof recipeSchema>;

export function allocateMealTargets(target: { calories: number; proteinGrams?: number | null; carbohydrateGrams?: number | null; fatGrams?: number | null; fiberGrams?: number | null }, remaining: { calories: number; proteinGrams: number; carbohydrateGrams: number; fatGrams: number; fiberGrams: number }, mealTypes: MealType[], distribution = { BREAKFAST: 25, LUNCH: 40, DINNER: 35 }) {
  const weights = mealTypes.map((meal) => distribution[meal as keyof typeof distribution] ?? 0); const total = weights.reduce((a, b) => a + b, 0) || 1;
  return mealTypes.map((meal, index) => ({ mealType: meal, calories: Math.max(0, Math.round(remaining.calories * weights[index]! / total)), proteinGrams: Math.max(0, Math.round(remaining.proteinGrams * weights[index]! / total)), carbohydrateGrams: Math.max(0, Math.round(remaining.carbohydrateGrams * weights[index]! / total)), fatGrams: Math.max(0, Math.round(remaining.fatGrams * weights[index]! / total)), fiberGrams: Math.max(0, Math.round(remaining.fiberGrams * weights[index]! / total)) }));
}

function safeWords(value: unknown): string[] { return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, 40) : []; }
function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('invalid JSON');
  }
}
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

/**
 * Το μοντέλο δεν τηρεί πάντα το ακριβές σχήμα (π.χ. ingredients ή substitutions
 * ως strings, ονόματα πεδίων αλλιώς, ή λείπουν πεδία). Εδώ φέρνουμε την απάντηση
 * στη μορφή που περιμένει το `recipeSchema` πριν την επικύρωση, ώστε να μη
 * γυρνάμε άσκοπα στο σταθερό fallback.
 */
function coerceIngredient(ing: unknown): unknown {
  if (typeof ing === 'string') {
    const m = ing.match(/^\s*([\d.]+)\s*([\p{L}]+)?\s+(.+)$/u);
    if (m) return { name: str(m[3]), quantity: num(m[1], 1) || 1, unit: str(m[2], 20), estimatedCalories: 0 };
    return { name: str(ing), quantity: 1, unit: '', estimatedCalories: 0 };
  }
  if (ing && typeof ing === 'object') {
    const o = ing as Record<string, unknown>;
    return {
      name: str(o.name ?? o.ingredient ?? o.item ?? o.food),
      quantity: num(o.quantity ?? o.amount ?? o.qty, 1) || 1,
      unit: str(o.unit ?? o.units ?? o.measure ?? '', 20),
      estimatedCalories: Math.max(0, num(o.estimatedCalories ?? o.calories ?? o.kcal ?? o.cal, 0)),
    };
  }
  return ing;
}
function coerceStep(s: unknown): string {
  if (typeof s === 'string') return s.slice(0, 300);
  if (s && typeof s === 'object') {
    const o = s as Record<string, unknown>;
    return str(o.step ?? o.text ?? o.instruction ?? o.description ?? o.details ?? '', 300);
  }
  return str(s, 300);
}
function coerceSubstitution(s: unknown): { original: string; replacement: string; reason: string } | null {
  if (s && typeof s === 'object') {
    const o = s as Record<string, unknown>;
    const replacement = str(o.replacement ?? o.replace ?? o.substitute ?? o.with ?? o.alternative);
    if (!replacement) return null;
    return { original: str(o.original ?? o.from ?? o.ingredient ?? ''), replacement, reason: str(o.reason ?? o.note ?? '', 300) };
  }
  return null; // strings / malformed → dropped
}
export function normalizeRecipePayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const value = raw as Record<string, unknown>;
  const numberAliases = (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const item = input as Record<string, unknown>;
    return { ...item, calories: item.calories ?? item.calorieTarget ?? item.kcal ?? 0, proteinGrams: item.proteinGrams ?? item.protein ?? 0, carbohydrateGrams: item.carbohydrateGrams ?? item.carbsGrams ?? item.carbs ?? 0, fatGrams: item.fatGrams ?? item.fat ?? 0, fiberGrams: item.fiberGrams ?? item.fibreGrams ?? item.fibre ?? 0 };
  };
  const meals = Array.isArray(value.meals) ? value.meals.map((meal) => {
    if (!meal || typeof meal !== 'object') return meal;
    const item = meal as Record<string, unknown>;
    const ingredients = Array.isArray(item.ingredients) ? item.ingredients.map(coerceIngredient) : [];
    const est = Math.max(0, num(item.estimatedCalories ?? item.calories ?? item.targetCalories, 0)) ||
      (ingredients as Array<Record<string, unknown>>).reduce((s, i) => s + num(i?.estimatedCalories, 0), 0);
    const mealType = str(item.mealType ?? item.type ?? '', 20).toUpperCase();
    return {
      ...item,
      mealType,
      title: str(item.title ?? item.name ?? item.recipeName ?? item.recipe) || 'Suggested meal',
      description: str(item.description ?? item.summary ?? '', 400),
      targetCalories: Math.max(1, num(item.targetCalories ?? est, 1)),
      estimatedCalories: Math.max(1, est || 1),
      macros: numberAliases(item.macros),
      servings: num(item.servings, 1) || 1,
      preparationTimeMinutes: Math.max(0, num(item.preparationTimeMinutes ?? item.prepTime ?? item.minutes ?? item.timeMinutes, 20)),
      difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(str(item.difficulty, 10).toUpperCase()) ? str(item.difficulty, 10).toUpperCase() : 'EASY',
      allergenWarnings: Array.isArray(item.allergenWarnings) ? item.allergenWarnings.map((a) => str(a, 160)) : [],
      substitutions: Array.isArray(item.substitutions) ? item.substitutions.map(coerceSubstitution).filter((x): x is { original: string; replacement: string; reason: string } => x !== null) : [],
      ingredients,
      steps: Array.isArray(item.steps) ? item.steps.map(coerceStep).filter((s) => s.length > 0) : typeof item.steps === 'string' ? [item.steps.slice(0, 300)] : [],
    };
  }) : value.meals;
  return { ...value, dailyTarget: numberAliases(value.dailyTarget), remainingTarget: numberAliases(value.remainingTarget), estimatedDailyTotal: numberAliases(value.estimatedDailyTotal ?? value.remainingTarget), meals };
}
function validatePlan(plan: RecipePlan, forbidden: string[], budget: number) {
  const text = JSON.stringify(plan).toLowerCase();
  for (const word of forbidden) if (word.trim() && text.includes(word.toLowerCase())) throw new ApiError('BAD_REQUEST', 'The generated plan conflicts with your food restrictions.');
  for (const meal of plan.meals) { const ingredientSum = meal.ingredients.reduce((s, i) => s + i.estimatedCalories, 0); if (Math.abs(ingredientSum - meal.estimatedCalories) > Math.max(150, meal.estimatedCalories * 0.45)) throw new ApiError('BAD_REQUEST', 'The generated nutrition totals were inconsistent.'); }
  if (plan.meals.reduce((s, m) => s + m.estimatedCalories, 0) > budget * 1.15 + 100) throw new ApiError('BAD_REQUEST', 'The generated plan exceeds the remaining calorie budget.');
}

function fallbackPlan(date: string, goal: { calorieTarget: number | null; proteinGrams: number | null; carbohydrateGrams: number | null; fatGrams: number | null; fiberGrams: number | null }, remaining: RecipePlan['remainingTarget'], targets: ReturnType<typeof allocateMealTargets>): RecipePlan {
  const meals = targets.map((target) => {
    const calories = Math.max(1, target.calories);
    const recipes = {
      BREAKFAST: { title: 'Greek yogurt oat bowl with banana', description: 'Creamy Greek yogurt with oats, banana, berries and peanut butter.', ingredients: [['Greek yogurt 2%', 250, 'g', 180], ['rolled oats', 60, 'g', 228], ['banana', 120, 'g', 107], ['berries', 100, 'g', 50], ['peanut butter', 25, 'g', 147], ['honey', 10, 'g', 30]], steps: ['Add the yogurt and oats to a bowl and stir.', 'Slice the banana and add it with the berries.', 'Top with peanut butter and honey, then serve.'], minutes: 8 },
      LUNCH: { title: 'Chicken rice bowl with roasted vegetables', description: 'Seasoned chicken breast with rice, vegetables and olive oil.', ingredients: [['chicken breast', 220, 'g', 363], ['cooked rice', 300, 'g', 390], ['mixed vegetables', 250, 'g', 125], ['olive oil', 20, 'g', 180], ['feta cheese', 40, 'g', 106]], steps: ['Season the chicken and cook it until fully done, then slice.', 'Warm the rice and roast or saute the vegetables until tender.', 'Assemble the bowl, add feta and drizzle with olive oil.'], minutes: 30 },
      DINNER: { title: 'Salmon with potatoes and garden salad', description: 'Oven-baked salmon with potatoes, salad and a lemon olive-oil dressing.', ingredients: [['salmon fillet', 180, 'g', 374], ['potatoes', 350, 'g', 270], ['mixed salad', 180, 'g', 45], ['olive oil', 25, 'g', 225], ['lemon', 30, 'g', 8], ['herbs and spices', 1, 'serving', 20]], steps: ['Season the salmon and bake at 200°C until it flakes easily.', 'Cut the potatoes and roast until golden and tender.', 'Toss the salad with lemon and olive oil, then serve everything together.'], minutes: 35 },
    } as const;
    const recipe = recipes[target.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER'] ?? recipes.LUNCH;
    const baseCalories = recipe.ingredients.reduce((sum, item) => sum + item[3], 0);
    const scale = calories / baseCalories;
    const ingredients = recipe.ingredients.map((item, index) => ({ name: item[0], quantity: Math.max(1, Math.round(item[1] * scale)), unit: item[2], estimatedCalories: index === recipe.ingredients.length - 1 ? Math.max(0, calories - recipe.ingredients.slice(0, -1).reduce((sum, part) => sum + Math.round(part[3] * scale), 0)) : Math.round(item[3] * scale) }));
    return { mealType: target.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER', title: recipe.title, description: recipe.description, targetCalories: calories, estimatedCalories: calories, macros: { proteinGrams: target.proteinGrams, carbohydrateGrams: target.carbohydrateGrams, fatGrams: target.fatGrams, fiberGrams: target.fiberGrams }, servings: 1, preparationTimeMinutes: recipe.minutes, difficulty: 'EASY' as const, ingredients, steps: [...recipe.steps], allergenWarnings: [], substitutions: [] };
  });
  return { date, dailyTarget: { calories: Number(goal.calorieTarget ?? 0), proteinGrams: Number(goal.proteinGrams ?? 0), carbohydrateGrams: Number(goal.carbohydrateGrams ?? 0), fatGrams: Number(goal.fatGrams ?? 0), fiberGrams: Number(goal.fiberGrams ?? 0) }, remainingTarget: remaining, meals, estimatedDailyTotal: remaining };
}

export async function getRecipePreference(userId: string) { return prisma.recipePreference.upsert({ where: { userId }, create: { userId }, update: {} }); }

export async function saveRecipePreference(userId: string, data: Record<string, unknown>) {
  const current = await getRecipePreference(userId); const next = { ...current, ...data };
  const distribution = [Number(next.breakfastPercent), Number(next.lunchPercent), Number(next.dinnerPercent)];
  if (distribution.some((v) => !Number.isInteger(v) || v < 0) || distribution.reduce((a, b) => a + b, 0) !== 100) throw new ApiError('VALIDATION_ERROR', 'Meal distribution must total 100%.');
  return prisma.recipePreference.update({ where: { userId }, data: { mealsPerDay: Number(next.mealsPerDay), breakfastPercent: distribution[0], lunchPercent: distribution[1], dinnerPercent: distribution[2], maxPrepMinutes: Number(next.maxPrepMinutes), difficulty: String(next.difficulty), highProtein: Boolean(next.highProtein), lowPreparation: Boolean(next.lowPreparation), cuisines: next.cuisines as Prisma.InputJsonValue, likedFoods: next.likedFoods as Prisma.InputJsonValue, dislikedFoods: next.dislikedFoods as Prisma.InputJsonValue, allergies: next.allergies as Prisma.InputJsonValue, intolerances: next.intolerances as Prisma.InputJsonValue, equipment: next.equipment as Prisma.InputJsonValue, version: { increment: 1 } } });
}

/**
 * Μεταβλητότητα στη δημιουργία συνταγών. Το prompt είναι ντετερμινιστικό (ίδια
 * υπόλοιπα/προτιμήσεις → ίδιο input), οπότε χωρίς αυτό το μοντέλο επέστρεφε
 * πάντα τις ίδιες συνταγές. Δύο ρόλοι:
 *  1) `token` (μόνο σε force) μπαίνει στο fingerprint ώστε κάθε «νέα πρόταση» να
 *     είναι ξεχωριστή εγγραφή — αλλιώς το create έσκαγε σε unique constraint
 *     (userId, planDate, requestFingerprint) και δεν αποθηκευόταν ποτέ νέο plan.
 *  2) `promptSuffix` λέει στο μοντέλο να αποφύγει πρόσφατες συνταγές και δίνει
 *     τυχαίο token, ώστε η έξοδος να διαφέρει.
 */
export function recipeVariation(
  force: boolean,
  recentTitles: string[],
  rng: () => string = () => randomBytes(6).toString('hex'),
): { token: string; avoid: string[]; promptSuffix: string } {
  const token = force ? rng() : '';
  const avoid = [...new Set(recentTitles.filter((t) => t && t.trim()))].slice(0, 15);
  const avoidText = avoid.length
    ? ` Avoid repeating these recently suggested dishes; propose clearly different meals: ${JSON.stringify(avoid)}.`
    : '';
  const tokenText = force ? ` Variation token (produce a fresh, distinct plan for this token): ${token}.` : '';
  return { token, avoid, promptSuffix: `${avoidText}${tokenText}` };
}

export async function generateDailyRecipePlan(userId: string, date: string, force = false) {
  if (!env.DAILY_RECIPE_PLAN) throw new ApiError('NOT_FOUND', 'Daily recipe plans are disabled.');
  const timezone = await getUserTimezone(userId); const goal = await getGoalForDay(userId, date); const pref = await getRecipePreference(userId); const pantry = await prisma.pantryItem.findMany({ where: { userId }, select: { name: true, quantity: true, expiresAt: true }, take: 100 });
  const range = zonedDayRangeUtc(date, timezone); const meals = await prisma.meal.findMany({ where: { userId, status: 'CONFIRMED', mealDateTime: { gte: range.start, lt: range.end } }, select: { mealType: true, finalCalories: true, proteinGrams: true, carbohydrateGrams: true, fatGrams: true, fiberGrams: true } });
  const consumed = meals.reduce((s, m) => s + (m.finalCalories ?? 0), 0); const sum = (key: 'proteinGrams'|'carbohydrateGrams'|'fatGrams'|'fiberGrams') => meals.reduce((s, m) => s + (m[key]?.toNumber() ?? 0), 0);
  const remaining = { calories: Math.max(0, (goal.calorieTarget ?? 0) - consumed), proteinGrams: Math.max(0, (goal.proteinGrams ?? 0) - sum('proteinGrams')), carbohydrateGrams: Math.max(0, (goal.carbohydrateGrams ?? 0) - sum('carbohydrateGrams')), fatGrams: Math.max(0, (goal.fatGrams ?? 0) - sum('fatGrams')), fiberGrams: Math.max(0, (goal.fiberGrams ?? 0) - sum('fiberGrams')) };
  const remainingTypes = (['BREAKFAST','LUNCH','DINNER'] as MealType[]).filter((type) => !meals.some((m) => m.mealType === type)); if (!remainingTypes.length && !force) throw new ApiError('BAD_REQUEST', 'All three main meals are already logged.');
  const types = remainingTypes.length ? remainingTypes : (['BREAKFAST','LUNCH','DINNER'] as MealType[]); const targets = allocateMealTargets({ calories: goal.calorieTarget ?? 0, proteinGrams: goal.proteinGrams, carbohydrateGrams: goal.carbohydrateGrams, fatGrams: goal.fatGrams, fiberGrams: goal.fiberGrams }, remaining, types, { BREAKFAST: pref.breakfastPercent, LUNCH: pref.lunchPercent, DINNER: pref.dinnerPercent });
  // Μεταβλητότητα: σε «νέα πρόταση» (force) φέρνουμε πρόσφατους τίτλους ώστε το
  // μοντέλο να τους αποφύγει, και προσθέτουμε τυχαίο token στο fingerprint ώστε
  // κάθε regeneration να είναι ξεχωριστή εγγραφή (χωρίς unique-constraint σύγκρουση).
  const recentTitles = force
    ? (
        await prisma.aiMealPlan.findMany({
          where: { userId, planDate: new Date(`${date}T00:00:00.000Z`) },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { recipes: { select: { title: true } } },
        })
      ).flatMap((p) => p.recipes.map((r) => r.title))
    : [];
  const variation = recipeVariation(force, recentTitles);
  const baseFingerprint = { date, remaining, types, prefVersion: pref.version, meals: meals.map((m) => [m.mealType, m.finalCalories]) };
  const fingerprint = createHash('sha256').update(JSON.stringify(force ? { ...baseFingerprint, token: variation.token } : baseFingerprint)).digest('hex');
  if (!force) { const cached = await prisma.aiMealPlan.findUnique({ where: { userId_planDate_requestFingerprint: { userId, planDate: new Date(`${date}T00:00:00.000Z`), requestFingerprint: fingerprint } }, include: { recipes: true } }); if (cached?.status === 'READY') return cached.payload as unknown as RecipePlan; }
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const generatedToday = await prisma.aiMealPlan.count({ where: { userId, createdAt: { gte: todayStart } } });
  if (generatedToday >= env.MAX_DAILY_RECIPE_PLANS) throw new ApiError('RATE_LIMITED', 'You have reached the daily recipe generation limit.');
  await assertAiRateLimit(userId); const provider = getVisionProvider(); if (!provider.generateText) throw new ApiError('AI_UNAVAILABLE', 'Recipe generation is unavailable for this AI provider.');
  const outputTemplate = { date, dailyTarget: { calories: Number(goal.calorieTarget ?? 0), proteinGrams: Number(goal.proteinGrams ?? 0), carbohydrateGrams: Number(goal.carbohydrateGrams ?? 0), fatGrams: Number(goal.fatGrams ?? 0), fiberGrams: Number(goal.fiberGrams ?? 0) }, remainingTarget: remaining, meals: targets.map((target) => ({ mealType: target.mealType, title: 'string', description: 'string', targetCalories: target.calories, estimatedCalories: target.calories, macros: { proteinGrams: target.proteinGrams, carbohydrateGrams: target.carbohydrateGrams, fatGrams: target.fatGrams, fiberGrams: target.fiberGrams }, servings: 1, preparationTimeMinutes: 20, difficulty: 'EASY', ingredients: [{ name: 'string', quantity: 1, unit: 'g', estimatedCalories: target.calories }], steps: ['string'], allergenWarnings: [], substitutions: [] })), estimatedDailyTotal: remaining };
  const prompt = `Generate one JSON object only for a daily recipe plan. Do not use markdown or explanatory text. Date: ${date}. Remaining targets: ${JSON.stringify(remaining)}. Meal targets: ${JSON.stringify(targets)}. Preferences: ${JSON.stringify({ cuisines: safeWords(pref.cuisines), likedFoods: safeWords(pref.likedFoods), dislikedFoods: safeWords(pref.dislikedFoods), allergies: safeWords(pref.allergies), intolerances: safeWords(pref.intolerances), maxPrepMinutes: pref.maxPrepMinutes, difficulty: pref.difficulty, highProtein: pref.highProtein, equipment: safeWords(pref.equipment) })}. Pantry (do not use expired items): ${JSON.stringify(pantry)}. Use only these meal types: ${types.join(',')}. Every key shown below is required; replace example strings/numbers with real values and keep the same key names and nesting. Keep each meal to 4-8 ingredients and 3-6 steps so the response is complete. JSON template: ${JSON.stringify(outputTemplate)}.${variation.promptSuffix}`;
  const system = 'You are NutreLuma recipe planner. Return valid JSON only, no markdown. Never claim allergen-free. Never use declared allergies/disliked foods. Do not diagnose or suggest extreme restriction, unsafe raw foods, or dangerous cooking. Use realistic quantities and make ingredient calories approximately sum to recipe calories.';
  const started = Date.now(); let response; try { response = await provider.generateText({ systemPrompt: system, userPrompt: prompt, timeoutMs: env.AI_TIMEOUT_MS }); } catch { await prisma.aiUsageLog.create({ data: { userId, provider: provider.name, model: env.AI_MODEL, status: 'PROVIDER_ERROR', durationMs: Date.now() - started } }); throw new ApiError('AI_UNAVAILABLE', 'Recipe suggestions are unavailable right now.'); }
  let raw: unknown; try { raw = parseJsonResponse(response.text); } catch { throw new ApiError('BAD_REQUEST', 'The AI response was not valid.'); }
  const parsed = recipeSchema.safeParse(normalizeRecipePayload(raw));
  if (!parsed.success) {
    console.error('recipe_plan_validation_failed', { provider: provider.name, issues: JSON.stringify(parsed.error.issues.slice(0, 12).map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message }))) });
    console.error('recipe_plan_raw_sample', JSON.stringify(normalizeRecipePayload(raw)).slice(0, 1500));
    const fallback = fallbackPlan(date, goal, remaining, targets);
    await prisma.aiUsageLog.create({ data: { userId, provider: provider.name, model: response.model, status: 'INVALID_RESPONSE', durationMs: Date.now() - started, requestId: response.requestId } });
    return fallback;
  }
  validatePlan(parsed.data, [...safeWords(pref.allergies), ...safeWords(pref.intolerances), ...safeWords(pref.dislikedFoods)], remaining.calories);
  await prisma.aiUsageLog.create({ data: { userId, provider: provider.name, model: response.model, status: 'SUCCESS', durationMs: Date.now() - started, requestId: response.requestId } });
  const plan = await prisma.aiMealPlan.create({ data: { userId, planDate: new Date(`${date}T00:00:00.000Z`), status: 'READY', requestFingerprint: fingerprint, payload: parsed.data as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86400000), recipes: { create: parsed.data.meals.map((meal) => ({ mealType: meal.mealType, title: meal.title, payload: meal as unknown as Prisma.InputJsonValue })) } }, include: { recipes: true } });
  return plan.payload as unknown as RecipePlan;
}

export async function getCurrentRecipePlan(userId: string, date: string) {
  const plan = await prisma.aiMealPlan.findFirst({ where: { userId, planDate: new Date(`${date}T00:00:00.000Z`), status: 'READY', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  return plan ? (plan.payload as unknown as RecipePlan) : null;
}
