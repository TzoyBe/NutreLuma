import { describe, expect, it } from 'vitest';
import { getUniverseMotionPolicy } from './personal-universe-motion';

describe('getUniverseMotionPolicy', () => {
  it('returns immediate static presentation when reduced motion is enabled', () => {
    expect(getUniverseMotionPolicy({ reducedMotion: true, revealIndex: 3 })).toEqual({
      reveal: {
        initialOpacity: 1,
        initialTranslateY: 0,
        duration: 0,
        delay: 0,
      },
      heroDrift: {
        enabled: false,
        amplitude: 0,
        duration: 0,
      },
    });
  });

  it('uses restrained, bounded motion when reduced motion is disabled', () => {
    expect(getUniverseMotionPolicy({ reducedMotion: false, revealIndex: 2 })).toEqual({
      reveal: {
        initialOpacity: 0,
        initialTranslateY: 12,
        duration: 280,
        delay: 120,
      },
      heroDrift: {
        enabled: true,
        amplitude: 4,
        duration: 6000,
      },
    });
  });

  it('caps reveal staggering so long collections do not become sluggish', () => {
    expect(getUniverseMotionPolicy({ reducedMotion: false, revealIndex: 99 }).reveal.delay).toBe(
      240,
    );
  });
});
