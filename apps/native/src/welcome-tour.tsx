import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  TrendingDown,
  Trophy,
} from 'lucide-react-native';
import { colors } from './theme';
import { LogoMark } from './logo';

/**
 * Ξενάγηση καλωσορίσματος — native αντίστοιχο του web welcome-tour.tsx:
 * full-screen carousel με 5 slides, το καθένα με ένα ζωντανό SVG preview της
 * αντίστοιχης οθόνης, pagination dots, back/next και swipe.
 */

const PRIMARY = '#2563EB';
const ACCENT = '#FFB703';
const TRACK = 'hsl(224, 30%, 16%)';

type Slide = { id: string; title: (name: string) => string; body: string; Preview: () => ReactNode };

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    title: (name) => `Welcome, ${name}!`,
    body: 'Your smart nutrition companion. Here is what you can do in a few taps.',
    Preview: WelcomePreview,
  },
  {
    id: 'snap',
    title: () => 'Snap your meal',
    body: 'Take a photo and AI estimates the calories and macros for you.',
    Preview: SnapPreview,
  },
  {
    id: 'track',
    title: () => 'Track your day',
    body: 'Calories, protein, carbs and fat — all at a glance.',
    Preview: TrackPreview,
  },
  {
    id: 'progress',
    title: () => 'See your progress',
    body: 'Weight trends, stats and insights that keep you on track.',
    Preview: ProgressPreview,
  },
  {
    id: 'goals',
    title: () => 'Reach your goals',
    body: 'Goals, milestones and achievements that keep you motivated.',
    Preview: GoalsPreview,
  },
];

export function WelcomeTour({ firstName, onDone }: { firstName: string; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const directionRef = useRef(1);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [index, anim]);

  const go = useCallback((next: number, dir: number) => {
    directionRef.current = dir;
    setIndex(next);
  }, []);

  const next = useCallback(() => {
    if (last) onDone();
    else go(index + 1, 1);
  }, [last, onDone, go, index]);

  const back = useCallback(() => {
    if (index > 0) go(index - 1, -1);
  }, [index, go]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -48) next();
        else if (g.dx > 48) back();
      },
    }),
  ).current;

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [directionRef.current >= 0 ? 28 : -28, 0],
  });

  const Preview = slide.Preview;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <LogoMark size={24} />
          <Text style={styles.brandText}>
            Nutre<Text style={styles.brandAccent}>luma</Text>
          </Text>
        </View>
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body} {...panResponder.panHandlers}>
        <Animated.View style={[styles.slide, { opacity: anim, transform: [{ translateX }] }]}>
          <View style={styles.previewWrap}>
            <View style={styles.previewCard}>
              <Preview />
            </View>
          </View>
          <Text style={styles.title}>{slide.title(firstName)}</Text>
          <Text style={styles.copy}>{slide.body}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => go(i, i > index ? 1 : -1)}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>
        <View style={styles.buttons}>
          {index > 0 ? (
            <Pressable onPress={back} style={[styles.button, styles.buttonGhost]}>
              <ChevronLeft size={18} color={colors.text} />
              <Text style={styles.buttonGhostText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={next} style={[styles.button, styles.buttonPrimary]}>
            <Text style={styles.buttonPrimaryText}>{last ? 'Get started' : 'Next'}</Text>
            {last ? null : <ChevronRight size={18} color={colors.white} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ---------- Slide previews (react-native-svg) ---------- */

function PreviewCard({ children }: { children: ReactNode }) {
  return <View style={styles.previewInner}>{children}</View>;
}

function WelcomePreview() {
  return (
    <PreviewCard>
      <View style={styles.welcomeGlow}>
        <LogoMark size={78} />
      </View>
      <View style={[styles.sparkle, { top: 22, right: 22 }]}>
        <Sparkles size={22} color={PRIMARY} />
      </View>
      <View style={[styles.sparkle, { bottom: 26, left: 26 }]}>
        <Sparkles size={15} color="rgba(37,99,235,0.7)" />
      </View>
    </PreviewCard>
  );
}

function SnapPreview() {
  const chips = [
    { label: 'kcal', value: '540' },
    { label: 'P', value: '32g' },
    { label: 'C', value: '48g' },
    { label: 'F', value: '19g' },
  ];
  return (
    <PreviewCard>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={styles.snapRing}>
          <View style={styles.snapRingInner} />
          <View style={styles.snapCamera}>
            <Camera size={16} color={colors.white} />
          </View>
        </View>
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip.label} style={styles.chip}>
              <Text style={styles.chipValue}>{chip.value} </Text>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </PreviewCard>
  );
}

function TrackPreview() {
  const r = 34;
  const len = 2 * Math.PI * r;
  const macros = [
    { w: 0.72, color: PRIMARY },
    { w: 0.54, color: ACCENT },
    { w: 0.38, color: 'rgba(37,99,235,0.7)' },
  ];
  return (
    <PreviewCard>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={styles.trackRingWrap}>
          <Svg width={96} height={96} viewBox="0 0 84 84">
            <Circle cx="42" cy="42" r={r} fill="none" stroke={TRACK} strokeWidth={8} />
            <Circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              stroke={PRIMARY}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * 0.32}
              transform="rotate(-90, 42, 42)"
            />
          </Svg>
          <View style={styles.trackCenter}>
            <Flame size={16} color={PRIMARY} />
            <Text style={styles.trackValue}>1 480</Text>
          </View>
        </View>
        <View style={{ width: 144, gap: 8 }}>
          {macros.map((macro, i) => (
            <View key={i} style={styles.macroBarTrack}>
              <View
                style={[styles.macroBarFill, { width: `${macro.w * 100}%`, backgroundColor: macro.color }]}
              />
            </View>
          ))}
        </View>
      </View>
    </PreviewCard>
  );
}

function ProgressPreview() {
  const d = 'M8 66 L34 54 L60 58 L86 40 L112 44 L138 22';
  return (
    <PreviewCard>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Svg width={160} height={96} viewBox="0 0 150 84">
          <Defs>
            <LinearGradient id="tourTrend" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PRIMARY} stopOpacity="0.28" />
              <Stop offset="1" stopColor={PRIMARY} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={`${d} L138 84 L8 84 Z`} fill="url(#tourTrend)" />
          <Path
            d={d}
            fill="none"
            stroke={PRIMARY}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[
            [34, 54],
            [86, 40],
            [138, 22],
          ].map(([cx, cy], i) => (
            <Circle key={i} cx={cx} cy={cy} r={3} fill={PRIMARY} />
          ))}
        </Svg>
        <View style={styles.trendPill}>
          <TrendingDown size={16} color={PRIMARY} />
          <Text style={styles.trendPillText}>−2.4 kg</Text>
        </View>
      </View>
    </PreviewCard>
  );
}

function GoalsPreview() {
  return (
    <PreviewCard>
      <View style={styles.goalsWrap}>
        <View style={[styles.goalsRing, { borderColor: 'rgba(37,99,235,0.2)' }]} />
        <View
          style={[
            styles.goalsRing,
            { top: 12, left: 12, right: 12, bottom: 12, borderRadius: 36, borderColor: 'rgba(37,99,235,0.35)' },
          ]}
        />
        <View style={styles.goalsTrophy}>
          <Trophy size={30} color={colors.white} />
        </View>
        <View style={styles.goalsSpark}>
          <Sparkles size={15} color="#0B1020" />
        </View>
      </View>
    </PreviewCard>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  brandAccent: {
    color: colors.primary,
  },
  skip: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    alignItems: 'center',
    width: '100%',
  },
  previewWrap: {
    height: 240,
    justifyContent: 'center',
  },
  previewCard: {
    width: 208,
    height: 208,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  previewInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 30,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  copy: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(244,246,251,0.2)',
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.primary,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonGhost: {
    minWidth: 100,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  buttonGhostText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // previews
  welcomeGlow: {
    height: 112,
    width: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  sparkle: {
    position: 'absolute',
  },
  snapRing: {
    height: 80,
    width: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.28)',
  },
  snapRingInner: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(7,11,22,0.7)',
  },
  snapCamera: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    width: 160,
  },
  chip: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  trackRingWrap: {
    height: 96,
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  trackValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  macroBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: TRACK,
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
  },
  trendPillText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  goalsWrap: {
    height: 96,
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    borderWidth: 2,
  },
  goalsTrophy: {
    height: 64,
    width: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  goalsSpark: {
    position: 'absolute',
    top: -4,
    right: -4,
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
});
