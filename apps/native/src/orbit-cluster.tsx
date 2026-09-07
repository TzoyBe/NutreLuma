import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * "Glass Reel" layout: το κεντρικό calorie ring στο κέντρο, με τα macro rings
 * να επιπλέουν γύρω του σαν δορυφόροι πάνω στο aurora background (χωρίς
 * ατομικά glass cards — το βάθος δίνεται από το ίδιο το backdrop).
 * Καθαρά layout component: δεν αγγίζει τη λογική/props των gauges μέσα του.
 */
export function OrbitStage({ children, height = 360 }: { children: ReactNode; height?: number }) {
  return <View style={[styles.stage, { height }]}>{children}</View>;
}

export function OrbitCenter({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

type SatellitePosition = 'top-left' | 'top-right' | 'bottom-center';

const POSITIONS: Record<SatellitePosition, ViewStyle> = {
  'top-left': { top: 4, left: 6 },
  'top-right': { top: 14, right: 2 },
  'bottom-center': { bottom: 0, left: '50%', marginLeft: -66 },
};

/** Δορυφόρος με απαλή, ασύγχρονη κάθετη αιώρηση — δίνει την αίσθηση «liquid». */
export function Satellite({
  position,
  delay = 0,
  children,
}: {
  position: SatellitePosition;
  delay?: number;
  children: ReactNode;
}) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View style={[styles.satellite, POSITIONS[position], { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  satellite: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
