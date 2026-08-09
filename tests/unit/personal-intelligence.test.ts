import { describe, expect, it } from 'vitest';
import { calculateMealDataConfidence } from '@/server/services/personal-intelligence';

describe('personal intelligence confidence rules', () => {
  it('prioritizes verified sources', () => {
    expect(calculateMealDataConfidence({ source: 'BARCODE', confirmed: true })).toBeGreaterThan(0.9);
    expect(calculateMealDataConfidence({ source: 'AI_IMAGE', confirmed: false, aiConfidence: 0.4 })).toBeLessThan(0.6);
  });

  it('keeps AI confidence bounded and confirmation-aware', () => {
    const draft = calculateMealDataConfidence({ source: 'AI_IMAGE', confirmed: false, aiConfidence: 1, hasRange: true });
    const confirmed = calculateMealDataConfidence({ source: 'AI_IMAGE', confirmed: true, aiConfidence: 1, hasRange: true });
    expect(draft).toBeGreaterThanOrEqual(0);
    expect(draft).toBeLessThan(confirmed);
    expect(confirmed).toBeLessThanOrEqual(1);
  });
});
