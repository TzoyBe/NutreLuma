import { describe, expect, it } from 'vitest';
import { waterEntrySchema, activityEntrySchema } from '@/lib/validation/tracking';

const DATE = '2026-08-17';

describe('waterEntrySchema', () => {
  it('accepts a negative correction delta', () => {
    expect(waterEntrySchema.parse({ entryDate: DATE, volumeMl: -200 }).volumeMl).toBe(-200);
  });
  it('accepts a positive delta', () => {
    expect(waterEntrySchema.parse({ entryDate: DATE, volumeMl: 250 }).volumeMl).toBe(250);
  });
  it('rejects zero', () => {
    expect(() => waterEntrySchema.parse({ entryDate: DATE, volumeMl: 0 })).toThrow();
  });
  it('rejects out-of-range magnitude', () => {
    expect(() => waterEntrySchema.parse({ entryDate: DATE, volumeMl: 25000 })).toThrow();
  });
});

describe('activityEntrySchema', () => {
  it('accepts a negative steps delta', () => {
    expect(activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: -300 }).steps).toBe(-300);
  });
  it('rejects zero steps with no duration', () => {
    expect(() => activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: 0 })).toThrow();
  });
  it('rejects out-of-range steps', () => {
    expect(() => activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: -300000 })).toThrow();
  });
});
