import { Image } from 'react-native';

/**
 * Το επίσημο NutreLuma logo mark (brand kit v2) — το master mark PNG
 * (gold→blue→violet, διάφανο background) που ζει στο assets/logo-mark.png.
 * Χρησιμοποιείται σε headers, splash/startup και ως avatar/branding στοιχείο.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/logo-mark.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="NutreLuma"
    />
  );
}
