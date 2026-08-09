import 'server-only';
import { Prisma, type MilestoneStatus, type MilestoneType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { env } from '../env';
import { impliedWeeklyRateKg, isAggressiveWeeklyRate, milestonePercent } from '@/lib/milestone-progress';
import { toNumber } from '@/lib/utils';
import {
  createMilestoneSchema,
  milestoneListQuerySchema,
  updateMilestoneSchema,
  type CreateMilestoneInput,
  type MilestoneListQueryInput,
  type UpdateMilestoneInput,
} from '@/lib/validation/milestones';

const WEIGHT_TYPES = new Set<MilestoneType>([
  'TARGET_WEIGHT',
  'WEIGHT_LOSS_AMOUNT',
  'WEIGHT_GAIN_AMOUNT',
]);

const DEFAULT_UNITS: Partial<Record<MilestoneType, string>> = {
  TARGET_WEIGHT: 'kg',
  WEIGHT_LOSS_AMOUNT: 'kg',
  WEIGHT_GAIN_AMOUNT: 'kg',
  MEAL_LOGGING_DAYS: 'days',
  MEAL_LOGGING_STREAK: 'days',
  WEIGH_IN_FREQUENCY: 'days',
  CALORIE_TARGET_DAYS: 'days',
  PROTEIN_TARGET_DAYS: 'days',
  WATER_TARGET_DAYS: 'days',
  STEP_TARGET_DAYS: 'days',
  ACTIVITY_TARGET: 'days',
};

export interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  type: MilestoneType;
  unit: string | null;
  startValue: number | null;
  targetValue: number;
  currentValue: number;
  dailyThreshold: number | null;
  startDate: string;
  endDate: string | null;
  status: MilestoneStatus;
  completedAt: string | null;
  progressMethod: string | null;
  percent: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneRealismWarning {
  code: 'AGGRESSIVE_WEIGHT_RATE';
  weeklyRateKg: number;
  message: string;
}

export interface MilestoneSaveResult {
  milestone: MilestoneView;
  warnings: MilestoneRealismWarning[];
}

export interface SuggestedMilestone {
  title: string;
  description: string;
  type: MilestoneType;
  targetValue: number;
  dailyThreshold: number | null;
  unit: string;
  startDate: string;
  endDate: string;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toDayISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dec(value: number | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value.toFixed(2));
}

function decimalRequired(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function toView(row: {
  id: string;
  title: string;
  description: string | null;
  type: MilestoneType;
  unit: string | null;
  startValue: Prisma.Decimal | number | string | null;
  targetValue: Prisma.Decimal | number | string;
  currentValue: Prisma.Decimal | number | string;
  dailyThreshold: Prisma.Decimal | number | string | null;
  startDate: Date;
  endDate: Date | null;
  status: MilestoneStatus;
  completedAt: Date | null;
  progressMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MilestoneView {
  const startValue = row.startValue === null ? null : toNumber(row.startValue);
  const currentValue = toNumber(row.currentValue);
  const targetValue = toNumber(row.targetValue);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    unit: row.unit,
    startValue,
    targetValue,
    currentValue,
    dailyThreshold: row.dailyThreshold === null ? null : toNumber(row.dailyThreshold),
    startDate: toDayISO(row.startDate),
    endDate: row.endDate ? toDayISO(row.endDate) : null,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    progressMethod: row.progressMethod,
    percent: milestonePercent(startValue ?? 0, currentValue, targetValue),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function currentProfileWeight(userId: string): Promise<number | null> {
  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { currentWeightKg: true },
  });
  return profile ? toNumber(profile.currentWeightKg) : null;
}

function weightAmountForRate(type: MilestoneType, startValue: number | null, targetValue: number) {
  if (type === 'TARGET_WEIGHT') {
    return startValue === null ? null : Math.abs(startValue - targetValue);
  }
  if (type === 'WEIGHT_LOSS_AMOUNT' || type === 'WEIGHT_GAIN_AMOUNT') return targetValue;
  return null;
}

function realismWarnings(args: {
  type: MilestoneType;
  startValue: number | null;
  targetValue: number;
  startDate: string;
  endDate: string | null | undefined;
}): MilestoneRealismWarning[] {
  if (!WEIGHT_TYPES.has(args.type) || !args.endDate) return [];
  const amountKg = weightAmountForRate(args.type, args.startValue, args.targetValue);
  if (amountKg === null) return [];
  const rate = impliedWeeklyRateKg(0, amountKg, toDateOnly(args.startDate), toDateOnly(args.endDate));
  if (!isAggressiveWeeklyRate(rate)) return [];
  return [
    {
      code: 'AGGRESSIVE_WEIGHT_RATE',
      weeklyRateKg: rate,
      message:
        'Ο ρυθμός αλλαγής βάρους φαίνεται επιθετικός. Προχώρησε με προσοχή και συμβουλέψου ειδικό αν χρειάζεται.',
    },
  ];
}

export async function createMilestone(
  userId: string,
  input: CreateMilestoneInput,
): Promise<MilestoneSaveResult> {
  const parsed = createMilestoneSchema.parse(input);
  const profileWeight = WEIGHT_TYPES.has(parsed.type) ? await currentProfileWeight(userId) : null;
  const startValue = parsed.startValue ?? (parsed.type === 'TARGET_WEIGHT' ? profileWeight : 0);
  const unit = parsed.unit || DEFAULT_UNITS[parsed.type] || null;
  const warnings = realismWarnings({
    type: parsed.type,
    startValue,
    targetValue: parsed.targetValue,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  });

  const row = await prisma.milestone.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description || null,
      type: parsed.type,
      unit,
      startValue: dec(startValue),
      targetValue: decimalRequired(parsed.targetValue),
      currentValue: dec(startValue) ?? decimalRequired(0),
      dailyThreshold: dec(parsed.dailyThreshold),
      startDate: toDateOnly(parsed.startDate),
      endDate: parsed.endDate ? toDateOnly(parsed.endDate) : null,
      status: parsed.status,
    },
  });

  return { milestone: toView(row), warnings };
}

export async function listMilestones(
  userId: string,
  options: MilestoneListQueryInput = {},
): Promise<MilestoneView[]> {
  const parsed = milestoneListQuerySchema.parse(options);
  const rows = await prisma.milestone.findMany({
    where: { userId, ...(parsed.status ? { status: parsed.status } : {}) },
    orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
    take: parsed.limit,
  });
  return rows.map(toView);
}

export async function getMilestoneForUser(userId: string, milestoneId: string): Promise<MilestoneView> {
  const row = await prisma.milestone.findFirst({ where: { id: milestoneId, userId } });
  if (!row) throw new ApiError('NOT_FOUND', 'Ο στόχος δεν βρέθηκε.');
  return toView(row);
}

export async function updateMilestone(
  userId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<MilestoneSaveResult> {
  const existing = await prisma.milestone.findFirst({ where: { id: milestoneId, userId } });
  if (!existing) throw new ApiError('NOT_FOUND', 'Ο στόχος δεν βρέθηκε.');
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new ApiError('BAD_REQUEST', 'Ο στόχος δεν μπορεί να αλλάξει σε αυτή την κατάσταση.');
  }

  const parsed = updateMilestoneSchema.parse(input);
  const nextStartDate = parsed.startDate ?? toDayISO(existing.startDate);
  const nextEndDate = parsed.endDate === undefined ? existing.endDate && toDayISO(existing.endDate) : parsed.endDate;
  if (nextEndDate && nextEndDate < nextStartDate) {
    throw new ApiError('VALIDATION_ERROR', 'Η λήξη δεν μπορεί να είναι πριν από την έναρξη.');
  }

  const nextStartValue =
    parsed.startValue === undefined ? (existing.startValue === null ? null : toNumber(existing.startValue)) : parsed.startValue;
  const nextTargetValue =
    parsed.targetValue === undefined ? toNumber(existing.targetValue) : parsed.targetValue;
  const warnings = realismWarnings({
    type: existing.type,
    startValue: nextStartValue,
    targetValue: nextTargetValue,
    startDate: nextStartDate,
    endDate: nextEndDate,
  });

  const data: Prisma.MilestoneUpdateInput = {
    ...(parsed.title !== undefined ? { title: parsed.title } : {}),
    ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
    ...(parsed.unit !== undefined ? { unit: parsed.unit || null } : {}),
    ...(parsed.startValue !== undefined ? { startValue: dec(parsed.startValue) } : {}),
    ...(parsed.targetValue !== undefined ? { targetValue: decimalRequired(parsed.targetValue) } : {}),
    ...(parsed.dailyThreshold !== undefined ? { dailyThreshold: dec(parsed.dailyThreshold) } : {}),
    ...(parsed.startDate !== undefined ? { startDate: toDateOnly(parsed.startDate) } : {}),
    ...(parsed.endDate !== undefined ? { endDate: parsed.endDate ? toDateOnly(parsed.endDate) : null } : {}),
  };

  const row = await prisma.milestone.update({
    where: { id: existing.id },
    data,
  });
  return { milestone: toView(row), warnings };
}

export async function pauseMilestone(userId: string, milestoneId: string): Promise<MilestoneView> {
  const updated = await prisma.milestone.updateMany({
    where: { id: milestoneId, userId, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
  });
  if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Ο ενεργός στόχος δεν βρέθηκε.');
  return getMilestoneForUser(userId, milestoneId);
}

export async function resumeMilestone(userId: string, milestoneId: string): Promise<MilestoneView> {
  const updated = await prisma.milestone.updateMany({
    where: { id: milestoneId, userId, status: 'PAUSED' },
    data: { status: 'ACTIVE' },
  });
  if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Ο στόχος σε παύση δεν βρέθηκε.');
  return getMilestoneForUser(userId, milestoneId);
}

export async function cancelMilestone(userId: string, milestoneId: string): Promise<MilestoneView> {
  const updated = await prisma.milestone.updateMany({
    where: { id: milestoneId, userId, status: { in: ['ACTIVE', 'PAUSED', 'DRAFT'] } },
    data: { status: 'CANCELLED' },
  });
  if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Ο στόχος δεν βρέθηκε.');
  return getMilestoneForUser(userId, milestoneId);
}

export async function suggestMilestones(
  userId: string,
  todayISO = new Date().toISOString().slice(0, 10),
): Promise<SuggestedMilestone[]> {
  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { targetWeightKg: true },
  });
  const activeCount = await prisma.milestone.count({
    where: { userId, status: { in: ['ACTIVE', 'PAUSED', 'DRAFT'] } },
  });
  const start = toDateOnly(todayISO);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const endDate = toDayISO(end);

  const suggestions: SuggestedMilestone[] = [
    {
      title: 'Log your weight 3 times this week',
      description: 'A small, measurable step toward steadier progress.',
      type: 'WEIGH_IN_FREQUENCY',
      targetValue: 3,
      dailyThreshold: null,
      unit: 'days',
      startDate: todayISO,
      endDate,
    },
    {
      title: 'Log meals for 5 days',
      description: 'A consistency goal that does not require a perfect week.',
      type: 'MEAL_LOGGING_DAYS',
      targetValue: 5,
      dailyThreshold: null,
      unit: 'days',
      startDate: todayISO,
      endDate,
    },
    {
      title: 'Hit your water target for 4 days',
      description: 'A gentle hydration reminder for the week.',
      type: 'WATER_TARGET_DAYS',
      targetValue: 4,
      dailyThreshold: env.DEFAULT_DAILY_WATER_TARGET_ML,
      unit: 'days',
      startDate: todayISO,
      endDate,
    },
  ];

  if (profile?.targetWeightKg) {
    suggestions.unshift({
      title: 'Κάνε ένα μικρό βήμα προς το βάρος-στόχο',
      description: 'Παρακολούθηση με βάση το δηλωμένο βάρος-στόχο του προφίλ σου.',
      type: 'TARGET_WEIGHT',
      targetValue: toNumber(profile.targetWeightKg),
      dailyThreshold: null,
      unit: 'kg',
      startDate: todayISO,
      endDate,
    });
  }

  return activeCount > 0 ? suggestions.slice(0, 3) : suggestions;
}
