import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

/**
 * Backfill `mealFingerprint` για υπάρχοντα CONFIRMED γεύματα.
 *
 * ΣΗΜΑΝΤΙΚΟ: Η λογική fingerprint είναι εδώ ΑΝΤΙΓΡΑΜΜΕΝΗ αυτούσια από
 * `src/lib/meal-fingerprint.ts`, επειδή το production Docker image ΔΕΝ περιέχει
 * τον φάκελο `src/` (μόνο `.next`, `prisma`, `node_modules`). Έτσι το script
 * τρέχει και μέσα στο container: `docker compose exec web npx tsx prisma/backfill-fingerprints.ts`.
 * Οποιαδήποτε αλλαγή στο computeMealFingerprint ΠΡΕΠΕΙ να αντιγραφεί κι εδώ.
 */

const CALORIE_BUCKET = 25;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bucket(calories: number | null): number {
  if (calories === null || !Number.isFinite(calories)) return 0;
  return Math.round(calories / CALORIE_BUCKET) * CALORIE_BUCKET;
}

function computeMealFingerprint(input: {
  title: string | null;
  mealType: string;
  totalCalories: number | null;
  items: Array<{ name: string; calories: number | null }>;
}): string {
  const itemSigs = input.items
    .map((i) => `${normalizeText(i.name)}:${bucket(i.calories)}`)
    .sort();

  const titlePart =
    normalizeText(input.title ?? '') ||
    (itemSigs.length > 0
      ? itemSigs.map((s) => s.split(':')[0]).join(' ')
      : String(bucket(input.totalCalories)));

  const canonical = [
    titlePart,
    input.mealType,
    itemSigs.length > 0 ? itemSigs.join(',') : `total:${bucket(input.totalCalories)}`,
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}

const prisma = new PrismaClient();

async function main() {
  const BATCH = 200;
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const meals = await prisma.meal.findMany({
      where: { status: 'CONFIRMED', mealFingerprint: null },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, title: true, mealType: true, finalCalories: true,
        items: { select: { name: true, finalCalories: true } },
      },
    });
    if (meals.length === 0) break;
    for (const m of meals) {
      const fingerprint = computeMealFingerprint({
        title: m.title,
        mealType: m.mealType,
        totalCalories: m.finalCalories,
        items: m.items.map((i) => ({ name: i.name, calories: i.finalCalories })),
      });
      await prisma.meal.update({ where: { id: m.id }, data: { mealFingerprint: fingerprint } });
      updated++;
    }
    cursor = meals[meals.length - 1].id;
  }
  console.log(`Backfilled ${updated} meals.`);
}

main().finally(() => prisma.$disconnect());
