import 'server-only';
import {
  Prisma,
  type AnalysisStatus,
  type MealSource,
  type MealStatus,
  type MealType,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { analyzeMealImage, refineMealAnalysis } from '../ai';
import type { NormalizedAnalysis } from '../ai/schema';
import { processMealImage } from '../images';
import { buildMealImageKey, getStorage } from '../storage';
import { assertAiRateLimit, assertUploadRateLimit } from '../auth/rate-limit';
import { isAboveSoftLimit, normalizeCalories } from '@/lib/calories';
import { computeMealFingerprint } from '@/lib/meal-fingerprint';
import { localDateTimeToUtc, zonedDayRangeUtc } from '@/lib/dates';
import { recordMealCorrection } from './personal-intelligence';
import type {
  ClarificationAnswersInput,
  CreateMealInput,
  MacroFieldsInput,
  ManualMealInput,
  UpdateMealInput,
} from '@/lib/validation/meal';

/** Μόνο τα CONFIRMED μετρούν σε σύνολα, στατιστικά και αναφορές. */
export const COUNTED_MEAL_STATUS: MealStatus = 'CONFIRMED';

/** Καταστάσεις που περιμένουν ενέργεια του χρήστη. */
export const DRAFT_STATUSES: MealStatus[] = ['PENDING', 'ANALYZING', 'REVIEW_REQUIRED'];

export interface MacroView {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

export interface MealItemView {
  id: string;
  name: string;
  estimatedQuantity: string | null;
  aiEstimatedCalories: number | null;
  finalCalories: number | null;
  aiMinCalories: number | null;
  aiMaxCalories: number | null;
  macros: MacroView;
}

export interface ClarificationView {
  id: string;
  questionId: string;
  question: string;
  options: string[];
  answer: string | null;
  answeredAt: string | null;
}

export interface MealView {
  id: string;
  mealType: MealType;
  title: string | null;
  notes: string | null;
  mealDateTime: string;
  createdAt: string;
  updatedAt: string;
  status: MealStatus;
  source: MealSource;
  confirmedAt: string | null;
  countsTowardTotals: boolean;
  analysisStatus: AnalysisStatus;
  aiEstimatedCalories: number | null;
  finalCalories: number | null;
  aiMinCalories: number | null;
  aiMaxCalories: number | null;
  aiConfidence: number | null;
  aiModel: string | null;
  aiProvider: string | null;
  aiAnalyzedAt: string | null;
  aiErrorCode: string | null;
  wasManuallyEdited: boolean;
  hasImage: boolean;
  imageUrl: string | null;
  thumbUrl: string | null;
  macros: MacroView;
  items: MealItemView[];
  clarifications: ClarificationView[];
  pendingClarifications: number;
}

const MACRO_COLUMNS = {
  proteinGrams: true,
  carbohydrateGrams: true,
  fatGrams: true,
  fiberGrams: true,
  sugarGrams: true,
  saturatedFatGrams: true,
  sodiumMg: true,
} as const;

export const MEAL_SELECT = {
  id: true,
  mealType: true,
  title: true,
  notes: true,
  mealDateTime: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  source: true,
  confirmedAt: true,
  analysisStatus: true,
  aiEstimatedCalories: true,
  finalCalories: true,
  aiMinCalories: true,
  aiMaxCalories: true,
  aiConfidence: true,
  aiModel: true,
  aiProvider: true,
  aiAnalyzedAt: true,
  aiErrorCode: true,
  wasManuallyEdited: true,
  imagePath: true,
  thumbPath: true,
  ...MACRO_COLUMNS,
  items: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      estimatedQuantity: true,
      aiEstimatedCalories: true,
      finalCalories: true,
      aiMinCalories: true,
      aiMaxCalories: true,
      ...MACRO_COLUMNS,
    },
  },
  clarifications: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      questionId: true,
      question: true,
      options: true,
      answer: true,
      answeredAt: true,
    },
  },
} satisfies Prisma.MealSelect;

type MealRow = Prisma.MealGetPayload<{ select: typeof MEAL_SELECT }>;

/** Prisma Decimal -> number. `null` σημαίνει «άγνωστο», ποτέ 0. */
function decToNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

interface MacroRow {
  proteinGrams: Prisma.Decimal | null;
  carbohydrateGrams: Prisma.Decimal | null;
  fatGrams: Prisma.Decimal | null;
  fiberGrams: Prisma.Decimal | null;
  sugarGrams: Prisma.Decimal | null;
  saturatedFatGrams: Prisma.Decimal | null;
  sodiumMg: number | null;
}

function toMacroView(row: MacroRow): MacroView {
  return {
    proteinGrams: decToNum(row.proteinGrams),
    carbohydrateGrams: decToNum(row.carbohydrateGrams),
    fatGrams: decToNum(row.fatGrams),
    fiberGrams: decToNum(row.fiberGrams),
    sugarGrams: decToNum(row.sugarGrams),
    saturatedFatGrams: decToNum(row.saturatedFatGrams),
    sodiumMg: row.sodiumMg,
  };
}

/** Επιλογές ερώτησης: αποθηκεύονται ως JSON, επιστρέφονται πάντα ως string[]. */
function toOptions(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string').slice(0, 8);
}

/** Το `aiRawResponse` δεν εκτίθεται ΠΟΤΕ σε αυτή τη μορφή. */
export function toMealView(meal: MealRow): MealView {
  const clarifications = meal.clarifications.map((c) => ({
    id: c.id,
    questionId: c.questionId,
    question: c.question,
    options: toOptions(c.options),
    answer: c.answer,
    answeredAt: c.answeredAt ? c.answeredAt.toISOString() : null,
  }));

  return {
    id: meal.id,
    mealType: meal.mealType,
    title: meal.title,
    notes: meal.notes,
    mealDateTime: meal.mealDateTime.toISOString(),
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
    status: meal.status,
    source: meal.source,
    confirmedAt: meal.confirmedAt ? meal.confirmedAt.toISOString() : null,
    countsTowardTotals: meal.status === COUNTED_MEAL_STATUS,
    analysisStatus: meal.analysisStatus,
    aiEstimatedCalories: meal.aiEstimatedCalories,
    finalCalories: meal.finalCalories,
    aiMinCalories: meal.aiMinCalories,
    aiMaxCalories: meal.aiMaxCalories,
    aiConfidence: meal.aiConfidence,
    aiModel: meal.aiModel,
    aiProvider: meal.aiProvider,
    aiAnalyzedAt: meal.aiAnalyzedAt ? meal.aiAnalyzedAt.toISOString() : null,
    aiErrorCode: meal.aiErrorCode,
    wasManuallyEdited: meal.wasManuallyEdited,
    hasImage: Boolean(meal.imagePath),
    imageUrl: meal.imagePath ? `/api/meals/${meal.id}/image` : null,
    thumbUrl: meal.thumbPath ? `/api/meals/${meal.id}/image?variant=thumb` : null,
    macros: toMacroView(meal),
    items: meal.items.map((item) => ({
      id: item.id,
      name: item.name,
      estimatedQuantity: item.estimatedQuantity,
      aiEstimatedCalories: item.aiEstimatedCalories,
      finalCalories: item.finalCalories,
      aiMinCalories: item.aiMinCalories,
      aiMaxCalories: item.aiMaxCalories,
      macros: toMacroView(item),
    })),
    clarifications,
    pendingClarifications: clarifications.filter((c) => c.answer === null).length,
  };
}

/** Fingerprint από την τρέχουσα σύνθεση ενός γεύματος (title/type/items/total). */
function deriveFingerprint(params: {
  title: string | null;
  mealType: MealType;
  finalCalories: number | null;
  items: Array<{ name: string; finalCalories: number | null }>;
}): string {
  return computeMealFingerprint({
    title: params.title,
    mealType: params.mealType,
    totalCalories: params.finalCalories,
    items: params.items.map((i) => ({ name: i.name, calories: i.finalCalories })),
  });
}

/** Κάθε ανάγνωση γεύματος περνά από εδώ: userId στο where = anti-IDOR. */
export async function getMealForUser(userId: string, mealId: string): Promise<MealView> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: MEAL_SELECT,
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  return toMealView(meal);
}

export async function getMealImage(
  userId: string,
  mealId: string,
  variant: 'full' | 'thumb',
): Promise<{ body: Buffer; contentType: string }> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { imagePath: true, thumbPath: true },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');

  const key = variant === 'thumb' ? (meal.thumbPath ?? meal.imagePath) : meal.imagePath;
  if (!key) throw new ApiError('NOT_FOUND', 'Δεν υπάρχει φωτογραφία για αυτό το γεύμα.');

  try {
    const body = await getStorage().get(key);
    return { body, contentType: 'image/webp' };
  } catch {
    throw new ApiError('NOT_FOUND', 'Η φωτογραφία δεν βρέθηκε.');
  }
}

/**
 * Γεύματα ημέρας. Από προεπιλογή ΜΟΝΟ τα επιβεβαιωμένα, ώστε καμία κλήση να
 * μη μετρήσει κατά λάθος draft στα σύνολα. Τα drafts ζητούνται ρητά.
 */
export async function listMealsForDay(
  userId: string,
  dayISO: string,
  timezone: string,
  options: { statuses?: MealStatus[] } = {},
): Promise<MealView[]> {
  const { start, end } = zonedDayRangeUtc(dayISO, timezone);
  const meals = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      status: { in: options.statuses ?? [COUNTED_MEAL_STATUS] },
    },
    orderBy: { mealDateTime: 'asc' },
    select: MEAL_SELECT,
  });
  return meals.map(toMealView);
}

/** Drafts που περιμένουν την επιβεβαίωση του χρήστη, ανεξάρτητα από ημέρα. */
export async function listPendingDrafts(userId: string, limit = 10): Promise<MealView[]> {
  const meals = await prisma.meal.findMany({
    where: { userId, status: { in: DRAFT_STATUSES } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: MEAL_SELECT,
  });
  return meals.map(toMealView);
}

export interface HistoryQuery {
  from?: string;
  to?: string;
  mealType?: MealType;
  search?: string;
  minCalories?: number;
  maxCalories?: number;
  page: number;
  pageSize: number;
}

export async function listMealHistory(
  userId: string,
  query: HistoryQuery,
  timezone: string,
): Promise<{ meals: MealView[]; total: number; page: number; pageSize: number }> {
  // Το ιστορικό δείχνει ό,τι υπάρχει εκτός από τα ακυρωμένα — ο χρήστης πρέπει
  // να βλέπει και τα drafts του για να τα τακτοποιήσει.
  const where: Prisma.MealWhereInput = { userId, status: { not: 'CANCELLED' } };

  if (query.from || query.to) {
    const range: Prisma.DateTimeFilter = {};
    if (query.from) range.gte = zonedDayRangeUtc(query.from, timezone).start;
    if (query.to) range.lt = zonedDayRangeUtc(query.to, timezone).end;
    where.mealDateTime = range;
  }
  if (query.mealType) where.mealType = query.mealType;
  if (query.minCalories !== undefined || query.maxCalories !== undefined) {
    const range: Prisma.IntNullableFilter = {};
    if (query.minCalories !== undefined) range.gte = query.minCalories;
    if (query.maxCalories !== undefined) range.lte = query.maxCalories;
    where.finalCalories = range;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
      { items: { some: { name: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }

  const [total, meals] = await prisma.$transaction([
    prisma.meal.count({ where }),
    prisma.meal.findMany({
      where,
      orderBy: { mealDateTime: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: MEAL_SELECT,
    }),
  ]);

  return { meals: meals.map(toMealView), total, page: query.page, pageSize: query.pageSize };
}

export interface CreateMealResult {
  meal: MealView;
  duplicated: boolean;
}

/**
 * Πλήρης ροή: validation εικόνας -> αποθήκευση -> Meal(ANALYZING) -> AI ->
 * REVIEW_REQUIRED/FAILED. Το γεύμα ΔΕΝ μετρά στα σύνολα μέχρι να το
 * επιβεβαιώσει ο χρήστης.
 *
 * Η `runAnalysis` είναι απομονωμένη ώστε να μπορεί αργότερα να κληθεί από
 * queue worker χωρίς αλλαγές στο υπόλοιπο API.
 */
export async function createMealWithAnalysis(params: {
  userId: string;
  file: Buffer;
  input: CreateMealInput;
  timezone: string;
}): Promise<CreateMealResult> {
  const { userId, file, input, timezone } = params;

  // Idempotency: το ίδιο requestKey δεν δημιουργεί δεύτερη εγγραφή.
  if (input.requestKey) {
    const existing = await prisma.meal.findFirst({
      where: { userId, requestKey: input.requestKey },
      select: MEAL_SELECT,
    });
    if (existing) return { meal: toMealView(existing), duplicated: true };
  }

  await assertUploadRateLimit(userId);
  await assertAiRateLimit(userId);

  const processed = await processMealImage(file);
  const storage = getStorage();
  const imageKey = buildMealImageKey(userId, processed.contentType, 'full');
  const thumbKey = buildMealImageKey(userId, processed.contentType, 'thumb');

  await storage.put(imageKey, processed.full, processed.contentType);
  await storage.put(thumbKey, processed.thumb, processed.contentType);

  let mealId: string;
  try {
    const created = await prisma.meal.create({
      data: {
        userId,
        mealType: input.mealType,
        title: input.title || null,
        notes: input.notes || null,
        mealDateTime: localDateTimeToUtc(input.mealDateTime, timezone),
        imagePath: imageKey,
        thumbPath: thumbKey,
        imageMimeType: processed.contentType,
        analysisStatus: 'PENDING',
        status: 'ANALYZING',
        source: 'AI_IMAGE',
        requestKey: input.requestKey ?? null,
      },
      select: { id: true },
    });
    mealId = created.id;
  } catch (error) {
    // Καθάρισμα των αρχείων αν η εγγραφή απέτυχε (π.χ. race στο requestKey).
    await storage.delete(imageKey);
    await storage.delete(thumbKey);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.meal.findFirst({
        where: { userId, requestKey: input.requestKey ?? '' },
        select: MEAL_SELECT,
      });
      if (existing) return { meal: toMealView(existing), duplicated: true };
    }
    throw error;
  }

  await runAnalysis({ userId, mealId, imageBuffer: processed.full, notes: input.notes ?? null });
  return { meal: await getMealForUser(userId, mealId), duplicated: false };
}

/** Κοινό γράψιμο αποτελέσματος ανάλυσης — αρχικής ή refinement. */
async function persistAnalysis(params: {
  userId: string;
  mealId: string;
  analysis: NormalizedAnalysis;
  model: string;
  provider: string;
  requestId: string | null;
  durationMs: number;
  writeClarifications: boolean;
}): Promise<void> {
  const { userId, mealId, analysis, writeClarifications } = params;
  const analyzedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.mealItem.deleteMany({ where: { mealId } });

    await tx.meal.update({
      where: { id: mealId },
      data: {
        analysisStatus: 'COMPLETED',
        status: 'REVIEW_REQUIRED',
        aiEstimatedCalories: analysis.totalCalories,
        // Ο χρήστης δεν έχει διορθώσει ακόμη: final == AI εκτίμηση.
        finalCalories: analysis.totalCalories,
        aiMinCalories: analysis.minCalories,
        aiMaxCalories: analysis.maxCalories,
        aiConfidence: analysis.confidence,
        aiModel: params.model,
        aiProvider: params.provider,
        aiAnalyzedAt: analyzedAt,
        aiErrorCode: null,
        proteinGrams: analysis.macros.proteinGrams,
        carbohydrateGrams: analysis.macros.carbohydrateGrams,
        fatGrams: analysis.macros.fatGrams,
        fiberGrams: analysis.macros.fiberGrams,
        sugarGrams: analysis.macros.sugarGrams,
        saturatedFatGrams: analysis.macros.saturatedFatGrams,
        sodiumMg: analysis.macros.sodiumMg,
        // Αποθηκεύουμε μόνο δομημένο, σύντομο summary — όχι chain-of-thought.
        aiRawResponse: {
          totalCalories: analysis.totalCalories,
          minCalories: analysis.minCalories,
          maxCalories: analysis.maxCalories,
          confidence: analysis.confidence,
          macros: analysis.macros,
          items: analysis.items,
          summary: analysis.internalReasoningSummary,
        } as unknown as Prisma.InputJsonValue,
        items: {
          create: analysis.items.map((item, index) => ({
            name: item.name,
            estimatedQuantity: item.estimatedQuantity || null,
            aiEstimatedCalories: item.estimatedCalories,
            finalCalories: item.estimatedCalories,
            aiMinCalories: item.minCalories,
            aiMaxCalories: item.maxCalories,
            proteinGrams: item.macros.proteinGrams,
            carbohydrateGrams: item.macros.carbohydrateGrams,
            fatGrams: item.macros.fatGrams,
            fiberGrams: item.macros.fiberGrams,
            sugarGrams: item.macros.sugarGrams,
            saturatedFatGrams: item.macros.saturatedFatGrams,
            sodiumMg: item.macros.sodiumMg,
            sortOrder: index,
          })),
        },
      },
    });

    if (writeClarifications) {
      await tx.mealClarification.deleteMany({ where: { mealId } });
      if (analysis.clarifications.length > 0) {
        await tx.mealClarification.createMany({
          data: analysis.clarifications.map((c, index) => ({
            mealId,
            questionId: c.id,
            question: c.question,
            options: c.options as Prisma.InputJsonValue,
            sortOrder: index,
          })),
        });
      }
    }

    await tx.aiUsageLog.create({
      data: {
        userId,
        mealId,
        provider: params.provider,
        model: params.model,
        status: 'SUCCESS',
        durationMs: params.durationMs,
        requestId: params.requestId,
      },
    });
  });
}

/**
 * Εκτελεί την ανάλυση για υπάρχον Meal και γράφει το αποτέλεσμα.
 * Ποτέ δεν αφήνει το γεύμα με λανθασμένη τιμή: σε αποτυχία -> FAILED χωρίς θερμίδες.
 */
export async function runAnalysis(params: {
  userId: string;
  mealId: string;
  imageBuffer: Buffer;
  notes: string | null;
}): Promise<void> {
  const { userId, mealId, imageBuffer, notes } = params;

  const outcome = await analyzeMealImage({
    imageBuffer,
    mimeType: 'image/webp',
    userNote: notes,
  });

  if (outcome.status === 'SUCCESS') {
    await persistAnalysis({
      userId,
      mealId,
      analysis: outcome.analysis,
      model: outcome.model,
      provider: outcome.provider,
      requestId: outcome.requestId,
      durationMs: outcome.durationMs,
      writeClarifications: true,
    });
    logger.info('meal_analysis_completed', { mealId, durationMs: outcome.durationMs });
    return;
  }

  const errorCode =
    outcome.status === 'NO_FOOD_DETECTED'
      ? 'NO_FOOD_DETECTED'
      : outcome.status === 'INVALID_RESPONSE'
        ? 'INVALID_RESPONSE'
        : outcome.status === 'TIMEOUT'
          ? 'TIMEOUT'
          : 'PROVIDER_ERROR';

  await prisma.$transaction(async (tx) => {
    await tx.meal.update({
      where: { id: mealId },
      data: {
        analysisStatus: 'FAILED',
        status: 'FAILED',
        aiErrorCode: errorCode,
        aiModel: outcome.model,
        aiProvider: outcome.provider,
        aiAnalyzedAt: new Date(),
        aiEstimatedCalories: null,
        finalCalories: null,
        aiMinCalories: null,
        aiMaxCalories: null,
        aiConfidence: null,
        aiRawResponse: Prisma.DbNull,
      },
    });
    await tx.aiUsageLog.create({
      data: {
        userId,
        mealId,
        provider: outcome.provider,
        model: outcome.model,
        status:
          outcome.status === 'NO_FOOD_DETECTED'
            ? 'NO_FOOD_DETECTED'
            : outcome.status === 'INVALID_RESPONSE'
              ? 'INVALID_RESPONSE'
              : outcome.status === 'TIMEOUT'
                ? 'TIMEOUT'
                : 'PROVIDER_ERROR',
        durationMs: outcome.durationMs,
        requestId: 'requestId' in outcome ? outcome.requestId : null,
        errorCode,
      },
    });
  });
  logger.warn('meal_analysis_failed', { mealId, errorCode });
}

/** Επανάληψη ανάλυσης. Επιτρέπεται και σε γεύμα υπό επιθεώρηση. */
export async function retryAnalysis(userId: string, mealId: string): Promise<MealView> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true, imagePath: true, notes: true, status: true },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  if (!meal.imagePath) {
    throw new ApiError('BAD_REQUEST', 'Το γεύμα δεν έχει φωτογραφία προς ανάλυση.');
  }
  if (meal.status === 'CANCELLED') {
    throw new ApiError('BAD_REQUEST', 'Το γεύμα έχει ακυρωθεί.');
  }

  await assertAiRateLimit(userId);

  const imageBuffer = await getStorage().get(meal.imagePath);
  await prisma.meal.update({
    where: { id: mealId },
    data: { analysisStatus: 'PENDING', status: 'ANALYZING', aiErrorCode: null },
  });
  await runAnalysis({ userId, mealId, imageBuffer, notes: meal.notes });
  return getMealForUser(userId, mealId);
}

/**
 * Καταχωρεί τις απαντήσεις στις διευκρινιστικές ερωτήσεις και ζητά νέα,
 * βελτιωμένη εκτίμηση. Οι απαντήσεις «Δεν γνωρίζω» δεν προσθέτουν πληροφορία,
 * οπότε αν είναι οι μοναδικές δεν ξοδεύουμε AI κλήση.
 */
const UNKNOWN_ANSWER_PATTERN = /^(δεν γνωρίζω|δεν ξέρω|unknown|not sure)$/i;

export async function answerClarifications(
  userId: string,
  mealId: string,
  input: ClarificationAnswersInput,
): Promise<MealView> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: {
      id: true,
      imagePath: true,
      status: true,
      aiRawResponse: true,
      clarifications: { select: { questionId: true, question: true, options: true } },
    },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  if (meal.status === 'CANCELLED' || meal.status === 'CONFIRMED') {
    throw new ApiError('BAD_REQUEST', 'Το γεύμα δεν είναι πλέον σε κατάσταση επιθεώρησης.');
  }

  const byId = new Map(meal.clarifications.map((c) => [c.questionId, c]));
  const accepted: Array<{ questionId: string; question: string; answer: string }> = [];

  for (const entry of input.answers) {
    const question = byId.get(entry.questionId);
    if (!question) {
      throw new ApiError('BAD_REQUEST', 'Άγνωστη ερώτηση για αυτό το γεύμα.');
    }
    // Η απάντηση πρέπει να είναι μία από τις επιλογές που δώσαμε εμείς:
    // αλλιώς ο χρήστης θα μπορούσε να στείλει ελεύθερο κείμενο στο μοντέλο.
    const options = toOptions(question.options);
    if (!options.includes(entry.answer)) {
      throw new ApiError('VALIDATION_ERROR', 'Μη έγκυρη επιλογή απάντησης.');
    }
    accepted.push({ questionId: entry.questionId, question: question.question, answer: entry.answer });
  }

  const answeredAt = new Date();
  await prisma.$transaction(
    accepted.map((a) =>
      prisma.mealClarification.updateMany({
        where: { mealId, questionId: a.questionId },
        data: { answer: a.answer, answeredAt },
      }),
    ),
  );

  const informative = accepted.filter((a) => !UNKNOWN_ANSWER_PATTERN.test(a.answer));
  if (informative.length === 0 || !meal.imagePath) {
    logger.info('meal_clarifications_no_refinement', { mealId, answers: accepted.length });
    return getMealForUser(userId, mealId);
  }

  await assertAiRateLimit(userId);

  const imageBuffer = await getStorage().get(meal.imagePath);
  const outcome = await refineMealAnalysis({
    imageBuffer,
    mimeType: 'image/webp',
    previous: meal.aiRawResponse ?? {},
    answers: informative.map((a) => ({ question: a.question, answer: a.answer })),
  });

  if (outcome.status !== 'SUCCESS') {
    // Η αποτυχία refinement ΔΕΝ χαλάει την υπάρχουσα εκτίμηση: οι απαντήσεις
    // έχουν ήδη αποθηκευτεί και ο χρήστης μπορεί να επιβεβαιώσει ή να διορθώσει.
    logger.warn('meal_refinement_failed', { mealId, status: outcome.status });
    return getMealForUser(userId, mealId);
  }

  await persistAnalysis({
    userId,
    mealId,
    analysis: outcome.analysis,
    model: outcome.model,
    provider: outcome.provider,
    requestId: outcome.requestId,
    durationMs: outcome.durationMs,
    // Οι απαντημένες ερωτήσεις διατηρούνται — δεν ξαναρωτάμε τα ίδια.
    writeClarifications: false,
  });
  logger.info('meal_refined', { mealId, answers: informative.length });
  return getMealForUser(userId, mealId);
}

/**
 * Οριστικοποίηση. Από αυτή τη στιγμή το γεύμα μετρά στα ημερήσια σύνολα.
 */
export async function confirmMeal(
  userId: string,
  mealId: string,
  acknowledgeHighCalories = false,
): Promise<MealView> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: {
      id: true, status: true, finalCalories: true, aiEstimatedCalories: true, title: true, mealType: true,
      items: { select: { name: true, finalCalories: true } },
    },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  if (meal.status === 'CANCELLED') {
    throw new ApiError('BAD_REQUEST', 'Το γεύμα έχει ακυρωθεί.');
  }
  if (meal.status === 'ANALYZING') {
    throw new ApiError('BAD_REQUEST', 'Η ανάλυση είναι σε εξέλιξη.');
  }
  if (meal.finalCalories === null) {
    throw new ApiError('BAD_REQUEST', 'Συμπλήρωσε θερμίδες πριν την επιβεβαίωση.');
  }
  if (isAboveSoftLimit(meal.finalCalories) && !acknowledgeHighCalories) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Η τιμή είναι ασυνήθιστα υψηλή. Επιβεβαίωσε ρητά για να αποθηκευτεί.',
      { field: 'finalCalories', requiresAcknowledgement: true },
    );
  }

  await prisma.meal.update({
    where: { id: mealId },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      mealFingerprint: deriveFingerprint({
        title: meal.title,
        mealType: meal.mealType,
        finalCalories: meal.finalCalories,
        items: meal.items,
      }),
    },
  });
  await recordMealCorrection({
    userId,
    mealId,
    baseCalories: meal.aiEstimatedCalories,
    finalCalories: meal.finalCalories,
    items: meal.items.map((item) => ({ name: item.name, calories: item.finalCalories })),
  });
  logger.info('meal_confirmed', { mealId });
  void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
    evaluateGoalsForUserBestEffort(userId),
  );
  return getMealForUser(userId, mealId);
}

/** Ακύρωση draft. Η εγγραφή μένει για audit αλλά δεν μετρά πουθενά. */
export async function cancelMeal(userId: string, mealId: string): Promise<MealView> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true, status: true },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  if (meal.status === 'CONFIRMED') {
    throw new ApiError(
      'BAD_REQUEST',
      'Το γεύμα έχει ήδη καταχωριστεί. Χρησιμοποίησε τη διαγραφή.',
    );
  }

  await prisma.meal.update({ where: { id: mealId }, data: { status: 'CANCELLED' } });
  logger.info('meal_cancelled', { mealId });
  return getMealForUser(userId, mealId);
}

/** Αθροίζει ένα macro πεδίο από τα τρόφιμα· null όταν κανένα δεν το δηλώνει. */
function sumItemMacro(
  items: Array<Record<string, unknown>>,
  key: keyof MacroFieldsInput,
): number | null {
  const values = items
    .map((item) => item[key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return key === 'sodiumMg' ? Math.round(sum) : Math.round(sum * 100) / 100;
}

const MACRO_KEYS: Array<keyof MacroFieldsInput> = [
  'proteinGrams',
  'carbohydrateGrams',
  'fatGrams',
  'fiberGrams',
  'sugarGrams',
  'saturatedFatGrams',
  'sodiumMg',
];

/**
 * Τα macros του γεύματος: ρητή τιμή αν δόθηκε, αλλιώς άθροισμα των τροφίμων.
 * Ίδια αρχή με τις θερμίδες — ό,τι δηλώνει ο χρήστης υπερισχύει.
 */
function resolveMacros(
  explicit: MacroFieldsInput,
  items: Array<Record<string, unknown>> | undefined,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const key of MACRO_KEYS) {
    const given = explicit[key];
    if (given !== undefined) {
      result[key] = given;
    } else if (items && items.length > 0) {
      result[key] = sumItemMacro(items, key);
    }
  }
  return result;
}

/**
 * Χειροκίνητη καταχώριση χωρίς φωτογραφία και χωρίς AI.
 * Καταχωρίζεται απευθείας ως CONFIRMED: δεν υπάρχει εκτίμηση προς επιθεώρηση.
 */
export async function createManualMeal(params: {
  userId: string;
  input: ManualMealInput;
  timezone: string;
  source?: MealSource;
}): Promise<CreateMealResult> {
  const { userId, input, timezone, source = 'MANUAL' } = params;

  if (input.requestKey) {
    const existing = await prisma.meal.findFirst({
      where: { userId, requestKey: input.requestKey },
      select: MEAL_SELECT,
    });
    if (existing) return { meal: toMealView(existing), duplicated: true };
  }

  const items = input.items ?? [];
  const total =
    input.finalCalories !== undefined
      ? normalizeCalories(input.finalCalories)
      : normalizeCalories(items.reduce((sum, item) => sum + normalizeCalories(item.finalCalories), 0));

  if (isAboveSoftLimit(total) && !input.acknowledgeHighCalories) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Η τιμή είναι ασυνήθιστα υψηλή. Επιβεβαίωσε ρητά για να αποθηκευτεί.',
      { field: 'finalCalories', requiresAcknowledgement: true },
    );
  }

  const macros = resolveMacros(input, items);
  const now = new Date();

  try {
    const created = await prisma.meal.create({
      data: {
        userId,
        mealType: input.mealType,
        title: input.title || null,
        notes: input.notes || null,
        mealDateTime: localDateTimeToUtc(input.mealDateTime, timezone),
        analysisStatus: 'COMPLETED',
        status: 'CONFIRMED',
        source,
        confirmedAt: now,
        finalCalories: total,
        mealFingerprint: deriveFingerprint({
          title: input.title || null,
          mealType: input.mealType,
          finalCalories: total,
          items: items.map((i) => ({ name: i.name, finalCalories: normalizeCalories(i.finalCalories) })),
        }),
        wasManuallyEdited: true,
        requestKey: input.requestKey ?? null,
        ...macros,
        items: {
          create: items.map((item, index) => ({
            name: item.name,
            estimatedQuantity: item.estimatedQuantity || null,
            finalCalories: normalizeCalories(item.finalCalories),
            proteinGrams: item.proteinGrams ?? null,
            carbohydrateGrams: item.carbohydrateGrams ?? null,
            fatGrams: item.fatGrams ?? null,
            fiberGrams: item.fiberGrams ?? null,
            sugarGrams: item.sugarGrams ?? null,
            saturatedFatGrams: item.saturatedFatGrams ?? null,
            sodiumMg: item.sodiumMg ?? null,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });
    logger.info('manual_meal_created', { mealId: created.id });
    void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
      evaluateGoalsForUserBestEffort(userId),
    );
    return { meal: await getMealForUser(userId, created.id), duplicated: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.meal.findFirst({
        where: { userId, requestKey: input.requestKey ?? '' },
        select: MEAL_SELECT,
      });
      if (existing) return { meal: toMealView(existing), duplicated: true };
    }
    throw error;
  }
}

/**
 * Χειροκίνητη διόρθωση. Η αρχική AI εκτίμηση (`aiEstimatedCalories`,
 * `aiEstimatedCalories` ανά τρόφιμο) δεν αλλάζει ποτέ.
 */
export async function updateMeal(
  userId: string,
  mealId: string,
  input: UpdateMealInput,
  timezone: string,
): Promise<MealView> {
  const existing = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: {
      id: true,
      finalCalories: true,
      aiEstimatedCalories: true,
      status: true,
      items: { select: { name: true, finalCalories: true } },
    },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  if (existing.status === 'CANCELLED') {
    throw new ApiError('BAD_REQUEST', 'Το γεύμα έχει ακυρωθεί.');
  }

  const data: Prisma.MealUpdateInput = {};
  let touched = false;

  if (input.mealType !== undefined) {
    data.mealType = input.mealType;
    touched = true;
  }
  if (input.title !== undefined) {
    data.title = input.title === '' ? null : input.title;
    touched = true;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes === '' ? null : input.notes;
    touched = true;
  }
  if (input.mealDateTime !== undefined) {
    data.mealDateTime = localDateTimeToUtc(input.mealDateTime, timezone);
    touched = true;
  }

  const macros = resolveMacros(input, input.items);
  for (const [key, value] of Object.entries(macros)) {
    (data as Record<string, unknown>)[key] = value;
    touched = true;
  }

  let finalCalories: number | undefined;
  if (input.finalCalories !== undefined) {
    finalCalories = normalizeCalories(input.finalCalories);
  } else if (input.items && input.items.length > 0) {
    // ΜΟΝΟ όταν υπάρχουν τρόφιμα. Κενή λίστα δεν μηδενίζει ποτέ το σύνολο:
    // θα ήταν σιωπηλή απώλεια δεδομένων αν η φόρμα στείλει κενό κατά λάθος.
    finalCalories = normalizeCalories(
      input.items.reduce((sum, item) => sum + normalizeCalories(item.finalCalories), 0),
    );
  }

  if (finalCalories !== undefined) {
    if (isAboveSoftLimit(finalCalories) && !input.acknowledgeHighCalories) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Η τιμή είναι ασυνήθιστα υψηλή. Επιβεβαίωσε ρητά για να αποθηκευτεί.',
        { field: 'finalCalories', requiresAcknowledgement: true },
      );
    }
    data.finalCalories = finalCalories;
    data.analysisStatus = 'COMPLETED';
    // Ένα αποτυχημένο γεύμα που συμπληρώθηκε χειροκίνητα γίνεται ξανά
    // επιθεωρήσιμο· ένα ήδη επιβεβαιωμένο παραμένει επιβεβαιωμένο.
    if (existing.status === 'FAILED' || existing.status === 'PENDING') {
      data.status = 'REVIEW_REQUIRED';
    }
    touched = true;
  }

  if (!touched && !input.items) {
    throw new ApiError('BAD_REQUEST', 'Δεν στάλθηκε καμία αλλαγή.');
  }

  data.wasManuallyEdited = true;

  await prisma.$transaction(async (tx) => {
    if (input.items) {
      const keepIds = input.items.map((item) => item.id).filter(Boolean) as string[];
      await tx.mealItem.deleteMany({
        where: { mealId, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
      });
      for (const [index, item] of input.items.entries()) {
        const itemData = {
          name: item.name,
          estimatedQuantity: item.estimatedQuantity || null,
          finalCalories: normalizeCalories(item.finalCalories),
          proteinGrams: item.proteinGrams ?? null,
          carbohydrateGrams: item.carbohydrateGrams ?? null,
          fatGrams: item.fatGrams ?? null,
          fiberGrams: item.fiberGrams ?? null,
          sugarGrams: item.sugarGrams ?? null,
          saturatedFatGrams: item.saturatedFatGrams ?? null,
          sodiumMg: item.sodiumMg ?? null,
          sortOrder: index,
        };
        if (item.id) {
          await tx.mealItem.updateMany({ where: { id: item.id, mealId }, data: itemData });
        } else {
          await tx.mealItem.create({ data: { mealId, ...itemData } });
        }
      }
    }
    await tx.meal.update({ where: { id: mealId }, data });

    // Αν το γεύμα μετρά (CONFIRMED), η σύνθεση μπορεί να άλλαξε — ξαναϋπολόγισε
    // το fingerprint ώστε η ομαδοποίηση συχνών/πρόσφατων να μείνει σωστή.
    const fresh = await tx.meal.findUnique({
      where: { id: mealId },
      select: {
        status: true, title: true, mealType: true, finalCalories: true,
        items: { select: { name: true, finalCalories: true } },
      },
    });
    if (fresh && fresh.status === 'CONFIRMED') {
      await tx.meal.update({
        where: { id: mealId },
        data: {
          mealFingerprint: deriveFingerprint({
            title: fresh.title, mealType: fresh.mealType,
            finalCalories: fresh.finalCalories, items: fresh.items,
          }),
        },
      });
    }
  });

  logger.info('meal_updated', { mealId });
  const updated = await getMealForUser(userId, mealId);
  await recordMealCorrection({
    userId,
    mealId,
    baseCalories: existing.aiEstimatedCalories,
    finalCalories: updated.finalCalories,
    items: updated.items.map((item) => ({ name: item.name, calories: item.finalCalories })),
  });
  return updated;
}

export async function deleteMeal(userId: string, mealId: string): Promise<void> {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: { id: true, imagePath: true, thumbPath: true },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');

  await prisma.meal.delete({ where: { id: meal.id } });

  const storage = getStorage();
  if (meal.imagePath) await storage.delete(meal.imagePath);
  if (meal.thumbPath) await storage.delete(meal.thumbPath);
  logger.info('meal_deleted', { mealId });
}
