import 'server-only';
import { Prisma, type ActivityKind } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import {
  activityEntrySchema,
  trackingListQuerySchema,
  type ActivityEntryInput,
  type TrackingListQueryInput,
} from '@/lib/validation/tracking';

export interface ActivityEntryView {
  id: string;
  entryDate: string;
  kind: ActivityKind;
  steps: number | null;
  durationMin: number | null;
  note: string | null;
  createdAt: string;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function toDayISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function addActivityEntry(
  userId: string,
  input: ActivityEntryInput,
): Promise<ActivityEntryView> {
  const parsed = activityEntrySchema.parse(input);
  const entry = await prisma.activityEntry.create({
    data: {
      userId,
      entryDate: toDateOnly(parsed.entryDate),
      kind: parsed.kind,
      steps: parsed.steps ?? null,
      durationMin: parsed.durationMin ?? null,
      note: parsed.note || null,
    },
  });
  void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
    evaluateGoalsForUserBestEffort(userId),
  );
  return toView(entry);
}

function toView(e: {
  id: string;
  entryDate: Date;
  kind: ActivityKind;
  steps: number | null;
  durationMin: number | null;
  note: string | null;
  createdAt: Date;
}): ActivityEntryView {
  return {
    id: e.id,
    entryDate: toDayISO(e.entryDate),
    kind: e.kind,
    steps: e.steps,
    durationMin: e.durationMin,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function listActivityEntries(
  userId: string,
  options: TrackingListQueryInput,
): Promise<ActivityEntryView[]> {
  const parsed = trackingListQuerySchema.parse(options);
  const where: Prisma.ActivityEntryWhereInput = { userId };
  if (parsed.from || parsed.to) {
    const range: Prisma.DateTimeFilter = {};
    if (parsed.from) range.gte = toDateOnly(parsed.from);
    if (parsed.to) range.lte = toDateOnly(parsed.to);
    where.entryDate = range;
  }
  const entries = await prisma.activityEntry.findMany({
    where,
    orderBy: { entryDate: 'desc' },
    take: parsed.limit,
  });
  return entries.map(toView);
}

export async function deleteActivityEntry(userId: string, entryId: string): Promise<void> {
  const deleted = await prisma.activityEntry.deleteMany({ where: { id: entryId, userId } });
  if (deleted.count === 0) throw new ApiError('NOT_FOUND', 'Η καταχώριση δεν βρέθηκε.');
}

/** Άθροισμα βημάτων ανά ημέρα — για STEP_TARGET_DAYS. */
export async function stepsByDay(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<Map<string, number>> {
  const rows = await prisma.activityEntry.findMany({
    where: {
      userId,
      entryDate: { gte: toDateOnly(fromISO), lte: toDateOnly(toISO) },
      steps: { not: null },
    },
    select: { entryDate: true, steps: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = toDayISO(r.entryDate);
    byDay.set(day, (byDay.get(day) ?? 0) + (r.steps ?? 0));
  }
  return byDay;
}

/** Ημερομηνίες (ISO) με ≥1 καταχώριση δραστηριότητας — για ACTIVITY_TARGET / activeDays. */
export async function activeDays(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<string[]> {
  const rows = await prisma.activityEntry.findMany({
    where: { userId, entryDate: { gte: toDateOnly(fromISO), lte: toDateOnly(toISO) } },
    select: { entryDate: true },
  });
  return [...new Set(rows.map((r) => toDayISO(r.entryDate)))].sort();
}
