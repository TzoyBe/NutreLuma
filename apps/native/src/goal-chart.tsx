import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  LinearGradient,
  Line,
  Path,
  Stop,
} from 'react-native-svg';

/**
 * GoalProgressChart — «έξυπνο», animated γράφημα προόδου βάρους προς τον στόχο.
 *
 * Δείχνει την τροχιά του καταγεγραμμένου βάρους στον χρόνο, μια διακεκομμένη
 * γραμμή στόχου (target) και ένα μεγάλο ποσοστό «% to goal». Η γραμμή
 * «ζωγραφίζεται» με animation (stroke-dashoffset) και το gradient γέμισμα κάτω
 * από αυτήν σβήνει μέσα απαλά. Χειρίζεται τόσο στόχους απώλειας όσο και αύξησης
 * βάρους (direction-aware), καθώς και τις κενές καταστάσεις.
 *
 * Παλέτα ταιριαστή με τα gauges / web dark theme.
 */

const PRIMARY = 'hsl(221, 83%, 53%)';
const ACCENT = 'hsl(43, 100%, 51%)';
const SUCCESS = 'hsl(160, 84%, 39%)';
const FOREGROUND = 'hsl(220, 20%, 96%)';
const MUTED_TEXT = 'hsl(220, 14%, 66%)';
const TRACK = 'hsl(224, 30%, 16%)';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const HEIGHT = 168;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;
const PAD_X = 14;

export type WeightPoint = { entryDate: string; weightKg: number };

type Props = {
  weights: WeightPoint[];
  targetWeightKg: number | null;
  startWeightKg?: number | null;
  unit?: string;
};

export function GoalProgressChart({ weights, targetWeightKg, startWeightKg, unit = 'kg' }: Props) {
  const [width, setWidth] = useState(0);

  // Ταξινόμηση παλαιότερο -> νεότερο ώστε ο άξονας x να τρέχει σωστά.
  const points = useMemo(
    () =>
      [...weights]
        .filter((w) => Number.isFinite(w.weightKg))
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [weights],
  );

  const hasTarget = targetWeightKg !== null && Number.isFinite(targetWeightKg);
  const enoughData = points.length >= 2;

  const start = startWeightKg ?? points[0]?.weightKg ?? null;
  const current = points.length ? points[points.length - 1]!.weightKg : null;

  // Direction-aware ποσοστό προς τον στόχο (0..100).
  const pct = useMemo(() => {
    if (start === null || current === null || !hasTarget) return null;
    const total = start - (targetWeightKg as number);
    if (Math.abs(total) < 1e-6) return 100;
    const done = start - current;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }, [start, current, hasTarget, targetWeightKg]);

  if (!hasTarget) {
    return (
      <ChartShell onLayout={setWidth}>
        <Text style={styles.emptyTitle}>Goal progress</Text>
        <Text style={styles.emptyCopy}>
          Set a target weight in your profile to track progress toward your goal.
        </Text>
      </ChartShell>
    );
  }

  if (!enoughData) {
    return (
      <ChartShell onLayout={setWidth}>
        <Text style={styles.emptyTitle}>Goal progress</Text>
        <Text style={styles.emptyCopy}>
          Log your weight at least twice to see your trend toward {Math.round(targetWeightKg as number)}
          {unit}.
        </Text>
      </ChartShell>
    );
  }

  return (
    <ChartShell onLayout={setWidth}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Goal progress</Text>
          <Text style={styles.headline}>
            {pct}
            <Text style={styles.headlineUnit}>% to goal</Text>
          </Text>
        </View>
        <View style={styles.chipCol}>
          <Chip label="Current" value={`${round1(current as number)}${unit}`} tone="fg" />
          <Chip label="Target" value={`${round1(targetWeightKg as number)}${unit}`} tone="accent" />
        </View>
      </View>

      {width > 0 ? (
        <Plot
          width={width}
          points={points}
          target={targetWeightKg as number}
          start={start as number}
        />
      ) : null}

      <View style={styles.footRow}>
        <Text style={styles.footText}>Start {round1(start as number)}{unit}</Text>
        <Text style={styles.footText}>
          {(start as number) - (current as number) >= 0 ? '−' : '+'}
          {round1(Math.abs((start as number) - (current as number)))}{unit} so far
        </Text>
      </View>
    </ChartShell>
  );
}

// ---------------------------------------------------------------------------
// Το ίδιο το SVG plot (animated)
// ---------------------------------------------------------------------------

function Plot({
  width,
  points,
  target,
  start,
}: {
  width: number;
  points: WeightPoint[];
  target: number;
  start: number;
}) {
  const innerW = Math.max(1, width - PAD_X * 2);
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  // Y-domain: όλα τα βάρη + ο στόχος + η αφετηρία, με λίγο padding.
  const values = points.map((p) => p.weightKg).concat([target, start]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yPad = span * 0.15;
  const domMin = min - yPad;
  const domMax = max + yPad;

  const xAt = (i: number) => PAD_X + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const yAt = (v: number) => PAD_TOP + innerH * (1 - (v - domMin) / (domMax - domMin));

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.weightKg) }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(
    1,
  )} L${coords[0]!.x.toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

  // Μήκος γραμμής για το draw-on animation.
  const lineLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += Math.hypot(coords[i]!.x - coords[i - 1]!.x, coords[i]!.y - coords[i - 1]!.y);
    }
    return Math.max(1, len);
  }, [coords]);

  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 1100, useNativeDriver: false }),
      Animated.timing(fade, { toValue: 1, duration: 900, delay: 500, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [lineLength, 0] });

  const targetY = yAt(target);
  const last = coords[coords.length - 1]!;
  const reached = Math.abs(points[points.length - 1]!.weightKg - target) < 0.15;

  return (
    <Svg width={width} height={HEIGHT}>
      <Defs>
        <LinearGradient id="goalLine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={PRIMARY} />
          <Stop offset="0.6" stopColor={ACCENT} />
          <Stop offset="1" stopColor={reached ? SUCCESS : PRIMARY} />
        </LinearGradient>
        <LinearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={PRIMARY} stopOpacity={0.34} />
          <Stop offset="1" stopColor={PRIMARY} stopOpacity={0} />
        </LinearGradient>
        <Filter id="goalGlow" x="-20%" y="-40%" width="140%" height="180%">
          <FeGaussianBlur stdDeviation="3.2" />
        </Filter>
      </Defs>

      {/* Γραμμή στόχου (διακεκομμένη) */}
      <Line
        x1={PAD_X}
        y1={targetY}
        x2={width - PAD_X}
        y2={targetY}
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeDasharray="5 6"
        opacity={0.7}
      />

      {/* Γέμισμα κάτω από τη γραμμή (fade-in) */}
      <AnimatedPath d={areaPath} fill="url(#goalFill)" opacity={fade} />

      {/* Λάμψη γραμμής */}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke="url(#goalLine)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
        filter="url(#goalGlow)"
        strokeDasharray={lineLength}
        strokeDashoffset={dashOffset}
      />
      {/* Κύρια γραμμή (draw-on) */}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke="url(#goalLine)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={lineLength}
        strokeDashoffset={dashOffset}
      />

      {/* Τρέχον σημείο */}
      <AnimatedCircle cx={last.x} cy={last.y} fade={fade} reached={reached} />
    </Svg>
  );
}

function AnimatedCircle({
  cx,
  cy,
  fade,
  reached,
}: {
  cx: number;
  cy: number;
  fade: Animated.Value;
  reached: boolean;
}) {
  const AC = Animated.createAnimatedComponent(Circle);
  return (
    <>
      <AC cx={cx} cy={cy} r={7} fill="#ffffff" opacity={fade} />
      <AC cx={cx} cy={cy} r={4} fill={reached ? SUCCESS : PRIMARY} opacity={fade} />
    </>
  );
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function ChartShell({
  children,
  onLayout,
}: {
  children: React.ReactNode;
  onLayout: (w: number) => void;
}) {
  return (
    <View
      style={styles.card}
      onLayout={(e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.width - 32)}
    >
      {children}
    </View>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone: 'fg' | 'accent' }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, tone === 'accent' ? { color: ACCENT } : null]}>{value}</Text>
    </View>
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(25, 35, 62, 0.55)',
    borderColor: 'rgba(191, 210, 248, 0.22)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MUTED_TEXT,
    fontWeight: '600',
  },
  headline: {
    marginTop: 2,
    fontSize: 40,
    fontWeight: '700',
    color: FOREGROUND,
    fontVariant: ['tabular-nums'],
  },
  headlineUnit: {
    fontSize: 15,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  chipCol: {
    gap: 6,
    alignItems: 'flex-end',
  },
  chip: {
    alignItems: 'flex-end',
  },
  chipLabel: {
    fontSize: 11,
    color: MUTED_TEXT,
  },
  chipValue: {
    fontSize: 15,
    fontWeight: '600',
    color: FOREGROUND,
    fontVariant: ['tabular-nums'],
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footText: {
    fontSize: 12,
    color: MUTED_TEXT,
    fontVariant: ['tabular-nums'],
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: FOREGROUND,
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED_TEXT,
  },
});
