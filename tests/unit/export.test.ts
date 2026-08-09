import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/prisma', () => ({ prisma: {} }));
vi.mock('@/server/storage', () => ({ getStorage: () => ({}) }));

const { exportToCsv } = await import('@/server/services/account');

const bundle = {
  exportedAt: '2026-08-04T10:00:00.000Z',
  account: { email: 'a@b.com', displayName: 'Demo', createdAt: '2026-01-01T00:00:00.000Z' },
  healthProfile: null,
  nutritionGoals: [
    {
      effectiveFrom: '2026-08-01',
      source: 'MANUAL',
      calorieTarget: 2200,
      proteinGrams: 150,
      carbohydrateGrams: 220,
      fatGrams: 75,
      fiberGrams: 30,
      waterMl: 2500,
    },
  ],
  meals: [
    {
      mealDateTimeUtc: '2026-08-04T10:30:00.000Z',
      mealType: 'LUNCH',
      title: 'Γεύμα με "εισαγωγικά"',
      aiEstimatedCalories: 720,
      finalCalories: 700,
      wasManuallyEdited: true,
      status: 'CONFIRMED',
      source: 'AI_IMAGE',
      notes: null,
      macros: {
        proteinGrams: 48,
        carbohydrateGrams: 72,
        fatGrams: 25,
        fiberGrams: 9,
      },
      items: [{ name: 'rice', finalCalories: 260 }],
    },
    {
      mealDateTimeUtc: '2026-08-05T10:30:00.000Z',
      mealType: 'DINNER',
      title: '=HYPERLINK("http://evil","click")',
      aiEstimatedCalories: 400,
      finalCalories: 400,
      wasManuallyEdited: false,
      status: 'CONFIRMED',
      source: 'MANUAL',
      notes: null,
      items: [],
    },
  ],
  weightEntries: [{ entryDate: '2026-08-04', weightKg: 82.5, notes: null }],
  disclaimer: 'test',
};

describe('exportToCsv', () => {
  it('περιλαμβάνει επικεφαλίδες και όλες τις γραμμές', () => {
    const csv = exportToCsv(bundle);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('finalCalories');
    expect(lines[0]).toContain('proteinGrams');
    expect(lines).toHaveLength(5); // header + 2 meals + 1 goal + 1 weight
  });

  it('περιλαμβάνει το ιστορικό στόχων και τα macros', () => {
    const csv = exportToCsv(bundle);
    expect(csv).toContain('"goal"');
    expect(csv).toContain('"2200"');
    expect(csv).toContain('"48"'); // πρωτεΐνη γεύματος
  });

  it('κάνει escape τα εισαγωγικά', () => {
    expect(exportToCsv(bundle)).toContain('""εισαγωγικά""');
  });

  it('προστατεύει από CSV injection', () => {
    expect(exportToCsv(bundle)).toContain(`"'=HYPERLINK`);
  });

  it('περιλαμβάνει τις καταχωρίσεις βάρους', () => {
    expect(exportToCsv(bundle)).toContain('82.5 kg');
  });
});
