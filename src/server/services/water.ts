import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import {
  trackingListQuerySchema,
  waterEntrySchema,
  type TrackingListQueryInput,
  type WaterEntryInput,
} from '@/lib/validation/tracking';

export interface WaterEntryView {
  id: string;
  entryDate: string;
  volumeMl: number;
  createdAt: string;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function toDayISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function addWaterEntry(userId: string, input: WaterEntryInput): Promise<WaterEntryView> {
  const parsed = waterEntrySchema.parse(input);
  const entry = await prisma.waterEntry.create({
    data: { userId, entryDate: toDateOnly(parsed.entryDate), volumeMl: parsed.volumeMl },
  });
  void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
    evaluateGoalsForUserBestEffort(userId),
  );
  return {
    id: entry.id,
    entryDate: toDayISO(entry.entryDate),
    volumeMl: entry.volumeMl,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function listWaterEntries(
  userId: string,
  options: TrackingListQueryInput,
): Promise<WaterEntryView[]> {
  const parsed = trackingListQuerySchema.parse(options);
  const where: Prisma.WaterEntryWhereInput = { userId };
  if (parsed.from || parsed.to) {
    const range: Prisma.DateTimeFilter = {};
    if (parsed.from) range.gte = toDateOnly(parsed.from);
    if (parsed.to) range.lte = toDateOnly(parsed.to);
    where.entryDate = range;
  }
  const entries = await prisma.waterEntry.findMany({
    where,
    orderBy: { entryDate: 'desc' },
    take: parsed.limit,
  });
  return entries.map((e) => ({
    id: e.id,
    entryDate: toDayISO(e.entryDate),
    volumeMl: e.volumeMl,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function deleteWaterEntry(userId: string, entryId: string): Promise<void> {
  const deleted = await prisma.waterEntry.deleteMany({ where: { id: entryId, userId } });
  if (deleted.count === 0) throw new ApiError('NOT_FOUND', 'Η καταχώριση δεν βρέθηκε.');
}

/** Άθροισμα ml ανά ημέρα (entryDate) στο διάστημα — για progress milestones. */
export async function waterMlByDay(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<Map<string, number>> {
  const rows = await prisma.waterEntry.findMany({
    where: { userId, entryDate: { gte: toDateOnly(fromISO), lte: toDateOnly(toISO) } },
    select: { entryDate: true, volumeMl: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = toDayISO(r.entryDate);
    byDay.set(day, (byDay.get(day) ?? 0) + r.volumeMl);
  }
  return byDay;
}
