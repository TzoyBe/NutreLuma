import type { ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, signatureGradient } from './theme';

const CARD_W = 116;
const CARD_H = 156;

/** Οριζόντιο "film reel" καρουζέλ γευμάτων — αντικαθιστά την κάθετη λίστα. */
export function MealReel({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.reel}
    >
      {children}
    </ScrollView>
  );
}

export function MealReelCard({
  onPress,
  photo,
  title,
  meta,
  kcal,
}: {
  onPress: () => void;
  photo: ReactNode;
  title: string;
  meta: string;
  kcal: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={StyleSheet.absoluteFill}>{photo}</View>
      <View style={styles.footer}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.footerInner}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {meta} · {Math.round(kcal)} kcal
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function AddMealReelCard({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, styles.addCard]}>
      <LinearGradient
        colors={signatureGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.addBubble}
      >
        <Plus size={22} color={colors.white} />
      </LinearGradient>
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reel: {
    gap: 12,
    paddingRight: 8,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceSoft,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  footerInner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
});
