import { Image, StyleSheet, View } from 'react-native';

/**
 * Το επίσημο portrait background του v4 brand kit λειτουργεί ως διακριτικό
 * theme layer πίσω από το υπάρχον interface. Η χαμηλή αδιαφάνεια κρατά τα
 * δεδομένα και τις glass επιφάνειες ευανάγνωστα σε iOS και Android.
 */
export function GlassBackdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Image
        source={require('../assets/liquid-glass-bg.png')}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, styles.artwork]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#081020',
  },
  artwork: {
    opacity: 0.12,
  },
});
