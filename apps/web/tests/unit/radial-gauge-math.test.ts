import { describe, expect, it } from 'vitest';
import { angleFraction, applyAntiWrap, snapValue } from '@/components/dashboard/radial-gauge-math';

describe('angleFraction', () => {
  // center at (0,0); screen coords (y grows downward)
  it('top = 0', () => expect(angleFraction(0, 0, 0, -10)).toBeCloseTo(0, 5));
  it('right = 0.25', () => expect(angleFraction(0, 0, 10, 0)).toBeCloseTo(0.25, 5));
  it('bottom = 0.5', () => expect(angleFraction(0, 0, 0, 10)).toBeCloseTo(0.5, 5));
  it('left = 0.75', () => expect(angleFraction(0, 0, -10, 0)).toBeCloseTo(0.75, 5));
});

describe('applyAntiWrap', () => {
  it('null prev returns raw', () => expect(applyAntiWrap(0.3, null)).toBe(0.3));
  it('near-full prev + near-zero raw clamps to 1', () => expect(applyAntiWrap(0.02, 0.98)).toBe(1));
  it('near-zero prev + near-full raw clamps to 0', () => expect(applyAntiWrap(0.98, 0.02)).toBe(0));
  it('small move passes through', () => expect(applyAntiWrap(0.5, 0.48)).toBe(0.5));
});

describe('snapValue', () => {
  it('half of 3000 snaps to 1500', () => expect(snapValue(0.5, 3000, 50)).toBe(1500));
  it('rounds to nearest 50', () => expect(snapValue(0.51, 100, 50)).toBe(50));
  it('clamps to scaleMax', () => expect(snapValue(0.999, 100, 50)).toBe(100));
  it('zero fraction is 0', () => expect(snapValue(0, 3000, 50)).toBe(0));
});
