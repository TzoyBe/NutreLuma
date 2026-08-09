import { describe, expect, it } from 'vitest';
import {
  activateMaintenanceSchema,
  updateRangeSchema,
  changeModeSchema,
} from '@/lib/validation/maintenance';

const valid = {
  targetWeightKg: 120,
  lowerBoundaryKg: 118.5,
  upperBoundaryKg: 121.5,
  weighInsPerWeek: 3,
  calorieTarget: 2600,
  applyCalorieTarget: false,
  alertSensitivity: 'MEDIUM',
  confirm: true,
};

describe('activateMaintenanceSchema', () => {
  it('accepts a confirmed, well-ordered payload', () => {
    expect(activateMaintenanceSchema.safeParse(valid).success).toBe(true);
  });

  it('requires explicit confirmation', () => {
    const res = activateMaintenanceSchema.safeParse({ ...valid, confirm: false });
    expect(res.success).toBe(false);
  });

  it('rejects a lower boundary above the target', () => {
    const res = activateMaintenanceSchema.safeParse({ ...valid, lowerBoundaryKg: 121 });
    expect(res.success).toBe(false);
  });

  it('rejects an upper boundary below the target', () => {
    const res = activateMaintenanceSchema.safeParse({ ...valid, upperBoundaryKg: 119 });
    expect(res.success).toBe(false);
  });

  it('defaults applyCalorieTarget to false when omitted', () => {
    const { confirm, applyCalorieTarget, ...rest } = valid;
    const res = activateMaintenanceSchema.safeParse({ ...rest, confirm: true });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.applyCalorieTarget).toBe(false);
  });
});

describe('updateRangeSchema', () => {
  it('enforces ordered boundaries', () => {
    expect(
      updateRangeSchema.safeParse({ targetWeightKg: 120, lowerBoundaryKg: 118, upperBoundaryKg: 122 }).success,
    ).toBe(true);
    expect(
      updateRangeSchema.safeParse({ targetWeightKg: 120, lowerBoundaryKg: 122, upperBoundaryKg: 118 }).success,
    ).toBe(false);
  });
});

describe('changeModeSchema', () => {
  it('accepts valid modes only', () => {
    expect(changeModeSchema.safeParse({ mode: 'MAINTENANCE' }).success).toBe(true);
    expect(changeModeSchema.safeParse({ mode: 'SLEEP' }).success).toBe(false);
  });
});
