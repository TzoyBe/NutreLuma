import { createHash } from 'node:crypto';
import type { VisionProvider, VisionRequest, VisionResponse } from './types';

/**
 * Ντετερμινιστικός πάροχος για development, demo και tests.
 * Επιτρέπει πλήρη λειτουργία της εφαρμογής χωρίς AI_API_KEY.
 * Το αποτέλεσμα εξαρτάται από το hash της εικόνας, ώστε η ίδια φωτογραφία
 * να δίνει πάντα το ίδιο αποτέλεσμα.
 */
interface MockItem {
  name: string;
  estimatedQuantity: string;
  mostLikelyCalories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
}

const MENU: MockItem[][] = [
  [
    {
      name: 'grilled chicken',
      estimatedQuantity: '180 g',
      mostLikelyCalories: 300,
      proteinGrams: 42,
      carbohydrateGrams: 0,
      fatGrams: 11,
    },
    {
      name: 'rice',
      estimatedQuantity: '200 g',
      mostLikelyCalories: 260,
      proteinGrams: 5,
      carbohydrateGrams: 56,
      fatGrams: 1,
    },
    {
      name: 'salad with dressing',
      estimatedQuantity: '1 serving',
      mostLikelyCalories: 160,
      proteinGrams: 3,
      carbohydrateGrams: 8,
      fatGrams: 13,
    },
  ],
  [
    {
      name: 'greek salad',
      estimatedQuantity: '1 bowl',
      mostLikelyCalories: 320,
      proteinGrams: 9,
      carbohydrateGrams: 14,
      fatGrams: 25,
    },
    {
      name: 'bread',
      estimatedQuantity: '2 slices',
      mostLikelyCalories: 160,
      proteinGrams: 6,
      carbohydrateGrams: 30,
      fatGrams: 2,
    },
  ],
  [
    {
      name: 'pasta with tomato sauce',
      estimatedQuantity: '300 g',
      mostLikelyCalories: 480,
      proteinGrams: 16,
      carbohydrateGrams: 88,
      fatGrams: 7,
    },
    {
      name: 'parmesan',
      estimatedQuantity: '15 g',
      mostLikelyCalories: 60,
      proteinGrams: 5,
      carbohydrateGrams: 0,
      fatGrams: 4,
    },
  ],
  [
    {
      name: 'greek yogurt',
      estimatedQuantity: '200 g',
      mostLikelyCalories: 130,
      proteinGrams: 20,
      carbohydrateGrams: 8,
      fatGrams: 2,
    },
    {
      name: 'honey',
      estimatedQuantity: '1 tbsp',
      mostLikelyCalories: 64,
      proteinGrams: 0,
      carbohydrateGrams: 17,
      fatGrams: 0,
    },
    {
      name: 'walnuts',
      estimatedQuantity: '20 g',
      mostLikelyCalories: 131,
      proteinGrams: 3,
      carbohydrateGrams: 3,
      fatGrams: 13,
    },
  ],
  [
    {
      name: 'souvlaki pita',
      estimatedQuantity: '1 piece',
      mostLikelyCalories: 620,
      proteinGrams: 30,
      carbohydrateGrams: 60,
      fatGrams: 28,
    },
    {
      name: 'french fries',
      estimatedQuantity: '80 g',
      mostLikelyCalories: 240,
      proteinGrams: 3,
      carbohydrateGrams: 30,
      fatGrams: 12,
    },
  ],
];

/** Δείγμα ερωτήσεων· επιλέγονται ντετερμινιστικά ώστε το UI να είναι δοκιμάσιμο. */
const QUESTIONS = [
  {
    id: 'oil_amount',
    question: 'Πόσο λάδι χρησιμοποιήθηκε;',
    options: ['Χωρίς λάδι', '1 κουταλάκι', '1 κουταλιά', '2 κουταλιές', 'Δεν γνωρίζω'],
  },
  {
    id: 'portion_finished',
    question: 'Κατανάλωσες όλη την ποσότητα;',
    options: ['Ναι, όλη', 'Περίπου τη μισή', 'Λιγότερο από τη μισή', 'Δεν γνωρίζω'],
  },
];

export class MockVisionProvider implements VisionProvider {
  readonly name = 'mock';

  /**
   * Το όνομα μοντέλου είναι σταθερό και αυτοπεριγραφικό — δεν δέχεται το
   * πραγματικό AI_MODEL, ώστε να μην μπορεί demo αποτέλεσμα να εμφανιστεί
   * ποτέ σαν να προήλθε από αληθινό μοντέλο.
   */
  private readonly model = 'mock-vision-1 (DEMO DATA)';

  async analyze(request: VisionRequest): Promise<VisionResponse> {
    const digest = createHash('sha256').update(request.imageBase64).digest();
    const index = digest[0]! % MENU.length;
    const items = MENU[index]!;
    const mostLikelyCalories = items.reduce((sum, item) => sum + item.mostLikelyCalories, 0);
    const confidence = Number((0.62 + (digest[1]! % 30) / 100).toFixed(2));

    const sum = (key: 'proteinGrams' | 'carbohydrateGrams' | 'fatGrams') =>
      items.reduce((total, item) => total + item[key], 0);

    // Στο refinement δεν επιστρέφουμε ξανά ερωτήσεις και στενεύουμε το εύρος,
    // ώστε η ροή να συμπεριφέρεται ρεαλιστικά και σε demo mode.
    const isRefinement = request.userPrompt.startsWith('Previous estimate');
    const spread = isRefinement ? 0.05 : 0.12;

    // Μικρή καθυστέρηση ώστε το UI loading state να είναι ορατό σε demo.
    await new Promise((resolve) => setTimeout(resolve, 350));

    return {
      text: JSON.stringify({
        mostLikelyCalories,
        minimumCalories: Math.round(mostLikelyCalories * (1 - spread)),
        maximumCalories: Math.round(mostLikelyCalories * (1 + spread)),
        confidence: isRefinement ? Math.min(0.95, confidence + 0.1) : confidence,
        macros: {
          proteinGrams: sum('proteinGrams'),
          carbohydrateGrams: sum('carbohydrateGrams'),
          fatGrams: sum('fatGrams'),
          fiberGrams: 6,
          sugarGrams: 9,
          saturatedFatGrams: 7,
          sodiumMg: 780,
        },
        items: items.map((item) => ({
          ...item,
          minimumCalories: Math.round(item.mostLikelyCalories * (1 - spread)),
          maximumCalories: Math.round(item.mostLikelyCalories * (1 + spread)),
        })),
        clarificationQuestions: isRefinement ? [] : QUESTIONS.slice(0, 1 + (digest[2]! % 2)),
        summary: 'Mock provider: deterministic sample result derived from the image hash.',
      }),
      model: this.model,
      requestId: `mock_${digest.toString('hex').slice(0, 12)}`,
    };
  }
}
