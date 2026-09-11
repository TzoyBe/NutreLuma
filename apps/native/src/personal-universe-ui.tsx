import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassCard } from './glass-card';
import { getUniverseMotionPolicy } from './personal-universe-motion';
import { colors } from './theme';
import type { NativeUniverseTone } from './personal-universe-model';

export type UniverseHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  center: ReactNode;
  satellites: ReactNode[];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export type UniverseMetricProps = {
  label: string;
  value: string | number;
  unit?: string;
  tone?: NativeUniverseTone;
  style?: StyleProp<ViewStyle>;
};

export type UniverseActionTileProps = {
  label: string;
  value?: string | number;
  detail?: string;
  tone?: NativeUniverseTone;
  icon?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type UniverseRevealProps = {
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const toneColors: Record<NativeUniverseTone, string> = {
  cyan: colors.cyan,
  gold: colors.accent,
  violet: colors.violet,
  emerald: colors.success,
  blue: colors.blueBright,
};

export function useReducedMotionPreference(): boolean {
  // Stay conservative until the asynchronous native preference resolves.
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      preferenceChanged = true;
      setReducedMotion(enabled);
    });

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted && !preferenceChanged) setReducedMotion(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function UniverseReveal({ index, children, style }: UniverseRevealProps) {
  const reducedMotion = useReducedMotionPreference();
  const policy = useMemo(
    () => getUniverseMotionPolicy({ reducedMotion, revealIndex: index }),
    [index, reducedMotion],
  );
  const progress = useRef(new Animated.Value(1)).current;

  useLayoutEffect(() => {
    if (reducedMotion) {
      progress.setValue(policy.reveal.initialOpacity);
      return;
    }

    progress.setValue(policy.reveal.initialOpacity);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: policy.reveal.duration,
      delay: policy.reveal.delay,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [
    policy.reveal.delay,
    policy.reveal.duration,
    policy.reveal.initialOpacity,
    progress,
    reducedMotion,
  ]);

  if (reducedMotion) return <View style={style}>{children}</View>;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [policy.reveal.initialTranslateY, 0],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function UniverseHero({
  eyebrow,
  title,
  subtitle,
  center,
  satellites,
  accessibilityLabel,
  style,
}: UniverseHeroProps) {
  const reducedMotion = useReducedMotionPreference();
  const policy = useMemo(
    () => getUniverseMotionPolicy({ reducedMotion, revealIndex: 0 }),
    [reducedMotion],
  );
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!policy.heroDrift.enabled) {
      drift.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: policy.heroDrift.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: -1,
          duration: policy.heroDrift.duration * 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: policy.heroDrift.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, policy.heroDrift.duration, policy.heroDrift.enabled]);

  const translateY = drift.interpolate({
    inputRange: [-1, 1],
    outputRange: [-policy.heroDrift.amplitude, policy.heroDrift.amplitude],
  });

  return (
    <GlassCard
      radius={32}
      intensity={30}
      style={[styles.hero, style]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.heroDecoration}
      >
        <View style={styles.heroGlowBlue} />
        <View style={styles.heroGlowViolet} />
        <Animated.View style={[styles.heroOrbit, { transform: [{ translateY }] }]} />
        <View style={[styles.heroParticle, styles.heroParticleGold]} />
        <View style={[styles.heroParticle, styles.heroParticleEmerald]} />
      </View>

      <View
        style={styles.heroCopy}
        accessible
        accessibilityLabel={
          accessibilityLabel ?? `${eyebrow}. ${title}${subtitle ? `. ${subtitle}` : ''}`
        }
      >
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.heroStage}>
        <Animated.View style={[styles.heroCenter, { transform: [{ translateY }] }]}>
          {center}
        </Animated.View>
        <View style={styles.satelliteRow}>
          {satellites.map((satellite, index) => (
            <View key={index} style={styles.satelliteSlot}>
              {satellite}
            </View>
          ))}
        </View>
      </View>
    </GlassCard>
  );
}

export function UniverseMetric({
  label,
  value,
  unit,
  tone = 'blue',
  style,
}: UniverseMetricProps) {
  const toneColor = toneColors[tone];

  return (
    <View
      style={[styles.metric, { borderTopColor: toneColor }, style]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
    >
      <View style={[styles.metricDot, { backgroundColor: toneColor }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text selectable style={styles.metricValue}>
        {value}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function UniverseActionTile({
  label,
  value,
  detail,
  tone = 'blue',
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}: UniverseActionTileProps) {
  const toneColor = toneColors[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}${value === undefined ? '' : `, ${value}`}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionPressable,
        style,
        disabled ? styles.actionDisabled : null,
        pressed ? styles.actionPressed : null,
      ]}
    >
      <GlassCard radius={24} intensity={20} style={[styles.actionTile, { borderTopColor: toneColor }]}>
        <View style={styles.actionHeader}>
          {icon ? <View style={[styles.actionIcon, { borderColor: toneColor }]}>{icon}</View> : null}
          {value !== undefined ? (
            <Text selectable style={[styles.actionValue, { color: toneColor }]}>
              {value}
            </Text>
          ) : null}
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    minHeight: 360,
    padding: 22,
    gap: 22,
    backgroundColor: 'rgba(11, 16, 32, 0.92)',
    borderTopColor: 'rgba(225, 234, 255, 0.58)',
    borderCurve: 'continuous',
  },
  heroDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 32,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  heroGlowBlue: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -74,
    top: -82,
    backgroundColor: 'rgba(37, 99, 235, 0.17)',
  },
  heroGlowViolet: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    left: -88,
    bottom: -78,
    backgroundColor: 'rgba(103, 70, 232, 0.14)',
  },
  heroOrbit: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    alignSelf: 'center',
    top: 82,
    borderWidth: 1,
    borderColor: 'rgba(191, 210, 248, 0.18)',
  },
  heroParticle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroParticleGold: {
    right: 42,
    top: 116,
    backgroundColor: colors.accent,
  },
  heroParticleEmerald: {
    left: 34,
    bottom: 96,
    backgroundColor: colors.success,
  },
  heroCopy: {
    gap: 5,
  },
  eyebrow: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
  },
  heroSubtitle: {
    maxWidth: 520,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroStage: {
    alignItems: 'center',
    gap: 18,
  },
  heroCenter: {
    width: 144,
    minHeight: 144,
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(21, 29, 53, 0.9)',
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: 'rgba(191, 210, 248, 0.3)',
    borderTopColor: 'rgba(225, 234, 255, 0.68)',
  },
  satelliteRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  satelliteSlot: {
    minWidth: 92,
    flexGrow: 1,
    flexBasis: 92,
    maxWidth: 180,
  },
  metric: {
    minHeight: 84,
    padding: 12,
    gap: 3,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: 'rgba(191, 210, 248, 0.2)',
    backgroundColor: 'rgba(17, 24, 46, 0.9)',
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  actionPressable: {
    minHeight: 96,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  actionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionTile: {
    flex: 1,
    minHeight: 96,
    padding: 14,
    gap: 5,
    backgroundColor: 'rgba(17, 24, 46, 0.88)',
    borderTopWidth: 2,
    borderCurve: 'continuous',
  },
  actionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionValue: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  actionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});
