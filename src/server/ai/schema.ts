import { z } from 'zod';
import { CALORIE_LIMITS } from '@/lib/constants';

/**
 * Επικύρωση & καθαρισμός της απάντησης του AI.
 * Τίποτα από την απάντηση δεν θεωρείται έμπιστο: τιμές clamp-άρονται, κείμενα
 * κόβονται, και τα σύνολα ελέγχονται ως προς τη συνέπειά τους.
 *
 * Το schema δέχεται ΚΑΙ την παλιά μορφή (`totalCalories`/`estimatedCalories`)
 * ΚΑΙ τη νέα (`mostLikelyCalories` με εύρος και macros), ώστε μια απάντηση από
 * παλιότερο prompt ή cache να μη θεωρείται άκυρη.
 */

/** Ανώτατα λογικά όρια — αποτρέπουν παράλογες τιμές να φτάσουν στη βάση. */
const MAX_MACRO_GRAMS = 2000;
const MAX_SODIUM_MG = 100_000;

const caloriesField = z.coerce.number().finite().min(0).max(CALORIE_LIMITS.hardMaxPerMeal);
const gramsField = z.coerce.number().finite().min(0).max(MAX_MACRO_GRAMS);
const sodiumField = z.coerce.number().finite().min(0).max(MAX_SODIUM_MG);

export const aiMacrosSchema = z
  .object({
    proteinGrams: gramsField.optional(),
    carbohydrateGrams: gramsField.optional(),
    fatGrams: gramsField.optional(),
    fiberGrams: gramsField.optional(),
    sugarGrams: gramsField.optional(),
    saturatedFatGrams: gramsField.optional(),
    sodiumMg: sodiumField.optional(),
  })
  .partial();

export const aiItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    estimatedQuantity: z.string().trim().max(60).optional().default(''),
    // Παλιό όνομα ή νέο — τουλάχιστον ένα από τα δύο.
    estimatedCalories: caloriesField.optional(),
    mostLikelyCalories: caloriesField.optional(),
    minimumCalories: caloriesField.optional(),
    maximumCalories: caloriesField.optional(),
  })
  .merge(aiMacrosSchema)
  .refine(
    (item) => item.estimatedCalories !== undefined || item.mostLikelyCalories !== undefined,
    { message: 'missing calories' },
  );

export const aiClarificationSchema = z.object({
  id: z.string().trim().min(1).max(60),
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(8),
});

export const aiSuccessSchema = z
  .object({
    totalCalories: caloriesField.optional(),
    mostLikelyCalories: caloriesField.optional(),
    minimumCalories: caloriesField.optional(),
    maximumCalories: caloriesField.optional(),
    confidence: z.coerce.number().finite().min(0).max(1),
    items: z.array(aiItemSchema).min(1).max(30),
    macros: aiMacrosSchema.optional(),
    clarificationQuestions: z.array(aiClarificationSchema).max(6).optional(),
    // Το `summary` είναι το νέο όνομα του `internalReasoningSummary`.
    summary: z.string().trim().max(400).optional(),
    internalReasoningSummary: z.string().trim().max(400).optional(),
  })
  .refine((data) => data.totalCalories !== undefined || data.mostLikelyCalories !== undefined, {
    message: 'missing total calories',
  });

export const aiErrorSchema = z.object({
  error: z.string().trim().min(1).max(60),
  message: z.string().trim().max(300).optional().default(''),
});

export type AiSuccess = z.infer<typeof aiSuccessSchema>;

export interface AnalysisMacros {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

export interface NormalizedItem {
  name: string;
  estimatedQuantity: string;
  /** Η πιθανότερη εκτίμηση. Διατηρεί το παλιό όνομα για συμβατότητα. */
  estimatedCalories: number;
  minCalories: number | null;
  maxCalories: number | null;
  macros: AnalysisMacros;
}

export interface NormalizedClarification {
  id: string;
  question: string;
  options: string[];
}

export interface NormalizedAnalysis {
  totalCalories: number;
  minCalories: number | null;
  maxCalories: number | null;
  confidence: number;
  items: NormalizedItem[];
  macros: AnalysisMacros;
  clarifications: NormalizedClarification[];
  /** Σύντομο summary μόνο για debugging — ποτέ chain-of-thought, ποτέ στον χρήστη. */
  internalReasoningSummary: string;
}

export type ParseResult =
  | { kind: 'ok'; data: NormalizedAnalysis }
  | { kind: 'no_food'; code: string }
  | { kind: 'invalid'; reason: string };

/**
 * Απομονώνει το JSON object από την απάντηση, ακόμη κι αν το μοντέλο πρόσθεσε
 * code fences ή κείμενο γύρω του.
 */
export function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  const start = text.indexOf('{');
  if (start === -1) return null;

  // Ισοστάθμιση αγκυλών, αγνοώντας ό,τι βρίσκεται μέσα σε strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Αφαιρεί control characters και σύμβολα markup (άμυνα σε βάθος κατά XSS). */
const CONTROL_AND_MARKUP = new RegExp('[\\u0000-\\u001F\\u007F<>]', 'g');

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(CONTROL_AND_MARKUP, '').trim().slice(0, maxLength);
}

const EMPTY_MACROS: AnalysisMacros = {
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
  fiberGrams: null,
  sugarGrams: null,
  saturatedFatGrams: null,
  sodiumMg: null,
};

type MacroInput = z.infer<typeof aiMacrosSchema>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMacros(input: MacroInput | undefined): AnalysisMacros {
  if (!input) return { ...EMPTY_MACROS };
  const grams = (v: number | undefined) =>
    v === undefined ? null : round2(Math.min(Math.max(v, 0), MAX_MACRO_GRAMS));
  return {
    proteinGrams: grams(input.proteinGrams),
    carbohydrateGrams: grams(input.carbohydrateGrams),
    fatGrams: grams(input.fatGrams),
    fiberGrams: grams(input.fiberGrams),
    sugarGrams: grams(input.sugarGrams),
    saturatedFatGrams: grams(input.saturatedFatGrams),
    sodiumMg:
      input.sodiumMg === undefined
        ? null
        : Math.round(Math.min(Math.max(input.sodiumMg, 0), MAX_SODIUM_MG)),
  };
}

/** Αθροίζει macros των τροφίμων· null όταν κανένα τρόφιμο δεν δίνει την τιμή. */
function sumItemMacros(items: NormalizedItem[]): AnalysisMacros {
  const keys = Object.keys(EMPTY_MACROS) as Array<keyof AnalysisMacros>;
  const result = { ...EMPTY_MACROS };
  for (const key of keys) {
    const values = items.map((item) => item.macros[key]).filter((v): v is number => v !== null);
    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    result[key] = key === 'sodiumMg' ? Math.round(sum) : round2(sum);
  }
  return result;
}

/** Κρατά την ιεραρχία min <= πιθανότερο <= max, αγνοώντας ασυνεπείς τιμές. */
function normalizeRange(
  mostLikely: number,
  min: number | undefined,
  max: number | undefined,
): { min: number | null; max: number | null } {
  const safeMin = min === undefined ? null : Math.round(Math.min(min, mostLikely));
  const safeMax = max === undefined ? null : Math.round(Math.max(max, mostLikely));
  return {
    min: safeMin === null ? null : Math.max(0, safeMin),
    max: safeMax === null ? null : Math.min(safeMax, CALORIE_LIMITS.hardMaxPerMeal),
  };
}

export function normalizeAnalysis(data: AiSuccess): NormalizedAnalysis {
  const items: NormalizedItem[] = data.items
    .map((item) => {
      const mostLikely = Math.max(
        0,
        Math.round(item.mostLikelyCalories ?? item.estimatedCalories ?? 0),
      );
      const range = normalizeRange(mostLikely, item.minimumCalories, item.maximumCalories);
      return {
        name: sanitizeText(item.name, 120),
        estimatedQuantity: sanitizeText(item.estimatedQuantity ?? '', 60),
        estimatedCalories: mostLikely,
        minCalories: range.min,
        maxCalories: range.max,
        macros: normalizeMacros(item),
      };
    })
    .filter((item) => item.name.length > 0)
    .slice(0, 30);

  const itemsSum = items.reduce((sum, item) => sum + item.estimatedCalories, 0);
  let total = Math.round(data.mostLikelyCalories ?? data.totalCalories ?? 0);

  // Το μοντέλο μπορεί να δώσει ασυνεπές σύνολο· εμπιστευόμαστε το άθροισμα
  // των τροφίμων όταν η απόκλιση είναι μεγάλη.
  if (itemsSum > 0) {
    const deviation = Math.abs(total - itemsSum) / itemsSum;
    if (deviation > 0.25) total = itemsSum;
  }
  if (total <= 0) total = itemsSum;

  total = Math.min(Math.max(total, 0), CALORIE_LIMITS.hardMaxPerMeal);

  const totalRange = normalizeRange(total, data.minimumCalories, data.maximumCalories);

  // Τα συνολικά macros υπερισχύουν· αλλιώς προκύπτουν από τα τρόφιμα.
  const declared = normalizeMacros(data.macros);
  const derived = sumItemMacros(items);
  const macros = { ...EMPTY_MACROS };
  for (const key of Object.keys(EMPTY_MACROS) as Array<keyof AnalysisMacros>) {
    macros[key] = declared[key] ?? derived[key];
  }

  const seen = new Set<string>();
  const clarifications: NormalizedClarification[] = (data.clarificationQuestions ?? [])
    .map((q) => ({
      id: sanitizeText(q.id, 60),
      question: sanitizeText(q.question, 200),
      options: q.options.map((o) => sanitizeText(o, 80)).filter((o) => o.length > 0),
    }))
    .filter((q) => {
      if (!q.id || !q.question || q.options.length < 2) return false;
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
    .slice(0, 6);

  return {
    totalCalories: total,
    minCalories: totalRange.min,
    maxCalories: totalRange.max,
    confidence: Math.min(1, Math.max(0, Number(data.confidence.toFixed(2)))),
    items,
    macros,
    clarifications,
    internalReasoningSummary: sanitizeText(
      data.summary ?? data.internalReasoningSummary ?? '',
      400,
    ),
  };
}

export function parseAiResponse(raw: string): ParseResult {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return { kind: 'invalid', reason: 'NO_JSON_FOUND' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'invalid', reason: 'JSON_PARSE_ERROR' };
  }

  const asError = aiErrorSchema.safeParse(parsed);
  if (asError.success) {
    return { kind: 'no_food', code: asError.data.error.toUpperCase().slice(0, 60) };
  }

  const asSuccess = aiSuccessSchema.safeParse(parsed);
  if (!asSuccess.success) {
    return { kind: 'invalid', reason: 'SCHEMA_MISMATCH' };
  }

  const normalized = normalizeAnalysis(asSuccess.data);
  if (normalized.items.length === 0 || normalized.totalCalories <= 0) {
    return { kind: 'invalid', reason: 'EMPTY_RESULT' };
  }
  return { kind: 'ok', data: normalized };
}
