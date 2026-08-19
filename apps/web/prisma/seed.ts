/**
 * Seed script (προαιρετικό).
 *   npm run db:seed
 *
 * Δημιουργεί demo χρήστη με προφίλ, γεύματα και καταχωρίσεις βάρους.
 * Το password διαβάζεται από SEED_DEMO_PASSWORD· αν λείπει, παράγεται τυχαίο
 * και τυπώνεται ΜΙΑ φορά. Δεν χρησιμοποιείται ποτέ αδύναμο σταθερό password.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMAIL = (process.env.SEED_DEMO_EMAIL ?? 'demo@nutreluma.local').toLowerCase();
const TIMEZONE = process.env.DEFAULT_TIMEZONE ?? 'Europe/Athens';

function generatePassword(): string {
  // 18 bytes -> 24 χαρακτήρες base64url, με εγγυημένα κεφαλαίο/πεζό/ψηφίο.
  return `Aa1${randomBytes(18).toString('base64url')}`;
}

const SAMPLE_MEALS = [
  {
    dayOffset: 0,
    hour: 8,
    mealType: 'BREAKFAST' as const,
    title: 'Γιαούρτι με μέλι',
    calories: 325,
    confidence: 0.81,
    items: [
      { name: 'greek yogurt', quantity: '200 g', calories: 130 },
      { name: 'honey', quantity: '1 tbsp', calories: 64 },
      { name: 'walnuts', quantity: '20 g', calories: 131 },
    ],
  },
  {
    dayOffset: 0,
    hour: 14,
    mealType: 'LUNCH' as const,
    title: 'Κοτόπουλο με ρύζι',
    calories: 720,
    confidence: 0.78,
    items: [
      { name: 'grilled chicken', quantity: '180 g', calories: 300 },
      { name: 'rice', quantity: '200 g', calories: 260 },
      { name: 'salad with dressing', quantity: '1 serving', calories: 160 },
    ],
  },
  {
    dayOffset: 1,
    hour: 21,
    mealType: 'DINNER' as const,
    title: 'Χωριάτικη σαλάτα',
    calories: 480,
    confidence: 0.7,
    items: [
      { name: 'greek salad', quantity: '1 bowl', calories: 320 },
      { name: 'bread', quantity: '2 slices', calories: 160 },
    ],
  },
  {
    dayOffset: 2,
    hour: 13,
    mealType: 'LUNCH' as const,
    title: 'Μακαρόνια με σάλτσα',
    calories: 540,
    confidence: 0.74,
    items: [
      { name: 'pasta with tomato sauce', quantity: '300 g', calories: 480 },
      { name: 'parmesan', quantity: '15 g', calories: 60 },
    ],
  },
  {
    dayOffset: 3,
    hour: 20,
    mealType: 'DINNER' as const,
    title: 'Σουβλάκι',
    calories: 860,
    confidence: 0.66,
    items: [
      { name: 'souvlaki pita', quantity: '1 piece', calories: 620 },
      { name: 'french fries', quantity: '80 g', calories: 240 },
    ],
  },
];

function dateAt(dayOffset: number, hour: number): Date {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0),
  );
  day.setUTCDate(day.getUTCDate() - dayOffset);
  return day;
}

async function main() {
  const providedPassword = process.env.SEED_DEMO_PASSWORD;
  const providedIsUsable = Boolean(providedPassword && providedPassword.length >= 10);

  // Αν δόθηκε password αλλά είναι πολύ αδύναμο, το λέμε ρητά: η σιωπηλή
  // αντικατάσταση με τυχαίο θα άφηνε τον χρήστη να προσπαθεί να συνδεθεί
  // με έναν κωδικό που δεν ίσχυσε ποτέ.
  if (providedPassword && !providedIsUsable) {
    console.warn(
      `ΠΡΟΣΟΧΗ: το SEED_DEMO_PASSWORD ("${'*'.repeat(providedPassword.length)}", ` +
        `${providedPassword.length} χαρακτήρες) είναι κάτω από το ελάχιστο των 10 και ΑΓΝΟΗΘΗΚΕ. ` +
        'Χρησιμοποιείται τυχαίο password (τυπώνεται παρακάτω).',
    );
  }

  const password = providedIsUsable ? (providedPassword as string) : generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  // Το password ΠΡΕΠΕΙ να ενημερώνεται και σε υπάρχοντα demo χρήστη: αλλιώς
  // ένα δεύτερο seed θα τύπωνε "password: (από SEED_DEMO_PASSWORD)" ενώ στη
  // βάση θα παρέμενε ο κωδικός της πρώτης εκτέλεσης.
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, displayName: 'Demo Χρήστης' },
    create: {
      email: EMAIL,
      displayName: 'Demo Χρήστης',
      passwordHash,
      consentAcceptedAt: new Date(),
    },
  });

  await prisma.healthProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      firstName: 'Demo',
      lastName: 'Χρήστης',
      birthDate: new Date('1990-05-14T00:00:00.000Z'),
      gender: 'UNDISCLOSED',
      heightCm: new Prisma.Decimal('178.00'),
      currentWeightKg: new Prisma.Decimal('82.50'),
      targetWeightKg: new Prisma.Decimal('76.00'),
      activityLevel: 'MODERATE',
      goal: 'LOSE',
      dailyCalorieTarget: 2100,
      preferredUnits: 'METRIC',
      timezone: TIMEZONE,
    },
  });

  // Καθαρίζουμε προηγούμενα demo δεδομένα ώστε το seed να είναι idempotent.
  await prisma.meal.deleteMany({ where: { userId: user.id } });

  for (const sample of SAMPLE_MEALS) {
    await prisma.meal.create({
      data: {
        userId: user.id,
        mealType: sample.mealType,
        title: sample.title,
        mealDateTime: dateAt(sample.dayOffset, sample.hour),
        analysisStatus: 'COMPLETED',
        aiEstimatedCalories: sample.calories,
        finalCalories: sample.calories,
        aiConfidence: sample.confidence,
        aiModel: 'mock-vision-1',
        aiProvider: 'mock',
        aiAnalyzedAt: dateAt(sample.dayOffset, sample.hour),
        aiRawResponse: {
          totalCalories: sample.calories,
          confidence: sample.confidence,
          items: sample.items.map((item) => ({
            name: item.name,
            estimatedQuantity: item.quantity,
            estimatedCalories: item.calories,
          })),
          summary: 'Seed data (δεν προήλθε από πραγματική ανάλυση).',
        },
        items: {
          create: sample.items.map((item, index) => ({
            name: item.name,
            estimatedQuantity: item.quantity,
            aiEstimatedCalories: item.calories,
            finalCalories: item.calories,
            sortOrder: index,
          })),
        },
      },
    });
  }

  const weights = [
    { dayOffset: 0, kg: '82.50' },
    { dayOffset: 7, kg: '83.10' },
    { dayOffset: 14, kg: '83.80' },
    { dayOffset: 21, kg: '84.40' },
  ];
  for (const entry of weights) {
    const date = dateAt(entry.dayOffset, 0);
    const dateOnly = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    await prisma.weightEntry.upsert({
      where: { userId_entryDate: { userId: user.id, entryDate: dateOnly } },
      update: { weightKg: new Prisma.Decimal(entry.kg) },
      create: { userId: user.id, entryDate: dateOnly, weightKg: new Prisma.Decimal(entry.kg) },
    });
  }

  console.log('Seed ολοκληρώθηκε.');
  console.log(`  email:    ${EMAIL}`);
  if (providedIsUsable) {
    console.log('  password: (από SEED_DEMO_PASSWORD)');
  } else {
    console.log(`  password: ${password}`);
    console.log('  ^ Τυπώνεται μία φορά. Μην το χρησιμοποιήσεις σε production.');
  }
}

main()
  .catch((error) => {
    console.error('Το seed απέτυχε:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
