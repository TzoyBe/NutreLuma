import { describe, expect, it } from 'vitest';
import { extractJsonObject, parseAiResponse } from '@/server/ai/schema';

const validResponse = {
  totalCalories: 720,
  confidence: 0.78,
  items: [
    { name: 'grilled chicken', estimatedQuantity: '180 g', estimatedCalories: 300 },
    { name: 'rice', estimatedQuantity: '200 g', estimatedCalories: 260 },
    { name: 'salad with dressing', estimatedQuantity: '1 serving', estimatedCalories: 160 },
  ],
  internalReasoningSummary: 'Estimated from visible portion sizes.',
};

describe('extractJsonObject', () => {
  it('βρίσκει JSON μέσα σε code fences', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it('βρίσκει JSON με κείμενο γύρω του', () => {
    expect(extractJsonObject('Here you go: {"a":{"b":2}} thanks')).toBe('{"a":{"b":2}}');
  });

  it('δεν μπερδεύεται από αγκύλες μέσα σε strings', () => {
    expect(extractJsonObject('{"name":"a}b"}')).toBe('{"name":"a}b"}');
  });

  it('επιστρέφει null χωρίς JSON', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('parseAiResponse', () => {
  it('δέχεται έγκυρη απάντηση', () => {
    const result = parseAiResponse(JSON.stringify(validResponse));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.totalCalories).toBe(720);
      expect(result.data.items).toHaveLength(3);
      expect(result.data.confidence).toBe(0.78);
    }
  });

  it('αναγνωρίζει NO_FOOD_DETECTED', () => {
    const result = parseAiResponse(
      '{"error":"NO_FOOD_DETECTED","message":"No meal could be identified."}',
    );
    expect(result.kind).toBe('no_food');
    if (result.kind === 'no_food') expect(result.code).toBe('NO_FOOD_DETECTED');
  });

  it('απορρίπτει μη έγκυρο JSON', () => {
    expect(parseAiResponse('{not json').kind).toBe('invalid');
  });

  it('απορρίπτει απάντηση που δεν ταιριάζει στο schema', () => {
    const result = parseAiResponse('{"totalCalories":"πολλές","items":[]}');
    expect(result.kind).toBe('invalid');
  });

  it('απορρίπτει confidence εκτός [0,1]', () => {
    const result = parseAiResponse(JSON.stringify({ ...validResponse, confidence: 5 }));
    expect(result.kind).toBe('invalid');
  });

  it('διορθώνει ασυνεπές σύνολο με βάση το άθροισμα των τροφίμων', () => {
    const result = parseAiResponse(JSON.stringify({ ...validResponse, totalCalories: 25 }));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.data.totalCalories).toBe(720);
  });

  it('κρατά το σύνολο του μοντέλου όταν η απόκλιση είναι μικρή', () => {
    const result = parseAiResponse(JSON.stringify({ ...validResponse, totalCalories: 700 }));
    if (result.kind === 'ok') expect(result.data.totalCalories).toBe(700);
  });

  it('καθαρίζει επικίνδυνους χαρακτήρες από τα ονόματα', () => {
    const result = parseAiResponse(
      JSON.stringify({
        ...validResponse,
        items: [{ name: '<script>alert(1)</script>rice', estimatedQuantity: '1', estimatedCalories: 100 }],
        totalCalories: 100,
      }),
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.items[0]!.name).not.toContain('<');
      expect(result.data.items[0]!.name).not.toContain('>');
    }
  });

  it('απορρίπτει κενή λίστα τροφίμων', () => {
    const result = parseAiResponse(JSON.stringify({ ...validResponse, items: [] }));
    expect(result.kind).toBe('invalid');
  });

  it('περιορίζει υπερβολικές θερμίδες', () => {
    const result = parseAiResponse(
      JSON.stringify({
        totalCalories: 500_000,
        confidence: 0.5,
        items: [{ name: 'x', estimatedQuantity: '1', estimatedCalories: 500_000 }],
      }),
    );
    expect(result.kind).toBe('invalid');
  });
});

describe('νέα μορφή απάντησης (macros, εύρη, ερωτήσεις)', () => {
  const full = JSON.stringify({
    mostLikelyCalories: 720,
    minimumCalories: 650,
    maximumCalories: 810,
    confidence: 0.78,
    macros: {
      proteinGrams: 48,
      carbohydrateGrams: 72,
      fatGrams: 25,
      fiberGrams: 9,
      sugarGrams: 8,
      saturatedFatGrams: 6,
      sodiumMg: 940,
    },
    items: [
      {
        name: 'grilled chicken',
        estimatedQuantity: '180 g',
        mostLikelyCalories: 300,
        minimumCalories: 270,
        maximumCalories: 340,
        proteinGrams: 42,
        carbohydrateGrams: 0,
        fatGrams: 11,
      },
      {
        name: 'rice',
        estimatedQuantity: '200 g',
        mostLikelyCalories: 420,
        proteinGrams: 6,
        carbohydrateGrams: 72,
        fatGrams: 14,
      },
    ],
    clarificationQuestions: [
      {
        id: 'oil_amount',
        question: 'Πόσο λάδι χρησιμοποιήθηκε;',
        options: ['Χωρίς λάδι', '1 κουταλιά', 'Δεν γνωρίζω'],
      },
    ],
    summary: 'Chicken and rice.',
  });

  it('διαβάζει εύρος, macros και ερωτήσεις', () => {
    const result = parseAiResponse(full);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;

    expect(result.data.totalCalories).toBe(720);
    expect(result.data.minCalories).toBe(650);
    expect(result.data.maxCalories).toBe(810);
    expect(result.data.macros.proteinGrams).toBe(48);
    expect(result.data.macros.sodiumMg).toBe(940);
    expect(result.data.items[0]!.macros.proteinGrams).toBe(42);
    expect(result.data.items[0]!.minCalories).toBe(270);
    expect(result.data.clarifications).toHaveLength(1);
    expect(result.data.clarifications[0]!.id).toBe('oil_amount');
  });

  it('εξακολουθεί να δέχεται την παλιά μορφή χωρίς macros', () => {
    const legacy = JSON.stringify({
      totalCalories: 500,
      confidence: 0.7,
      items: [{ name: 'soup', estimatedQuantity: '1 bowl', estimatedCalories: 500 }],
      internalReasoningSummary: 'legacy',
    });
    const result = parseAiResponse(legacy);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;

    expect(result.data.totalCalories).toBe(500);
    expect(result.data.minCalories).toBeNull();
    expect(result.data.macros.proteinGrams).toBeNull();
    expect(result.data.clarifications).toHaveLength(0);
  });

  it('διορθώνει ασυνεπές εύρος αντί να το απορρίψει', () => {
    const inconsistent = JSON.stringify({
      mostLikelyCalories: 500,
      minimumCalories: 600,
      maximumCalories: 450,
      confidence: 0.5,
      items: [{ name: 'x', estimatedCalories: 500 }],
    });
    const result = parseAiResponse(inconsistent);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;

    expect(result.data.minCalories).toBeLessThanOrEqual(result.data.totalCalories);
    expect(result.data.maxCalories).toBeGreaterThanOrEqual(result.data.totalCalories);
  });

  it('αθροίζει macros από τα τρόφιμα όταν λείπουν τα συνολικά', () => {
    const noTotals = JSON.stringify({
      mostLikelyCalories: 400,
      confidence: 0.6,
      items: [
        { name: 'a', estimatedCalories: 200, proteinGrams: 10 },
        { name: 'b', estimatedCalories: 200, proteinGrams: 15 },
      ],
    });
    const result = parseAiResponse(noTotals);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.data.macros.proteinGrams).toBe(25);
  });

  it('απορρίπτει ερωτήσεις με λιγότερες από δύο επιλογές', () => {
    const badQuestion = JSON.stringify({
      mostLikelyCalories: 300,
      confidence: 0.6,
      items: [{ name: 'a', estimatedCalories: 300 }],
      clarificationQuestions: [{ id: 'q1', question: 'Ε;', options: ['μόνο ένα'] }],
    });
    const result = parseAiResponse(badQuestion);
    // Το Zod απορρίπτει το question, οπότε ολόκληρη η απάντηση θεωρείται άκυρη.
    expect(result.kind).toBe('invalid');
  });

  it('καθαρίζει markup από τα κείμενα των ερωτήσεων', () => {
    const dirty = JSON.stringify({
      mostLikelyCalories: 300,
      confidence: 0.6,
      items: [{ name: 'a', estimatedCalories: 300 }],
      clarificationQuestions: [
        { id: 'q1', question: '<script>alert(1)</script>Ποσότητα;', options: ['Α', 'Β'] },
      ],
    });
    const result = parseAiResponse(dirty);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.data.clarifications[0]!.question).not.toContain('<');
  });
});
