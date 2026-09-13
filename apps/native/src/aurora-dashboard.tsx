import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Apple,
  Bell,
  ChevronRight,
  Dna,
  Droplet,
  FilePlus,
  Footprints,
  Leaf,
  Mic,
  Plus,
  Scan,
  Sparkles,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import type { buildAuroraDashboardModel } from './aurora-dashboard-model';
import { colors } from './theme';

type DashboardModel = ReturnType<typeof buildAuroraDashboardModel>;
type IconType = LucideIcon;

type AuroraDashboardProps = {
  model: DashboardModel;
  firstName?: string | null;
  unreadNotifications: number;
  dateControl?: ReactNode;
  onNotifications: () => void;
  onCalories: () => void;
  onMetric: (key: DashboardModel['metrics'][number]['key']) => void;
  onAddMeal: () => void;
  onAddWater: () => void;
  onAddActivity: () => void;
  onQuickAdd: () => void;
};

const metricIcons: Record<DashboardModel['metrics'][number]['key'], IconType> = {
  protein: Dna,
  carbohydrate: Wheat,
  fat: Droplet,
  fiber: Leaf,
  water: Droplet,
  steps: Footprints,
};

const metricShapes = [
  { borderTopLeftRadius: 58, borderTopRightRadius: 36, borderBottomRightRadius: 66, borderBottomLeftRadius: 42 },
  { borderTopLeftRadius: 42, borderTopRightRadius: 68, borderBottomRightRadius: 42, borderBottomLeftRadius: 62 },
  { borderTopLeftRadius: 66, borderTopRightRadius: 44, borderBottomRightRadius: 58, borderBottomLeftRadius: 38 },
  { borderTopLeftRadius: 48, borderTopRightRadius: 62, borderBottomRightRadius: 36, borderBottomLeftRadius: 68 },
  { borderTopLeftRadius: 38, borderTopRightRadius: 64, borderBottomRightRadius: 60, borderBottomLeftRadius: 44 },
  { borderTopLeftRadius: 62, borderTopRightRadius: 42, borderBottomRightRadius: 68, borderBottomLeftRadius: 48 },
] as const;

function AuroraAtmosphere() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.aurora, styles.auroraBlue]} />
      <View style={[styles.aurora, styles.auroraViolet]} />
      <View style={[styles.aurora, styles.auroraEmerald]} />
    </View>
  );
}

function BrandHeader({ unread, onPress }: { unread: number; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandLockup}>
        <Sparkles size={25} color="#FFE28C" strokeWidth={1.8} />
        <View>
          <Text style={styles.wordmark}>N U T R E L U M A</Text>
          <Text style={styles.tagline}>Nourish a brighter you</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread ? `${unread} unread notifications` : 'Notifications'}
        onPress={onPress}
        style={({ pressed }) => [styles.notification, pressed && styles.pressed]}
      >
        <Bell size={21} color="#D7E4FF" strokeWidth={1.8} />
        {unread > 0 ? <View style={styles.notificationDot} /> : null}
      </Pressable>
    </View>
  );
}

function Welcome({ firstName }: { firstName?: string | null }) {
  return (
    <View style={styles.welcomeRow}>
      <View style={styles.welcomeCopy}>
        <Text style={styles.eyebrow}>GOOD MORNING{firstName ? `, ${firstName.toUpperCase()}` : ''}</Text>
        <Text style={styles.welcomeTitle}>Progress{`\n`}looks good <Text style={styles.gold}>✦</Text></Text>
        <Text style={styles.welcomeBody}>Small choices{`\n`}shape a brighter you.</Text>
      </View>
      <View style={styles.wellnessOrb}>
        <LinearGradient colors={['rgba(26,210,171,0.30)', 'rgba(7,24,53,0.82)', 'rgba(95,58,214,0.18)']} style={StyleSheet.absoluteFill} />
        <Leaf size={34} color="#66F3B7" strokeWidth={1.5} />
        <Text style={styles.orbCopy}>Fuel today.{`\n`}A brighter{`\n`}tomorrow.</Text>
      </View>
    </View>
  );
}

function ProgressArc({ progress, color, size = 112 }: { progress: number; color: string; size?: number }) {
  const stroke = size > 150 ? 12 : 8;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id={`arc-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF3BE" />
          <Stop offset="0.5" stopColor={color} />
          <Stop offset="1" stopColor={color} stopOpacity={0.72} />
        </SvgGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(113,139,183,0.18)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference * 0.72} ${circumference}`} transform={`rotate(-70 ${size / 2} ${size / 2})`} />
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={size > 150 ? `url(#arc-${color.replace('#', '')})` : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference * 0.72 * progress} ${circumference}`} transform={`rotate(-70 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

function CaloriesHero({ model, onPress }: { model: DashboardModel['calories']; onPress: () => void }) {
  const targetLabel = model.target ? `of ${Math.round(model.target)} kcal` : 'No target set';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${model.current} calories, ${model.percent}% of goal`} onPress={onPress} style={({ pressed }) => [styles.calorieShell, pressed && styles.pressed]}>
      <LinearGradient colors={['rgba(50,115,255,0.48)', 'rgba(9,18,48,0.96)', 'rgba(112,47,211,0.35)', 'rgba(255,191,76,0.28)']} locations={[0, 0.34, 0.72, 1]} style={styles.calorieOuter}>
        <View style={styles.calorieInner}>
          <ProgressArc progress={model.progress} color="#FFD66B" size={218} />
          <Text style={styles.calorieEyebrow}>C A L O R I E S</Text>
          <Text selectable style={styles.calorieValue}>{Math.round(model.current)}</Text>
          <Text selectable style={styles.calorieTarget}>{targetLabel}</Text>
          <View style={styles.percentPill}><Text selectable style={styles.percentText}>{model.percent}%</Text></View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function MetricBlob({ metric, index, onPress }: { metric: DashboardModel['metrics'][number]; index: number; onPress: () => void }) {
  const Icon = metricIcons[metric.key];
  const target = metric.target === null ? '—' : Math.round(metric.target).toLocaleString();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${metric.label}, ${metric.current} of ${target} ${metric.unit}`} onPress={onPress} style={({ pressed }) => [styles.metricWrap, pressed && styles.pressed]}>
      <View style={[styles.metricGlow, metricShapes[index], { backgroundColor: `${metric.color}22`, borderColor: `${metric.color}99`, boxShadow: `0 10px 34px ${metric.color}24` }]}>
        <ProgressArc progress={metric.progress} color={metric.color} />
        <View style={styles.metricContent}>
          <Icon size={22} color={metric.color} strokeWidth={1.8} />
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <View style={styles.metricValueRow}>
            <Text selectable style={styles.metricValue}>{Math.round(metric.current).toLocaleString()}</Text>
            <Text selectable style={styles.metricTarget}> / {target}{metric.unit}</Text>
          </View>
        </View>
        <View style={styles.metricChevron}><ChevronRight size={16} color="#B9C9E7" /></View>
      </View>
      <Text style={styles.metricMicrocopy}>{metric.microcopy}</Text>
    </Pressable>
  );
}

function SmartSummary({ message, onPress }: { message: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Smart Summary" onPress={onPress} style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
      <LinearGradient colors={['rgba(255,199,88,0.16)', 'rgba(9,17,40,0.93)', 'rgba(23,154,212,0.20)']} style={StyleSheet.absoluteFill} />
      <View style={styles.summaryTitleRow}><Sparkles size={22} color="#FFD86B" /><Text style={styles.summaryTitle}>Smart Summary</Text></View>
      <Text style={styles.summaryMessage}>{message}</Text>
      <View style={styles.summaryArrow}><ChevronRight size={20} color="#C7D8F8" /></View>
    </Pressable>
  );
}

function SmartLogBar({ onScan, onVoice, onAdd }: { onScan: () => void; onVoice: () => void; onAdd: () => void }) {
  return (
    <View style={styles.logBar}>
      <View style={styles.logPrompt}><Sparkles size={18} color="#8EA6FF" /><Text numberOfLines={1} style={styles.logPlaceholder}>What would you like to log?</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Scan food" onPress={onScan} style={({ pressed }) => [styles.logIconButton, pressed && styles.pressed]}><Scan size={21} color="#DCE7FF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Log by voice" onPress={onVoice} style={({ pressed }) => [styles.logIconButton, pressed && styles.pressed]}><Mic size={21} color="#DCE7FF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Add entry" onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><LinearGradient colors={['#42C8FF', '#4F5DFF', '#8B3DFF']} style={StyleSheet.absoluteFill} /><Plus size={29} color="#FFFFFF" /></Pressable>
    </View>
  );
}

function QuickActions({ onMeal, onWater, onActivity, onQuickAdd }: { onMeal: () => void; onWater: () => void; onActivity: () => void; onQuickAdd: () => void }) {
  const actions: Array<{ label: string; Icon: IconType; color: string; onPress: () => void }> = [
    { label: 'Meal', Icon: Apple, color: '#FF8E8E', onPress: onMeal },
    { label: 'Water', Icon: Droplet, color: '#38CFFF', onPress: onWater },
    { label: 'Activity', Icon: Footprints, color: '#7C8CFF', onPress: onActivity },
    { label: 'Quick Add', Icon: FilePlus, color: '#3CE2BE', onPress: onQuickAdd },
  ];
  return <View style={styles.quickRow}>{actions.map(({ label, Icon, color, onPress }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><Icon size={19} color={color} /><Text style={styles.quickLabel}>{label}</Text></Pressable>)}</View>;
}

export function AuroraDashboard(props: AuroraDashboardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const metrics = props.model.metrics;
  return (
    <View style={styles.root}>
      <AuroraAtmosphere />
      <BrandHeader unread={props.unreadNotifications} onPress={props.onNotifications} />
      <Welcome firstName={props.firstName} />
      {props.dateControl}
      <View style={[styles.metricStage, compact && styles.metricStageCompact]}>
        <View style={styles.sideColumn}>
          <MetricBlob metric={metrics[0]} index={0} onPress={() => props.onMetric(metrics[0].key)} />
          <MetricBlob metric={metrics[2]} index={2} onPress={() => props.onMetric(metrics[2].key)} />
        </View>
        <View style={styles.centerColumn}>
          <CaloriesHero model={props.model.calories} onPress={props.onCalories} />
          <MetricBlob metric={metrics[4]} index={4} onPress={() => props.onMetric(metrics[4].key)} />
        </View>
        <View style={[styles.sideColumn, styles.sideColumnLower]}>
          <MetricBlob metric={metrics[1]} index={1} onPress={() => props.onMetric(metrics[1].key)} />
          <MetricBlob metric={metrics[3]} index={3} onPress={() => props.onMetric(metrics[3].key)} />
          <MetricBlob metric={metrics[5]} index={5} onPress={() => props.onMetric(metrics[5].key)} />
        </View>
      </View>
      <SmartSummary message={props.model.summary} onPress={props.onCalories} />
      <SmartLogBar onScan={props.onAddMeal} onVoice={props.onQuickAdd} onAdd={props.onQuickAdd} />
      <QuickActions onMeal={props.onAddMeal} onWater={props.onAddWater} onActivity={props.onAddActivity} onQuickAdd={props.onQuickAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', gap: 22, paddingTop: 4 },
  aurora: { position: 'absolute', borderRadius: 999, opacity: 0.2 },
  auroraBlue: { width: 340, height: 140, top: 40, right: -170, backgroundColor: '#15BFFF', transform: [{ rotate: '-28deg' }], boxShadow: '0 0 80px rgba(21,191,255,0.35)' },
  auroraViolet: { width: 260, height: 140, top: 520, left: -170, backgroundColor: '#7A29E8', transform: [{ rotate: '18deg' }], boxShadow: '0 0 80px rgba(122,41,232,0.32)' },
  auroraEmerald: { width: 250, height: 130, top: 860, right: -170, backgroundColor: '#13B980', boxShadow: '0 0 70px rgba(19,185,128,0.3)' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { color: '#F4F7FF', fontSize: 14, fontWeight: '600', letterSpacing: 2.8 },
  tagline: { color: '#91A8CF', fontSize: 11, letterSpacing: 0.5, paddingTop: 4 },
  notification: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,34,63,0.72)', borderWidth: 1, borderColor: 'rgba(103,183,255,0.38)', boxShadow: '0 8px 28px rgba(23,130,255,0.25)' },
  notificationDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: '#E548EF' },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  welcomeCopy: { flex: 1, gap: 8 },
  eyebrow: { color: '#B4C9EB', fontSize: 10, letterSpacing: 3, fontWeight: '600' },
  welcomeTitle: { color: '#E6EEFF', fontSize: 36, lineHeight: 39, fontWeight: '400', letterSpacing: -1.4 },
  gold: { color: '#FFD970' },
  welcomeBody: { color: '#8EA6CD', fontSize: 15, lineHeight: 21 },
  wellnessOrb: { width: 126, minHeight: 138, padding: 18, borderTopLeftRadius: 56, borderTopRightRadius: 68, borderBottomRightRadius: 42, borderBottomLeftRadius: 72, overflow: 'hidden', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(76,229,198,0.35)', transform: [{ rotate: '5deg' }] },
  orbCopy: { color: '#99B9D9', fontSize: 14, lineHeight: 19 },
  metricStage: { minHeight: 690, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginHorizontal: -12, gap: 4 },
  metricStageCompact: { transform: [{ scale: 0.91 }], marginVertical: -30 },
  sideColumn: { width: '27%', gap: 26, paddingTop: 84 },
  sideColumnLower: { paddingTop: 50 },
  centerColumn: { width: '46%', alignItems: 'center', gap: 24 },
  calorieShell: { width: 224, height: 304, maxWidth: '100%' },
  calorieOuter: { flex: 1, padding: 5, borderTopLeftRadius: 98, borderTopRightRadius: 122, borderBottomRightRadius: 94, borderBottomLeftRadius: 128, transform: [{ rotate: '-3deg' }], boxShadow: '0 18px 50px rgba(44,102,255,0.32)' },
  calorieInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 92, borderTopRightRadius: 116, borderBottomRightRadius: 88, borderBottomLeftRadius: 122, backgroundColor: 'rgba(5,11,31,0.88)', overflow: 'hidden', transform: [{ rotate: '3deg' }] },
  calorieEyebrow: { color: '#E5ECFF', fontSize: 10, letterSpacing: 3, fontWeight: '700' },
  calorieValue: { color: '#F7F9FF', fontSize: 51, lineHeight: 58, fontWeight: '500', fontVariant: ['tabular-nums'] },
  calorieTarget: { color: '#C8D4ED', fontSize: 15 },
  percentPill: { minWidth: 66, minHeight: 34, marginTop: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(37,99,235,0.22)', borderWidth: 1, borderColor: '#397EF1' },
  percentText: { color: '#8FB9FF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricWrap: { alignItems: 'center', gap: 8 },
  metricGlow: { width: 112, height: 132, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  metricContent: { position: 'absolute', inset: 0, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 17, gap: 4 },
  metricLabel: { color: '#F2F6FF', fontSize: 13, fontWeight: '700' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  metricValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricTarget: { color: '#B6C4DE', fontSize: 10, fontVariant: ['tabular-nums'] },
  metricChevron: { position: 'absolute', right: 8, bottom: 10 },
  metricMicrocopy: { maxWidth: 106, minHeight: 30, color: '#8EA4C7', fontSize: 10, lineHeight: 14, textAlign: 'center', textTransform: 'capitalize' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  summary: { minHeight: 142, padding: 24, gap: 12, overflow: 'hidden', borderTopLeftRadius: 52, borderTopRightRadius: 78, borderBottomRightRadius: 46, borderBottomLeftRadius: 66, borderWidth: 1, borderColor: 'rgba(107,171,245,0.34)', boxShadow: '0 14px 38px rgba(5,101,173,0.22)' },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryTitle: { color: '#F1F5FF', fontSize: 17, fontWeight: '700' },
  summaryMessage: { maxWidth: '86%', color: '#B9C9E6', fontSize: 14, lineHeight: 21 },
  summaryArrow: { position: 'absolute', right: 24, top: 26 },
  logBar: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7, paddingLeft: 16, borderRadius: 38, backgroundColor: 'rgba(12,22,48,0.9)', borderWidth: 1, borderColor: 'rgba(108,151,231,0.36)' },
  logPrompt: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  logPlaceholder: { flex: 1, color: '#8FA7D0', fontSize: 13 },
  logIconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(133,165,222,0.35)', backgroundColor: 'rgba(11,26,54,0.8)' },
  addButton: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(89,72,255,0.45)' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction: { flexGrow: 1, flexBasis: 74, minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 24, backgroundColor: 'rgba(17,29,58,0.78)', borderWidth: 1, borderColor: 'rgba(119,151,210,0.28)' },
  quickLabel: { color: '#E1E9F9', fontSize: 12, fontWeight: '600' },
});
