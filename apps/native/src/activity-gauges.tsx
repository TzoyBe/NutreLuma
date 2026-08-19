import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Droplet, Footprints } from 'lucide-react-native';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors } from './theme';
import { angleFraction, applyAntiWrap, snapValue } from './radial-gauge-math';

/**
 * Animated κυκλικά gauges για Νερό & Βήματα στο dashboard — ίδιο ύφος με τα
 * calorie/macro gauges (gradient τόξο + glow) ΚΑΙ ίδια drag-to-adjust
 * συμπεριφορά με το web: ορατό στρογγυλό knob που σέρνεις γύρω από το δαχτυλίδι
 * για να ανεβάσεις/κατεβάσεις την τιμή (snap ανά 50, commit στο release).
 *
 * Κρίσιμο για να δουλεύει σωστά το drag: όλα τα εσωτερικά στρώματα (Svg + κέντρο)
 * είναι `pointerEvents="none"`, ώστε κάθε touch να «πέφτει» στο εξωτερικό View
 * και το locationX/locationY να είναι πάντα ως προς αυτό (σταθερές συντεταγμένες),
 * όπως ακριβώς το web χρησιμοποιεί το κέντρο του SVG + clientX/clientY.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 140;
const CENTER = SIZE / 2;
const RADIUS = 56;
const STROKE = 12;
const CIRC = 2 * Math.PI * RADIUS;
const SNAP = 50;

function Ring({
  fraction,
  dragging,
  interactive,
  from,
  to,
  glow,
  uid,
}: {
  fraction: number;
  dragging: boolean;
  interactive: boolean;
  from: string;
  to: string;
  glow: string;
  uid: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, fraction));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamped,
      // Κατά το drag το τόξο ακολουθεί ΑΜΕΣΩΣ το δάχτυλο (χωρίς lag)· αλλιώς
      // κάνει το draw-on animation όπως τα υπόλοιπα gauges.
      duration: dragging ? 0 : 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, dragging, anim]);

  const dashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });

  // Knob position — screen frame (top = 0, clockwise), σχεδιασμένο ΕΞΩ από το
  // rotate(-90) G ώστε να ταιριάζει με τα μαθηματικά του pointer.
  const knobAngle = (clamped * 360 - 90) * (Math.PI / 180);
  const knobX = CENTER + RADIUS * Math.cos(knobAngle);
  const knobY = CENTER + RADIUS * Math.sin(knobAngle);

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id={`ringGrad${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <Filter id={`ringGlow${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <FeGaussianBlur stdDeviation="9" />
        </Filter>
      </Defs>

      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS - 4}
        fill={glow}
        opacity={0.16}
        filter={`url(#ringGlow${uid})`}
      />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={colors.surfaceSoft}
        strokeWidth={STROKE}
        opacity={0.6}
      />
      <G transform={`rotate(-90, ${CENTER}, ${CENTER})`}>
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={`url(#ringGrad${uid})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
        />
      </G>

      {interactive ? (
        <>
          {/* Grab handle — το στρογγυλό «κουμπάκι» που σέρνει ο χρήστης. */}
          <Circle cx={knobX} cy={knobY} r={STROKE / 2 + 5} fill={to} opacity={0.18} />
          <Circle
            cx={knobX}
            cy={knobY}
            r={STROKE / 2 + 1}
            fill="#FFFFFF"
            stroke={to}
            strokeWidth={3}
          />
        </>
      ) : null}
    </Svg>
  );
}

function pct(consumed: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.round(Math.min(1, consumed / target) * 100);
}

/**
 * Κοινό interactive gauge: κρατά την drag λογική μία φορά (νερό & βήματα την
 * μοιράζονται) — mirror του web `Ring`.
 */
function InteractiveGauge({
  value,
  max,
  from,
  to,
  glow,
  uid,
  interactive,
  onCommit,
  onDragStateChange,
  renderCenter,
  renderLabel,
}: {
  value: number;
  max: number;
  from: string;
  to: string;
  glow: string;
  uid: string;
  interactive: boolean;
  onCommit?: (newTotal: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
  renderCenter: (display: number) => ReactNode;
  renderLabel: (display: number) => ReactNode;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const prev = useRef<number | null>(null);

  const display = preview ?? value;
  const fraction = max > 0 ? display / max : 0;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        // Διεκδικούμε το gesture ΠΡΙΝ το γονικό ScrollView, ώστε το άγγιγμα μέσα
        // στο gauge να ΜΗΝ κάνει scroll τη σελίδα...
        onStartShouldSetPanResponderCapture: () => interactive,
        onMoveShouldSetPanResponderCapture: () => interactive,
        // ...και δεν το παραδίδουμε πίσω στο ScrollView όσο σέρνει ο χρήστης.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          setDragging(true);
          // Λέμε στον γονέα να απενεργοποιήσει το scroll του ScrollView.
          onDragStateChange?.(true);
          prev.current = Math.max(0, Math.min(1, value / max));
          const { locationX, locationY } = e.nativeEvent;
          const raw = angleFraction(CENTER, CENTER, locationX, locationY);
          const f = applyAntiWrap(raw, prev.current);
          prev.current = f;
          setPreview(snapValue(f, max, SNAP));
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const raw = angleFraction(CENTER, CENTER, locationX, locationY);
          const f = applyAntiWrap(raw, prev.current);
          prev.current = f;
          setPreview(snapValue(f, max, SNAP));
        },
        onPanResponderRelease: () => {
          setDragging(false);
          onDragStateChange?.(false);
          const next = preview;
          prev.current = null;
          setPreview(null);
          if (next != null && next !== value) onCommit?.(next);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onDragStateChange?.(false);
          prev.current = null;
          setPreview(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive, max, value, preview, onCommit, onDragStateChange],
  );

  return (
    <View style={styles.wrap}>
      <View style={{ width: SIZE, height: SIZE }} {...(interactive ? pan.panHandlers : {})}>
        {/* pointerEvents none => κάθε touch πάει στο εξωτερικό View (σταθερό locationX/Y). */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Ring
            fraction={fraction}
            dragging={dragging}
            interactive={interactive}
            from={from}
            to={to}
            glow={glow}
            uid={uid}
          />
        </View>
        <View style={styles.center} pointerEvents="none">
          {renderCenter(Math.round(display))}
        </View>
      </View>
      {renderLabel(Math.round(display))}
    </View>
  );
}

export function WaterGauge({
  consumedMl,
  targetMl,
  scaleMax,
  onCommit,
  onDragStateChange,
}: {
  consumedMl: number;
  targetMl: number | null;
  scaleMax?: number;
  onCommit?: (newTotal: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const target = targetMl && targetMl > 0 ? targetMl : null;
  const max = scaleMax ?? 1.5 * (target ?? 3000);

  return (
    <InteractiveGauge
      value={consumedMl}
      max={max}
      from="#38BDF8"
      to="#2563EB"
      glow="#38BDF8"
      uid="water"
      interactive={!!onCommit}
      onCommit={onCommit}
      onDragStateChange={onDragStateChange}
      renderCenter={(display) => (
        <>
          <Droplet size={18} color="#38BDF8" />
          <Text style={styles.value}>{display.toLocaleString()}</Text>
          <Text style={styles.caption}>{target ? `of ${target.toLocaleString()} ml` : 'ml today'}</Text>
        </>
      )}
      renderLabel={(display) => (
        <Text style={styles.label}>Water{target ? ` · ${pct(display, target)}%` : ''}</Text>
      )}
    />
  );
}

export function StepsGauge({
  steps,
  targetSteps,
  scaleMax,
  onCommit,
  onDragStateChange,
}: {
  steps: number;
  targetSteps: number | null;
  scaleMax?: number;
  onCommit?: (newTotal: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const target = targetSteps && targetSteps > 0 ? targetSteps : null;
  const max = scaleMax ?? 1.5 * (target ?? 10000);

  return (
    <InteractiveGauge
      value={steps}
      max={max}
      from="#2DD4BF"
      to="#10B981"
      glow="#10B981"
      uid="steps"
      interactive={!!onCommit}
      onCommit={onCommit}
      onDragStateChange={onDragStateChange}
      renderCenter={(display) => (
        <>
          <Footprints size={18} color="#10B981" />
          <Text style={styles.value}>{display.toLocaleString()}</Text>
          <Text style={styles.caption}>{target ? `of ${target.toLocaleString()}` : 'steps'}</Text>
        </>
      )}
      renderLabel={(display) => (
        <Text style={styles.label}>Steps{target ? ` · ${pct(display, target)}%` : ''}</Text>
      )}
    />
  );
}

const MUTED = 'hsl(220, 14%, 66%)';
const FOREGROUND = 'hsl(220, 20%, 96%)';

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  value: {
    marginTop: 3,
    fontSize: 22,
    fontWeight: '700',
    color: FOREGROUND,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 11,
    color: MUTED,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: FOREGROUND,
  },
});
