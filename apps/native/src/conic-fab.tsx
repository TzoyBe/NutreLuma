import { useEffect, useRef, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Easing, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { signatureGradient } from './theme';

/**
 * Floating gradient action button (signature gold→blue→violet), με απαλό
 * "breathing" glow — το κύριο add-meal CTA στο Glass Reel dashboard.
 */
export function GradientFab({
  onPress,
  children,
  size = 60,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const shadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] });
  const shadowRadius = pulse.interpolate({ inputRange: [0, 1], outputRange: [14, 22] });

  return (
    <Animated.View
      style={[
        styles.shadowWrap,
        { shadowOpacity, shadowRadius, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Pressable onPress={onPress} style={{ width: size, height: size }}>
        <LinearGradient
          colors={signatureGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}
        >
          {children}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
