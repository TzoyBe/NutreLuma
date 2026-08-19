import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from './theme';

/**
 * Branded loader για τις στιγμές που περιμένουμε το AI (ανάλυση γεύματος,
 * refinement, δημιουργία recipe plan). Ένα περιστρεφόμενο τόξο με το signature
 * gradient (gold→blue→violet) + μήνυμα, ώστε ο χρήστης να ξέρει ότι δουλεύει.
 */
export function AiSpinner({ size = 48, stroke = 5 }: { size?: number; stroke?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 950,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="aiSpinnerGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFB703" />
            <Stop offset="0.5" stopColor="#2563EB" />
            <Stop offset="1" stopColor="#7C3AED" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceSoft}
          strokeWidth={stroke}
          fill="none"
          opacity={0.5}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#aiSpinnerGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * 0.7} ${circ * 0.3}`}
        />
      </Svg>
    </Animated.View>
  );
}

export function AiLoadingCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.card}>
      <AiSpinner size={52} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});
