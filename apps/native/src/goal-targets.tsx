import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

/**
 * «Daily targets» για τη σελίδα Goals — όμορφες κάρτες με χρωματικό accent ανά
 * θρεπτικό (brand nutrition colors) και animated count-up των αριθμών κατά τη
 * φόρτωση, ώστε να δίνει ζωντάνια αντί για στατικά νούμερα.
 */

function TargetStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === null) return undefined;
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);

  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value === null ? '--' : display.toLocaleString()}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

export function GoalTargets({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  return (
    <View style={styles.grid}>
      <TargetStat label="Calories" value={calories} unit="kcal" color="#3B6FF5" />
      <TargetStat label="Protein" value={protein} unit="g" color="#38BDF8" />
      <TargetStat label="Carbs" value={carbs} unit="g" color="#FFB703" />
      <TargetStat label="Fat" value={fat} unit="g" color="#A855F7" />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    flexDirection: 'row',
    minHeight: 78,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    width: 5,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
  },
});
