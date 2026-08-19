import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { toNumber } from '@/lib/utils';
import type { WeightEntryInput } from '@/lib/validation/weight';

export interface WeightEntryView {
  id: string;
  weightKg: number;
  entryDate: string;
  notes: string | null;
  createdAt: string;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function listWeightEntries(
  userId: string,
  options: { from?: string; to?: string; limit: number },
): Promise<WeightEntryView[]> {
  const where: Prisma.WeightEntryWhereInput = { userId };
  if (options.from || options.to) {
    const range: Prisma.DateTimeFilter = {};
    if (options.from) range.gte = toDateOnly(options.from);
    if (options.to) range.lte = toDateOnly(options.to);
    where.entryDate = range;
  }

  const entries = await prisma.weightEntry.findMany({
    where,
    orderBy: { entryDate: 'desc' },
    take: options.limit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    weightKg: toNumber(entry.weightKg),
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
  }));
}

/**
 * Μία καταχώριση ανά ημέρα ανά χρήστη (unique constraint): νέα τιμή για
 * υπάρχουσα ημερομηνία ενημερώνει την προηγούμενη.
 * Ενημερώνει και το τρέχον βάρος στο προφίλ όταν είναι η πιο πρόσφατη εγγραφή.
 */
export async function upsertWeightEntry(
  userId: string,
  input: WeightEntryInput,
): Promise<WeightEntryView> {
  const entryDate = toDateOnly(input.entryDate);
  const weightKg = new Prisma.Decimal(input.weightKg.toFixed(2));

  const entry = await prisma.$transaction(async (tx) => {
    const saved = await tx.weightEntry.upsert({
      where: { userId_entryDate: { userId, entryDate } },
      create: { userId, entryDate, weightKg, notes: input.notes || null },
      update: { weightKg, notes: input.notes || null },
    });

    const latest = await tx.weightEntry.findFirst({
      where: { userId },
      orderBy: { entryDate: 'desc' },
      select: { entryDate: true, weightKg: true },
    });
    if (latest && latest.entryDate.getTime() === entryDate.getTime()) {
      await tx.healthProfile.updateMany({
        where: { userId },
        data: { currentWeightKg: weightKg },
      });
    }
    return saved;
  });

  void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
    evaluateGoalsForUserBestEffort(userId),
  );
  return {
    id: entry.id,
    weightKg: toNumber(entry.weightKg),
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function deleteWeightEntry(userId: string, entryId: string): Promise<void> {
  const deleted = await prisma.weightEntry.deleteMany({ where: { id: entryId, userId } });
  if (deleted.count === 0) {
    throw new ApiError('NOT_FOUND', 'Η καταχώριση δεν βρέθηκε.');
  }
}
