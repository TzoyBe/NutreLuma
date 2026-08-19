import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, apiErrorMessage, type DashboardResult, type MobileUser } from './src/api';
import type {
  AppNotification,
  BillingOverviewResult,
  InsightsResult,
  IntelligenceResult,
  MaintenanceAlert,
  MaintenanceDashboardResult,
  MaintenanceEligibility,
  MaintenanceReport,
  MealDetailResult,
  MealSummary,
  MilestoneItem,
  MilestoneSuggestion,
  QuickPickCardModel,
  QuickPickPreviewResult,
  HealthProfileView,
  SavedRecipe,
  StatsOverviewResult,
  WeightEntry,
} from './src/api';
import { clearStoredSession, loadStoredSession, saveStoredSession } from './src/session-storage';
import { API_BASE_URL, colors } from './src/theme';
import { CalorieGauge, MacroGauge } from './src/gauges';
import { GoalProgressChart } from './src/goal-chart';
import { WaterGauge, StepsGauge } from './src/activity-gauges';
import { GoalTargets } from './src/goal-targets';
import { AiLoadingCard, AiSpinner } from './src/ai-loader';
import { GlassBackdrop } from './src/backdrop';
import { GlassCard } from './src/glass-card';
import { LogoMark } from './src/logo';
import { WelcomeTour } from './src/welcome-tour';
import { RevenueCatProvider, useRevenueCat } from './src/revenuecat';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LineChart,
  Plus,
  Scale,
  Settings,
  Sparkles,
  Target,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react-native';

type AuthMode = 'login' | 'register' | 'forgot' | 'verify';
type Session = { token: string; user: MobileUser; needsProfile: boolean };
type Screen =
  | 'dashboard'
  | 'addMeal'
  | 'onboarding'
  | 'welcome'
  | 'mealDetail'
  | 'history'
  | 'stats'
  | 'insights'
  | 'weight'
  | 'notifications'
  | 'settings'
  | 'progress'
  | 'goals'
  | 'goalsOverview'
  | 'maintenance'
  | 'recipes'
  | 'recipesOverview'
  | 'profile'
  | 'profileOverview';
type MainTab = 'dashboard' | 'progress' | 'goals' | 'recipes' | 'profile';

class AppErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: string | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Unexpected app error.' };
  }

  async resetApp() {
    await clearStoredSession();
    this.props.onReset();
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.startupContent}>
          <LogoMark />
          <Text style={styles.titleSmall}>NutreLuma needs a restart.</Text>
          <Text style={styles.subtitle}>{this.state.error}</Text>
          <PillButton label="Reset session" onPress={() => void this.resetApp()} />
        </View>
      </SafeAreaView>
    );
  }
}

const mainTabs: Array<{ screen: MainTab; label: string; Icon: LucideIcon }> = [
  { screen: 'dashboard', label: 'Today', Icon: LayoutDashboard },
  { screen: 'progress', label: 'Progress', Icon: LineChart },
  { screen: 'goals', label: 'Goals', Icon: Target },
  { screen: 'recipes', label: 'Recipes', Icon: ChefHat },
  { screen: 'profile', label: 'Profile', Icon: UserCircle2 },
];

function isMainTab(screen: Screen): screen is MainTab {
  return mainTabs.some((tab) => tab.screen === screen);
}

const mealTypes = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'MORNING_SNACK', label: 'Morning snack' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'AFTERNOON_SNACK', label: 'Afternoon snack' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'OTHER', label: 'Other' },
] as const;

const genders = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'UNDISCLOSED', label: 'Prefer not' },
] as const;

const activityLevels = [
  { value: 'SEDENTARY', label: 'Low' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'VERY_ACTIVE', label: 'Very active' },
] as const;

const goals = [
  { value: 'LOSE', label: 'Lose' },
  { value: 'MAINTAIN', label: 'Maintain' },
  { value: 'GAIN', label: 'Gain' },
] as const;

const milestoneTypes = [
  { value: 'MEAL_LOGGING_DAYS', label: 'Meal days' },
  { value: 'MEAL_LOGGING_STREAK', label: 'Meal streak' },
  { value: 'WEIGH_IN_FREQUENCY', label: 'Weigh-ins' },
  { value: 'WATER_TARGET_DAYS', label: 'Water days' },
  { value: 'STEP_TARGET_DAYS', label: 'Step days' },
  { value: 'ACTIVITY_TARGET', label: 'Activity' },
  { value: 'CUSTOM_NUMERIC', label: 'Custom' },
] as const;

function nowLocalInput(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
}

function todayLocalISO(): string {
  return nowLocalInput().slice(0, 10);
}

/** Μετατόπιση ISO ημέρας κατά `days` (UTC-safe), όπως το addDaysISO του web. */
function addDaysISO(dayISO: string, days: number): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + days * 86400000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** "2026-08-16" -> "Sat, 16 Aug" (ίδιο ύφος με το formatDayISOHuman του web). */
function formatDayISOHuman(dayISO: string): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

/** ISO timestamp -> τοπική ημέρα "YYYY-MM-DD" (τοπική ζώνη συσκευής). */
function localDayISO(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** ISO timestamp -> τοπική ώρα καταχώρησης "13:45" (τοπική ζώνη συσκευής). */
function formatMealTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
}

function defaultMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'BREAKFAST';
  if (hour < 12) return 'MORNING_SNACK';
  if (hour < 16) return 'LUNCH';
  if (hour < 19) return 'AFTERNOON_SNACK';
  if (hour < 23) return 'DINNER';
  return 'OTHER';
}

function displayMealType(value?: string): string {
  return mealTypes.find((type) => type.value === value)?.label ?? 'Meal';
}

function quickPickTitle(model: QuickPickCardModel) {
  return model.title || displayMealType(model.mealType);
}

function quickPickModelsFromOptions(result: Awaited<ReturnType<typeof api.quickPickOptions>>) {
  const favoriteIdByFingerprint = new Map(result.favorites.map((favorite) => [favorite.fingerprint, favorite.id]));
  const favorites: QuickPickCardModel[] = result.favorites.map((favorite) => ({
    ref: { kind: 'favorite', id: favorite.id },
    title: favorite.title ?? '',
    mealType: favorite.mealType,
    calories: favorite.calories,
    macros: favorite.macros,
    thumbUrl: favorite.thumbUrl,
    isFavorite: true,
    favoriteId: favorite.id,
  }));
  const frequent: QuickPickCardModel[] = result.frequent.map((row) => ({
    ref: { kind: 'frequent', fingerprint: row.fingerprint },
    title: row.meal.title ?? '',
    mealType: row.meal.mealType,
    calories: row.meal.finalCalories,
    macros: row.meal.macros,
    thumbUrl: null,
    isFavorite: row.isFavorite,
    favoriteId: favoriteIdByFingerprint.get(row.fingerprint) ?? null,
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt,
  }));
  const recent: QuickPickCardModel[] = result.recent.map((meal) => ({
    ref: { kind: 'recent', mealId: meal.id },
    title: meal.title ?? '',
    mealType: meal.mealType,
    calories: meal.finalCalories,
    macros: meal.macros,
    thumbUrl: null,
    isFavorite: false,
    favoriteId: null,
  }));
  return { favorites, frequent, recent };
}

function macroDisplayRows(macros: MealDetailResult['meal']['macros']) {
  return [
    { label: 'Protein', value: macros.proteinGrams, unit: 'g' },
    { label: 'Carbs', value: macros.carbohydrateGrams, unit: 'g' },
    { label: 'Fat', value: macros.fatGrams, unit: 'g' },
    { label: 'Fiber', value: macros.fiberGrams, unit: 'g' },
    { label: 'Sugar', value: macros.sugarGrams, unit: 'g' },
    { label: 'Sodium', value: macros.sodiumMg, unit: 'mg' },
  ].filter((row) => row.value !== null);
}

function notificationAction(notification: AppNotification): Screen | null {
  if (notification.type === 'MEAL_REMINDER') return 'addMeal';
  return null;
}

/** Πού να πάει το app όταν ο χρήστης πατήσει ένα push notification. */
function pushTargetScreen(data: Record<string, unknown> | null): Screen {
  const type = data && typeof data.type === 'string' ? data.type : '';
  if (type === 'MEAL_REMINDER') return 'addMeal';
  return 'notifications';
}

function formatNotificationDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function dashboardList<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function dashboardMacroRows(value: DashboardResult['macros']) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const labels: Record<string, string> = {
      protein: 'Protein',
      carbohydrate: 'Carbs',
      fat: 'Fat',
      fiber: 'Fiber',
    };
    return Object.entries(value).map(([key, macro]) => ({
      key,
      label: labels[key] ?? key,
      unit: 'g',
      ...macro,
    }));
  }
  return [];
}

type MacroValue = {
  consumed?: number;
  target?: number;
  overTarget?: boolean;
  progressPercent?: number;
  unit?: string;
};

/** Επιστρέφει τα μακροθρεπτικά με κλειδί (protein/carbohydrate/fat/fiber), όπως το web. */
function dashboardMacroMap(value: DashboardResult['macros']): Record<string, MacroValue> {
  const map: Record<string, MacroValue> = {};
  if (Array.isArray(value)) {
    for (const macro of value) {
      if (macro?.key) map[macro.key] = macro;
    }
  } else if (value && typeof value === 'object') {
    for (const [key, macro] of Object.entries(value)) {
      map[key] = macro as MacroValue;
    }
  }
  return map;
}

function formatWholeNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  try {
    return Math.round(value).toLocaleString();
  } catch {
    return String(Math.round(value));
  }
}

function MealPhoto({
  token,
  mealId,
  variant = 'thumb',
  style,
}: {
  token: string;
  mealId: string;
  variant?: 'thumb' | 'full';
  style: ComponentProps<typeof Image>['style'];
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{
        uri: `${API_BASE_URL}/api/meals/${mealId}/image?variant=${variant}`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' ? styles.ghostButton : styles.primaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={variant === 'ghost' ? styles.ghostButtonText : styles.primaryButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

function BottomNav({
  active,
  unreadNotifications,
  onChange,
}: {
  active: Screen;
  unreadNotifications: number;
  onChange: (screen: MainTab) => void;
}) {
  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        {mainTabs.map((tab) => {
          const selected = active === tab.screen;
          const showBadge = tab.screen === 'profile' && unreadNotifications > 0;
          return (
            <Pressable
              key={tab.screen}
              onPress={() => onChange(tab.screen)}
              style={[styles.navItem, selected ? styles.navItemActive : null]}
            >
              <View style={styles.navIconWrap}>
                <tab.Icon size={22} color={selected ? colors.primary : colors.mutedSoft} />
                {showBadge ? (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navLabel, selected ? styles.navLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.mutedSoft}
        selectionColor={colors.primary}
        style={styles.input}
      />
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTypeRow}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.mealTypePill, active ? styles.mealTypePillActive : null]}
            >
              <Text style={[styles.mealTypeText, active ? styles.mealTypeTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const float = useRef(new Animated.Value(0)).current;

  async function completeGoogleUrl(url: string) {
    let handoffToken = '';
    try {
      handoffToken = new URL(url).searchParams.get('token') ?? '';
    } catch {
      handoffToken = url.match(/[?&]token=([^&]+)/)?.[1] ?? '';
    }
    if (!handoffToken) return;
    setGoogleLoading(true);
    setMessage(null);
    try {
      const result = await api.completeGoogleMobileAuth(decodeURIComponent(handoffToken));
      onAuthenticated({
        token: result.token,
        user: result.user,
        needsProfile: result.needsProfile,
      });
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      void completeGoogleUrl(event.url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void completeGoogleUrl(url);
    });
    return () => subscription.remove();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  async function startGoogleLogin() {
    setGoogleLoading(true);
    setMessage(null);
    try {
      await Linking.openURL(`${API_BASE_URL}/api/auth/google?app=capacitor`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign-in could not be opened.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'login') {
        const result = await api.login(email, password);
        onAuthenticated({
          token: result.token,
          user: result.user,
          needsProfile: result.needsProfile,
        });
      } else if (mode === 'register') {
        await api.register(displayName, email, password);
        setMode('login');
        setMessage('Verification email sent. Verify your email, then log in here.');
      } else if (mode === 'forgot') {
        await api.forgotPassword(email);
        setMode('login');
        setMessage('If this email exists, a password reset link is on its way.');
      } else {
        await api.resendVerification(email);
        setMode('login');
        setMessage('If this account needs verification, a fresh link is on its way.');
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <LogoMark />
          <Text style={styles.brandText}>
            Nutre<Text style={styles.brandAccent}>Luma</Text>
          </Text>
        </View>

        <Animated.View style={[styles.heroPhone, { transform: [{ translateY }] }]}>
          <View style={styles.heroPhoneTop}>
            <Text style={styles.miniMuted}>Today</Text>
            <Text style={styles.heroPhoneTitle}>Lunch scan</Text>
          </View>
          <View style={styles.scanPreview}>
            <View style={styles.scanLine} />
            <Text style={styles.scanTitle}>AI estimate ready</Text>
            <Text style={styles.scanCopy}>Calories, macros and notes grouped.</Text>
          </View>
          <View style={styles.phoneMetrics}>
            <MetricCard value="612" label="kcal" />
            <MetricCard value="38g" label="protein" />
            <MetricCard value="52g" label="carbs" />
          </View>
        </Animated.View>

        <GlassCard style={styles.authPanel}>
          <Text style={styles.kicker}>Smart nutrition companion</Text>
          <Text style={styles.title}>See your food differently.</Text>
          <Text style={styles.subtitle}>
            Log meals, follow your day and keep progress synced across web, iOS and Android.
          </Text>

          <View style={styles.segmented}>
            <Pressable
              onPress={() => setMode('login')}
              style={[styles.segment, mode === 'login' ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, mode === 'login' ? styles.segmentTextActive : null]}>
                Log in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('register')}
              style={[styles.segment, mode === 'register' ? styles.segmentActive : null]}
            >
              <Text
                style={[styles.segmentText, mode === 'register' ? styles.segmentTextActive : null]}
              >
                Sign up
              </Text>
            </Pressable>
          </View>

          {mode === 'register' ? (
            <Field
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} />
          {mode === 'login' || mode === 'register' ? (
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <PillButton
            label={
              loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : 'Resend verification'
            }
            onPress={submit}
            disabled={loading}
          />

          <View style={styles.actionRow}>
            <Pressable onPress={() => setMode('forgot')} style={styles.actionButton}>
              <Text style={styles.actionText}>Forgot password</Text>
            </Pressable>
            <Pressable onPress={() => setMode('verify')} style={styles.actionButton}>
              <Text style={styles.actionText}>Verify email</Text>
            </Pressable>
          </View>
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddMealScreen({
  session,
  onBack,
  onCreated,
}: {
  session: Session;
  onBack: () => void;
  onCreated: (mealId: string) => void;
}) {
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mealType, setMealType] = useState(defaultMealType());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [manualDateTime, setManualDateTime] = useState(nowLocalInput());
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('');
  const [manualItemCalories, setManualItemCalories] = useState('');
  const [acknowledgeHigh, setAcknowledgeHigh] = useState(false);
  const [quickPicks, setQuickPicks] = useState<{
    favorites: QuickPickCardModel[];
    frequent: QuickPickCardModel[];
    recent: QuickPickCardModel[];
  }>({ favorites: [], frequent: [], recent: [] });
  const [quickPickLoading, setQuickPickLoading] = useState(false);
  const [selectedQuickPick, setSelectedQuickPick] = useState<QuickPickCardModel | null>(null);
  const [quickPickPreview, setQuickPickPreview] = useState<QuickPickPreviewResult | null>(null);
  const [quickPickMultiplier, setQuickPickMultiplier] = useState(1);
  const [quickPickNotes, setQuickPickNotes] = useState('');
  const [quickPickSubmitting, setQuickPickSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pickFromLibrary() {
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'NutreLuma needs photo library access to upload a meal.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.88,
    });
    if (!result.canceled) setAsset(result.assets[0] ?? null);
  }

  async function takePhoto() {
    setMessage(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'NutreLuma needs camera access to take a meal photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.88,
    });
    if (!result.canceled) setAsset(result.assets[0] ?? null);
  }

  async function loadQuickPicks() {
    setQuickPickLoading(true);
    try {
      const result = await api.quickPickOptions(session.token);
      setQuickPicks(quickPickModelsFromOptions(result));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setQuickPickLoading(false);
    }
  }

  async function openQuickPick(model: QuickPickCardModel, multiplier = 1) {
    setSelectedQuickPick(model);
    setQuickPickMultiplier(multiplier);
    setQuickPickPreview(null);
    setMessage(null);
    try {
      const preview = await api.previewQuickPick(session.token, model.ref, multiplier);
      setQuickPickPreview(preview);
      setMealType(preview.mealType);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  async function confirmQuickPick() {
    if (!selectedQuickPick || quickPickSubmitting) return;
    setQuickPickSubmitting(true);
    setMessage(null);
    try {
      const overrides =
        quickPickPreview?.composition.finalCalories === null
          ? undefined
          : { finalCalories: quickPickPreview?.composition.finalCalories ?? undefined };
      const result = await api.createQuickPick(session.token, {
        ref: selectedQuickPick.ref,
        servingMultiplier: quickPickMultiplier,
        mealType,
        notes: quickPickNotes.trim() || undefined,
        overrides,
        requestKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onCreated(result.meal.id);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setQuickPickSubmitting(false);
    }
  }

  async function toggleFavorite(model: QuickPickCardModel) {
    setMessage(null);
    try {
      if (model.favoriteId) {
        await api.removeFavorite(session.token, model.favoriteId);
      } else {
        await api.addFavorite(session.token, model.ref);
      }
      await loadQuickPicks();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  async function submit() {
    if (!asset) {
      setMessage('Choose or take a meal photo first.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const name = asset.fileName || `meal-${Date.now()}.jpg`;
      const type = asset.mimeType || 'image/jpeg';
      const result = await api.uploadMeal({
        token: session.token,
        image: { uri: asset.uri, name, type },
        mealType,
        mealDateTime: nowLocalInput(),
        title,
        notes,
      });
      onCreated(result.meal.id);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function optionalManualNumber(value: string) {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Enter valid numbers.');
    return parsed;
  }

  async function submitManual() {
    setLoading(true);
    setMessage(null);
    try {
      const finalCalories = optionalManualNumber(manualCalories);
      const itemCalories = optionalManualNumber(manualItemCalories);
      const items =
        manualItemName.trim() && itemCalories !== undefined
          ? [
              {
                name: manualItemName.trim(),
                estimatedQuantity: manualItemQuantity.trim(),
                finalCalories: itemCalories,
              },
            ]
          : [];
      if (finalCalories === undefined && !items.length) {
        throw new Error('Enter total calories or one food item.');
      }
      const result = await api.createManualMeal(session.token, {
        mealType,
        mealDateTime: manualDateTime,
        title,
        notes,
        finalCalories,
        proteinGrams: optionalManualNumber(manualProtein),
        carbohydrateGrams: optionalManualNumber(manualCarbs),
        fatGrams: optionalManualNumber(manualFat),
        fiberGrams: optionalManualNumber(manualFiber),
        items,
        acknowledgeHighCalories: acknowledgeHigh,
        requestKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onCreated(result.meal.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuickPicks();
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.addMealContent} keyboardShouldPersistTaps="handled">
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.kicker}>Add meal</Text>
            <Text style={styles.headerName}>{mode === 'photo' ? 'Photo analysis' : 'Manual entry'}</Text>
          </View>
          <Pressable onPress={onBack} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.segmented}>
          {(['photo', 'manual'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setMode(option)}
              style={[styles.segment, mode === option ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, mode === option ? styles.segmentTextActive : null]}>
                {option === 'photo' ? 'Photo' : 'Manual'}
              </Text>
            </Pressable>
          ))}
        </View>

        <GlassCard style={styles.authPanel}>
          <View style={styles.notificationHeader}>
            <Text style={styles.sectionTitle}>Quick picks</Text>
            <Pressable onPress={loadQuickPicks} disabled={quickPickLoading} style={styles.statusPill}>
              <Text style={styles.statusText}>{quickPickLoading ? '...' : 'Refresh'}</Text>
            </Pressable>
          </View>
          {(
            [
              ['Favorites', quickPicks.favorites],
              ['Frequent', quickPicks.frequent],
              ['Recent', quickPicks.recent],
            ] as const
          ).map(([label, models]) => (
            <View key={label} style={styles.quickPickSection}>
              <Text style={styles.fieldLabel}>{label}</Text>
              {models.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPickRow}>
                  {models.map((model) => (
                    <Pressable
                      key={`${model.ref.kind}-${JSON.stringify(model.ref)}`}
                      onPress={() => openQuickPick(model)}
                      style={styles.quickPickCardOuter}
                    >
                      <GlassCard style={styles.quickPickCard}>
                        <Text style={styles.mealTitle} numberOfLines={1}>{quickPickTitle(model)}</Text>
                        <Text style={styles.metricLabel}>{displayMealType(model.mealType)}</Text>
                        <Text style={styles.mealCalories}>{model.calories ?? '--'} kcal</Text>
                        {model.usageCount ? <Text style={styles.metricLabel}>{model.usageCount} times</Text> : null}
                        <Pressable onPress={() => toggleFavorite(model)} style={styles.favoriteMiniButton}>
                          <Text style={styles.favoriteMiniText}>{model.favoriteId ? 'Saved' : 'Save'}</Text>
                        </Pressable>
                      </GlassCard>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noticeCopy}>No {label.toLowerCase()} meals yet.</Text>
              )}
            </View>
          ))}
        </GlassCard>

        {selectedQuickPick ? (
          <GlassCard style={styles.authPanel}>
            <View style={styles.notificationHeader}>
              <View style={styles.mealItemCopy}>
                <Text style={styles.sectionTitle}>{quickPickTitle(selectedQuickPick)}</Text>
                <Text style={styles.metricLabel}>{quickPickPreview?.composition.finalCalories ?? selectedQuickPick.calories ?? '--'} kcal</Text>
              </View>
              <Pressable onPress={() => setSelectedQuickPick(null)} style={styles.statusPill}>
                <Text style={styles.statusText}>Close</Text>
              </Pressable>
            </View>
            <ChoiceRow
              label="Servings"
              value={String(quickPickMultiplier)}
              options={[
                { value: '0.5', label: '0.5x' },
                { value: '1', label: '1x' },
                { value: '1.5', label: '1.5x' },
                { value: '2', label: '2x' },
              ]}
              onChange={(value) => openQuickPick(selectedQuickPick, Number(value))}
            />
            <ChoiceRow label="Meal type" value={mealType} options={mealTypes} onChange={setMealType} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Notes optional</Text>
              <TextInput
                value={quickPickNotes}
                onChangeText={setQuickPickNotes}
                multiline
                placeholderTextColor={colors.mutedSoft}
                selectionColor={colors.primary}
                style={[styles.input, styles.notesInput]}
              />
            </View>
            {quickPickPreview?.composition.items.length ? (
              <View style={styles.recipeDetailBlock}>
                {quickPickPreview.composition.items.slice(0, 5).map((item) => (
                  <Text key={item.name} style={styles.noticeCopy}>
                    {item.name} - {item.finalCalories ?? 0} kcal
                  </Text>
                ))}
              </View>
            ) : null}
            <PillButton
              label={quickPickSubmitting ? 'Adding...' : 'Add quick meal'}
              onPress={confirmQuickPick}
              disabled={quickPickSubmitting || !quickPickPreview}
            />
          </GlassCard>
        ) : null}

        {mode === 'photo' ? (
          <>
            {asset ? (
              <GlassCard style={styles.photoPanel}>
                <Image source={{ uri: asset.uri }} style={styles.photoPreview} />
                <Pressable onPress={() => setAsset(null)} style={styles.photoRemoveButton}>
                  <Text style={styles.photoRemoveText}>Change photo</Text>
                </Pressable>
              </GlassCard>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable onPress={takePhoto} disabled={loading} style={[styles.actionButton, styles.actionPrimary]}>
                <Text style={styles.actionPrimaryText}>Camera</Text>
              </Pressable>
              <Pressable onPress={pickFromLibrary} disabled={loading} style={styles.actionButton}>
                <Text style={styles.actionText}>Gallery</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {mode === 'manual' || asset ? (
        <GlassCard style={styles.authPanel}>
          <Text style={styles.fieldLabel}>Meal type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTypeRow}>
            {mealTypes.map((type) => {
              const active = mealType === type.value;
              return (
                <Pressable
                  key={type.value}
                  onPress={() => setMealType(type.value)}
                  style={[styles.mealTypePill, active ? styles.mealTypePillActive : null]}
                >
                  <Text style={[styles.mealTypeText, active ? styles.mealTypeTextActive : null]}>
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Field
            label="Title optional"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />
          {mode === 'manual' ? (
            <>
              <Field label="Date time" value={manualDateTime} onChangeText={setManualDateTime} />
              <Field label="Total calories" value={manualCalories} onChangeText={setManualCalories} keyboardType="numeric" />
              <View style={styles.twoColumn}>
                <Field label="Protein g" value={manualProtein} onChangeText={setManualProtein} keyboardType="numeric" />
                <Field label="Carbs g" value={manualCarbs} onChangeText={setManualCarbs} keyboardType="numeric" />
              </View>
              <View style={styles.twoColumn}>
                <Field label="Fat g" value={manualFat} onChangeText={setManualFat} keyboardType="numeric" />
                <Field label="Fiber g" value={manualFiber} onChangeText={setManualFiber} keyboardType="numeric" />
              </View>
              <View style={styles.quickLogCard}>
                <Text style={styles.mealTitle}>Food item optional</Text>
                <Field label="Name" value={manualItemName} onChangeText={setManualItemName} />
                <View style={styles.twoColumn}>
                  <Field label="Quantity" value={manualItemQuantity} onChangeText={setManualItemQuantity} />
                  <Field label="Calories" value={manualItemCalories} onChangeText={setManualItemCalories} keyboardType="numeric" />
                </View>
              </View>
              <Pressable
                onPress={() => setAcknowledgeHigh((value) => !value)}
                style={styles.settingsRow}
              >
                <View style={styles.settingsCopy}>
                  <Text style={styles.mealTitle}>High calorie acknowledgement</Text>
                  <Text style={styles.noticeCopy}>Enable if the meal is intentionally high calorie.</Text>
                </View>
                <View style={[styles.statusPill, acknowledgeHigh ? styles.statusPillOn : null]}>
                  <Text style={[styles.statusText, acknowledgeHigh ? styles.statusTextOn : null]}>
                    {acknowledgeHigh ? 'On' : 'Off'}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes optional</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={colors.mutedSoft}
              selectionColor={colors.primary}
              style={[styles.input, styles.notesInput]}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <PillButton
            label={
              loading
                ? mode === 'photo'
                  ? 'Analyzing...'
                  : 'Saving...'
                : mode === 'photo'
                  ? 'Analyze meal'
                  : 'Save manual meal'
            }
            onPress={mode === 'photo' ? submit : submitManual}
            disabled={loading}
          />

          {loading && mode === 'photo' ? (
            <AiLoadingCard
              title="Analyzing your meal…"
              subtitle="Uploading your photo and estimating calories"
            />
          ) : null}
        </GlassCard>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OnboardingScreen({
  session,
  onComplete,
  onLogout,
}: {
  session: Session;
  onComplete: (session: Session) => void;
  onLogout: () => void;
}) {
  const [birthDate, setBirthDate] = useState('1990-01-01');
  const [gender, setGender] = useState('UNDISCLOSED');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState('MODERATE');
  const [goal, setGoal] = useState('MAINTAIN');
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const parsedHeight = Number(heightCm);
    const parsedCurrentWeight = Number(currentWeightKg);
    const parsedTargetWeight = targetWeightKg.trim() ? Number(targetWeightKg) : '';
    const parsedCalories = dailyCalorieTarget.trim() ? Number(dailyCalorieTarget) : '';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Athens';

    setLoading(true);
    setMessage(null);
    try {
      await api.updateProfile(session.token, {
        birthDate,
        gender,
        heightCm: parsedHeight,
        currentWeightKg: parsedCurrentWeight,
        targetWeightKg: parsedTargetWeight,
        activityLevel,
        goal,
        dailyCalorieTarget: parsedCalories,
        preferredUnits: 'METRIC',
        timezone,
      });

      onComplete({ ...session, needsProfile: false });
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.addMealContent} keyboardShouldPersistTaps="handled">
        <View style={styles.dashboardHeader}>
          <View style={styles.brandRowCompact}>
            <LogoMark />
            <View>
              <Text style={styles.kicker}>Profile setup</Text>
              <Text style={styles.headerName}>Personalize NutreLuma</Text>
            </View>
          </View>
          <Pressable onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        <GlassCard style={styles.authPanel}>
          <Text style={styles.titleSmall}>Your daily targets start here.</Text>
          <Text style={styles.subtitle}>
            These details help NutreLuma calculate calorie and macro guidance.
          </Text>

          <Field label="Birth date YYYY-MM-DD" value={birthDate} onChangeText={setBirthDate} />
          <ChoiceRow label="Gender" value={gender} options={genders} onChange={setGender} />

          <View style={styles.twoColumn}>
            <Field
              label="Height cm"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
            />
            <Field
              label="Weight kg"
              value={currentWeightKg}
              onChangeText={setCurrentWeightKg}
              keyboardType="decimal-pad"
            />
          </View>

          <Field
            label="Target weight optional"
            value={targetWeightKg}
            onChangeText={setTargetWeightKg}
            keyboardType="decimal-pad"
          />

          <ChoiceRow
            label="Activity"
            value={activityLevel}
            options={activityLevels}
            onChange={setActivityLevel}
          />
          <ChoiceRow label="Goal" value={goal} options={goals} onChange={setGoal} />

          <Field
            label="Daily calorie target optional"
            value={dailyCalorieTarget}
            onChangeText={setDailyCalorieTarget}
            keyboardType="numeric"
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <PillButton
            label={loading ? 'Saving...' : 'Finish setup'}
            onPress={submit}
            disabled={loading}
          />
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

function MealDetailScreen({
  session,
  mealId,
  onBack,
  onChanged,
}: {
  session: Session;
  mealId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [meal, setMeal] = useState<MealDetailResult['meal'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMealType, setEditMealType] = useState(defaultMealType());
  const [editCalories, setEditCalories] = useState('');
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const isAnalyzing = meal?.analysisStatus === 'PENDING' || meal?.analysisStatus === 'ANALYZING';
  const canConfirm =
    meal &&
    meal.status !== 'CONFIRMED' &&
    meal.analysisStatus === 'COMPLETED' &&
    meal.pendingClarifications === 0;

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.meal(session.token, mealId);
      setMeal(result.meal);
      setEditTitle(result.meal.title ?? '');
      setEditNotes(result.meal.notes ?? '');
      setEditMealType(result.meal.mealType);
      setEditCalories(String(result.meal.finalCalories ?? result.meal.aiEstimatedCalories ?? ''));
      setClarificationAnswers(
        Object.fromEntries(
          (result.meal.clarifications ?? [])
            .filter((question) => question.answer)
            .map((question) => [question.questionId, question.answer as string]),
        ),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function toggleMealFavorite() {
    if (!meal || favoriteBusy) return;
    setFavoriteBusy(true);
    setError(null);
    try {
      if (favoriteId) {
        await api.removeFavorite(session.token, favoriteId);
        setFavoriteId(null);
      } else {
        const result = await api.addFavorite(session.token, { kind: 'recent', mealId: meal.id });
        setFavoriteId(result.favorite.id);
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function confirmMeal() {
    if (!meal || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await api.confirmMeal(session.token, meal.id);
      setMeal(result.meal);
      onChanged();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setConfirming(false);
    }
  }

  async function saveMealEdits() {
    if (!meal || saving) return;
    const parsedCalories = editCalories.trim() ? Number(editCalories) : undefined;
    if (parsedCalories !== undefined && !Number.isFinite(parsedCalories)) {
      setError('Enter valid calories.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.updateMeal(session.token, meal.id, {
        title: editTitle,
        notes: editNotes,
        mealType: editMealType,
        finalCalories: parsedCalories,
        acknowledgeHighCalories: true,
      });
      setMeal(result.meal);
      setEditing(false);
      onChanged();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function confirmCancelMeal() {
    if (!meal || deleting) return;
    Alert.alert('Cancel meal?', 'This removes the meal from totals but keeps the record visible.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel meal',
        style: 'destructive',
        onPress: () => {
          void cancelMeal();
        },
      },
    ]);
  }

  async function cancelMeal() {
    if (!meal) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await api.cancelMeal(session.token, meal.id);
      setMeal(result.meal);
      onChanged();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteMeal() {
    if (!meal || deleting) return;
    Alert.alert('Delete meal?', 'This permanently deletes the meal and image.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteMeal();
        },
      },
    ]);
  }

  async function deleteMeal() {
    if (!meal) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteMeal(session.token, meal.id);
      onChanged();
      onBack();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  async function submitClarifications() {
    if (!meal || clarifying) return;
    const answers = (meal.clarifications ?? [])
      .filter((question) => !question.answer && clarificationAnswers[question.questionId]?.trim())
      .map((question) => ({
        questionId: question.questionId,
        answer: clarificationAnswers[question.questionId].trim(),
      }));
    if (!answers.length) {
      setError('Answer at least one clarification.');
      return;
    }
    setClarifying(true);
    setError(null);
    try {
      const result = await api.answerClarifications(session.token, meal.id, answers);
      // Μένουμε στην οθόνη του γεύματος ώστε ο χρήστης να δει το ΝΕΟ estimate και
      // μετά να πατήσει «Confirm». (Παλιά καλούσαμε onChanged() που έκανε
      // setScreen('dashboard') — γι' αυτό «πεταγόταν» στο dashboard χωρίς να δει
      // το ανανεωμένο kcal και το γεύμα έμενε σε review_required.)
      setMeal(result.meal);
      setClarificationAnswers(
        Object.fromEntries(
          (result.meal.clarifications ?? [])
            .filter((question) => question.answer)
            .map((question) => [question.questionId, question.answer as string]),
        ),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setClarifying(false);
    }
  }

  useEffect(() => {
    setFavoriteId(null);
    load();
  }, [mealId]);

  useEffect(() => {
    if (!isAnalyzing) return undefined;
    const id = setInterval(() => {
      void load(true);
    }, 3500);
    return () => clearInterval(id);
  }, [isAnalyzing, mealId]);

  const calories = meal?.finalCalories ?? meal?.aiEstimatedCalories ?? 0;
  const macroRows = meal ? macroDisplayRows(meal.macros) : [];

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.kicker}>{meal ? displayMealType(meal.mealType) : 'Meal detail'}</Text>
          <Text style={styles.headerName}>{meal?.title || 'Analysis result'}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Back</Text>
        </Pressable>
      </View>

      {meal ? (
        <MealPhoto
          token={session.token}
          mealId={meal.id}
          variant="full"
          style={styles.mealDetailPhoto}
        />
      ) : null}

      <GlassCard style={styles.summaryCard}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : meal ? (
          <>
            <View style={styles.summaryHeader}>
              <Text style={styles.kicker}>
                {isAnalyzing ? 'Analyzing...' : meal.analysisStatus.toLowerCase()}
              </Text>
              <Text style={styles.summaryPercent}>{meal.status.toLowerCase()}</Text>
            </View>
            <Text style={styles.calories}>{Math.round(calories).toLocaleString()} kcal</Text>
            <Text style={styles.subtitle}>
              {meal.aiConfidence !== null
                ? `${Math.round(meal.aiConfidence * 100)}% confidence`
                : meal.aiErrorCode
                  ? `AI error: ${meal.aiErrorCode}`
                  : 'Pull down to refresh the latest status.'}
            </Text>
            {isAnalyzing ? (
              <View style={styles.analysisPulse}>
                <AiSpinner size={40} />
                <Text style={styles.analysisPulseText}>Analyzing your meal…</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.errorText}>{error ?? 'Meal not found.'}</Text>
        )}
      </GlassCard>

      {error ? <Text style={styles.message}>{error}</Text> : null}

      {meal && meal.pendingClarifications > 0 ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Review needed</Text>
          <Text style={styles.noticeCopy}>
            Answer the AI questions below so NutreLuma can finish this meal accurately.
          </Text>
          <View style={styles.clarificationList}>
            {(meal.clarifications ?? []).map((question) => {
              const answered = Boolean(question.answer);
              const value = clarificationAnswers[question.questionId] ?? question.answer ?? '';
              return (
                <View key={question.id || question.questionId} style={styles.clarificationCard}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.clarificationQuestion}>{question.question}</Text>
                    {answered ? <Text style={styles.statusText}>Answered</Text> : null}
                  </View>
                  {question.options.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.mealTypeRow}
                    >
                      {question.options.map((option) => {
                        const active = value === option;
                        return (
                          <Pressable
                            key={option}
                            disabled={answered}
                            onPress={() =>
                              setClarificationAnswers((current) => ({
                                ...current,
                                [question.questionId]: option,
                              }))
                            }
                            style={[
                              styles.mealTypePill,
                              active ? styles.mealTypePillActive : null,
                              answered ? styles.disabledPill : null,
                            ]}
                          >
                            <Text style={[styles.mealTypeText, active ? styles.mealTypeTextActive : null]}>
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  {!answered ? (
                    <TextInput
                      value={value}
                      onChangeText={(text) =>
                        setClarificationAnswers((current) => ({
                          ...current,
                          [question.questionId]: text,
                        }))
                      }
                      placeholder={question.options.length ? 'Or type another answer' : 'Type your answer'}
                      placeholderTextColor={colors.mutedSoft}
                      selectionColor={colors.primary}
                      style={styles.input}
                    />
                  ) : (
                    <Text style={styles.noticeCopy}>{question.answer}</Text>
                  )}
                </View>
              );
            })}
          </View>
          <PillButton
            label={clarifying ? 'Updating...' : 'Submit answers'}
            onPress={submitClarifications}
            disabled={clarifying}
          />
        </View>
      ) : null}

      {clarifying ? (
        <AiLoadingCard title="Updating estimate…" subtitle="Applying your answers to recalculate" />
      ) : null}

      {meal && canConfirm ? (
        <PillButton
          label={confirming ? 'Confirming...' : 'Confirm meal'}
          onPress={confirmMeal}
          disabled={confirming}
        />
      ) : null}

      {meal ? (
        <View style={styles.actionRow}>
          <Pressable onPress={toggleMealFavorite} disabled={favoriteBusy} style={styles.actionButton}>
            <Text style={styles.actionText}>{favoriteId ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing((value) => !value)} style={styles.actionButton}>
            <Text style={styles.actionText}>{editing ? 'Close edit' : 'Edit'}</Text>
          </Pressable>
          <Pressable
            onPress={confirmCancelMeal}
            disabled={deleting || meal.status === 'CANCELLED'}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>{deleting ? 'Working...' : 'Cancel'}</Text>
          </Pressable>
          <Pressable onPress={confirmDeleteMeal} disabled={deleting} style={styles.actionButton}>
            <Text style={styles.actionText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}

      {meal && editing ? (
        <GlassCard style={styles.authPanel}>
          <Text style={styles.sectionTitle}>Edit meal</Text>
          <Field
            label="Title"
            value={editTitle}
            onChangeText={setEditTitle}
            autoCapitalize="sentences"
          />
          <ChoiceRow label="Meal type" value={editMealType} options={mealTypes} onChange={setEditMealType} />
          <Field
            label="Final calories"
            value={editCalories}
            onChangeText={setEditCalories}
            keyboardType="numeric"
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholderTextColor={colors.mutedSoft}
              selectionColor={colors.primary}
              style={[styles.input, styles.notesInput]}
            />
          </View>
          <PillButton label={saving ? 'Saving...' : 'Save changes'} onPress={saveMealEdits} disabled={saving} />
        </GlassCard>
      ) : null}

      {macroRows.length ? (
        <>
          <Text style={styles.sectionTitle}>Macros</Text>
          <View style={styles.macroGrid}>
            {macroRows.map((macro) => (
              <GlassCard key={macro.label} style={styles.macroCard}>
                <Text style={styles.metricValue}>
                  {Math.round((macro.value ?? 0) * 10) / 10}
                  <Text style={styles.metricUnit}>{macro.unit}</Text>
                </Text>
                <Text style={styles.metricLabel}>{macro.label}</Text>
              </GlassCard>
            ))}
          </View>
        </>
      ) : null}

      {meal?.items.length ? (
        <>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.mealList}>
            {meal.items.map((item) => (
              <View key={item.id} style={styles.mealCard}>
                <View style={styles.mealItemCopy}>
                  <Text style={styles.mealTitle}>{item.name}</Text>
                  <Text style={styles.metricLabel}>{item.estimatedQuantity || 'Estimated item'}</Text>
                </View>
                <Text style={styles.mealCalories}>
                  {Math.round(item.finalCalories ?? item.aiEstimatedCalories ?? 0)} kcal
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {meal?.notes ? (
        <View style={styles.emptyCard}>
          <Text style={styles.noticeTitle}>Notes</Text>
          <Text style={styles.noticeCopy}>{meal.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function WeightScreen({
  session,
  onBack,
  onChanged,
}: {
  session: Session;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [entryDate, setEntryDate] = useState(todayLocalISO());
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const result = await api.weights(session.token);
      setEntries(result.entries);
      const latest = result.entries[0];
      if (latest && !weightKg) setWeightKg(String(latest.weightKg));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function save() {
    const parsedWeight = Number(weightKg);
    if (!Number.isFinite(parsedWeight)) {
      setMessage('Enter a valid weight.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.saveWeight(session.token, {
        weightKg: parsedWeight,
        entryDate,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      await load(true);
      onChanged();
      setMessage('Weight saved.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(entry: WeightEntry) {
    Alert.alert('Delete weight entry?', `${entry.entryDate} - ${entry.weightKg} kg`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteEntry(entry.id);
        },
      },
    ]);
  }

  async function deleteEntry(entryId: string) {
    setMessage(null);
    try {
      await api.deleteWeight(session.token, entryId);
      await load(true);
      onChanged();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const latest = entries[0];
  const previous = entries[1];
  const delta =
    latest && previous ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.kicker}>Weight</Text>
            <Text style={styles.headerName}>Track progress</Text>
          </View>
          <Pressable onPress={onBack} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Back</Text>
          </Pressable>
        </View>

        <GlassCard style={styles.summaryCard}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.summaryHeader}>
                <Text style={styles.kicker}>Latest</Text>
                <Text style={styles.summaryPercent}>
                  {delta === null ? 'new' : `${delta > 0 ? '+' : ''}${delta} kg`}
                </Text>
              </View>
              <Text style={styles.calories}>{latest ? `${latest.weightKg} kg` : '-- kg'}</Text>
              <Text style={styles.subtitle}>
                {latest ? `Recorded on ${latest.entryDate}` : 'Add your first weight entry.'}
              </Text>
            </>
          )}
        </GlassCard>

        <GlassCard style={styles.authPanel}>
          <Text style={styles.titleSmall}>Add weight entry</Text>
          <View style={styles.twoColumn}>
            <Field label="Date" value={entryDate} onChangeText={setEntryDate} />
            <Field
              label="Weight kg"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes optional</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={colors.mutedSoft}
              selectionColor={colors.primary}
              style={[styles.input, styles.notesInput]}
            />
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <PillButton label={saving ? 'Saving...' : 'Save weight'} onPress={save} disabled={saving} />
        </GlassCard>

        <Text style={styles.sectionTitle}>Recent entries</Text>
        <View style={styles.mealList}>
          {entries.length ? (
            entries.map((entry) => (
              <Pressable key={entry.id} onLongPress={() => confirmDelete(entry)} style={styles.mealCard}>
                <View style={styles.mealItemCopy}>
                  <Text style={styles.mealTitle}>{entry.entryDate}</Text>
                  <Text style={styles.metricLabel}>
                    {entry.notes ? entry.notes : 'Long press to delete'}
                  </Text>
                </View>
                <Text style={styles.mealCalories}>{entry.weightKg} kg</Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.noticeTitle}>No weight entries yet</Text>
              <Text style={styles.noticeCopy}>Save your first entry to start the trend.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HistoryScreen({
  session,
  onBack,
  onOpenMeal,
}: {
  session: Session;
  onBack: () => void;
  onOpenMeal: (mealId: string) => void;
}) {
  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mealType, setMealType] = useState('');
  const [search, setSearch] = useState('');
  const [minCalories, setMinCalories] = useState('');
  const [maxCalories, setMaxCalories] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const result = await api.meals(session.token, {
        page: nextPage,
        pageSize,
        from,
        to,
        mealType,
        search,
        minCalories,
        maxCalories,
      });
      setMeals(Array.isArray(result.meals) ? result.meals : []);
      setTotal(result.total ?? 0);
      setPage(result.page ?? nextPage);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilters() {
    setPage(1);
    void load(1);
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setMealType('');
    setSearch('');
    setMinCalories('');
    setMaxCalories('');
    setPage(1);
  }

  useEffect(() => {
    load(1);
  }, []);

  useEffect(() => {
    if (!from && !to && !mealType && !search && !minCalories && !maxCalories) {
      void load(1, true);
    }
  }, [from, to, mealType, search, minCalories, maxCalories]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(page, true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.kicker}>History</Text>
            <Text style={styles.headerName}>{total} meals</Text>
          </View>
          <Pressable onPress={onBack} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Back</Text>
          </Pressable>
        </View>

        <GlassCard style={styles.authPanel}>
          <Text style={styles.titleSmall}>Find a meal</Text>
          <Field label="Search" value={search} onChangeText={setSearch} autoCapitalize="sentences" />
          <View style={styles.twoColumn}>
            <Field label="From YYYY-MM-DD" value={from} onChangeText={setFrom} />
            <Field label="To YYYY-MM-DD" value={to} onChangeText={setTo} />
          </View>
          <ChoiceRow
            label="Meal type"
            value={mealType}
            options={[{ value: '', label: 'All' }, ...mealTypes]}
            onChange={setMealType}
          />
          <View style={styles.twoColumn}>
            <Field
              label="Min kcal"
              value={minCalories}
              onChangeText={setMinCalories}
              keyboardType="numeric"
            />
            <Field
              label="Max kcal"
              value={maxCalories}
              onChangeText={setMaxCalories}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.actionRow}>
            <Pressable onPress={applyFilters} style={[styles.actionButton, styles.actionPrimary]}>
              <Text style={styles.actionPrimaryText}>Apply</Text>
            </Pressable>
            <Pressable onPress={clearFilters} style={styles.actionButton}>
              <Text style={styles.actionText}>Clear</Text>
            </Pressable>
          </View>
        </GlassCard>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.mealList}>
          {loading ? (
            <GlassCard style={styles.summaryCard}>
              <ActivityIndicator color={colors.primary} />
            </GlassCard>
          ) : meals.length ? (
            meals.map((meal) => (
              <Pressable key={meal.id} onPress={() => onOpenMeal(meal.id)} style={styles.mealCard}>
                <View style={styles.mealItemCopy}>
                  <Text style={styles.mealTitle}>{meal.title || displayMealType(meal.mealType)}</Text>
                  <Text style={styles.metricLabel}>
                    {displayMealType(meal.mealType)} · {formatNotificationDate(meal.mealDateTime)} ·{' '}
                    {meal.status.toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.mealCalories}>
                  {Math.round(meal.finalCalories ?? meal.aiEstimatedCalories ?? 0)} kcal
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.noticeTitle}>No meals found</Text>
              <Text style={styles.noticeCopy}>Try clearing filters or adding a meal.</Text>
            </View>
          )}
        </View>

        <View style={styles.paginationRow}>
          <Pressable
            onPress={() => load(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            style={[styles.pageButton, page <= 1 ? styles.buttonDisabled : null]}
          >
            <Text style={styles.actionText}>Prev</Text>
          </Pressable>
          <Text style={styles.metricLabel}>
            Page {page} / {totalPages}
          </Text>
          <Pressable
            onPress={() => load(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            style={[styles.pageButton, page >= totalPages ? styles.buttonDisabled : null]}
          >
            <Text style={styles.actionText}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MiniBarChart({
  points,
  target,
}: {
  points: Array<{ label: string; value: number; highlight?: boolean }>;
  target?: number | null;
}) {
  const max = Math.max(1, target ?? 0, ...points.map((point) => point.value));
  return (
    <View style={styles.chartRow}>
      {points.map((point, index) => {
        const height = Math.max(6, Math.round((point.value / max) * 92));
        return (
          <View key={`${point.label}-${index}`} style={styles.chartColumn}>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBar,
                  point.highlight ? styles.chartBarHighlight : null,
                  { height },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DistributionRows({
  rows,
}: {
  rows: Array<{ label: string; percent: number; total: number }>;
}) {
  return (
    <View style={styles.distributionList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.distributionRow}>
          <View style={styles.distributionHeader}>
            <Text style={styles.metricLabel}>{row.label}</Text>
            <Text style={styles.mealCalories}>{row.percent}%</Text>
          </View>
          <ProgressBar value={row.percent} />
          <Text style={styles.metricLabel}>{formatWholeNumber(row.total)} kcal</Text>
        </View>
      ))}
    </View>
  );
}

function StatsScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false, range = days) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      setStats(await api.stats(session.token, range));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function changeRange(nextDays: number) {
    setDays(nextDays);
    void load(false, nextDays);
  }

  useEffect(() => {
    load();
  }, []);

  const daily = (stats?.dailyTotals ?? []).slice(-14).map((point) => ({
    label: point.day.slice(5),
    value: point.total,
    highlight: stats?.target ? point.total > stats.target : false,
  }));
  const distribution = (stats?.distribution ?? []).map((slice) => ({
    label: displayMealType(slice.mealType),
    percent: slice.percent,
    total: slice.total,
  }));
  const timeLabels: Record<string, string> = {
    morning: 'Morning',
    midday: 'Midday',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  };
  const timeRows = (stats?.timeOfDay ?? []).map((slice) => ({
    label: timeLabels[slice.bucket] ?? slice.bucket,
    percent: slice.percent,
    total: slice.total,
  }));

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.kicker}>Stats</Text>
          <Text style={styles.headerName}>{days}-day overview</Text>
        </View>
        <Pressable onPress={onBack} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.segmented}>
        {[30, 90].map((value) => {
          const active = days === value;
          return (
            <Pressable
              key={value}
              onPress={() => changeRange(value)}
              style={[styles.segment, active ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                {value} days
              </Text>
            </Pressable>
          );
        })}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : stats && stats.daysLogged > 0 ? (
        <>
          <View style={styles.macroGrid}>
            <MetricCard value={formatWholeNumber(stats.average7)} label="avg 7 kcal" />
            <MetricCard value={formatWholeNumber(stats.average30)} label="avg 30 kcal" />
            <MetricCard value={formatWholeNumber(stats.weekTotal)} label="week kcal" />
            <MetricCard
              value={stats.daysWithinTargetPercent === null ? '--' : `${stats.daysWithinTargetPercent}%`}
              label="within target"
            />
          </View>

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Calories per day</Text>
            <MiniBarChart points={daily} target={stats.target} />
            <Text style={styles.metricLabel}>
              {stats.from} to {stats.to}
              {stats.target ? ` · target ${stats.target} kcal` : ''}
            </Text>
          </GlassCard>

          {stats.weight ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Weight vs calories</Text>
              <View style={styles.twoColumn}>
                <MetricCard
                  value={`${stats.weight.deltaKg > 0 ? '+' : ''}${stats.weight.deltaKg}`}
                  label="kg change"
                />
                <MetricCard value={formatWholeNumber(stats.avgIntake)} label="avg kcal" />
              </View>
              <Text style={styles.metricLabel}>
                {stats.weight.first} kg to {stats.weight.last} kg
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.noticeTitle}>Weight trend needs more data</Text>
              <Text style={styles.noticeCopy}>Add at least two weight entries to see the trend.</Text>
            </View>
          )}

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Meal distribution</Text>
            <DistributionRows rows={distribution} />
          </GlassCard>

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Eating times</Text>
            <DistributionRows rows={timeRows} />
          </GlassCard>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.noticeTitle}>No stats yet</Text>
          <Text style={styles.noticeCopy}>Confirm a few meals to unlock progress charts.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function GoalMetric({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return <MetricCard value={value === null || value === undefined ? '--' : String(Math.round(value))} label={`${label} ${unit}`} />;
}

function InsightsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const [insightsResult, intelligenceResult] = await Promise.all([
        api.insights(session.token),
        api.intelligence(session.token),
      ]);
      setInsights(insightsResult);
      setIntelligence(intelligenceResult);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const calibration = intelligence?.calibration;
  const quality = insights?.quality;

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.kicker}>Insights</Text>
          <Text style={styles.headerName}>{insights?.today ?? 'Personal signals'}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Back</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : (
        <>
          <View style={styles.macroGrid}>
            <MetricCard value={calibration ? `${calibration.score}%` : '--'} label="calibration" />
            <MetricCard value={quality ? `${quality.score}%` : '--'} label={`quality ${quality?.level ?? ''}`} />
            <MetricCard value={`${intelligence?.correctionRates?.['30d'] ?? 0}%`} label="30d corrections" />
          </View>

          {insights?.energy ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Energy estimate</Text>
              <Text style={styles.calories}>{insights.energy.estimatedCalories} kcal</Text>
              <Text style={styles.noticeCopy}>
                Confidence {Math.round(insights.energy.confidence * 100)}% - {insights.energy.completeDays} complete days
              </Text>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Useful patterns</Text>
            {insights?.patterns?.length ? (
              insights.patterns.map((pattern) => (
                <View key={pattern.type} style={styles.quickLogCard}>
                  <Text style={styles.mealTitle}>{pattern.type.toLowerCase()}</Text>
                  <Text style={styles.noticeCopy}>
                    {pattern.message ??
                      `${pattern.weekendHigher ? 'Weekend' : 'Weekday'} meals average ${pattern.deltaKcal ?? 0} kcal higher.`}
                  </Text>
                  <Text style={styles.metricLabel}>
                    {pattern.sampleCount ?? 0} meals - {Math.round((pattern.confidence ?? 0) * 100)}% strength
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noticeCopy}>Track more confirmed meals to unlock personal patterns.</Text>
            )}
          </GlassCard>

        </>
      )}
    </ScrollView>
  );
}

function MaintenanceScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [eligibility, setEligibility] = useState<MaintenanceEligibility | null>(null);
  const [dashboard, setDashboard] = useState<MaintenanceDashboardResult | null>(null);
  const [report, setReport] = useState<MaintenanceReport | null>(null);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [editingMaintenance, setEditingMaintenance] = useState(false);
  const [rangeTarget, setRangeTarget] = useState('');
  const [rangeLower, setRangeLower] = useState('');
  const [rangeUpper, setRangeUpper] = useState('');
  const [calorieTarget, setCalorieTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');
  const [carbTarget, setCarbTarget] = useState('');
  const [fatTarget, setFatTarget] = useState('');
  const [weighInsPerWeek, setWeighInsPerWeek] = useState('3');
  const [alertSensitivity, setAlertSensitivity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [applyCalorieTarget, setApplyCalorieTarget] = useState(false);
  const [confirmActivation, setConfirmActivation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const eligibilityResult = await api.maintenanceEligibility(session.token);
      setEligibility(eligibilityResult);
      if (!dashboard) {
        const suggestedRange = eligibilityResult.suggestedRange;
        setRangeTarget(String(eligibilityResult.targetWeightKg ?? ''));
        setRangeLower(String(suggestedRange?.lower ?? ''));
        setRangeUpper(String(suggestedRange?.upper ?? ''));
        setCalorieTarget(String(eligibilityResult.suggestedCalorieTarget ?? eligibilityResult.currentCalorieTarget ?? ''));
      }
      if (eligibilityResult.alreadyActive) {
        const [dashboardResult, reportResult, alertsResult] = await Promise.all([
          api.maintenanceDashboard(session.token),
          api.maintenanceReport(session.token),
          api.maintenanceAlerts(session.token),
        ]);
        setDashboard(dashboardResult);
        setRangeTarget(String(dashboardResult.targetWeightKg));
        setRangeLower(String(dashboardResult.range.lower));
        setRangeUpper(String(dashboardResult.range.upper));
        setCalorieTarget(String(dashboardResult.calorie.target));
        setReport(reportResult);
        setAlerts(alertsResult.alerts);
      } else {
        setDashboard(null);
        setReport(null);
        setAlerts([]);
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function activateMaintenance() {
    setSavingMaintenance(true);
    setMessage(null);
    try {
      await api.activateMaintenance(session.token, {
        targetWeightKg: numberField(rangeTarget, 'Target weight', true) as number,
        lowerBoundaryKg: numberField(rangeLower, 'Lower boundary', true) as number,
        upperBoundaryKg: numberField(rangeUpper, 'Upper boundary', true) as number,
        weighInsPerWeek: numberField(weighInsPerWeek, 'Weigh-ins per week', true) as number,
        calorieTarget: numberField(calorieTarget, 'Calorie target', true) as number,
        applyCalorieTarget,
        proteinGrams: numberField(proteinTarget, 'Protein'),
        carbohydrateGrams: numberField(carbTarget, 'Carbs'),
        fatGrams: numberField(fatTarget, 'Fat'),
        alertSensitivity,
        confirm: confirmActivation,
      });
      setMessage('Maintenance mode activated.');
      setConfirmActivation(false);
      setEditingMaintenance(false);
      await load(true);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function saveMaintenanceRange() {
    setSavingMaintenance(true);
    setMessage(null);
    try {
      await api.updateMaintenanceRange(session.token, {
        targetWeightKg: numberField(rangeTarget, 'Target weight', true) as number,
        lowerBoundaryKg: numberField(rangeLower, 'Lower boundary', true) as number,
        upperBoundaryKg: numberField(rangeUpper, 'Upper boundary', true) as number,
        reason: 'native_update',
      });
      setMessage('Maintenance range saved.');
      await load(true);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function saveMaintenanceTargets() {
    setSavingMaintenance(true);
    setMessage(null);
    try {
      await api.updateMaintenanceTargets(session.token, {
        calorieTarget: numberField(calorieTarget, 'Calorie target', true) as number,
        proteinGrams: numberField(proteinTarget, 'Protein'),
        carbohydrateGrams: numberField(carbTarget, 'Carbs'),
        fatGrams: numberField(fatTarget, 'Fat'),
        alertSensitivity,
        weighInsPerWeek: numberField(weighInsPerWeek, 'Weigh-ins per week', true) as number,
        applyCalorieTarget,
      });
      setMessage('Maintenance targets saved.');
      await load(true);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function dismissAlert(alertId: string) {
    setMessage(null);
    try {
      await api.dismissMaintenanceAlert(session.token, alertId);
      setAlerts((items) => items.filter((item) => item.id !== alertId));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  async function switchMode(mode: 'LOSS' | 'MAINTENANCE' | 'GAIN') {
    setSavingMode(true);
    setMessage(null);
    try {
      await api.updateMaintenanceMode(session.token, mode);
      setMessage(`Mode changed to ${mode.toLowerCase()}.`);
      await load(true);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingMode(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.kicker}>Maintenance</Text>
          <Text style={styles.headerName}>{dashboard?.today ?? 'Stability mode'}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Back</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : dashboard ? (
        <>
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.kicker}>{dashboard.status.toLowerCase()}</Text>
              <Text style={styles.summaryPercent}>{dashboard.score.score}%</Text>
            </View>
            <Text style={styles.calories}>
              {dashboard.current7dAverage === null ? '--' : dashboard.current7dAverage.toFixed(1)} kg
            </Text>
            <Text style={styles.subtitle}>
              Range {dashboard.range.lower}-{dashboard.range.upper} kg
            </Text>
            <ProgressBar value={dashboard.score.score} />
          </GlassCard>

          <GlassCard style={styles.authPanel}>
            <View style={styles.notificationHeader}>
              <View style={styles.mealItemCopy}>
                <Text style={styles.sectionTitle}>Maintenance controls</Text>
                <Text style={styles.noticeCopy}>Fine tune range, daily targets and alert behavior.</Text>
              </View>
              <Pressable
                onPress={() => setEditingMaintenance((value) => !value)}
                style={styles.statusPill}
              >
                <Text style={styles.statusText}>{editingMaintenance ? 'Close' : 'Edit'}</Text>
              </Pressable>
            </View>

            {editingMaintenance ? (
              <View style={styles.recipeDetailBlock}>
                <Text style={styles.mealTitle}>Weight range</Text>
                <Field label="Target kg" value={rangeTarget} onChangeText={setRangeTarget} keyboardType="numeric" />
                <View style={styles.twoColumn}>
                  <Field label="Lower kg" value={rangeLower} onChangeText={setRangeLower} keyboardType="numeric" />
                  <Field label="Upper kg" value={rangeUpper} onChangeText={setRangeUpper} keyboardType="numeric" />
                </View>
                <PillButton label={savingMaintenance ? 'Saving...' : 'Save range'} onPress={saveMaintenanceRange} disabled={savingMaintenance} />

                <Text style={styles.mealTitle}>Nutrition targets</Text>
                <Field label="Calories" value={calorieTarget} onChangeText={setCalorieTarget} keyboardType="numeric" />
                <View style={styles.twoColumn}>
                  <Field label="Protein g" value={proteinTarget} onChangeText={setProteinTarget} keyboardType="numeric" />
                  <Field label="Carbs g" value={carbTarget} onChangeText={setCarbTarget} keyboardType="numeric" />
                </View>
                <View style={styles.twoColumn}>
                  <Field label="Fat g" value={fatTarget} onChangeText={setFatTarget} keyboardType="numeric" />
                  <Field label="Weigh-ins/wk" value={weighInsPerWeek} onChangeText={setWeighInsPerWeek} keyboardType="numeric" />
                </View>
                <ChoiceRow
                  label="Alert sensitivity"
                  value={alertSensitivity}
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                  ]}
                  onChange={setAlertSensitivity}
                />
                <Pressable onPress={() => setApplyCalorieTarget((value) => !value)} style={styles.settingsRow}>
                  <View style={styles.settingsCopy}>
                    <Text style={styles.mealTitle}>Apply to daily goal</Text>
                    <Text style={styles.noticeCopy}>Also update today's calorie and macro goal.</Text>
                  </View>
                  <View style={[styles.statusPill, applyCalorieTarget ? styles.statusPillOn : null]}>
                    <Text style={[styles.statusText, applyCalorieTarget ? styles.statusTextOn : null]}>
                      {applyCalorieTarget ? 'On' : 'Off'}
                    </Text>
                  </View>
                </Pressable>
                <PillButton label={savingMaintenance ? 'Saving...' : 'Save targets'} onPress={saveMaintenanceTargets} disabled={savingMaintenance} />
              </View>
            ) : null}
          </GlassCard>

          <View style={styles.macroGrid}>
            <MetricCard value={String(dashboard.stability.daysWithinRange30)} label="days in range" />
            <MetricCard value={dashboard.stability.variability.toFixed(1)} label="variability kg" />
            <MetricCard value={String(dashboard.calorie.completeDays7)} label="complete days" />
            <MetricCard value={dashboard.calorie.diffFromTarget === null ? '--' : String(Math.round(dashboard.calorie.diffFromTarget))} label="kcal delta" />
          </View>

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Habits</Text>
            <View style={styles.distributionList}>
              {Object.entries(dashboard.habits).map(([key, value]) => (
                <View key={key} style={styles.distributionRow}>
                  <View style={styles.distributionHeader}>
                    <Text style={styles.metricLabel}>{key.replace('Percent', '')}</Text>
                    <Text style={styles.mealCalories}>{value}%</Text>
                  </View>
                  <ProgressBar value={value} />
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {dashboard.recommendations.length ? (
              dashboard.recommendations.map((item, index) => (
                <Text key={`${item.code ?? index}`} style={styles.noticeCopy}>{item.message}</Text>
              ))
            ) : (
              <Text style={styles.noticeCopy}>Keep your current rhythm.</Text>
            )}
          </GlassCard>

          {report ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Weekly report</Text>
              <Text style={styles.noticeCopy}>{report.weekStart} to {report.weekEnd}</Text>
              <View style={styles.macroGrid}>
                <MetricCard value={report.movingAverage === null ? '--' : report.movingAverage.toFixed(1)} label="avg kg" />
                <MetricCard value={String(report.daysWithinRange)} label="range days" />
                <MetricCard value={report.averageCalories === null ? '--' : String(Math.round(report.averageCalories))} label="avg kcal" />
              </View>
              <Text style={styles.message}>{report.suggestedNextAction}</Text>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Mode</Text>
            <View style={styles.actionRow}>
              {(['LOSS', 'MAINTENANCE', 'GAIN'] as const).map((mode) => (
                <Pressable key={mode} onPress={() => switchMode(mode)} disabled={savingMode} style={styles.actionButton}>
                  <Text style={styles.actionText}>{mode.toLowerCase()}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>

          {alerts.length ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              {alerts.slice(0, 5).map((alert) => (
                <View key={alert.id} style={styles.quickLogCard}>
                  <Text style={styles.mealTitle}>{alert.severity.toLowerCase()}</Text>
                  <Text style={styles.noticeCopy}>{alert.message}</Text>
                  <PillButton label="Dismiss" onPress={() => dismissAlert(alert.id)} variant="ghost" />
                </View>
              ))}
            </GlassCard>
          ) : null}
        </>
      ) : (
        <GlassCard style={styles.authPanel}>
          <Text style={styles.sectionTitle}>Maintenance locked</Text>
          <Text style={styles.noticeCopy}>
            Progress {Math.round(eligibility?.progressPercent ?? 0)}% toward your target weight.
          </Text>
          <ProgressBar value={eligibility?.progressPercent ?? 0} />
          <View style={styles.macroGrid}>
            <MetricCard value={eligibility?.current === null || eligibility?.current === undefined ? '--' : String(eligibility.current)} label="current kg" />
            <MetricCard value={eligibility?.targetWeightKg === null || eligibility?.targetWeightKg === undefined ? '--' : String(eligibility.targetWeightKg)} label="target kg" />
          </View>
          {eligibility?.eligible ? (
            <View style={styles.recipeDetailBlock}>
              <Text style={styles.mealTitle}>Activate maintenance</Text>
              <Field label="Target kg" value={rangeTarget} onChangeText={setRangeTarget} keyboardType="numeric" />
              <View style={styles.twoColumn}>
                <Field label="Lower kg" value={rangeLower} onChangeText={setRangeLower} keyboardType="numeric" />
                <Field label="Upper kg" value={rangeUpper} onChangeText={setRangeUpper} keyboardType="numeric" />
              </View>
              <View style={styles.twoColumn}>
                <Field label="Calories" value={calorieTarget} onChangeText={setCalorieTarget} keyboardType="numeric" />
                <Field label="Weigh-ins/wk" value={weighInsPerWeek} onChangeText={setWeighInsPerWeek} keyboardType="numeric" />
              </View>
              <View style={styles.twoColumn}>
                <Field label="Protein g" value={proteinTarget} onChangeText={setProteinTarget} keyboardType="numeric" />
                <Field label="Carbs g" value={carbTarget} onChangeText={setCarbTarget} keyboardType="numeric" />
              </View>
              <Field label="Fat g" value={fatTarget} onChangeText={setFatTarget} keyboardType="numeric" />
              <ChoiceRow
                label="Alert sensitivity"
                value={alertSensitivity}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ]}
                onChange={setAlertSensitivity}
              />
              <Pressable onPress={() => setApplyCalorieTarget((value) => !value)} style={styles.settingsRow}>
                <View style={styles.settingsCopy}>
                  <Text style={styles.mealTitle}>Apply calorie target</Text>
                  <Text style={styles.noticeCopy}>Update today's daily nutrition goal too.</Text>
                </View>
                <View style={[styles.statusPill, applyCalorieTarget ? styles.statusPillOn : null]}>
                  <Text style={[styles.statusText, applyCalorieTarget ? styles.statusTextOn : null]}>
                    {applyCalorieTarget ? 'On' : 'Off'}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setConfirmActivation((value) => !value)} style={styles.settingsRow}>
                <View style={styles.settingsCopy}>
                  <Text style={styles.mealTitle}>Confirm activation</Text>
                  <Text style={styles.noticeCopy}>I want to switch this account into maintenance mode.</Text>
                </View>
                <View style={[styles.statusPill, confirmActivation ? styles.statusPillOn : null]}>
                  <Text style={[styles.statusText, confirmActivation ? styles.statusTextOn : null]}>
                    {confirmActivation ? 'Yes' : 'No'}
                  </Text>
                </View>
              </Pressable>
              <PillButton
                label={savingMaintenance ? 'Activating...' : 'Activate maintenance'}
                onPress={activateMaintenance}
                disabled={savingMaintenance || !confirmActivation}
              />
            </View>
          ) : (
            <Text style={styles.noticeCopy}>Keep logging weight entries to unlock maintenance mode.</Text>
          )}
        </GlassCard>
      )}
    </ScrollView>
  );
}

function milestoneTypeLabel(value: string) {
  return milestoneTypes.find((type) => type.value === value)?.label ?? value.replaceAll('_', ' ').toLowerCase();
}

function numberField(value: string, label: string, required = false) {
  if (!value.trim()) {
    if (required) throw new Error(`${label} is required.`);
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  return parsed;
}

function MilestoneCard({ milestone, children }: { milestone: MilestoneItem; children?: ReactNode }) {
  return (
    <GlassCard style={styles.notificationCard}>
      <View style={styles.notificationHeader}>
        <View style={styles.mealItemCopy}>
          <Text style={styles.mealTitle}>{milestone.title}</Text>
          <Text style={styles.metricLabel}>
            {milestone.status.toLowerCase()} · {milestone.currentValue}/{milestone.targetValue}
            {milestone.unit ? ` ${milestone.unit}` : ''}
          </Text>
        </View>
        <Text style={styles.mealCalories}>{Math.round(milestone.percent)}%</Text>
      </View>
      <ProgressBar value={milestone.percent} />
      {milestone.description ? <Text style={styles.noticeCopy}>{milestone.description}</Text> : null}
      {children}
    </GlassCard>
  );
}

function GoalsOverviewScreen({
  session,
  onOpenMaintenance,
}: {
  session: Session;
  onOpenMaintenance: () => void;
}) {
  const [goal, setGoal] = useState<Awaited<ReturnType<typeof api.goals>> | null>(null);
  const [achievements, setAchievements] = useState(0);
  const [achievementTotal, setAchievementTotal] = useState(0);
  const [badges, setBadges] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [suggestions, setSuggestions] = useState<MilestoneSuggestion[]>([]);
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneType, setMilestoneType] = useState('MEAL_LOGGING_DAYS');
  const [milestoneTarget, setMilestoneTarget] = useState('5');
  const [milestoneThreshold, setMilestoneThreshold] = useState('');
  const [milestoneStart, setMilestoneStart] = useState(todayLocalISO());
  const [milestoneEnd, setMilestoneEnd] = useState('');
  const [milestoneUnit, setMilestoneUnit] = useState('');
  const [milestoneStartValue, setMilestoneStartValue] = useState('');
  const [goalCalories, setGoalCalories] = useState('');
  const [goalProtein, setGoalProtein] = useState('');
  const [goalCarbs, setGoalCarbs] = useState('');
  const [goalFat, setGoalFat] = useState('');
  const [goalFiber, setGoalFiber] = useState('');
  // Water/steps targets are edited on the dashboard· εδώ τα κρατάμε μόνο ώστε το
  // Save goals να μην τα μηδενίζει (setGoal αντικαθιστά ολόκληρη την εγγραφή).
  const [goalWater, setGoalWater] = useState('');
  const [goalSteps, setGoalSteps] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const [
        goalsResult,
        achievementsResult,
        badgesResult,
        milestonesResult,
        suggestionsResult,
      ] = await Promise.all([
        api.goals(session.token),
        api.achievements(session.token),
        api.badges(session.token),
        api.milestones(session.token),
        api.milestoneSuggestions(session.token),
      ]);
      setGoal(goalsResult);
      setGoalCalories(String(goalsResult.goal.calorieTarget ?? goalsResult.suggestion?.calorieTarget ?? ''));
      setGoalProtein(String(goalsResult.goal.proteinGrams ?? goalsResult.suggestion?.proteinGrams ?? ''));
      setGoalCarbs(String(goalsResult.goal.carbohydrateGrams ?? goalsResult.suggestion?.carbohydrateGrams ?? ''));
      setGoalFat(String(goalsResult.goal.fatGrams ?? goalsResult.suggestion?.fatGrams ?? ''));
      setGoalFiber(String(goalsResult.goal.fiberGrams ?? goalsResult.suggestion?.fiberGrams ?? ''));
      setGoalWater(String(goalsResult.goal.waterMl ?? goalsResult.suggestion?.waterMl ?? ''));
      setGoalSteps(String(goalsResult.goal.stepsTarget ?? ''));
      const unlocked = achievementsResult.achievements.filter((item) => item.unlocked).length;
      setAchievements(unlocked);
      setAchievementTotal(achievementsResult.achievements.length);
      setBadges(
        badgesResult.badges.filter((badge) => badge.unlockedAt || badge.earnedAt).length,
      );
      setMilestones(milestonesResult.milestones.slice(0, 10));
      setSuggestions(suggestionsResult.suggestions);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGoal() {
    const calories = Number(goalCalories);
    if (!Number.isFinite(calories)) {
      setMessage('Enter valid calories.');
      return;
    }
    const numberOrNull = (value: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    setSavingGoal(true);
    setMessage(null);
    try {
      await api.updateGoal(session.token, {
        calorieTarget: calories,
        proteinGrams: numberOrNull(goalProtein),
        carbohydrateGrams: numberOrNull(goalCarbs),
        fatGrams: numberOrNull(goalFat),
        fiberGrams: numberOrNull(goalFiber),
        waterMl: numberOrNull(goalWater),
        stepsTarget: numberOrNull(goalSteps),
      });
      setEditingGoal(false);
      await load(true);
      setMessage('Goal saved.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingGoal(false);
    }
  }

  async function milestoneAction(id: string, action: 'pause' | 'resume' | 'cancel') {
    setMessage(null);
    try {
      const result =
        action === 'pause'
          ? await api.pauseMilestone(session.token, id)
          : action === 'resume'
            ? await api.resumeMilestone(session.token, id)
            : await api.cancelMilestone(session.token, id);
      setMilestones((current) =>
        current.map((milestone) => (milestone.id === id ? result.milestone : milestone)),
      );
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  function resetMilestoneForm() {
    setEditingMilestoneId(null);
    setMilestoneTitle('');
    setMilestoneDescription('');
    setMilestoneType('MEAL_LOGGING_DAYS');
    setMilestoneTarget('5');
    setMilestoneThreshold('');
    setMilestoneStart(todayLocalISO());
    setMilestoneEnd('');
    setMilestoneUnit('');
    setMilestoneStartValue('');
  }

  function applySuggestion(suggestion: MilestoneSuggestion) {
    setEditingMilestoneId(null);
    setMilestoneTitle(suggestion.title);
    setMilestoneDescription(suggestion.description);
    setMilestoneType(suggestion.type);
    setMilestoneTarget(String(suggestion.targetValue));
    setMilestoneThreshold(suggestion.dailyThreshold ? String(suggestion.dailyThreshold) : '');
    setMilestoneStart(suggestion.startDate || todayLocalISO());
    setMilestoneEnd(suggestion.endDate ?? '');
    setMilestoneUnit(suggestion.unit ?? '');
    setMilestoneStartValue('');
  }

  function useSuggestedDailyGoals() {
    if (!goal?.suggestion) return;
    setGoalCalories(String(goal.suggestion.calorieTarget ?? ''));
    setGoalProtein(String(goal.suggestion.proteinGrams ?? ''));
    setGoalCarbs(String(goal.suggestion.carbohydrateGrams ?? ''));
    setGoalFat(String(goal.suggestion.fatGrams ?? ''));
    setGoalFiber(String(goal.suggestion.fiberGrams ?? ''));
    setGoalWater(String(goal.suggestion.waterMl ?? ''));
    setEditingGoal(true);
  }

  function editMilestone(milestone: MilestoneItem) {
    setEditingMilestoneId(milestone.id);
    setMilestoneTitle(milestone.title);
    setMilestoneDescription(milestone.description ?? '');
    setMilestoneType(milestone.type);
    setMilestoneTarget(String(milestone.targetValue));
    setMilestoneThreshold(milestone.dailyThreshold ? String(milestone.dailyThreshold) : '');
    setMilestoneStart(milestone.startDate || todayLocalISO());
    setMilestoneEnd(milestone.endDate ?? '');
    setMilestoneUnit(milestone.unit ?? '');
    setMilestoneStartValue(milestone.startValue === null || milestone.startValue === undefined ? '' : String(milestone.startValue));
  }

  async function saveMilestone(source?: MilestoneSuggestion) {
    if (savingMilestone) return;
    setSavingMilestone(true);
    setMessage(null);
    try {
      const targetValue = source?.targetValue ?? numberField(milestoneTarget, 'Target', true);
      if (targetValue === undefined) throw new Error('Target is required.');
      const payload = {
        title: source?.title ?? milestoneTitle.trim(),
        description: source?.description ?? milestoneDescription.trim(),
        type: source?.type ?? milestoneType,
        unit: source?.unit ?? milestoneUnit.trim(),
        targetValue,
        startValue: source ? undefined : numberField(milestoneStartValue, 'Start value'),
        dailyThreshold:
          source?.dailyThreshold ?? (numberField(milestoneThreshold, 'Daily threshold') ?? null),
        startDate: source?.startDate ?? milestoneStart,
        endDate: source?.endDate ?? (milestoneEnd.trim() || null),
      };
      if (!payload.title) throw new Error('Title is required.');
      if (!payload.startDate) throw new Error('Start date is required.');

      const result = editingMilestoneId
        ? await api.updateMilestone(session.token, editingMilestoneId, payload)
        : await api.createMilestone(session.token, {
            ...payload,
            type: payload.type,
            targetValue: payload.targetValue,
            startDate: payload.startDate,
          });
      setMilestones((current) => {
        const exists = current.some((milestone) => milestone.id === result.milestone.id);
        const next = exists
          ? current.map((milestone) => (milestone.id === result.milestone.id ? result.milestone : milestone))
          : [result.milestone, ...current];
        return next.slice(0, 10);
      });
      setMessage(result.warnings?.[0]?.message ?? (editingMilestoneId ? 'Milestone saved.' : 'Milestone created.'));
      resetMilestoneForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : apiErrorMessage(error));
    } finally {
      setSavingMilestone(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>NutreLuma</Text>
            <Text style={styles.headerName}>Goals</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={onOpenMaintenance}><GlassCard style={styles.featureCard}>
        <View style={styles.featureIcon}>
          <Scale size={20} color={colors.primary} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={styles.mealTitle}>Weight maintenance</Text>
          <Text style={styles.noticeCopy}>Range, trends and stability alerts.</Text>
        </View>
        <ChevronRight size={20} color={colors.mutedSoft} />
      </GlassCard></Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : goal ? (
        <>
          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Daily targets</Text>
            <GoalTargets
              calories={goal.goal.calorieTarget}
              protein={goal.goal.proteinGrams}
              carbs={goal.goal.carbohydrateGrams}
              fat={goal.goal.fatGrams}
            />
            {goal.suggestion ? (
              <Text style={styles.noticeCopy}>
                Suggested: {goal.suggestion.calorieTarget} kcal · {goal.suggestion.proteinGrams}g protein
              </Text>
            ) : null}
            <View style={styles.actionRow}>
              <Pressable onPress={() => setEditingGoal((value) => !value)} style={styles.actionButton}>
                <Text style={styles.actionText}>{editingGoal ? 'Close edit' : 'Edit goals'}</Text>
              </Pressable>
              {goal.suggestion ? (
                <Pressable onPress={useSuggestedDailyGoals} style={[styles.actionButton, styles.actionPrimary]}>
                  <Text style={styles.actionPrimaryText}>Use suggestion</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>

          {editingGoal ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Edit daily goals</Text>
              <Field label="Calories" value={goalCalories} onChangeText={setGoalCalories} keyboardType="numeric" />
              <View style={styles.twoColumn}>
                <Field label="Protein g" value={goalProtein} onChangeText={setGoalProtein} keyboardType="numeric" />
                <Field label="Carbs g" value={goalCarbs} onChangeText={setGoalCarbs} keyboardType="numeric" />
              </View>
              <View style={styles.twoColumn}>
                <Field label="Fat g" value={goalFat} onChangeText={setGoalFat} keyboardType="numeric" />
                <Field label="Fiber g" value={goalFiber} onChangeText={setGoalFiber} keyboardType="numeric" />
              </View>
              <Text style={styles.noticeCopy}>
                Water & steps targets are set from the dashboard.
              </Text>
              <PillButton label={savingGoal ? 'Saving...' : 'Save goals'} onPress={saveGoal} disabled={savingGoal} />
            </GlassCard>
          ) : null}

          <View style={styles.macroGrid}>
            <MetricCard value={`${achievements}/${achievementTotal}`} label="achievements" />
            <MetricCard value={String(badges)} label="badges" />
          </View>

          {suggestions.length ? (
            <GlassCard style={styles.authPanel}>
              <Text style={styles.sectionTitle}>Smart milestone ideas</Text>
              <View style={styles.mealList}>
                {suggestions.map((suggestion) => (
                  <GlassCard key={`${suggestion.type}-${suggestion.title}`} style={styles.suggestionCard}>
                    <Text style={styles.mealTitle}>{suggestion.title}</Text>
                    <Text style={styles.noticeCopy}>{suggestion.description}</Text>
                    <Text style={styles.metricLabel}>
                      {milestoneTypeLabel(suggestion.type)} - {suggestion.targetValue}
                      {suggestion.unit ? ` ${suggestion.unit}` : ''}
                      {suggestion.endDate ? ` by ${suggestion.endDate}` : ''}
                    </Text>
                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={() => saveMilestone(suggestion)}
                        disabled={savingMilestone}
                        style={[styles.actionButton, styles.actionPrimary]}
                      >
                        <Text style={styles.actionPrimaryText}>{savingMilestone ? 'Saving...' : 'Start'}</Text>
                      </Pressable>
                      <Pressable onPress={() => applySuggestion(suggestion)} style={styles.actionButton}>
                        <Text style={styles.actionText}>Edit</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                ))}
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>
              {editingMilestoneId ? 'Edit milestone' : 'Custom milestone'}
            </Text>
            <Field label="Title" value={milestoneTitle} onChangeText={setMilestoneTitle} />
            <Field label="Description optional" value={milestoneDescription} onChangeText={setMilestoneDescription} />
            {!editingMilestoneId ? (
              <ChoiceRow
                label="Type"
                value={milestoneType}
                options={milestoneTypes}
                onChange={setMilestoneType}
              />
            ) : (
              <Text style={styles.metricLabel}>Type: {milestoneTypeLabel(milestoneType)}</Text>
            )}
            <View style={styles.twoColumn}>
              <Field label="Target" value={milestoneTarget} onChangeText={setMilestoneTarget} keyboardType="numeric" />
              <Field label="Daily limit" value={milestoneThreshold} onChangeText={setMilestoneThreshold} keyboardType="numeric" />
            </View>
            <View style={styles.twoColumn}>
              <Field label="Start value" value={milestoneStartValue} onChangeText={setMilestoneStartValue} keyboardType="numeric" />
              <Field label="Unit" value={milestoneUnit} onChangeText={setMilestoneUnit} autoCapitalize="none" />
            </View>
            <View style={styles.twoColumn}>
              <Field label="Start date" value={milestoneStart} onChangeText={setMilestoneStart} />
              <Field label="End date" value={milestoneEnd} onChangeText={setMilestoneEnd} />
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => saveMilestone()}
                disabled={savingMilestone}
                style={[styles.actionButton, styles.actionPrimary]}
              >
                <Text style={styles.actionPrimaryText}>{savingMilestone ? 'Saving...' : editingMilestoneId ? 'Save' : 'Create'}</Text>
              </Pressable>
              {editingMilestoneId ? (
                <Pressable onPress={resetMilestoneForm} style={styles.actionButton}>
                  <Text style={styles.actionText}>Cancel edit</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.mealList}>
            {milestones.length ? (
              milestones.map((milestone) => (
                <MilestoneCard key={milestone.id} milestone={milestone}>
                  <View style={styles.actionRow}>
                    {!['COMPLETED', 'CANCELLED'].includes(milestone.status) ? (
                      <Pressable onPress={() => editMilestone(milestone)} style={styles.actionButton}>
                        <Text style={styles.actionText}>Edit</Text>
                      </Pressable>
                    ) : null}
                    {milestone.status === 'ACTIVE' ? (
                      <Pressable onPress={() => milestoneAction(milestone.id, 'pause')} style={styles.actionButton}>
                        <Text style={styles.actionText}>Pause</Text>
                      </Pressable>
                    ) : null}
                    {milestone.status === 'PAUSED' ? (
                      <Pressable onPress={() => milestoneAction(milestone.id, 'resume')} style={styles.actionButton}>
                        <Text style={styles.actionText}>Resume</Text>
                      </Pressable>
                    ) : null}
                    {!['COMPLETED', 'CANCELLED'].includes(milestone.status) ? (
                      <Pressable onPress={() => milestoneAction(milestone.id, 'cancel')} style={styles.actionButton}>
                        <Text style={styles.actionText}>Cancel</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </MilestoneCard>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.noticeTitle}>No milestones yet</Text>
                <Text style={styles.noticeCopy}>Use a smart idea or create a custom milestone above.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Goal history</Text>
          <View style={styles.mealList}>
            {goal.history.slice(0, 6).map((row, index) => (
              <View key={row.id ?? row.effectiveFrom ?? `goal-${index}`} style={styles.mealCard}>
                <View style={styles.mealItemCopy}>
                  <Text style={styles.mealTitle}>{row.effectiveFrom ?? 'Fallback goal'}</Text>
                  <Text style={styles.metricLabel}>{row.source.toLowerCase()}</Text>
                </View>
                <Text style={styles.mealCalories}>{row.calorieTarget ?? '--'} kcal</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.noticeTitle}>Goals unavailable</Text>
          <Text style={styles.noticeCopy}>Pull down to try again.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function recipeCalories(recipe: SavedRecipe['recipe']) {
  return Math.round(recipe.estimatedCalories ?? recipe.targetCalories ?? 0);
}

function RecipeCard({
  recipe,
  onDelete,
  onSave,
  saved,
}: {
  recipe: SavedRecipe['recipe'];
  onDelete?: () => void;
  onSave?: () => void;
  saved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable onPress={() => setExpanded((value) => !value)}><GlassCard style={styles.notificationCard}>
      <View style={styles.notificationHeader}>
        <View style={styles.mealItemCopy}>
          <Text style={styles.mealTitle}>{recipe.title || displayMealType(recipe.mealType)}</Text>
          <Text style={styles.metricLabel}>
            {displayMealType(recipe.mealType)} · {recipe.preparationTimeMinutes ?? '--'} min ·{' '}
            {recipe.difficulty ?? 'easy'}
          </Text>
        </View>
        <Text style={styles.mealCalories}>{recipeCalories(recipe)} kcal</Text>
      </View>
      {recipe.description ? <Text style={styles.noticeCopy}>{recipe.description}</Text> : null}
      {recipe.macros ? (
        <Text style={styles.metricLabel}>
          P {Math.round(recipe.macros.proteinGrams ?? 0)}g · C{' '}
          {Math.round(recipe.macros.carbohydrateGrams ?? 0)}g · F{' '}
          {Math.round(recipe.macros.fatGrams ?? 0)}g · Fiber{' '}
          {Math.round(recipe.macros.fiberGrams ?? 0)}g
        </Text>
      ) : null}
      {expanded ? (
        <View style={styles.recipeDetailBlock}>
          {recipe.ingredients?.length ? (
            <>
              <Text style={styles.noticeTitle}>Ingredients</Text>
              {recipe.ingredients.slice(0, 12).map((ingredient, index) => (
                <Text key={`${ingredient.name}-${index}`} style={styles.noticeCopy}>
                  {ingredient.name} · {ingredient.quantity ?? ''} {ingredient.unit ?? ''}
                </Text>
              ))}
            </>
          ) : null}
          {recipe.steps?.length ? (
            <>
              <Text style={styles.noticeTitle}>Steps</Text>
              {recipe.steps.slice(0, 8).map((step, index) => (
                <Text key={`${index}-${step}`} style={styles.noticeCopy}>
                  {index + 1}. {step}
                </Text>
              ))}
            </>
          ) : null}
          {recipe.allergenWarnings?.length ? (
            <Text style={styles.message}>Allergens: {recipe.allergenWarnings.join(', ')}</Text>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} style={styles.pageButton}>
              <Text style={styles.actionText}>Delete recipe</Text>
            </Pressable>
          ) : null}
          {onSave ? (
            <Pressable onPress={onSave} disabled={saved} style={styles.pageButton}>
              <Text style={styles.actionText}>{saved ? 'Saved' : 'Save recipe'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </GlassCard></Pressable>
  );
}

function RecipesOverviewScreen({ session }: { session: Session }) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [planMeals, setPlanMeals] = useState<SavedRecipe['recipe'][]>([]);
  const [savedPlanTitles, setSavedPlanTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function extractPlanMeals(result: Awaited<ReturnType<typeof api.mealPlan>>) {
    return (
      result.plan?.meals ??
      result.plan?.payload?.meals ??
      result.plan?.recipes?.map((recipe) => recipe.payload ?? { title: recipe.title, mealType: recipe.mealType }) ??
      []
    );
  }

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      // Το «Today's plan» εμφανίζεται μόνο αφού ο χρήστης πατήσει «Generate plan»,
      // οπότε στο load φέρνουμε μόνο τις αποθηκευμένες συνταγές.
      const recipesResult = await api.recipes(session.token);
      setRecipes(Array.isArray(recipesResult.recipes) ? recipesResult.recipes : []);
      setSavedPlanTitles(recipesResult.recipes.map((item) => item.recipe.title ?? '').filter(Boolean));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function generatePlan() {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await api.generateMealPlan(session.token);
      setPlanMeals(extractPlanMeals(result));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function savePlanRecipe(recipe: SavedRecipe['recipe']) {
    setMessage(null);
    try {
      const result = await api.saveRecipe(session.token, recipe);
      setRecipes((current) => [
        { id: result.id, createdAt: new Date().toISOString(), recipe: result.recipe },
        ...current,
      ]);
      if (recipe.title) {
        setSavedPlanTitles((current) => (current.includes(recipe.title!) ? current : [...current, recipe.title!]));
      }
      setMessage('Recipe saved.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  function confirmDeleteRecipe(id: string, title?: string) {
    Alert.alert('Delete recipe?', title || 'Saved recipe', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteRecipe(id);
        },
      },
    ]);
  }

  async function deleteRecipe(id: string) {
    setMessage(null);
    try {
      await api.deleteRecipe(session.token, id);
      setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>NutreLuma</Text>
            <Text style={styles.headerName}>Recipes</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={generatePlan}
        disabled={generating}
        style={[styles.actionButton, styles.actionPrimary, styles.actionFull]}
      >
        <Text style={styles.actionPrimaryText}>{generating ? 'Generating...' : 'Generate plan'}</Text>
      </Pressable>

      {generating ? (
        <AiLoadingCard
          title="Generating your plan…"
          subtitle="NutreLuma is building recipes from your remaining targets"
        />
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : (
        <>
          {planMeals.length ? (
            <>
              <Text style={styles.sectionTitle}>Today's plan</Text>
              <View style={styles.mealList}>
                {planMeals.map((recipe, index) => (
                  <RecipeCard
                    key={`${recipe.title}-${index}`}
                    recipe={recipe}
                    saved={Boolean(recipe.title && savedPlanTitles.includes(recipe.title))}
                    onSave={() => savePlanRecipe(recipe)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Saved recipes</Text>
          <View style={styles.mealList}>
            {recipes.length ? (
              recipes.slice(0, 20).map((saved) => (
                <RecipeCard
                  key={saved.id}
                  recipe={saved.recipe}
                  onDelete={() => confirmDeleteRecipe(saved.id, saved.recipe.title)}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.noticeTitle}>No saved recipes</Text>
                <Text style={styles.noticeCopy}>Generated recipes you save will appear here.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function NotificationsScreen({
  session,
  onBack,
  onOpenTarget,
  onUnreadCountChange,
}: {
  session: Session;
  onBack: () => void;
  onOpenTarget: (screen: Screen) => void;
  onUnreadCountChange: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const result = await api.notifications(session.token, { limit: 50 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      onUnreadCountChange(result.unreadCount);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function markAllRead() {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    setMessage(null);
    try {
      await api.markNotificationsRead(session.token);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      onUnreadCountChange(0);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setMarkingRead(false);
    }
  }

  async function openNotification(notification: AppNotification) {
    if (!notification.readAt) {
      try {
        await api.markNotificationsRead(session.token, [notification.id]);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        );
        const nextCount = Math.max(0, unreadCount - 1);
        setUnreadCount(nextCount);
        onUnreadCountChange(nextCount);
      } catch {
        // Keep navigation responsive even if read marking fails.
      }
    }

    const target = notificationAction(notification);
    if (target) onOpenTarget(target);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.kicker}>Notifications</Text>
          <Text style={styles.headerName}>{unreadCount} new</Text>
        </View>
        <Pressable onPress={onBack} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={markAllRead}
          disabled={markingRead || unreadCount === 0}
          style={[styles.actionButton, unreadCount > 0 ? styles.actionPrimary : null]}
        >
          <Text style={unreadCount > 0 ? styles.actionPrimaryText : styles.actionText}>
            {markingRead ? 'Marking...' : 'Mark all read'}
          </Text>
        </Pressable>
        <Pressable onPress={() => load(true)} style={styles.actionButton}>
          <Text style={styles.actionText}>Refresh</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <GlassCard style={styles.summaryCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : notifications.length ? (
        <View style={styles.mealList}>
          {notifications.map((notification) => {
            const unread = !notification.readAt;
            const hasTarget = Boolean(notificationAction(notification));
            return (
              <Pressable key={notification.id} onPress={() => openNotification(notification)}><GlassCard style={[styles.notificationCard, unread ? styles.notificationCardUnread : null]}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationTitleRow}>
                    {unread ? <View style={styles.unreadDot} /> : null}
                    <Text style={styles.mealTitle}>{notification.title}</Text>
                  </View>
                  <Text style={styles.metricLabel}>
                    {formatNotificationDate(notification.createdAt)}
                  </Text>
                </View>
                <Text style={styles.noticeCopy}>{notification.body}</Text>
                {hasTarget ? <Text style={styles.notificationActionText}>Open</Text> : null}
              </GlassCard></Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.noticeTitle}>No notifications</Text>
          <Text style={styles.noticeCopy}>You are all caught up.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function ProgressScreen({
  session,
  onOpenHistory,
  onOpenStats,
  onOpenInsights,
}: {
  session: Session;
  onOpenHistory: () => void;
  onOpenStats: () => void;
  onOpenInsights: () => void;
}) {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [weightRes, profileRes] = await Promise.all([
        api.weights(session.token),
        api.profile(session.token),
      ]);
      setWeights(weightRes.entries ?? []);
      setTargetWeightKg(profileRes.profile?.targetWeightKg ?? null);
    } catch {
      // Κρατάμε ό,τι έχουμε ήδη· το γράφημα δείχνει κενή κατάσταση αν χρειαστεί.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>NutreLuma</Text>
            <Text style={styles.headerName}>Progress</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.gaugeCard}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <GoalProgressChart
          weights={weights.map((w) => ({ entryDate: w.entryDate, weightKg: w.weightKg }))}
          targetWeightKg={targetWeightKg}
        />
      )}

      <View style={styles.progressCardRow}>
        <Pressable onPress={onOpenHistory} style={styles.progressCardOuter}>
          <GlassCard style={styles.progressCard}>
            <View style={styles.featureIcon}>
              <CalendarDays size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.progressCardTitle}>History</Text>
              <Text style={styles.progressCardBody}>Browse past days and meals.</Text>
            </View>
          </GlassCard>
        </Pressable>
        <Pressable onPress={onOpenInsights} style={styles.progressCardOuter}>
          <GlassCard style={styles.progressCard}>
            <View style={styles.featureIcon}>
              <Sparkles size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.progressCardTitle}>Insights</Text>
              <Text style={styles.progressCardBody}>Personal, deterministic observations.</Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      <Pressable onPress={onOpenStats}><GlassCard style={styles.progressWideCard}>
        <View style={styles.featureIcon}>
          <BarChart3 size={20} color={colors.primary} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={styles.progressCardTitle}>Statistics</Text>
          <Text style={styles.progressCardBody}>Calorie, macro and consistency trends.</Text>
        </View>
        <ChevronRight size={20} color={colors.mutedSoft} />
      </GlassCard></Pressable>
    </ScrollView>
  );
}

function SettingsScreen({
  session,
  pushToken,
  registeringPush,
  onRegisterPush,
  onLogout,
}: {
  session: Session;
  pushToken: string | null;
  registeringPush: boolean;
  onRegisterPush: () => void;
  onLogout: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.dashboardContent}>
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>Settings</Text>
            <Text style={styles.headerName}>Account</Text>
          </View>
        </View>
      </View>

      <GlassCard style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {session.user.displayName.trim().slice(0, 1).toUpperCase() || 'N'}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{session.user.displayName}</Text>
          <Text style={styles.metricLabel}>{session.user.email}</Text>
        </View>
      </GlassCard>

      <View style={styles.settingsList}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsIcon}>
            <Text style={styles.settingsIconText}>!</Text>
          </View>
          <View style={styles.settingsCopy}>
            <Text style={styles.mealTitle}>Push notifications</Text>
            <Text style={styles.noticeCopy}>
              {pushToken
                ? 'Enabled on this device for meal reminders and account alerts.'
                : 'Not enabled yet on this device.'}
            </Text>
          </View>
          <View style={[styles.statusPill, pushToken ? styles.statusPillOn : null]}>
            <Text style={[styles.statusText, pushToken ? styles.statusTextOn : null]}>
              {pushToken ? 'On' : 'Off'}
            </Text>
          </View>
        </View>

        {!pushToken ? (
          <PillButton
            label={registeringPush ? 'Enabling...' : 'Enable push notifications'}
            onPress={onRegisterPush}
            disabled={registeringPush}
          />
        ) : null}

        <View style={styles.settingsRow}>
          <View style={styles.settingsIcon}>
            <Text style={styles.settingsIconText}>#</Text>
          </View>
          <View style={styles.settingsCopy}>
            <Text style={styles.mealTitle}>Synced data</Text>
            <Text style={styles.noticeCopy}>
              Meals, weight entries and notifications sync with {API_BASE_URL}.
            </Text>
          </View>
        </View>

        <View style={styles.settingsRow}>
          <View style={styles.settingsIcon}>
            <Text style={styles.settingsIconText}>i</Text>
          </View>
          <View style={styles.settingsCopy}>
            <Text style={styles.mealTitle}>Native app build</Text>
            <Text style={styles.noticeCopy}>Expo iOS and Android client connected to NutreLuma web.</Text>
          </View>
        </View>
      </View>

      <PillButton label="Log out" onPress={onLogout} variant="ghost" />
    </ScrollView>
  );
}

function formatCurrency(cents?: number) {
  if (cents === undefined) return '--';
  return `€${(cents / 100).toFixed(2)}`;
}

/** Ηλικία από ημερομηνία γέννησης "YYYY-MM-DD". */
function computeAge(birthDateISO: string): number | null {
  const d = new Date(birthDateISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** BMI + κατηγορία από ύψος (cm) και βάρος (kg) ως strings φόρμας. */
function computeBmi(heightCm: string, weightKg: string): { value: number; label: string } | null {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
  const bmi = w / (h * h);
  if (!Number.isFinite(bmi) || bmi < 8 || bmi > 90) return null;
  const label = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese';
  return { value: Math.round(bmi * 10) / 10, label };
}

type ProfileTab = 'profile' | 'coaching' | 'plan' | 'account';

const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'plan', label: 'Plan' },
  { key: 'account', label: 'Account' },
];

function SegmentedTabs({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <View style={styles.segmented}>
      {PROFILE_TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.segment, on ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, on ? styles.segmentTextActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProfileOverviewScreen({
  session,
  onSessionChange,
  onOpenSettings,
  onOpenNotifications,
  onOpenWeight,
  onLogout,
}: {
  session: Session;
  onSessionChange: (session: Session) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenWeight: () => void;
  onLogout: () => void;
}) {
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [billing, setBilling] = useState<BillingOverviewResult | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfileView | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResult | null>(null);
  const [savingLearning, setSavingLearning] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('profile');
  const [profileBirthDate, setProfileBirthDate] = useState('1990-01-01');
  const [profileGender, setProfileGender] = useState('UNDISCLOSED');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileCurrentWeight, setProfileCurrentWeight] = useState('');
  const [profileTargetWeight, setProfileTargetWeight] = useState('');
  const [profileActivity, setProfileActivity] = useState('MODERATE');
  const [profileGoal, setProfileGoal] = useState('MAINTAIN');
  const [profileCalories, setProfileCalories] = useState('');
  const [profileTimezone, setProfileTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Athens');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [cancellingBilling, setCancellingBilling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { ready: rcReady, available: rcAvailable, isPro, presentPaywall, restore, presentCustomerCenter } =
    useRevenueCat();
  const [subscribing, setSubscribing] = useState(false);

  async function handleUpgrade() {
    setSubscribing(true);
    setMessage(null);
    try {
      const purchased = await presentPaywall();
      if (purchased) setMessage('Subscription active — thank you!');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSubscribing(false);
    }
  }

  async function handleRestore() {
    setSubscribing(true);
    setMessage(null);
    try {
      const restored = await restore();
      setMessage(restored ? 'Purchases restored.' : 'No active subscription found.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSubscribing(false);
    }
  }

  async function handleManageSubscription() {
    try {
      await presentCustomerCenter();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  function hydrateProfileForm(profile: HealthProfileView | null) {
    if (!profile) return;
    setHealthProfile(profile);
    setProfileBirthDate(profile.birthDate);
    setProfileGender(profile.gender);
    setProfileHeight(String(profile.heightCm));
    setProfileCurrentWeight(String(profile.currentWeightKg));
    setProfileTargetWeight(profile.targetWeightKg === null ? '' : String(profile.targetWeightKg));
    setProfileActivity(profile.activityLevel);
    setProfileGoal(profile.goal);
    setProfileCalories(profile.dailyCalorieTarget === null ? '' : String(profile.dailyCalorieTarget));
    setProfileTimezone(profile.timezone);
  }

  async function loadBilling() {
    setLoading(true);
    setMessage(null);
    try {
      const [billingResult, profileResult, intelligenceResult] = await Promise.all([
        api.billing(session.token),
        api.profile(session.token),
        api.intelligence(session.token).catch(() => null),
      ]);
      setBilling(billingResult);
      hydrateProfileForm(profileResult.profile);
      if (intelligenceResult) setIntelligence(intelligenceResult);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function toggleLearning(key: keyof NonNullable<IntelligenceResult['settings']>) {
    if (!intelligence?.settings || savingLearning) return;
    const next = { ...intelligence.settings, [key]: !intelligence.settings[key] };
    setIntelligence({ ...intelligence, settings: next });
    setSavingLearning(true);
    setMessage(null);
    try {
      const result = await api.updateIntelligence(session.token, { [key]: next[key] });
      setIntelligence((current) => (current ? { ...current, settings: result.settings } : current));
    } catch (error) {
      setMessage(apiErrorMessage(error));
      await loadBilling();
    } finally {
      setSavingLearning(false);
    }
  }

  async function resetLearning() {
    setSavingLearning(true);
    setMessage(null);
    try {
      await api.resetIntelligence(session.token);
      const refreshed = await api.intelligence(session.token).catch(() => null);
      if (refreshed) setIntelligence(refreshed);
      setMessage('Learning reset.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingLearning(false);
    }
  }

  async function saveHealthProfile() {
    const heightCm = Number(profileHeight);
    const currentWeightKg = Number(profileCurrentWeight);
    const targetWeightKg = profileTargetWeight.trim() ? Number(profileTargetWeight) : '';
    const dailyCalorieTarget = profileCalories.trim() ? Number(profileCalories) : '';
    if (!Number.isFinite(heightCm) || !Number.isFinite(currentWeightKg)) {
      setMessage('Enter valid height and current weight.');
      return;
    }
    if (targetWeightKg !== '' && !Number.isFinite(targetWeightKg)) {
      setMessage('Enter a valid target weight.');
      return;
    }
    if (dailyCalorieTarget !== '' && !Number.isFinite(dailyCalorieTarget)) {
      setMessage('Enter a valid calorie target.');
      return;
    }
    setSavingProfile(true);
    setMessage(null);
    try {
      const result = await api.updateProfile(session.token, {
        birthDate: profileBirthDate,
        gender: profileGender,
        heightCm,
        currentWeightKg,
        targetWeightKg,
        activityLevel: profileActivity,
        goal: profileGoal,
        dailyCalorieTarget,
        preferredUnits: 'METRIC',
        timezone: profileTimezone,
      });
      hydrateProfileForm(result.profile);
      setMessage('Health profile saved.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveName() {
    if (!displayName.trim()) {
      setMessage('Display name is required.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.updateAccount(session.token, displayName.trim());
      const nextSession = { ...session, user: result.account };
      await saveStoredSession(nextSession);
      onSessionChange(nextSession);
      setMessage('Account updated.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      setMessage('Enter current and new password.');
      return;
    }
    setChangingPassword(true);
    setMessage(null);
    try {
      await api.changePassword(session.token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  }

  async function openCheckout(interval: 'monthly' | 'yearly') {
    setCheckingOut(true);
    setMessage(null);
    try {
      const result = await api.stripeCheckout(session.token, interval, interval === 'monthly' ? couponCode : null);
      await Linking.openURL(result.url);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setCheckingOut(false);
    }
  }

  async function openWebPath(path: string) {
    try {
      await Linking.openURL(`${API_BASE_URL}${path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the web page.');
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || applyingCoupon) return;
    setApplyingCoupon(true);
    setMessage(null);
    try {
      const result = await api.applyBillingCoupon(session.token, code);
      setCouponCode(result.code);
      setCouponInput(result.code);
      setMessage('Coupon applied.');
    } catch (error) {
      setCouponCode(null);
      setMessage(apiErrorMessage(error));
    } finally {
      setApplyingCoupon(false);
    }
  }

  function confirmCancelBilling() {
    if (cancellingBilling) return;
    Alert.alert('Cancel subscription?', 'Your access remains active until the current paid period ends.', [
      { text: 'Keep subscription', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          void cancelBilling();
        },
      },
    ]);
  }

  async function cancelBilling() {
    setCancellingBilling(true);
    setMessage(null);
    try {
      await api.cancelBilling(session.token);
      setMessage('Subscription cancellation requested.');
      await loadBilling();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setCancellingBilling(false);
    }
  }

  async function exportAccount(format: 'json' | 'csv') {
    if (exporting) return;
    setExporting(true);
    setMessage(null);
    try {
      const result = await api.exportAccount(session.token, format);
      const file = new FileSystem.File(FileSystem.Paths.document, result.fileName);
      file.create({ overwrite: true });
      file.write(result.text, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: result.mimeType,
          dialogTitle: 'NutreLuma export',
        });
      }
      setMessage(`Export ready: ${result.fileName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : apiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  function confirmDeleteAccount() {
    if (!deletePassword.trim() || deletingAccount) {
      setMessage('Enter your password before deleting the account.');
      return;
    }
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, meals, images, goals and profile data.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAccount();
          },
        },
      ],
    );
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    setMessage(null);
    try {
      await api.deleteAccount(session.token, deletePassword);
      await clearStoredSession();
      onLogout();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  const yearlySelected = billingInterval === 'yearly';
  const billingPrice = yearlySelected
    ? billing?.yearlyPriceCents
    : couponCode
      ? billing?.couponPriceCents
      : billing?.priceCents;
  const billingOriginalPrice = yearlySelected ? billing?.yearlyOriginalPriceCents : billing?.originalPriceCents;
  const billingDiscount = yearlySelected ? billing?.yearlyDiscountPercent : couponCode ? billing?.couponDiscountPercent : billing?.discountPercent;
  const stripeAvailableForInterval = yearlySelected
    ? billing?.stripeYearlyAvailable
    : billing?.stripeAvailable;
  const canCancelBilling = Boolean(billing?.state?.kind !== 'UNLIMITED' && billing?.status === 'ACTIVE');

  return (
    <ScrollView contentContainerStyle={styles.dashboardContent}>
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>Profile</Text>
            <Text style={styles.headerName}>{session.user.displayName}</Text>
          </View>
        </View>
      </View>

      <GlassCard style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {session.user.displayName.trim().slice(0, 1).toUpperCase() || 'N'}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{session.user.displayName}</Text>
          <Text style={styles.metricLabel}>{session.user.email}</Text>
        </View>
      </GlassCard>

      <SegmentedTabs active={profileTab} onChange={setProfileTab} />

      {profileTab === 'profile' ? (
        <>
      <GlassCard style={styles.authPanel}>
        <View style={styles.healthHero}>
          <View style={styles.healthHeroMain}>
            <Text style={styles.kicker}>Daily target</Text>
            <View style={styles.healthHeroValueRow}>
              <Text style={styles.calories}>
                {healthProfile?.effectiveDailyCalorieTarget ??
                  healthProfile?.suggestedDailyCalorieTarget ??
                  '--'}
              </Text>
              <Text style={styles.healthHeroUnit}>kcal</Text>
            </View>
            <Text style={styles.noticeCopy}>
              {healthProfile?.effectiveDailyCalorieTarget
                ? 'Based on your profile'
                : healthProfile?.suggestedDailyCalorieTarget
                  ? 'Suggested from your profile'
                  : 'Fill in your profile to get a target'}
            </Text>
          </View>
          <View style={styles.healthChips}>
            {(() => {
              const age = computeAge(profileBirthDate);
              return age !== null ? (
                <View style={styles.healthChip}>
                  <Text style={styles.healthChipValue}>{age}</Text>
                  <Text style={styles.healthChipLabel}>years</Text>
                </View>
              ) : null;
            })()}
            {(() => {
              const bmi = computeBmi(profileHeight, profileCurrentWeight);
              return bmi ? (
                <View style={styles.healthChip}>
                  <Text style={styles.healthChipValue}>{bmi.value}</Text>
                  <Text style={styles.healthChipLabel}>BMI · {bmi.label}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </View>

        <Text style={styles.fieldGroupLabel}>About you</Text>
        <Field label="Birth date" value={profileBirthDate} onChangeText={setProfileBirthDate} />
        <ChoiceRow label="Gender" value={profileGender} options={genders} onChange={setProfileGender} />

        <Text style={styles.fieldGroupLabel}>Body</Text>
        <View style={styles.twoColumn}>
          <Field label="Height cm" value={profileHeight} onChangeText={setProfileHeight} keyboardType="numeric" />
          <Field label="Current kg" value={profileCurrentWeight} onChangeText={setProfileCurrentWeight} keyboardType="numeric" />
        </View>
        <Field label="Target kg" value={profileTargetWeight} onChangeText={setProfileTargetWeight} keyboardType="numeric" />

        <Text style={styles.fieldGroupLabel}>Activity &amp; goal</Text>
        <ChoiceRow label="Activity" value={profileActivity} options={activityLevels} onChange={setProfileActivity} />
        <ChoiceRow label="Goal" value={profileGoal} options={goals} onChange={setProfileGoal} />

        <Text style={styles.fieldGroupLabel}>Preferences</Text>
        <Field label="Daily calories (optional)" value={profileCalories} onChangeText={setProfileCalories} keyboardType="numeric" />
        <Field label="Timezone" value={profileTimezone} onChangeText={setProfileTimezone} autoCapitalize="none" />
        {healthProfile?.suggestedDailyCalorieTarget ? (
          <Text style={styles.noticeCopy}>Suggested target: {healthProfile.suggestedDailyCalorieTarget} kcal</Text>
        ) : null}
        <PillButton label={savingProfile ? 'Saving...' : 'Save health profile'} onPress={saveHealthProfile} disabled={savingProfile} />
      </GlassCard>
        </>
      ) : null}

      {profileTab === 'coaching' ? (
        intelligence?.settings ? (
        <GlassCard style={styles.authPanel}>
          <Text style={styles.sectionTitle}>Learning settings</Text>
          <Text style={styles.noticeCopy}>
            Control how NutreLuma personalises your calorie and macro estimates.
          </Text>
          {(
            [
              ['personalCalibration', 'Personal calibration'],
              ['useMealHistory', 'Use meal history'],
              ['useWeightHistory', 'Use weight history'],
              ['useBehaviorPatterns', 'Use behavior patterns'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => toggleLearning(key)} style={styles.settingsRow}>
              <View style={styles.settingsCopy}>
                <Text style={styles.mealTitle}>{label}</Text>
                <Text style={styles.noticeCopy}>
                  {intelligence.settings![key] ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
              <View style={[styles.statusPill, intelligence.settings![key] ? styles.statusPillOn : null]}>
                <Text style={[styles.statusText, intelligence.settings![key] ? styles.statusTextOn : null]}>
                  {intelligence.settings![key] ? 'On' : 'Off'}
                </Text>
              </View>
            </Pressable>
          ))}
          <PillButton
            label={savingLearning ? 'Working...' : 'Reset learning'}
            onPress={resetLearning}
            variant="ghost"
            disabled={savingLearning}
          />
        </GlassCard>
        ) : (
          <GlassCard style={styles.authPanel}>
            <Text style={styles.sectionTitle}>Learning settings</Text>
            <Text style={styles.noticeCopy}>
              Learning data isn't available yet. Track a few meals to unlock personalisation controls.
            </Text>
          </GlassCard>
        )
      ) : null}

      {profileTab === 'account' ? (
        <>
      <GlassCard style={styles.authPanel}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <PillButton label={saving ? 'Saving...' : 'Save name'} onPress={saveName} disabled={saving} />
      </GlassCard>

      <GlassCard style={styles.authPanel}>
        <Text style={styles.sectionTitle}>Password</Text>
        <Field
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Field
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <PillButton
          label={changingPassword ? 'Changing...' : 'Change password'}
          onPress={changePassword}
          disabled={changingPassword}
        />
      </GlassCard>
        </>
      ) : null}

      {profileTab === 'plan' ? (
      <GlassCard style={styles.authPanel}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        {!rcReady ? (
          <ActivityIndicator color={colors.primary} />
        ) : !rcAvailable ? (
          <>
            <View style={styles.macroGrid}>
              <MetricCard value={billing?.state?.kind ?? 'Free'} label="plan" />
            </View>
            <Text style={styles.noticeCopy}>
              In-app subscriptions are set up on a production build. Add your store keys and
              install the latest build to subscribe from the app.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.macroGrid}>
              <MetricCard value={isPro ? 'Pro' : billing?.state?.kind ?? 'Free'} label="plan" />
              <MetricCard value={isPro ? 'active' : 'free'} label="status" />
            </View>
            <Text style={styles.noticeCopy}>
              {isPro
                ? 'You have NutreLuma Pro. Manage or restore your subscription below.'
                : 'Unlock NutreLuma Pro — full tracking, insights and AI meal plans.'}
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleUpgrade}
                disabled={subscribing}
                style={[styles.actionButton, styles.actionPrimary]}
              >
                <Text style={styles.actionPrimaryText}>
                  {subscribing ? 'Please wait...' : isPro ? 'Change plan' : 'Go Pro'}
                </Text>
              </Pressable>
              <Pressable onPress={handleRestore} disabled={subscribing} style={styles.actionButton}>
                <Text style={styles.actionText}>Restore</Text>
              </Pressable>
            </View>
            {isPro ? (
              <Pressable onPress={handleManageSubscription} style={styles.actionButton}>
                <Text style={styles.actionText}>Manage subscription</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </GlassCard>
      ) : null}

      {profileTab === 'account' ? (
        <>
      <GlassCard style={styles.authPanel}>
        <Text style={styles.noticeTitle}>Data export</Text>
        <Text style={styles.noticeCopy}>
          Download a JSON backup or CSV history file from this device.
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => exportAccount('json')}
            disabled={exporting}
            style={[styles.actionButton, styles.actionPrimary]}
          >
            <Text style={styles.actionPrimaryText}>{exporting ? 'Preparing...' : 'Export JSON'}</Text>
          </Pressable>
          <Pressable onPress={() => exportAccount('csv')} disabled={exporting} style={styles.actionButton}>
            <Text style={styles.actionText}>Export CSV</Text>
          </Pressable>
        </View>
      </GlassCard>

      <GlassCard style={styles.authPanel}>
        <Text style={styles.noticeTitle}>Delete account</Text>
        <Text style={styles.noticeCopy}>
          Permanently remove your account, meals, images, goals and profile data.
        </Text>
        <Field
          label="Password"
          value={deletePassword}
          onChangeText={setDeletePassword}
          secureTextEntry
        />
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deletingAccount}
          style={[styles.actionButton, styles.dangerButton]}
        >
          <Text style={styles.actionPrimaryText}>{deletingAccount ? 'Deleting...' : 'Delete account'}</Text>
        </Pressable>
      </GlassCard>

      <View style={styles.settingsList}>
        <Pressable onPress={onOpenSettings}><GlassCard style={styles.featureCard}>
          <View style={styles.featureCopy}>
            <Text style={styles.mealTitle}>Settings</Text>
            <Text style={styles.noticeCopy}>Push notifications, synced data and device info.</Text>
          </View>
        </GlassCard></Pressable>
        <Pressable onPress={onOpenNotifications}><GlassCard style={styles.featureCard}>
          <View style={styles.featureCopy}>
            <Text style={styles.mealTitle}>Notifications</Text>
            <Text style={styles.noticeCopy}>Inbox, reminders and achievement alerts.</Text>
          </View>
        </GlassCard></Pressable>
        <Pressable onPress={onOpenWeight}><GlassCard style={styles.featureCard}>
          <View style={styles.featureCopy}>
            <Text style={styles.mealTitle}>Weight</Text>
            <Text style={styles.noticeCopy}>Manage profile weight entries.</Text>
          </View>
        </GlassCard></Pressable>
        <View style={styles.actionRow}>
          <Pressable onPress={() => openWebPath('/terms')} style={styles.actionButton}>
            <Text style={styles.actionText}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => openWebPath('/privacy')} style={styles.actionButton}>
            <Text style={styles.actionText}>Privacy</Text>
          </Pressable>
        </View>
        {session.user.role === 'ADMIN' ? (
          <View style={styles.actionRow}>
            <Pressable onPress={() => openWebPath('/admin/users')} style={styles.actionButton}>
              <Text style={styles.actionText}>Admin users</Text>
            </Pressable>
            <Pressable onPress={() => openWebPath('/admin/db')} style={styles.actionButton}>
              <Text style={styles.actionText}>Admin DB</Text>
            </Pressable>
          </View>
        ) : null}
        <GlassCard style={styles.featureCard}>
          <View style={styles.featureCopy}>
            <Text style={styles.mealTitle}>Joybee Digital</Text>
            <Text style={styles.noticeCopy}>NutreLuma is part of Joybee Digital. (c) 2026 Joybee Digital</Text>
          </View>
        </GlassCard>
      </View>

      <PillButton label="Log out" onPress={onLogout} variant="ghost" />
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

function StartupScreen() {
  return (
    <View style={styles.startupContent}>
      <LogoMark />
      <Text style={styles.brandText}>
        Nutre<Text style={styles.brandAccent}>Luma</Text>
      </Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const CALENDAR_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const CALENDAR_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Πλοήγηση ανά ημέρα + date picker — αντίγραφο της λειτουργίας του web DateNav.
 * Ξεκινά στη σημερινή μέρα (maxDate) και δεν επιτρέπει μελλοντικές ημερομηνίες.
 */
function DateNav({
  date,
  maxDate,
  onChange,
}: {
  date: string;
  maxDate: string;
  onChange: (next: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isToday = date >= maxDate;
  const go = (next: string) => {
    if (next > maxDate) return;
    onChange(next);
  };

  return (
    <View style={styles.dateNavRow}>
      <Pressable
        onPress={() => go(addDaysISO(date, -1))}
        style={styles.dateNavArrow}
        hitSlop={8}
        accessibilityLabel="Previous day"
      >
        <ChevronLeft size={18} color={colors.text} />
      </Pressable>

      <Pressable onPress={() => setPickerOpen(true)} style={styles.dateNavCenter} hitSlop={4}>
        <CalendarDays size={16} color={colors.primary} />
        <Text style={styles.dateNavLabel}>
          {isToday ? 'Today' : formatDayISOHuman(date)}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => go(addDaysISO(date, 1))}
        style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}
        disabled={isToday}
        hitSlop={8}
        accessibilityLabel="Next day"
      >
        <ChevronRight size={18} color={isToday ? colors.mutedSoft : colors.text} />
      </Pressable>

      <CalendarModal
        visible={pickerOpen}
        value={date}
        maxDate={maxDate}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setPickerOpen(false);
          go(next);
        }}
      />
    </View>
  );
}

/** Απλό ημερολόγιο μήνα σε καθαρό JS — χωρίς native dependency. */
function CalendarModal({
  visible,
  value,
  maxDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  maxDate: string;
  onClose: () => void;
  onSelect: (next: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => value.slice(0, 7));

  useEffect(() => {
    if (visible) setViewMonth(value.slice(0, 7));
  }, [visible, value]);

  const [yearStr, monthStr] = viewMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const startWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Δευτέρα = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`);
  }

  const shiftMonth = (delta: number) => {
    const base = new Date(Date.UTC(year, month - 1 + delta, 1));
    setViewMonth(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonthDisabled = viewMonth >= maxDate.slice(0, 7);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.calendarCard} onPress={() => {}}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.dateNavArrow} hitSlop={8}>
              <ChevronLeft size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.calendarMonthLabel}>
              {CALENDAR_MONTHS[month - 1]} {year}
            </Text>
            <Pressable
              onPress={() => !nextMonthDisabled && shiftMonth(1)}
              style={[styles.dateNavArrow, nextMonthDisabled && styles.dateNavArrowDisabled]}
              disabled={nextMonthDisabled}
              hitSlop={8}
            >
              <ChevronRight size={18} color={nextMonthDisabled ? colors.mutedSoft : colors.text} />
            </Pressable>
          </View>

          <View style={styles.calendarWeekRow}>
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <Text key={weekday} style={styles.calendarWeekday}>
                {weekday}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((iso, index) => {
              if (!iso) return <View key={`empty-${index}`} style={styles.calendarCell} />;
              const disabled = iso > maxDate;
              const selected = iso === value;
              return (
                <Pressable
                  key={iso}
                  style={styles.calendarCell}
                  disabled={disabled}
                  onPress={() => onSelect(iso)}
                >
                  <View style={[styles.calendarDay, selected && styles.calendarDaySelected]}>
                    <Text
                      style={[
                        styles.calendarDayText,
                        selected && styles.calendarDayTextSelected,
                        disabled && styles.calendarDayTextDisabled,
                      ]}
                    >
                      {Number(iso.slice(8))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => onSelect(maxDate)} style={styles.calendarTodayButton}>
            <Text style={styles.calendarTodayText}>Today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DashboardScreen({
  session,
  onAddMeal,
  onOpenMeal,
  onOpenWeight,
  onOpenGoals,
  onOpenNotifications,
  onOpenSettings,
  unreadNotifications,
  onUnreadCountChange,
  refreshKey,
}: {
  session: Session;
  onAddMeal: () => void;
  onOpenMeal: (mealId: string) => void;
  onOpenWeight: () => void;
  onOpenGoals: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  unreadNotifications: number;
  onUnreadCountChange: (count: number) => void;
  refreshKey: number;
}) {
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayLocalISO();
  const [date, setDate] = useState(today);
  const isToday = date >= today;
  const [waterMl, setWaterMl] = useState(0);
  const [waterTarget, setWaterTarget] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const [stepsTarget, setStepsTarget] = useState<number | null>(null);
  const [addingWater, setAddingWater] = useState(false);
  const [goalDetail, setGoalDetail] = useState<Awaited<ReturnType<typeof api.goals>>['goal'] | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [targetWaterInput, setTargetWaterInput] = useState('');
  const [targetStepsInput, setTargetStepsInput] = useState('');
  const [savingTargets, setSavingTargets] = useState(false);
  const [addingSteps, setAddingSteps] = useState(false);
  // Απενεργοποιεί το scroll του dashboard όσο ο χρήστης σέρνει ένα gauge, ώστε
  // η κάθετη κίνηση να αλλάζει την τιμή αντί να σκρολάρει τη σελίδα.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const STEPS_FALLBACK = 10000;

  // Τα confirmed meals έρχονται ήδη σκοπαρισμένα στην ημέρα από το backend, αλλά
  // τα drafts (pending) όχι — γι' αυτό φιλτράρουμε τα drafts στην επιλεγμένη μέρα
  // ώστε να μη «κολλάνε» χθεσινά μη-επιβεβαιωμένα γεύματα στο σημερινό dashboard.
  const meals = useMemo(() => {
    const dayDrafts = dashboardList(dashboard?.drafts).filter(
      (meal) => localDayISO(meal.mealDateTime) === date,
    );
    return [...dayDrafts, ...dashboardList(dashboard?.meals)].slice(0, 4);
  }, [dashboard, date]);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [dash, goalsRes, waterRes, activityRes] = await Promise.all([
        api.dashboard(session.token, date),
        api.goals(session.token).catch(() => null),
        api.waterEntries(session.token, { limit: 50 }).catch(() => null),
        api.activityEntries(session.token, { limit: 50 }).catch(() => null),
      ]);
      setDashboard(dash);
      setGoalDetail(goalsRes?.goal ?? null);
      setWaterTarget(goalsRes?.goal?.waterMl ?? null);
      setStepsTarget(goalsRes?.goal?.stepsTarget ?? null);
      setWaterMl(
        (waterRes?.entries ?? [])
          .filter((entry) => entry.entryDate.slice(0, 10) === date)
          .reduce((sum, entry) => sum + (entry.volumeMl ?? 0), 0),
      );
      setSteps(
        (activityRes?.entries ?? [])
          .filter((entry) => entry.entryDate.slice(0, 10) === date)
          .reduce((sum, entry) => sum + (entry.steps ?? 0), 0),
      );
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function commitWater(newTotal: number) {
    const delta = Math.round(newTotal - waterMl);
    if (delta === 0 || addingWater) return;
    setAddingWater(true);
    setError(null);
    try {
      await api.addWater(session.token, { entryDate: date, volumeMl: delta });
      await load(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setAddingWater(false);
    }
  }

  function openTargets() {
    setTargetWaterInput(waterTarget ? String(waterTarget) : '');
    setTargetStepsInput(stepsTarget ? String(stepsTarget) : '');
    setError(null);
    setShowTargets(true);
  }

  // Το setGoal αντικαθιστά ολόκληρη την εγγραφή, οπότε στέλνουμε ΚΑΙ τα υπάρχοντα
  // calorie/macros (από το goalDetail) ώστε να μη χαθούν όταν αλλάζουμε τους
  // στόχους νερού/βημάτων.
  async function saveTargets() {
    if (savingTargets) return;
    const calorieTarget = goalDetail?.calorieTarget;
    if (!calorieTarget) {
      setError('Set your calorie goal first (Set goals).');
      return;
    }
    const num = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };
    setSavingTargets(true);
    setError(null);
    try {
      await api.updateGoal(session.token, {
        calorieTarget,
        proteinGrams: goalDetail?.proteinGrams ?? null,
        carbohydrateGrams: goalDetail?.carbohydrateGrams ?? null,
        fatGrams: goalDetail?.fatGrams ?? null,
        fiberGrams: goalDetail?.fiberGrams ?? null,
        waterMl: num(targetWaterInput),
        stepsTarget: num(targetStepsInput),
      });
      setShowTargets(false);
      await load(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSavingTargets(false);
    }
  }

  async function commitSteps(newTotal: number) {
    const delta = Math.round(newTotal - steps);
    if (delta === 0 || addingSteps) return;
    setAddingSteps(true);
    setError(null);
    try {
      await api.addActivity(session.token, { entryDate: date, kind: 'WALK', steps: delta });
      await load(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setAddingSteps(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, date]);

  useEffect(() => {
    let mounted = true;
    const loadUnread = async () => {
      try {
        const result = await api.notifications(session.token, { limit: 1 });
        if (mounted) onUnreadCountChange(result.unreadCount);
      } catch {
        if (mounted) onUnreadCountChange(0);
      }
    };
    void loadUnread();
    const id = setInterval(loadUnread, 45000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [session.token, onUnreadCountChange]);

  const consumed = Math.round(dashboard?.summary?.consumed ?? 0);
  const rawTarget = dashboard?.summary?.target ?? 0;
  const target = rawTarget > 0 ? rawTarget : null;
  const remaining = dashboard?.summary?.remaining ?? (target !== null ? target - consumed : null);
  const progress = Math.round(
    dashboard?.summary?.progressPercent ?? (target ? (consumed / target) * 100 : 0),
  );
  const overTarget = dashboard?.summary?.overTarget ?? (remaining !== null && remaining < 0);
  const macroMap = dashboardMacroMap(dashboard?.macros);
  // Brand kit v2 nutrition data colors (σταθερά semantics σε όλες τις οθόνες).
  const macroConfig = [
    { key: 'protein', label: 'Protein', color: '#38BDF8' },
    { key: 'carbohydrate', label: 'Carbohydrates', color: '#FFB703' },
    { key: 'fat', label: 'Fat', color: '#A855F7' },
    { key: 'fiber', label: 'Fibre', color: '#10B981' },
  ] as const;

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      scrollEnabled={scrollEnabled}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.dashboardHeader}>
        <View style={styles.brandRowCompact}>
          <LogoMark />
          <View>
            <Text style={styles.kicker}>NutreLuma</Text>
            <Text style={styles.headerName}>Dashboard</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onOpenNotifications} style={styles.bellButton}>
            <Bell size={18} color={colors.muted} />
            {unreadNotifications > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {session.needsProfile ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Profile setup needed</Text>
          <Text style={styles.noticeCopy}>
            Complete the native onboarding flow to unlock the dashboard.
          </Text>
        </View>
      ) : null}

      <DateNav date={date} maxDate={today} onChange={setDate} />

      <View style={styles.actionRow}>
        <Pressable onPress={onAddMeal} style={[styles.actionButton, styles.actionPrimary]}>
          <Plus size={18} color={colors.white} />
          <Text style={styles.actionPrimaryText}>Add meal</Text>
        </Pressable>
        <Pressable onPress={onOpenWeight} style={styles.actionButton}>
          <Scale size={18} color={colors.primary} />
          <Text style={styles.actionText}>Weight</Text>
        </Pressable>
      </View>

      <View style={styles.progressSectionHeader}>
        <Text style={styles.sectionTitle}>{isToday ? "Today's progress" : "Day's progress"}</Text>
        <Pressable onPress={onOpenGoals} hitSlop={8}>
          <Text style={styles.linkText}>Set goals</Text>
        </Pressable>
      </View>

      {loading ? (
        <GlassCard style={styles.gaugeCard}>
          <ActivityIndicator color={colors.primary} />
        </GlassCard>
      ) : (
        <>
          <GlassCard style={styles.gaugeCard}>
            <CalorieGauge
              consumed={consumed}
              target={target}
              remaining={remaining}
              overTarget={overTarget}
              progressPercent={progress}
              labels={{
                of: `of ${target ?? 0} kcal`,
                remaining: `${Math.abs(remaining ?? 0)} kcal remaining`,
                over: `${Math.abs(remaining ?? 0)} kcal over target`,
                noTarget: 'No target set',
                kcal: 'kcal',
              }}
            />
          </GlassCard>

          <View style={styles.macroGaugeGrid}>
            {macroConfig.map(({ key, label, color }) => {
              const macro = macroMap[key] ?? {};
              const macroTarget = macro.target && macro.target > 0 ? macro.target : null;
              return (
                <GlassCard key={key} style={styles.macroGaugeCard}>
                  <MacroGauge
                    label={label}
                    consumed={macro.consumed ?? 0}
                    target={macroTarget}
                    over={macro.overTarget ?? false}
                    color={color}
                  />
                </GlassCard>
              );
            })}
          </View>
        </>
      )}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <PillButton label="Try again" onPress={() => load()} variant="ghost" />
        </View>
      ) : null}

      <View style={styles.progressSectionHeader}>
        <Text style={styles.sectionTitle}>{isToday ? 'Today' : 'That day'}</Text>
        {isToday ? (
          <Pressable onPress={openTargets} hitSlop={8} style={styles.gaugeSettingsButton}>
            <Settings size={16} color={colors.muted} />
            <Text style={styles.linkText}>Targets</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.macroGaugeGrid}>
        <GlassCard style={styles.macroGaugeCard}>
          <WaterGauge
            consumedMl={waterMl}
            targetMl={waterTarget}
            scaleMax={1.5 * (waterTarget ?? 3000)}
            onCommit={isToday ? commitWater : undefined}
            onDragStateChange={(d) => setScrollEnabled(!d)}
          />
        </GlassCard>
        <GlassCard style={styles.macroGaugeCard}>
          <StepsGauge
            steps={steps}
            targetSteps={stepsTarget ?? STEPS_FALLBACK}
            scaleMax={1.5 * (stepsTarget ?? STEPS_FALLBACK)}
            onCommit={isToday ? commitSteps : undefined}
            onDragStateChange={(d) => setScrollEnabled(!d)}
          />
        </GlassCard>
      </View>

      <Text style={styles.sectionTitle}>Meals</Text>
      <View style={styles.mealList}>
        {meals.length ? (
          meals.map((meal) => (
            <Pressable key={meal.id} onPress={() => onOpenMeal(meal.id)}>
              <GlassCard style={styles.mealCard}>
                <View style={styles.mealCardLeft}>
                  <MealPhoto token={session.token} mealId={meal.id} style={styles.mealThumb} />
                  <View style={styles.mealCardCopy}>
                    <Text style={styles.mealTitle}>{meal.title || meal.mealType || 'Meal'}</Text>
                    <Text style={styles.metricLabel}>
                      {[formatMealTime(meal.mealDateTime), meal.analysisStatus ?? 'saved']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.mealCalories}>{Math.round(meal.finalCalories ?? 0)} kcal</Text>
              </GlassCard>
            </Pressable>
          ))
        ) : (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.noticeTitle}>No meals yet</Text>
            <Text style={styles.noticeCopy}>Add your first meal from camera or gallery.</Text>
          </GlassCard>
        )}
      </View>

      <Modal visible={showTargets} transparent animationType="fade" onRequestClose={() => setShowTargets(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTargets(false)}>
          <Pressable style={styles.calendarCard} onPress={() => {}}>
            <Text style={styles.sectionTitle}>Water &amp; steps</Text>
            <Text style={styles.noticeCopy}>Set your daily targets and log steps.</Text>

            <Field
              label="Daily water target (ml)"
              value={targetWaterInput}
              onChangeText={setTargetWaterInput}
              keyboardType="numeric"
            />
            <Field
              label="Daily steps target"
              value={targetStepsInput}
              onChangeText={setTargetStepsInput}
              keyboardType="numeric"
            />
            <PillButton
              label={savingTargets ? 'Saving...' : 'Save targets'}
              onPress={saveTargets}
              disabled={savingTargets}
            />

            <Pressable onPress={() => setShowTargets(false)} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreenRaw] = useState<Screen>('dashboard');
  const screenRef = useRef<Screen>('dashboard');
  const backStack = useRef<Screen[]>([]);
  const forwardStack = useRef<Screen[]>([]);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Κάθε πλοήγηση περνά από εδώ, οπότε κρατάμε ιστορικό back/forward χωρίς να
  // αλλάξουμε τα call sites (ίδιο όνομα setScreen).
  const setScreen = useCallback((next: Screen) => {
    setScreenRaw((prev) => {
      if (next !== prev) {
        backStack.current.push(prev);
        forwardStack.current = [];
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    const prev = backStack.current.pop();
    if (prev === undefined) return;
    forwardStack.current.push(screenRef.current);
    setScreenRaw(prev);
  }, []);

  const goForward = useCallback(() => {
    const next = forwardStack.current.pop();
    if (next === undefined) return;
    backStack.current.push(screenRef.current);
    setScreenRaw(next);
  }, []);

  // iOS gestures: one-finger swipe από την αριστερή άκρη → back,
  // από τη δεξιά άκρη → forward. Διεκδικεί τον responder μόνο σε καθαρά
  // οριζόντια κίνηση που ξεκινά στην άκρη, ώστε να μη μπλοκάρει το scroll.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          if (Platform.OS !== 'ios') return false;
          const horizontal =
            Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7;
          if (!horizontal) return false;
          if (gesture.x0 <= 28 && gesture.dx > 0) return true;
          if (gesture.x0 >= windowWidth - 28 && gesture.dx < 0) return true;
          return false;
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.x0 <= 40 && gesture.dx > 60) goBack();
          else if (gesture.x0 >= windowWidth - 40 && gesture.dx < -60) goForward();
        },
      }),
    [windowWidth, goBack, goForward],
  );
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const pushRegisteredForToken = useRef<string | null>(null);

  // Push notifications: μόλις υπάρχει ενεργό session (με ολοκληρωμένο προφίλ)
  // κάνουμε αυτόματη εγγραφή του συσκευακού token (σιωπηλά — χωρίς alert σε
  // Expo Go/άρνηση) και στήνουμε listener ώστε το πάτημα ενός push να ανοίγει
  // την αντίστοιχη οθόνη. Έτσι το κινητό λαμβάνει και χειρίζεται push χωρίς να
  // χρειάζεται ο χρήστης να το ενεργοποιήσει χειροκίνητα από τα Settings.
  useEffect(() => {
    if (!session || session.needsProfile) return;
    const token = session.token;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      const push = await import('./src/push-notifications').catch(() => null);
      if (!push || cancelled) return;

      if (pushRegisteredForToken.current !== token) {
        pushRegisteredForToken.current = token;
        try {
          const registered = await push.registerForPushNotifications(token);
          if (registered && !cancelled) setPushToken(registered);
        } catch {
          // Expo Go ή χωρίς άδεια — αγνοούμε, δεν μπλοκάρουμε το app.
        }
      }

      if (cancelled) return;
      subscription = push.addNotificationResponseListener((data) => {
        setScreen(pushTargetScreen(data));
      });

      const initial = await push.getInitialNotificationData().catch(() => null);
      if (initial && !cancelled) setScreen(pushTargetScreen(initial));
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, session?.needsProfile]);

  useEffect(() => {
    let mounted = true;

    loadStoredSession()
      .then((storedSession) => {
        if (!mounted) return;
        setSession(storedSession);
      })
      .finally(() => {
        if (mounted) setRestoringSession(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleAuthenticated(nextSession: Session) {
    await saveStoredSession(nextSession);
    setSession(nextSession);
    setScreen(nextSession.needsProfile ? 'onboarding' : 'dashboard');
  }

  async function handleOnboardingComplete(nextSession: Session) {
    await saveStoredSession(nextSession);
    setSession(nextSession);
    setScreen('welcome');
    setRefreshKey((value) => value + 1);
  }

  function handleMealCreated() {
    setScreen('dashboard');
    setRefreshKey((value) => value + 1);
  }

  function openMealDetail(mealId: string) {
    setSelectedMealId(mealId);
    setScreen('mealDetail');
  }

  function handleUploadedMeal(mealId: string) {
    setRefreshKey((value) => value + 1);
    openMealDetail(mealId);
  }

  async function handleLogout() {
    if (session && pushToken) {
      const push = await import('./src/push-notifications').catch(() => null);
      await push?.unregisterPushNotifications(session.token, pushToken);
    }
    await clearStoredSession();
    setSession(null);
    setScreen('dashboard');
    setSelectedMealId(null);
    setUnreadNotifications(0);
    setPushToken(null);
    pushRegisteredForToken.current = null;
  }

  async function handleRegisterPush() {
    if (!session || registeringPush) return;
    setRegisteringPush(true);
    try {
      const push = await import('./src/push-notifications');
      const registeredToken = await push.registerForPushNotifications(session.token);
      if (registeredToken) setPushToken(registeredToken);
      else Alert.alert('Push notifications', 'Push notifications need a physical device and permission.');
    } catch (error) {
      Alert.alert('Push notifications', apiErrorMessage(error));
    } finally {
      setRegisteringPush(false);
    }
  }

  function handleBoundaryReset() {
    setSession(null);
    setScreen('dashboard');
    setSelectedMealId(null);
    setUnreadNotifications(0);
    setPushToken(null);
    pushRegisteredForToken.current = null;
    setRestoringSession(false);
  }

  return (
    <AppErrorBoundary onReset={handleBoundaryReset}>
      <RevenueCatProvider appUserID={session?.user.id ?? null}>
      <SafeAreaView style={styles.safeArea}>
        <GlassBackdrop />
        <StatusBar style="light" />
        <View style={styles.appBody} {...panResponder.panHandlers}>
        {restoringSession ? <StartupScreen /> : null}
        {!restoringSession && !session ? <AuthScreen onAuthenticated={handleAuthenticated} /> : null}
        {!restoringSession && session && session.needsProfile && screen !== 'onboarding' ? (
          <OnboardingScreen
            session={session}
            onComplete={handleOnboardingComplete}
            onLogout={handleLogout}
          />
        ) : null}
        {!restoringSession && session && screen === 'onboarding' ? (
          <OnboardingScreen
            session={session}
            onComplete={handleOnboardingComplete}
            onLogout={handleLogout}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'welcome' ? (
          <WelcomeTour
            firstName={(session.user.displayName ?? '').split(' ')[0] || 'there'}
            onDone={() => setScreen('dashboard')}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'dashboard' ? (
          <DashboardScreen
            session={session}
            onAddMeal={() => setScreen('addMeal')}
            onOpenMeal={openMealDetail}
            onOpenWeight={() => setScreen('weight')}
            onOpenGoals={() => setScreen('goals')}
            onOpenNotifications={() => setScreen('notifications')}
            onOpenSettings={() => setScreen('profile')}
            unreadNotifications={unreadNotifications}
            onUnreadCountChange={setUnreadNotifications}
            refreshKey={refreshKey}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'progress' ? (
          <ProgressScreen
            session={session}
            onOpenHistory={() => setScreen('history')}
            onOpenStats={() => setScreen('stats')}
            onOpenInsights={() => setScreen('insights')}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'goals' ? (
          <GoalsOverviewScreen
            session={session}
            onOpenMaintenance={() => setScreen('maintenance')}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'maintenance' ? (
          <MaintenanceScreen session={session} onBack={() => setScreen('goals')} />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'recipes' ? (
          <RecipesOverviewScreen session={session} />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'profile' ? (
          <ProfileOverviewScreen
            session={session}
            onSessionChange={setSession}
            onOpenSettings={() => setScreen('settings')}
            onOpenNotifications={() => setScreen('notifications')}
            onOpenWeight={() => setScreen('weight')}
            onLogout={handleLogout}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'addMeal' ? (
          <AddMealScreen
            session={session}
            onBack={() => setScreen('dashboard')}
            onCreated={handleUploadedMeal}
          />
        ) : null}
        {!restoringSession &&
        session &&
        !session.needsProfile &&
        screen === 'mealDetail' &&
        selectedMealId ? (
          <MealDetailScreen
            session={session}
            mealId={selectedMealId}
            onBack={() => setScreen('dashboard')}
            onChanged={handleMealCreated}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'weight' ? (
          <WeightScreen
            session={session}
            onBack={() => setScreen('dashboard')}
            onChanged={handleMealCreated}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'history' ? (
          <HistoryScreen
            session={session}
            onBack={() => setScreen('progress')}
            onOpenMeal={openMealDetail}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'stats' ? (
          <StatsScreen session={session} onBack={() => setScreen('progress')} />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'insights' ? (
          <InsightsScreen session={session} onBack={() => setScreen('progress')} />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'notifications' ? (
          <NotificationsScreen
            session={session}
            onBack={goBack}
            onOpenTarget={setScreen}
            onUnreadCountChange={setUnreadNotifications}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && screen === 'settings' ? (
          <SettingsScreen
            session={session}
            pushToken={pushToken}
            registeringPush={registeringPush}
            onRegisterPush={handleRegisterPush}
            onLogout={handleLogout}
          />
        ) : null}
        {!restoringSession && session && !session.needsProfile && isMainTab(screen) ? (
          <BottomNav
            active={screen}
            unreadNotifications={unreadNotifications}
            onChange={setScreen}
          />
        ) : null}
        </View>
      </SafeAreaView>
      </RevenueCatProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBody: {
    flex: 1,
  },
  startupContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  authContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 28,
    gap: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  brandRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#0B1020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    zIndex: 2,
  },
  logoPetal: {
    position: 'absolute',
    width: 9,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  logoPetalTop: {
    top: 4,
  },
  logoPetalRight: {
    right: 5,
    transform: [{ rotate: '90deg' }],
  },
  logoPetalBottom: {
    bottom: 4,
    backgroundColor: colors.accent,
  },
  logoPetalLeft: {
    left: 5,
    transform: [{ rotate: '90deg' }],
    backgroundColor: colors.accent,
  },
  brandText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  brandAccent: {
    color: colors.primary,
  },
  heroPhone: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 340,
    borderRadius: 34,
    padding: 12,
    backgroundColor: 'rgba(16, 23, 43, 0.78)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  heroPhoneTop: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(191, 210, 248, 0.18)',
  },
  miniMuted: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  heroPhoneTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  scanPreview: {
    marginTop: 12,
    minHeight: 120,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanLine: {
    position: 'absolute',
    top: 32,
    left: 18,
    right: 18,
    height: 2,
    backgroundColor: colors.accent,
  },
  scanTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  scanCopy: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  phoneMetrics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  metricUnit: {
    color: colors.muted,
    fontSize: 12,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  authPanel: {
    padding: 18,
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  titleSmall: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.white,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesInput: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  message: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  ghostButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  ghostButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  dashboardContent: {
    padding: 16,
    paddingTop: 20,
    gap: 16,
    paddingBottom: 112,
  },
  addMealContent: {
    padding: 16,
    paddingTop: 20,
    gap: 16,
    paddingBottom: 112,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  bellBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.background,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  headerName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  logoutButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.muted,
    fontWeight: '800',
  },
  noticeCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  noticeCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  heroBand: {
    borderRadius: 30,
    padding: 20,
    gap: 8,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionFull: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  actionIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  actionText: {
    color: colors.text,
    fontWeight: '900',
  },
  actionPrimaryText: {
    color: colors.white,
    fontWeight: '900',
  },
  photoPanel: {
    minHeight: 270,
    borderRadius: 24,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 270,
  },
  photoEmpty: {
    flex: 1,
    minHeight: 270,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  photoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 54,
    color: colors.white,
    fontSize: 34,
    fontWeight: '300',
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  photoRemoveButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 11, 22, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoRemoveText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
  },
  mealTypeRow: {
    gap: 8,
    paddingVertical: 2,
  },
  mealTypePill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealTypePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mealTypeText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  mealTypeTextActive: {
    color: colors.white,
  },
  summaryCard: {
    padding: 20,
    minHeight: 178,
    justifyContent: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryPercent: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  calories: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  analysisPulse: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 3, 0.24)',
  },
  analysisPulseText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    gap: 12,
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
  },
  errorText: {
    color: colors.text,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroCard: {
    width: '48%',
    minHeight: 116,
    padding: 14,
  },
  progressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavArrow: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateNavArrowDisabled: {
    opacity: 0.45,
  },
  dateNavCenter: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateNavLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  calendarDayTextSelected: {
    color: colors.white,
    fontWeight: '900',
  },
  calendarDayTextDisabled: {
    color: colors.mutedSoft,
    opacity: 0.4,
  },
  calendarTodayButton: {
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calendarTodayText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  gaugeCard: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  macroGaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroGaugeCard: {
    width: '48%',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  gaugeSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  waterAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  waterAddButtonGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  waterAddButtonBusy: {
    opacity: 0.5,
  },
  waterAddText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  waterAddTextGhost: {
    color: '#38BDF8',
    fontWeight: '800',
    fontSize: 13,
  },
  mealList: {
    gap: 10,
  },
  mealCard: {
    minHeight: 72,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  mealCardCopy: {
    flex: 1,
  },
  mealThumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
  },
  mealDetailPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    backgroundColor: colors.surfaceSoft,
  },
  mealTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  mealItemCopy: {
    flex: 1,
    paddingRight: 12,
  },
  mealCalories: {
    color: colors.accent,
    fontWeight: '900',
  },
  paginationRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageButton: {
    minWidth: 92,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartRow: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    paddingTop: 12,
  },
  chartColumn: {
    flex: 1,
    minWidth: 8,
    alignItems: 'center',
  },
  chartBarTrack: {
    height: 100,
    width: '100%',
    maxWidth: 18,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  chartBar: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  chartBarHighlight: {
    backgroundColor: colors.accent,
  },
  distributionList: {
    gap: 12,
  },
  distributionRow: {
    gap: 4,
  },
  distributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyCard: {
    padding: 18,
  },
  notificationCard: {
    padding: 16,
    gap: 10,
  },
  notificationCardUnread: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  notificationActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  recipeDetailBlock: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 26, android: 16, default: 16 }),
  },
  bottomNav: {
    minHeight: 66,
    borderRadius: 28,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 27, 49, 0.78)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  navItem: {
    flex: 1,
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navItemActive: {
    backgroundColor: colors.primarySoft,
  },
  navIconWrap: {
    minWidth: 24,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: '900',
  },
  navIconActive: {
    color: colors.accent,
  },
  navLabel: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '800',
  },
  navLabelActive: {
    color: colors.text,
  },
  navBadge: {
    position: 'absolute',
    right: -8,
    top: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  navBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
  profileCard: {
    minHeight: 96,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  healthHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: 4,
  },
  healthHeroMain: {
    flex: 1,
    gap: 2,
  },
  healthHeroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  healthHeroUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  healthChips: {
    gap: 8,
    alignItems: 'flex-end',
  },
  healthChip: {
    alignItems: 'center',
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthChipValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  healthChipLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  fieldGroupLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedSoft,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  settingsList: {
    gap: 10,
  },
  featureCard: {
    minHeight: 94,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureCardReady: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  featureCopy: {
    flex: 1,
  },
  progressCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  progressCardOuter: {
    flex: 1,
  },
  progressCard: {
    minHeight: 132,
    padding: 16,
    justifyContent: 'space-between',
    gap: 10,
  },
  progressWideCard: {
    minHeight: 96,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  progressCardBody: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  settingsRow: {
    minHeight: 84,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  settingsIconText: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 16,
  },
  settingsCopy: {
    flex: 1,
  },
  suggestionCard: {
    gap: 10,
    padding: 14,
  },
  quickLogGrid: {
    gap: 12,
  },
  quickLogCard: {
    gap: 10,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPickSection: {
    gap: 8,
  },
  quickPickRow: {
    gap: 10,
    paddingRight: 8,
  },
  quickPickCardOuter: {
    width: 150,
  },
  quickPickCard: {
    minHeight: 132,
    gap: 6,
    padding: 12,
  },
  favoriteMiniButton: {
    marginTop: 'auto',
    minHeight: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  favoriteMiniText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  compactChipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  compactChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  compactChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  clarificationList: {
    gap: 12,
    marginVertical: 14,
  },
  clarificationCard: {
    gap: 10,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clarificationQuestion: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  disabledPill: {
    opacity: 0.7,
  },
  statusPill: {
    minWidth: 46,
    minHeight: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  statusTextOn: {
    color: colors.success,
  },
});
