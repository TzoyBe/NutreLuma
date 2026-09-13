import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChefHat,
  ChevronRight,
  Droplet,
  Flame,
  Footprints,
  Plus,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import type { buildOrbitalDashboardModel } from './orbital-dashboard-model';
import { orbitalTheme as theme } from './orbital-theme';

type DashboardModel = ReturnType<typeof buildOrbitalDashboardModel>;
type Metric = DashboardModel['metrics'][number];

type OrbitalDashboardProps = {
  model: DashboardModel;
  unreadNotifications: number;
  dateControl: ReactNode;
  onNotifications: () => void;
  onCalories: () => void;
  onMetric: (key: Metric['key']) => void;
  onAddWater: () => void;
  onAddSteps: () => void;
};

const metricIcons: Record<Metric['key'], LucideIcon> = {
  protein: Target,
  carbohydrate: ChefHat,
  fat: Droplet,
  fiber: Sparkles,
  water: Droplet,
  steps: Footprints,
};

function SpaceBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.haze, styles.hazeBlue]} />
      <View style={[styles.haze, styles.hazeViolet]} />
      <View style={[styles.haze, styles.hazeCyan]} />
      {Array.from({ length: 22 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.star,
            {
              left: `${(index * 37) % 96}%`,
              top: 150 + ((index * 83) % 850),
              opacity: 0.25 + (index % 4) * 0.14,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Arc({ progress, color, size, stroke = 9 }: { progress: number; color: string; size: number; stroke?: number }) {
  const radius = size / 2 - stroke - 2;
  const circumference = 2 * Math.PI * radius;
  const visible = circumference * 0.78;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id={`orb-${color.slice(1)}-${size}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.18" stopColor={color} />
          <Stop offset="1" stopColor={color} stopOpacity={0.72} />
        </SvgGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(105,133,190,0.18)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${visible} ${circumference}`} transform={`rotate(-50 ${size / 2} ${size / 2})`} />
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#orb-${color.slice(1)}-${size})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${visible * progress} ${circumference}`} transform={`rotate(-50 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

function BrandHeader({ unread, onPress }: { unread: number; onPress: () => void }) {
  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandGroup}>
        <View style={styles.brandMark}><View style={styles.brandMarkCore} /></View>
        <View>
          <Text style={styles.wordmark}>N U T R E L U M A</Text>
          <Text style={styles.tagline}>F U E L  A  B R I G H T E R  Y O U</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread ? `${unread} unread notifications` : 'Notifications'}
        onPress={onPress}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
      >
        <Bell size={23} color="#C8D8FF" strokeWidth={1.7} />
        {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
      </Pressable>
    </View>
  );
}

function InsightCard({ insight, kind, onPress }: { insight: DashboardModel['insights'][number]; kind: 'luma' | 'nutrition'; onPress: () => void }) {
  const Icon = kind === 'luma' ? Sparkles : ChefHat;
  const color = kind === 'luma' ? theme.cyan : theme.emerald;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${insight.title}. ${insight.body}`} onPress={onPress} style={({ pressed }) => [styles.insight, pressed && styles.pressed]}>
      <LinearGradient colors={kind === 'luma' ? ['rgba(41,91,221,0.42)', 'rgba(12,30,70,0.88)'] : ['rgba(16,124,113,0.32)', 'rgba(10,33,61,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.insightIcon, { borderColor: `${color}88` }]}><Icon size={25} color={color} /></View>
      <View style={styles.insightCopy}><Text style={styles.insightTitle}>{insight.title}</Text><Text style={styles.insightBody}>{insight.body}</Text></View>
      <ChevronRight size={18} color="#C1D5FF" />
    </Pressable>
  );
}

function MetricPlanet({ metric, position, onPress }: { metric: Metric; position: object; onPress: () => void }) {
  const Icon = metricIcons[metric.key];
  const target = metric.target && metric.target > 0 ? Math.round(metric.target).toLocaleString() : '—';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${metric.label}, ${Math.round(metric.current)} of ${target} ${metric.unit}`} onPress={onPress} style={({ pressed }) => [styles.metricPlanet, position, { borderColor: `${metric.color}88`, shadowColor: metric.color }, pressed && styles.pressed]}>
      <LinearGradient colors={[`${metric.color}34`, 'rgba(4,13,36,0.96)', `${metric.color}15`]} style={StyleSheet.absoluteFill} />
      <Arc progress={metric.progress} color={metric.color} size={112} stroke={8} />
      <View style={styles.metricPlanetContent}>
        <Icon size={20} color={metric.color} strokeWidth={2} />
        <Text style={styles.metricName}>{metric.label}</Text>
        <Text selectable style={styles.metricNumber}>{Math.round(metric.current).toLocaleString()}<Text style={styles.metricUnit}>{metric.unit}</Text></Text>
        <Text selectable style={styles.metricOf}>of {target}{metric.unit}</Text>
      </View>
    </Pressable>
  );
}

function CaloriePlanet({ calories, onPress }: { calories: DashboardModel['calories']; onPress: () => void }) {
  const target = calories.target && calories.target > 0 ? Math.round(calories.target).toLocaleString() : '—';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${Math.round(calories.current)} of ${target} calories, ${calories.percent}%`} onPress={onPress} style={({ pressed }) => [styles.caloriePlanet, pressed && styles.pressed]}>
      <LinearGradient colors={['rgba(31,113,255,0.72)', 'rgba(8,25,63,0.96)', 'rgba(122,57,211,0.42)', 'rgba(255,187,66,0.38)']} locations={[0, 0.4, 0.73, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.calorieCore}>
        <Arc progress={calories.progress} color={theme.amber} size={222} stroke={13} />
        <Flame size={31} color={theme.blue} fill="rgba(76,125,255,0.24)" />
        <Text selectable style={styles.calorieValue}>{Math.round(calories.current).toLocaleString()}</Text>
        <Text selectable style={styles.calorieTarget}>of {target} kcal</Text>
        <View style={styles.percentPill}><Text selectable style={styles.percentText}>{calories.percent}%</Text></View>
      </View>
    </Pressable>
  );
}

function OrbitStage({ model, onCalories, onMetric }: { model: DashboardModel; onCalories: () => void; onMetric: OrbitalDashboardProps['onMetric'] }) {
  const metric = (key: Metric['key']) => model.metrics.find((item) => item.key === key)!;
  return (
    <View style={styles.orbitStage}>
      <View pointerEvents="none" style={[styles.orbitLine, styles.orbitLineOuter]} />
      <View pointerEvents="none" style={[styles.orbitLine, styles.orbitLineInner]} />
      <View pointerEvents="none" style={[styles.orbitDot, styles.orbitDotOne]} />
      <View pointerEvents="none" style={[styles.orbitDot, styles.orbitDotTwo]} />
      <View pointerEvents="none" style={[styles.orbitDot, styles.orbitDotThree]} />
      <CaloriePlanet calories={model.calories} onPress={onCalories} />
      <MetricPlanet metric={metric('protein')} position={styles.proteinPlanet} onPress={() => onMetric('protein')} />
      <MetricPlanet metric={metric('carbohydrate')} position={styles.carbsPlanet} onPress={() => onMetric('carbohydrate')} />
      <MetricPlanet metric={metric('fat')} position={styles.fatPlanet} onPress={() => onMetric('fat')} />
      <MetricPlanet metric={metric('fiber')} position={styles.fiberPlanet} onPress={() => onMetric('fiber')} />
      <Text style={styles.fuelLabel}>F U E L  T O D A Y</Text>
    </View>
  );
}

function ActivityPlanet({ metric, onAdd }: { metric: Metric; onAdd: () => void }) {
  const Icon = metricIcons[metric.key];
  const target = metric.target && metric.target > 0 ? Math.round(metric.target).toLocaleString() : '—';
  return (
    <View style={styles.activityWrap}>
      <View style={[styles.activityPlanet, { borderColor: `${metric.color}66`, shadowColor: metric.color }]}>
        <LinearGradient colors={[`${metric.color}3B`, 'rgba(5,18,43,0.95)', 'rgba(255,255,255,0.07)']} style={StyleSheet.absoluteFill} />
        <Icon size={25} color={metric.color} />
        <Text style={styles.activityName}>{metric.label}</Text>
        <Text selectable style={styles.activityValue}>{Math.round(metric.current).toLocaleString()}</Text>
        <Text selectable style={styles.activityTarget}>of {target}{metric.unit ? ` ${metric.unit}` : ''}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${metric.label.toLowerCase()}`} onPress={onAdd} style={({ pressed }) => [styles.activityAdd, pressed && styles.pressed]}><Plus size={25} color="#FFFFFF" /></Pressable>
    </View>
  );
}

function FocusCard({ focus, onPress }: { focus: DashboardModel['focus']; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Today's focus. ${focus.title}. ${focus.body}`} onPress={onPress} style={({ pressed }) => [styles.focusCard, pressed && styles.pressed]}>
      <LinearGradient colors={['rgba(24,72,158,0.44)', 'rgba(8,21,52,0.94)', 'rgba(51,31,130,0.32)']} style={StyleSheet.absoluteFill} />
      <View style={styles.focusMoon}><Sparkles size={28} color={theme.amber} /></View>
      <View style={styles.focusCopy}><Text style={styles.focusEyebrow}>Today's focus</Text><Text style={styles.focusTitle}>{focus.title}</Text><Text style={styles.focusBody}>{focus.body}</Text></View>
      <View style={styles.focusArrow}><ChevronRight size={22} color="#DCE7FF" /></View>
    </Pressable>
  );
}

export function OrbitalDashboard(props: OrbitalDashboardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const metric = (key: Metric['key']) => props.model.metrics.find((item) => item.key === key)!;
  return (
    <View style={styles.root}>
      <SpaceBackdrop />
      <BrandHeader unread={props.unreadNotifications} onPress={props.onNotifications} />
      <View style={styles.greetingRow}>
        <View style={styles.greetingCopy}>
          <Text style={styles.greeting}>{props.model.greeting},</Text>
          <Text style={styles.headline}>{props.model.headline} <Text style={styles.spark}>✦</Text></Text>
          <Text style={styles.subhead}>Small choices create big tomorrows.</Text>
        </View>
        <View style={styles.dateSlot}>{props.dateControl}</View>
      </View>
      <View style={[styles.insightRow, compact && styles.insightRowCompact]}>
        <InsightCard insight={props.model.insights[0]} kind="luma" onPress={props.onAddWater} />
        <InsightCard insight={props.model.insights[1]} kind="nutrition" onPress={props.onCalories} />
      </View>
      <View style={compact ? styles.compactStage : undefined}>
        <OrbitStage model={props.model} onCalories={props.onCalories} onMetric={props.onMetric} />
      </View>
      <Text style={styles.balance}>B A L A N C E{`\n`}F U E L S  A  B R I G H T E R  Y O U</Text>
      <View style={styles.activityRow}>
        <ActivityPlanet metric={metric('water')} onAdd={props.onAddWater} />
        <ActivityPlanet metric={metric('steps')} onAdd={props.onAddSteps} />
      </View>
      <FocusCard focus={props.model.focus} onPress={props.onCalories} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', gap: 22, paddingTop: 2 },
  haze: { position: 'absolute', borderRadius: 999, opacity: 0.2 },
  hazeBlue: { width: 420, height: 170, left: -280, top: 150, backgroundColor: '#245AFF', transform: [{ rotate: '52deg' }], boxShadow: '0 0 80px rgba(36,90,255,0.5)' },
  hazeViolet: { width: 300, height: 120, right: -220, top: 610, backgroundColor: '#713DFF', transform: [{ rotate: '-24deg' }], boxShadow: '0 0 80px rgba(113,61,255,0.42)' },
  hazeCyan: { width: 300, height: 120, left: -230, top: 950, backgroundColor: '#28CFFF', boxShadow: '0 0 70px rgba(40,207,255,0.32)' },
  star: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#8FB7FF' },
  brandHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  brandMark: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.blue, borderStyle: 'dashed', shadowColor: theme.blue, shadowOpacity: 0.6, shadowRadius: 12 },
  brandMarkCore: { width: 17, height: 17, borderRadius: 9, backgroundColor: theme.blue, borderWidth: 4, borderColor: '#18356F' },
  wordmark: { color: '#E4EAFF', fontSize: 13, fontWeight: '700', letterSpacing: 3.2 },
  tagline: { color: theme.textMuted, fontSize: 8, fontWeight: '600', letterSpacing: 2.7, paddingTop: 6 },
  bell: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.glass, shadowColor: theme.blue, shadowOpacity: 0.28, shadowRadius: 16 },
  badge: { position: 'absolute', right: 3, top: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.blue },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  greetingCopy: { flex: 1, gap: 4 },
  greeting: { color: theme.textSoft, fontSize: 21, fontWeight: '400' },
  headline: { color: theme.text, fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  spark: { color: theme.amber },
  subhead: { color: theme.textSoft, fontSize: 15, lineHeight: 21, paddingTop: 6 },
  dateSlot: { maxWidth: 150, flexShrink: 1 },
  insightRow: { flexDirection: 'row', gap: 10 },
  insightRowCompact: { flexDirection: 'column' },
  insight: { flex: 1, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  insightIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(28,79,165,0.3)' },
  insightCopy: { flex: 1, gap: 5 },
  insightTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  insightBody: { color: '#C0D0EE', fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  compactStage: { transform: [{ scale: 0.9 }], marginVertical: -30 },
  orbitStage: { height: 610, marginHorizontal: -10, alignItems: 'center', justifyContent: 'center' },
  orbitLine: { position: 'absolute', borderWidth: 1, borderColor: theme.orbit, borderRadius: 999 },
  orbitLineOuter: { width: 382, height: 510, transform: [{ rotate: '-8deg' }] },
  orbitLineInner: { width: 310, height: 410, borderColor: 'rgba(69,114,221,0.30)', transform: [{ rotate: '12deg' }] },
  orbitDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: theme.blue, borderWidth: 2, borderColor: '#DDF4FF', shadowColor: theme.blue, shadowOpacity: 1, shadowRadius: 12 },
  orbitDotOne: { top: 76, left: 65 },
  orbitDotTwo: { top: 265, right: 7, backgroundColor: theme.amber, shadowColor: theme.amber },
  orbitDotThree: { bottom: 58, left: 183 },
  caloriePlanet: { position: 'absolute', width: 230, height: 230, borderRadius: 115, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(96,177,255,0.62)', shadowColor: theme.blue, shadowOpacity: 0.55, shadowRadius: 28, elevation: 12 },
  calorieCore: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(3,11,34,0.44)' },
  calorieValue: { color: '#FFFFFF', fontSize: 48, lineHeight: 54, fontWeight: '800', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(89,126,255,0.75)', textShadowRadius: 14 },
  calorieTarget: { color: '#C8D6F0', fontSize: 15 },
  percentPill: { minWidth: 70, minHeight: 34, marginTop: 8, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.blue, backgroundColor: 'rgba(33,73,174,0.48)' },
  percentText: { color: '#79AEFF', fontSize: 17, fontWeight: '800' },
  metricPlanet: { position: 'absolute', width: 112, height: 112, borderRadius: 56, overflow: 'hidden', borderWidth: 1, shadowOpacity: 0.5, shadowRadius: 18, elevation: 8 },
  metricPlanetContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  metricName: { color: theme.text, fontSize: 12, fontWeight: '700' },
  metricNumber: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 12, color: '#C3D0E9' },
  metricOf: { color: '#9CAFD0', fontSize: 10 },
  proteinPlanet: { left: 23, top: 58 },
  carbsPlanet: { right: 17, top: 56 },
  fatPlanet: { left: 2, bottom: 66 },
  fiberPlanet: { right: 0, bottom: 68 },
  fuelLabel: { position: 'absolute', bottom: 124, color: '#8397BF', fontSize: 8, letterSpacing: 4 },
  balance: { color: '#7187B2', fontSize: 8, lineHeight: 17, letterSpacing: 4, textAlign: 'center' },
  activityRow: { minHeight: 150, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  activityWrap: { width: 144, height: 150, alignItems: 'center', justifyContent: 'center' },
  activityPlanet: { width: 132, height: 132, borderRadius: 66, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, transform: [{ rotate: '-5deg' }], shadowOpacity: 0.38, shadowRadius: 22, elevation: 8 },
  activityName: { color: theme.text, fontSize: 13, fontWeight: '700', paddingTop: 3 },
  activityValue: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', fontVariant: ['tabular-nums'] },
  activityTarget: { color: '#A4B7D8', fontSize: 11 },
  activityAdd: { position: 'absolute', right: 0, bottom: 2, width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#174DD8', borderWidth: 1, borderColor: '#6DA2FF', shadowColor: theme.blue, shadowOpacity: 0.7, shadowRadius: 12, elevation: 10 },
  focusCard: { minHeight: 140, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  focusMoon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43,101,214,0.35)', borderWidth: 1, borderColor: 'rgba(111,169,255,0.5)' },
  focusCopy: { flex: 1, gap: 5 },
  focusEyebrow: { color: theme.textSoft, fontSize: 13 },
  focusTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  focusBody: { color: '#AFC0DE', fontSize: 12, lineHeight: 17 },
  focusArrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(35,68,137,0.54)', borderWidth: 1, borderColor: theme.border },
});
