import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from './theme';

/**
 * Liquid-glass επιφάνεια — mobile αντίστοιχο των web κλάσεων `.glass` +
 * `.glass-specular`. Αντικαθιστά τα παλιά «επίπεδα» cards ώστε web & mobile
 * να έχουν ΕΝΙΑΙΑ εμφάνιση: frosted blur, layered gradient fill, specular
 * top-highlight, λεπτό φωτεινό border και βαθιά soft σκιά.
 *
 * Drop-in αντικαταστάτης του `<View>`: δέχεται το ίδιο `style` (padding/sizing/
 * layout) και το εφαρμόζει στο εξωτερικό View, οπότε η μετατροπή μιας κάρτας
 * είναι απλώς `View` → `GlassCard`. Το frosted background μπαίνει σε ένα
 * absolute-fill layer που αυτο-κόβεται στη γωνία (overflow:hidden), ενώ το
 * εξωτερικό View μένει overflow:visible ώστε η σκιά να ΜΗΝ κόβεται σε iOS.
 *
 * Το `style` ΔΕΝ πρέπει να ορίζει backgroundColor/border/borderRadius — αυτά τα
 * δίνει το component (radius ενιαίο 24, ίδιο με το web `--radius`).
 */
export function GlassCard({
  style,
  children,
  radius = 24,
  intensity = 24,
  ...props
}: ViewProps & { radius?: number; intensity?: number }) {
  return (
    <View style={[styles.base, { borderRadius: radius }, style]} {...props}>
      <View
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
        pointerEvents="none"
      >
        <BlurView
          intensity={intensity}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            {/* Base fill: surface → surface_2, ημιδιαφανές (web glass-bg → glass-tint). */}
            <LinearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.surface} stopOpacity={0.66} />
              <Stop offset="1" stopColor={colors.surfaceSoft} stopOpacity={0.5} />
            </LinearGradient>
            {/* Specular top-highlight (web ::before). */}
            <LinearGradient id="glassSpec" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#BFD2F8" stopOpacity={0.28} />
              <Stop offset="0.3" stopColor="#BFD2F8" stopOpacity={0} />
            </LinearGradient>
            {/* Διαγώνια liquid-edge ανταύγεια (web liquid-edge tint). */}
            <LinearGradient id="glassEdge" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#9E7BF2" stopOpacity={0.12} />
              <Stop offset="0.34" stopColor="#9E7BF2" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glassFill)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glassEdge)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glassSpec)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#05070F',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
});
