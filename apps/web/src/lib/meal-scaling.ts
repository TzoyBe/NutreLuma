import { Prisma } from '@prisma/client';

export interface MacroFields {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}
export interface ScalableItem {
  name: string;
  estimatedQuantity: string | null;
  finalCalories: number | null;
  macros: MacroFields;
}
export interface ScalableComposition {
  finalCalories: number | null;
  macros: MacroFields;
  items: ScalableItem[];
}

export const SERVING_PRESETS = [0.5, 1, 1.5, 2] as const;
const MAX_MULTIPLIER = 20;
const GRAM_KEYS = ['proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fiberGrams', 'sugarGrams', 'saturatedFatGrams'] as const;

/** Decimal * multiplier, 2dp. null -> null. */
function scaleGrams(value: number | null, m: Prisma.Decimal): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value).mul(m).toDecimalPlaces(2).toNumber();
}
/** Decimal * multiplier, rounded to int. null -> null. */
function scaleInt(value: number | null, m: Prisma.Decimal): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value).mul(m).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}
function scaleMacros(macros: MacroFields, m: Prisma.Decimal): MacroFields {
  const out = { sodiumMg: scaleInt(macros.sodiumMg, m) } as MacroFields;
  for (const key of GRAM_KEYS) out[key] = scaleGrams(macros[key], m);
  return out;
}

export function scaleComposition(base: ScalableComposition, multiplier: number): ScalableComposition {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > MAX_MULTIPLIER) {
    throw new Error(`Invalid serving multiplier: ${multiplier}`);
  }
  const m = new Prisma.Decimal(multiplier);
  return {
    finalCalories: scaleInt(base.finalCalories, m),
    macros: scaleMacros(base.macros, m),
    items: base.items.map((i) => ({
      name: i.name,
      estimatedQuantity: i.estimatedQuantity,
      finalCalories: scaleInt(i.finalCalories, m),
      macros: scaleMacros(i.macros, m),
    })),
  };
}
