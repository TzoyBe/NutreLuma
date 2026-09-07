import type { ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

/**
 * Dynamic-island-style πάνω pill: σύντομο, σημαντικό status ("860 kcal
 * υπόλοιπο"). Ίδιο ύφος με GlassCard αλλά πιο σκοτεινό/συμπυκνωμένο, όπως το
 * iOS Dynamic Island — floating πάνω από το scroll content, όχι μέσα σε λίστα.
 */
export function StatusIsland({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        {icon}
        <Text style={styles.text}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,6,13,0.5)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 18,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  text: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text,
  },
});
