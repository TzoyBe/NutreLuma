import { useRef } from 'react';
import { Flame } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  LinearGradient,
  Stop,
} from 'react-native-svg';

/**
 * Κυκλικά «gauge» για το dashboard — πιστή αναπαραγωγή των web components
 * (calorie-gauge.tsx / macro-gauge.tsx): ticks γύρω-γύρω, ambient χρωματιστή
 * λάμψη, gradient τόξο με glow (drop-shadow) και φωτεινός δείκτης στο τέλος
 * της προόδου. Τα χρώματα ταιριάζουν ακριβώς με τις CSS μεταβλητές του web.
 */

// Ακριβές palette από src/app/globals.css του web (dark theme).
const PRIMARY = 'hsl(221, 83%, 53%)';
const ACCENT = 'hsl(43, 100%, 51%)';
const DESTRUCTIVE = 'hsl(0, 72%, 51%)';
const FOREGROUND = 'hsl(220, 20%, 96%)';
const TRACK = 'hsl(224, 30%, 16%)'; // --muted
const PRIMARY_GLOW = 'hsla(221, 83%, 53%, 0.5)';
const DESTRUCTIVE_GLOW = 'hsla(0, 72%, 51%, 0.55)';
const PRIMARY_AMBIENT = 'hsla(221, 83%, 53%, 0.2)';
const DESTRUCTIVE_AMBIENT = 'hsla(0, 72%, 51%, 0.25)';

// ---------------------------------------------------------------------------
// Calorie gauge (μεγάλο)
// ---------------------------------------------------------------------------

const C_SIZE = 208;
const C_CENTER = C_SIZE / 2;
const C_RADIUS = 84;
const C_STROKE = 16;
const C_CIRC = 2 * Math.PI * C_RADIUS;
const C_RENDER = 248; // pixel μέγεθος απόδοσης

type CalorieGaugeProps = {
  consumed: number;
  target: number | null;
  remaining: number | null;
  overTarget: boolean;
  progressPercent: number;
  labels: {
    of: string; // ήδη μεταφρασμένο, π.χ. "of 2000 kcal"
    remaining: string;
    over: string;
    noTarget: string;
    kcal: string;
  };
};

export function CalorieGauge({
  consumed,
  target,
  remaining,
  overTarget,
  progressPercent,
  labels,
}: CalorieGaugeProps) {
  const hasTarget = target !== null && target > 0;
  const fraction = hasTarget ? Math.max(0, Math.min(1, progressPercent / 100)) : 0;
  const dashoffset = C_CIRC * (1 - fraction);

  const capAngle = (-90 + 360 * fraction) * (Math.PI / 180);
  const capX = C_CENTER + C_RADIUS * Math.cos(capAngle);
  const capY = C_CENTER + C_RADIUS * Math.sin(capAngle);

  const arcColor = overTarget ? DESTRUCTIVE : 'url(#gaugeGradient)';
  const glowColor = overTarget ? DESTRUCTIVE_GLOW : PRIMARY_GLOW;
  const ambientColor = overTarget ? DESTRUCTIVE_AMBIENT : PRIMARY_AMBIENT;

  return (
    <View style={styles.wrap}>
      <View style={{ width: C_RENDER, height: C_RENDER }}>
        <Svg width={C_RENDER} height={C_RENDER} viewBox={`0 0 ${C_SIZE} ${C_SIZE}`}>
          <Defs>
            <LinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={PRIMARY} />
              <Stop offset="0.55" stopColor={ACCENT} />
              <Stop offset="1" stopColor={PRIMARY} />
            </LinearGradient>
            <Filter id="cArcGlow" x="-50%" y="-50%" width="200%" height="200%">
              <FeGaussianBlur stdDeviation="4" />
            </Filter>
            <Filter id="cAmbient" x="-60%" y="-60%" width="220%" height="220%">
              <FeGaussianBlur stdDeviation="14" />
            </Filter>
          </Defs>

          {/* Ambient χρωματιστή λάμψη πίσω από το gauge */}
          <Circle
            cx={C_CENTER}
            cy={C_CENTER}
            r={C_RADIUS - 6}
            fill={ambientColor}
            filter="url(#cAmbient)"
          />

          {/* Ticks */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i * 6 - 90) * (Math.PI / 180);
            const rOuter = C_RADIUS + C_STROKE / 2 + 6;
            const rInner = rOuter - (i % 5 === 0 ? 6 : 3);
            return (
              <Line
                key={i}
                x1={C_CENTER + rOuter * Math.cos(a)}
                y1={C_CENTER + rOuter * Math.sin(a)}
                x2={C_CENTER + rInner * Math.cos(a)}
                y2={C_CENTER + rInner * Math.sin(a)}
                stroke={FOREGROUND}
                strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
                opacity={i % 5 === 0 ? 0.22 : 0.1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Track */}
          <Circle
            cx={C_CENTER}
            cy={C_CENTER}
            r={C_RADIUS}
            fill="none"
            stroke={TRACK}
            strokeWidth={C_STROKE}
            opacity={0.55}
          />

          {/* Progress arc + glow */}
          {hasTarget ? (
            <G transform={`rotate(-90, ${C_CENTER}, ${C_CENTER})`}>
              <Circle
                cx={C_CENTER}
                cy={C_CENTER}
                r={C_RADIUS}
                fill="none"
                stroke={glowColor}
                strokeWidth={C_STROKE}
                strokeLinecap="round"
                strokeDasharray={C_CIRC}
                strokeDashoffset={dashoffset}
                filter="url(#cArcGlow)"
              />
              <Circle
                cx={C_CENTER}
                cy={C_CENTER}
                r={C_RADIUS}
                fill="none"
                stroke={arcColor}
                strokeWidth={C_STROKE}
                strokeLinecap="round"
                strokeDasharray={C_CIRC}
                strokeDashoffset={dashoffset}
              />
            </G>
          ) : null}

          {/* Φωτεινός δείκτης στο τέλος της προόδου */}
          {hasTarget && fraction > 0.02 ? (
            <G>
              <Circle cx={capX} cy={capY} r={7} fill="#ffffff" opacity={0.95} />
              <Circle cx={capX} cy={capY} r={4} fill={overTarget ? DESTRUCTIVE : PRIMARY} />
            </G>
          ) : null}
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Flame size={22} color={overTarget ? DESTRUCTIVE : PRIMARY} />
          <Text style={styles.calorieValue}>{consumed}</Text>
          <Text style={styles.calorieCaption}>{hasTarget ? labels.of : labels.kcal}</Text>
          {hasTarget ? (
            <View
              style={[styles.percentPill, overTarget ? styles.percentPillOver : styles.percentPillOk]}
            >
              <Text style={[styles.percentPillText, { color: overTarget ? DESTRUCTIVE : PRIMARY }]}>
                {progressPercent}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {hasTarget ? (
        <Text style={[styles.statusText, { color: overTarget ? DESTRUCTIVE : MUTED_TEXT }]}>
          {overTarget ? labels.over : labels.remaining}
        </Text>
      ) : (
        <Text style={[styles.statusText, { color: MUTED_TEXT }]}>{labels.noTarget}</Text>
      )}
    </View>
  );
}

// Χρώμα κειμένου «muted-foreground» του web.
const MUTED_TEXT = 'hsl(220, 14%, 66%)';

// ---------------------------------------------------------------------------
// Macro gauge (μικρό)
// ---------------------------------------------------------------------------

const M_SIZE = 132;
const M_CENTER = M_SIZE / 2;
const M_RADIUS = 52;
const M_STROKE = 11;
const M_CIRC = 2 * Math.PI * M_RADIUS;

type MacroGaugeProps = {
  label: string;
  consumed: number;
  target: number | null;
  over: boolean;
  color: string;
  unit?: string;
};

let macroFilterId = 0;

export function MacroGauge({ label, consumed, target, over, color, unit = 'g' }: MacroGaugeProps) {
  const rounded = Math.round(consumed);
  const hasTarget = target !== null && target > 0;
  const fraction = hasTarget ? Math.max(0, Math.min(1, consumed / target)) : 0;
  const dashoffset = M_CIRC * (1 - fraction);
  const stroke = over ? DESTRUCTIVE : color;
  // Μοναδικά filter ids ανά instance ώστε να μη συγκρούονται στο ίδιο SVG tree.
  const uid = useStableId();
  const glowId = `mGlow${uid}`;
  const ambientId = `mAmbient${uid}`;

  return (
    <View style={styles.macroWrap}>
      <View style={{ width: M_SIZE, height: M_SIZE }}>
        <Svg width={M_SIZE} height={M_SIZE} viewBox={`0 0 ${M_SIZE} ${M_SIZE}`}>
          <Defs>
            <Filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <FeGaussianBlur stdDeviation="3" />
            </Filter>
            <Filter id={ambientId} x="-60%" y="-60%" width="220%" height="220%">
              <FeGaussianBlur stdDeviation="9" />
            </Filter>
          </Defs>

          {/* Ambient λάμψη */}
          <Circle
            cx={M_CENTER}
            cy={M_CENTER}
            r={M_RADIUS - 4}
            fill={stroke}
            opacity={over ? 0.22 : 0.16}
            filter={`url(#${ambientId})`}
          />

          {/* Ticks */}
          {Array.from({ length: 40 }).map((_, i) => {
            const a = (i * 9 - 90) * (Math.PI / 180);
            const rOuter = M_RADIUS + M_STROKE / 2 + 5;
            const rInner = rOuter - (i % 5 === 0 ? 5 : 2.5);
            return (
              <Line
                key={i}
                x1={M_CENTER + rOuter * Math.cos(a)}
                y1={M_CENTER + rOuter * Math.sin(a)}
                x2={M_CENTER + rInner * Math.cos(a)}
                y2={M_CENTER + rInner * Math.sin(a)}
                stroke={FOREGROUND}
                strokeWidth={i % 5 === 0 ? 1.2 : 0.7}
                opacity={i % 5 === 0 ? 0.2 : 0.09}
                strokeLinecap="round"
              />
            );
          })}

          {/* Track */}
          <Circle
            cx={M_CENTER}
            cy={M_CENTER}
            r={M_RADIUS}
            fill="none"
            stroke={TRACK}
            strokeWidth={M_STROKE}
            opacity={0.5}
          />

          {/* Progress arc + glow */}
          {hasTarget ? (
            <G transform={`rotate(-90, ${M_CENTER}, ${M_CENTER})`}>
              <Circle
                cx={M_CENTER}
                cy={M_CENTER}
                r={M_RADIUS}
                fill="none"
                stroke={stroke}
                strokeWidth={M_STROKE}
                strokeLinecap="round"
                strokeDasharray={M_CIRC}
                strokeDashoffset={dashoffset}
                opacity={0.6}
                filter={`url(#${glowId})`}
              />
              <Circle
                cx={M_CENTER}
                cy={M_CENTER}
                r={M_RADIUS}
                fill="none"
                stroke={stroke}
                strokeWidth={M_STROKE}
                strokeLinecap="round"
                strokeDasharray={M_CIRC}
                strokeDashoffset={dashoffset}
              />
            </G>
          ) : null}
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <View style={styles.macroValueRow}>
            <Text style={[styles.macroValue, over ? { color: DESTRUCTIVE } : null]}>{rounded}</Text>
            <Text style={styles.macroUnit}>{unit}</Text>
          </View>
        </View>
      </View>

      <View style={styles.macroLabelWrap}>
        <Text style={styles.macroLabel}>{label}</Text>
        {hasTarget ? (
          <Text style={styles.macroTarget}>
            / {target}
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Σταθερό μοναδικό id ανά mounted instance.
function useStableId(): number {
  const ref = useRef<number | null>(null);
  if (ref.current === null) ref.current = ++macroFilterId;
  return ref.current;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieValue: {
    marginTop: 4,
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 42,
    color: FOREGROUND,
    fontVariant: ['tabular-nums'],
  },
  calorieCaption: {
    marginTop: 6,
    fontSize: 12,
    color: MUTED_TEXT,
  },
  percentPill: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
  },
  percentPillOk: {
    backgroundColor: 'hsla(221, 83%, 53%, 0.12)',
    borderColor: 'hsla(221, 83%, 53%, 0.22)',
  },
  percentPillOver: {
    backgroundColor: 'hsla(0, 72%, 51%, 0.12)',
    borderColor: 'hsla(0, 72%, 51%, 0.22)',
  },
  percentPillText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  macroWrap: {
    alignItems: 'center',
    gap: 8,
  },
  macroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '600',
    color: FOREGROUND,
    fontVariant: ['tabular-nums'],
  },
  macroUnit: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  macroLabelWrap: {
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: FOREGROUND,
  },
  macroTarget: {
    fontSize: 12,
    color: MUTED_TEXT,
    fontVariant: ['tabular-nums'],
  },
});
