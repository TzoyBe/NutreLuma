export type UniverseMotionPolicy = {
  reveal: {
    initialOpacity: 0 | 1;
    initialTranslateY: number;
    duration: number;
    delay: number;
  };
  heroDrift: {
    enabled: boolean;
    amplitude: number;
    duration: number;
  };
};

export function getUniverseMotionPolicy({
  reducedMotion,
  revealIndex,
}: {
  reducedMotion: boolean;
  revealIndex: number;
}): UniverseMotionPolicy {
  if (reducedMotion) {
    return {
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
    };
  }

  return {
    reveal: {
      initialOpacity: 0,
      initialTranslateY: 12,
      duration: 280,
      delay: Math.min(Math.max(revealIndex, 0), 4) * 60,
    },
    heroDrift: {
      enabled: true,
      amplitude: 4,
      duration: 6000,
    },
  };
}
