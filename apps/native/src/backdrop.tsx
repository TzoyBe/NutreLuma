import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Liquid-glass backdrop για όλο το app: σκούρο διαγώνιο gradient με δύο
 * απαλά χρωματιστά «orbs» (primary/accent) για βάθος, ώστε οι ημιδιαφανείς
 * glass επιφάνειες από πάνω να διαβάζονται σαν γυαλί. Υλοποιείται εξ
 * ολοκλήρου με react-native-svg (χωρίς εξάρτηση από expo-linear-gradient),
 * ώστε να αποδίδει σωστά και σε iOS.
 */
export function GlassBackdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 100 170"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="bgBase" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0C1430" />
            <Stop offset="0.55" stopColor="#080C1A" />
            <Stop offset="1" stopColor="#05070F" />
          </LinearGradient>
          <RadialGradient id="orbPrimary" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="hsl(221, 83%, 53%)" stopOpacity="0.4" />
            <Stop offset="1" stopColor="hsl(221, 83%, 53%)" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbAccent" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="hsl(43, 100%, 51%)" stopOpacity="0.22" />
            <Stop offset="1" stopColor="hsl(43, 100%, 51%)" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="170" fill="url(#bgBase)" />
        <Circle cx="14" cy="16" r="64" fill="url(#orbPrimary)" />
        <Circle cx="90" cy="158" r="70" fill="url(#orbAccent)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#05070F',
  },
});
