import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/**
 * "Glass Reel" macro cluster: μια σειρά δορυφόρων πάνω, το calorie ring στο
 * κέντρο, μια σειρά δορυφόρων κάτω. Σκόπιμα ΟΧΙ απόλυτη επικάλυψη γύρω από το
 * κεντρικό ring — τα πραγματικά μεγέθη (248px κέντρο / 132px δορυφόρος) δεν
 * χωράνε "ορμπιτάλ" γύρω-γύρω σε πλάτος τηλεφώνου χωρίς να κόβονται. Η
 * αιώρηση (float) μένει, διορθώνοντας μόνο το layout ώστε να ΜΗΝ επικαλύπτονται.
 */
export function OrbitStage({ children }: { children: ReactNode }) {
  return <View style={styles.stage}>{children}</View>;
}

export function OrbitRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function OrbitCenter({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

/** Δορυφόρος με απαλή, ασύγχρονη κάθετη αιώρηση — δίνει την αίσθηση «liquid». */
export function Satellite({ delay = 0, children }: { delay?: number; children: ReactNode }) {
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

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
