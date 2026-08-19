import { File as ExpoFile } from 'expo-file-system';
import { API_BASE_URL } from './theme';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SUBSCRIPTION_REQUIRED'
  | 'INTERNAL_ERROR';

type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: { code: ApiErrorCode; message: string; details?: unknown } };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface MobileUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface MobileLoginResult {
  token: string;
  expiresInDays: number;
  user: MobileUser;
  needsProfile: boolean;
}

export interface MobileRegisterResult {
  user: MobileUser;
  requiresEmailVerification: boolean;
}

export interface DashboardResult {
  summary?: {
    consumed?: number;
    target?: number;
    remaining?: number;
    progressPercent?: number;
    overTarget?: boolean;
  };
  macros?:
    | Array<{
        key?: string;
        label?: string;
        consumed?: number;
        target?: number;
        unit?: string;
        progressPercent?: number;
        overTarget?: boolean;
      }>
    | Record<string, {
    key?: string;
    label?: string;
    consumed?: number;
    target?: number;
    unit?: string;
    progressPercent?: number;
    overTarget?: boolean;
  }>;
  meals?: Array<{
    id: string;
    title?: string | null;
    mealType?: string;
    finalCalories?: number;
    analysisStatus?: string;
    mealDateTime?: string;
  }>;
  drafts?: Array<{
    id: string;
    title?: string | null;
    mealType?: string;
    finalCalories?: number;
    analysisStatus?: string;
    mealDateTime?: string;
  }>;
}

export interface MealSummary {
  id: string;
  mealType: string;
  title: string | null;
  notes?: string | null;
  status: string;
  analysisStatus: string;
  finalCalories: number | null;
  aiEstimatedCalories?: number | null;
  mealDateTime: string;
}

export interface MealHistoryResult {
  meals: MealSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatsOverviewResult {
  timezone: string;
  target: number | null;
  from: string;
  to: string;
  dailyTotals: Array<{ day: string; total: number; withinTarget: boolean | null }>;
  weekTotal: number;
  weekAverage: number;
  monthTotal: number;
  monthAverage: number;
  average7: number;
  average30: number;
  daysWithinTargetPercent: number | null;
  daysLogged: number;
  distribution: Array<{ mealType: string; total: number; percent: number }>;
  avgIntake: number;
  weekdayAverages: Array<{ weekday: number; average: number }>;
  timeOfDay: Array<{ bucket: string; total: number; percent: number }>;
  weight: {
    points: Array<{ day: string; value: number }>;
    first: number;
    last: number;
    deltaKg: number;
  } | null;
}

export interface GoalView {
  id: string | null;
  effectiveFrom: string | null;
  source: string;
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  waterMl: number | null;
  stepsTarget: number | null;
  isFallback?: boolean;
}

export interface GoalsResult {
  date: string;
  timezone: string;
  goal: GoalView;
  suggestion: GoalView | null;
  history: GoalView[];
}

export interface AchievementItem {
  code?: string;
  name?: string;
  title?: string;
  description?: string;
  unlocked?: boolean;
  progress?: number;
  percent?: number;
}

export interface BadgeItem {
  code?: string;
  name?: string;
  title?: string;
  description?: string;
  unlockedAt?: string | null;
  earnedAt?: string | null;
}

export interface MilestoneItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  unit: string | null;
  startValue?: number | null;
  targetValue: number;
  currentValue: number;
  dailyThreshold?: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  percent: number;
}

export interface MilestoneSuggestion {
  title: string;
  description: string;
  type: string;
  targetValue: number;
  dailyThreshold: number | null;
  unit: string;
  startDate: string;
  endDate: string;
}

export interface MilestoneInput {
  title: string;
  description?: string;
  type?: string;
  unit?: string;
  startValue?: number | null;
  targetValue?: number;
  dailyThreshold?: number | null;
  startDate?: string;
  endDate?: string | null;
}

export interface SavedRecipe {
  id: string;
  createdAt: string;
  recipe: {
    mealType?: string;
    title?: string;
    description?: string;
    estimatedCalories?: number;
    targetCalories?: number;
    macros?: {
      proteinGrams?: number;
      carbohydrateGrams?: number;
      fatGrams?: number;
      fiberGrams?: number;
    };
    preparationTimeMinutes?: number;
    difficulty?: string;
    ingredients?: Array<{ name?: string; quantity?: number; unit?: string }>;
    steps?: string[];
    allergenWarnings?: string[];
  };
}

export interface MealPlanResult {
  plan: {
    id?: string;
    status?: string;
    planDate?: string;
    date?: string;
    // Το /api/meal-plan επιστρέφει το RecipePlan απευθείας, με τα meals στο top level.
    meals?: SavedRecipe['recipe'][];
    recipes?: Array<{
      id?: string;
      mealType?: string;
      title?: string;
      payload?: SavedRecipe['recipe'];
    }>;
    payload?: {
      meals?: SavedRecipe['recipe'][];
      estimatedDailyTotal?: number;
    };
  } | null;
}

export interface BillingOverviewResult {
  state?: { kind?: string; canWrite?: boolean; reason?: string | null; until?: string | null };
  status?: string;
  provider?: string | null;
  priceCents?: number;
  originalPriceCents?: number;
  discountPercent?: number;
  couponPriceCents?: number;
  couponDiscountPercent?: number;
  yearlyPriceCents?: number;
  yearlyOriginalPriceCents?: number;
  yearlyDiscountPercent?: number;
  stripeAvailable?: boolean;
  stripeYearlyAvailable?: boolean;
  paypalAvailable?: boolean;
  paypalYearlyAvailable?: boolean;
  payments?: Array<{ id: string; amountCents: number; currency: string; paidAt: string; note: string | null }>;
}

export interface InsightsResult {
  today: string;
  quality: null | {
    score: number;
    level: string;
    meals: number;
    complete: boolean;
  };
  patterns: Array<{
    type: string;
    weekendHigher?: boolean;
    deltaKcal?: number;
    message?: string;
    sampleCount?: number;
    confidence?: number;
  }>;
  energy: null | {
    estimatedCalories: number;
    confidence: number;
    completeDays: number;
  };
}

export interface IntelligenceResult {
  enabled: boolean;
  calibration?: {
    score: number;
    confirmedMeals: number;
    corrections: number;
  };
  correctionRates?: Record<string, number>;
  settings?: {
    personalCalibration: boolean;
    useMealHistory: boolean;
    useWeightHistory: boolean;
    useBehaviorPatterns: boolean;
  };
}

export interface MaintenanceEligibility {
  eligible: boolean;
  alreadyActive: boolean;
  method: string;
  current: number | null;
  targetWeightKg: number | null;
  toleranceKg: number;
  progressPercent: number;
  suggestedRange: null | { lower: number; upper: number };
  suggestedCalorieTarget: number | null;
  currentCalorieTarget: number | null;
}

export interface MaintenanceDashboardResult {
  active: boolean;
  today: string;
  range: { lower: number; upper: number };
  targetWeightKg: number;
  current7dAverage: number | null;
  status: string;
  distanceFromCenter: number;
  stability: {
    avg7: number | null;
    avg14: number | null;
    avg30: number | null;
    variability: number;
    daysWithinRange30: number;
  };
  calorie: {
    avg7: number | null;
    avg30: number | null;
    target: number;
    diffFromTarget: number | null;
    completeDays7: number;
  };
  habits: Record<string, number>;
  score: { score: number; level: string };
  recommendations: Array<{ code?: string; message: string; severity?: string }>;
}

export interface MaintenanceActivationInput {
  targetWeightKg: number;
  lowerBoundaryKg: number;
  upperBoundaryKg: number;
  weighInsPerWeek: number;
  calorieTarget: number;
  applyCalorieTarget: boolean;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
  weeklyCalorieMin?: number | null;
  weeklyCalorieMax?: number | null;
  alertSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  confirm: boolean;
}

export interface MaintenanceTargetInput {
  calorieTarget: number;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
  weeklyCalorieMin?: number | null;
  weeklyCalorieMax?: number | null;
  alertSensitivity?: 'LOW' | 'MEDIUM' | 'HIGH';
  weighInsPerWeek?: number;
  applyCalorieTarget: boolean;
}

export interface MaintenanceReport {
  weekStart: string;
  weekEnd: string;
  movingAverage: number | null;
  daysWithinRange: number;
  averageCalories: number | null;
  trend: string;
  suggestedNextAction: string;
  loggingCompletenessPercent: number;
  proteinConsistencyPercent: number;
  waterConsistencyPercent: number;
  activityConsistencyPercent: number;
}

export interface MaintenanceAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  dismissedAt: string | null;
}

export interface MacroValues {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

export interface MealDetailResult {
  meal: {
    id: string;
    mealType: string;
    title: string | null;
    notes: string | null;
    mealDateTime: string;
    status: string;
    analysisStatus: string;
    aiEstimatedCalories: number | null;
    finalCalories: number | null;
    aiMinCalories: number | null;
    aiMaxCalories: number | null;
    aiConfidence: number | null;
    aiErrorCode: string | null;
    countsTowardTotals: boolean;
    macros: MacroValues;
    items: Array<{
      id: string;
      name: string;
      estimatedQuantity: string | null;
      aiEstimatedCalories: number | null;
      finalCalories: number | null;
      macros: MacroValues;
    }>;
    pendingClarifications: number;
    clarifications: Array<{
      id: string;
      questionId: string;
      question: string;
      options: string[];
      answer: string | null;
      answeredAt?: string | null;
    }>;
  };
}

export interface UploadedMealResult {
  meal: {
    id: string;
    analysisStatus: string;
  };
  duplicated: boolean;
}

export type QuickPickRef =
  | { kind: 'favorite'; id: string }
  | { kind: 'frequent'; fingerprint: string }
  | { kind: 'recent'; mealId: string };

export interface QuickPickCardModel {
  ref: QuickPickRef;
  title: string;
  mealType: string;
  calories: number | null;
  macros: MacroValues;
  thumbUrl: string | null;
  isFavorite: boolean;
  favoriteId: string | null;
  usageCount?: number;
  lastUsedAt?: string;
}

export interface QuickPickPreviewResult {
  title: string | null;
  mealType: string;
  multiplier: number;
  composition: {
    finalCalories: number | null;
    macros: MacroValues;
    items: Array<{
      name: string;
      estimatedQuantity: string | null;
      finalCalories: number | null;
      macros: MacroValues;
    }>;
  };
}

export interface QuickPickOptionsResult {
  favorites: Array<{
    id: string;
    fingerprint: string;
    title: string | null;
    mealType: string;
    calories: number | null;
    macros: MacroValues;
    thumbUrl: string | null;
  }>;
  frequent: Array<{
    fingerprint: string;
    usageCount: number;
    lastUsedAt: string;
    isFavorite: boolean;
    meal: MealDetailResult['meal'];
  }>;
  recent: MealDetailResult['meal'][];
}

export interface HealthProfileInput {
  birthDate: string;
  gender: string;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg?: number | '';
  activityLevel: string;
  goal: string;
  dailyCalorieTarget?: number | '';
  preferredUnits: string;
  timezone: string;
}

export interface HealthProfileView {
  id: string;
  birthDate: string;
  gender: string;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number | null;
  activityLevel: string;
  goal: string;
  dailyCalorieTarget: number | null;
  suggestedDailyCalorieTarget?: number;
  effectiveDailyCalorieTarget?: number;
  preferredUnits: string;
  timezone: string;
}

export interface ProfileResult {
  profile: HealthProfileView | null;
}

export interface WeightEntry {
  id: string;
  weightKg: number;
  entryDate: string;
  notes: string | null;
  createdAt: string;
}

export interface WeightListResult {
  entries: WeightEntry[];
}

export interface WeightSaveResult {
  entry: WeightEntry;
}

export interface WaterEntry {
  id: string;
  entryDate: string;
  volumeMl: number;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  entryDate: string;
  kind: string;
  steps: number | null;
  durationMin: number | null;
  note: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  milestoneId: string | null;
  dedupeKey: string | null;
  readAt: string | null;
  emailedAt: string | null;
  createdAt: string;
}

export interface NotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface UploadMealInput {
  token: string;
  image: {
    uri: string;
    name: string;
    type: string;
  };
  mealType: string;
  mealDateTime: string;
  title?: string;
  notes?: string;
}

class NutreLumaApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'NutreLumaApiError';
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!payload) {
    throw new NutreLumaApiError('INTERNAL_ERROR', 'Unexpected server response.');
  }
  if (!payload.ok) {
    throw new NutreLumaApiError(
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }
  return payload.data;
}

async function requestRawText(path: string, token: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: '*/*',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const payload = (() => {
      try {
        return JSON.parse(text) as ApiResult<unknown>;
      } catch {
        return null;
      }
    })();
    if (payload && !payload.ok) {
      throw new NutreLumaApiError(payload.error.code, payload.error.message, payload.error.details);
    }
    throw new NutreLumaApiError('INTERNAL_ERROR', 'Export failed.');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'nutreluma-export.txt';
  return {
    text,
    fileName,
    mimeType: response.headers.get('content-type') ?? 'text/plain',
  };
}

export const api = {
  login(email: string, password: string) {
    return request<MobileLoginResult>('/api/auth/mobile/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(displayName: string, email: string, password: string) {
    return request<MobileRegisterResult>('/api/auth/mobile/register', {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        email,
        password,
        passwordConfirm: password,
        consent: true,
      }),
    });
  },

  forgotPassword(email: string) {
    return request<{ accepted: true }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resendVerification(email: string) {
    return request<{ accepted: true }>('/api/auth/verify-email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  completeGoogleMobileAuth(token: string) {
    return request<MobileLoginResult>('/api/auth/mobile/google/complete', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  dashboard(token: string, date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<DashboardResult>(`/api/dashboard${query}`, { token });
  },

  meals(
    token: string,
    options: {
      page?: number;
      pageSize?: number;
      from?: string;
      to?: string;
      mealType?: string;
      search?: string;
      minCalories?: string;
      maxCalories?: string;
    } = {},
  ) {
    const params = new URLSearchParams();
    params.set('page', String(options.page ?? 1));
    params.set('pageSize', String(options.pageSize ?? 12));
    for (const key of ['from', 'to', 'mealType', 'search', 'minCalories', 'maxCalories'] as const) {
      const value = options[key];
      if (value?.trim()) params.set(key, value.trim());
    }
    return request<MealHistoryResult>(`/api/meals?${params.toString()}`, { token });
  },

  stats(token: string, days = 30) {
    return request<StatsOverviewResult>(`/api/stats?days=${days}`, { token });
  },

  insights(token: string) {
    return request<InsightsResult>('/api/insights', { token });
  },

  intelligence(token: string) {
    return request<IntelligenceResult>('/api/intelligence', { token });
  },

  updateIntelligence(token: string, input: Partial<NonNullable<IntelligenceResult['settings']>>) {
    return request<{ settings: NonNullable<IntelligenceResult['settings']> }>('/api/intelligence', {
      method: 'PUT',
      token,
      body: JSON.stringify(input),
    });
  },

  resetIntelligence(token: string) {
    return request<{ reset: true }>('/api/intelligence', {
      method: 'DELETE',
      token,
    });
  },

  maintenanceEligibility(token: string) {
    return request<MaintenanceEligibility>('/api/maintenance/eligibility', { token });
  },

  maintenanceDashboard(token: string) {
    return request<MaintenanceDashboardResult>('/api/maintenance/dashboard', { token });
  },

  maintenanceReport(token: string) {
    return request<MaintenanceReport>('/api/maintenance/report', { token });
  },

  maintenanceAlerts(token: string) {
    return request<{ alerts: MaintenanceAlert[] }>('/api/maintenance/alerts', { token });
  },

  activateMaintenance(token: string, input: MaintenanceActivationInput) {
    return request<{ activated: true }>('/api/maintenance/activate', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  updateMaintenanceRange(
    token: string,
    input: {
      targetWeightKg: number;
      lowerBoundaryKg: number;
      upperBoundaryKg: number;
      reason?: string;
    },
  ) {
    return request<{ updated: true }>('/api/maintenance/range', {
      method: 'PUT',
      token,
      body: JSON.stringify(input),
    });
  },

  updateMaintenanceTargets(token: string, input: MaintenanceTargetInput) {
    return request<{ updated: true }>('/api/maintenance/targets', {
      method: 'PUT',
      token,
      body: JSON.stringify(input),
    });
  },

  dismissMaintenanceAlert(token: string, alertId: string) {
    return request<{ dismissed: true }>(`/api/maintenance/alerts/${alertId}/dismiss`, {
      method: 'POST',
      token,
    });
  },

  updateMaintenanceMode(token: string, mode: 'LOSS' | 'MAINTENANCE' | 'GAIN') {
    return request<{ mode: unknown }>('/api/maintenance/mode', {
      method: 'PUT',
      token,
      body: JSON.stringify({ mode, reason: 'native_switch' }),
    });
  },

  goals(token: string) {
    return request<GoalsResult>('/api/goals', { token });
  },

  updateGoal(
    token: string,
    input: {
      calorieTarget: number;
      proteinGrams?: number | null;
      carbohydrateGrams?: number | null;
      fatGrams?: number | null;
      fiberGrams?: number | null;
      waterMl?: number | null;
      stepsTarget?: number | null;
    },
  ) {
    return request<{ goal: GoalView }>('/api/goals', {
      method: 'PUT',
      token,
      body: JSON.stringify({ ...input, source: 'MANUAL' }),
    });
  },

  achievements(token: string) {
    return request<{ achievements: AchievementItem[] }>('/api/achievements', { token });
  },

  badges(token: string) {
    return request<{ badges: BadgeItem[] }>('/api/badges', { token });
  },

  milestones(token: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ milestones: MilestoneItem[] }>(`/api/milestones${query}`, { token });
  },

  milestoneSuggestions(token: string) {
    return request<{ suggestions: MilestoneSuggestion[] }>('/api/milestones/suggestions', { token });
  },

  createMilestone(token: string, input: MilestoneInput & { type: string; targetValue: number; startDate: string }) {
    return request<{ milestone: MilestoneItem; warnings?: Array<{ message: string }> }>('/api/milestones', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  updateMilestone(token: string, id: string, input: MilestoneInput) {
    return request<{ milestone: MilestoneItem; warnings?: Array<{ message: string }> }>(`/api/milestones/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    });
  },

  pauseMilestone(token: string, id: string) {
    return request<{ milestone: MilestoneItem }>(`/api/milestones/${id}/pause`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  resumeMilestone(token: string, id: string) {
    return request<{ milestone: MilestoneItem }>(`/api/milestones/${id}/resume`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  cancelMilestone(token: string, id: string) {
    return request<{ milestone: MilestoneItem }>(`/api/milestones/${id}/cancel`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  addWater(token: string, input: { entryDate: string; volumeMl: number }) {
    return request<{ entry: WaterEntry }>('/api/water', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  waterEntries(token: string, options: { limit?: number } = {}) {
    const limit = options.limit ?? 10;
    return request<{ entries: WaterEntry[] }>(`/api/water?limit=${limit}`, { token });
  },

  deleteWater(token: string, id: string) {
    return request<{ deleted: true }>(`/api/water/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  addActivity(
    token: string,
    input: {
      entryDate: string;
      kind: string;
      steps?: number | null;
      durationMin?: number | null;
      note?: string;
    },
  ) {
    return request<{ entry: ActivityEntry }>('/api/activity', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  activityEntries(token: string, options: { limit?: number } = {}) {
    const limit = options.limit ?? 10;
    return request<{ entries: ActivityEntry[] }>(`/api/activity?limit=${limit}`, { token });
  },

  deleteActivity(token: string, id: string) {
    return request<{ deleted: true }>(`/api/activity/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  recipes(token: string) {
    return request<{ recipes: SavedRecipe[] }>('/api/recipes', { token });
  },

  saveRecipe(token: string, recipe: SavedRecipe['recipe']) {
    return request<{ id: string; recipe: SavedRecipe['recipe'] }>('/api/recipes', {
      method: 'POST',
      token,
      body: JSON.stringify(recipe),
    });
  },

  deleteRecipe(token: string, id: string) {
    return request<{ deleted: true }>(`/api/recipes/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  mealPlan(token: string) {
    return request<MealPlanResult>('/api/meal-plan', { token });
  },

  generateMealPlan(token: string) {
    return request<MealPlanResult>('/api/meal-plan', {
      method: 'POST',
      token,
      body: JSON.stringify({ force: true }),
    });
  },

  billing(token: string) {
    return request<BillingOverviewResult>('/api/billing', { token });
  },

  updateAccount(token: string, displayName: string) {
    return request<{ account: MobileUser }>('/api/account', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ displayName }),
    });
  },

  changePassword(token: string, currentPassword: string, newPassword: string) {
    return request<{ changed: true }>('/api/account/password', {
      method: 'POST',
      token,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  exportAccount(token: string, format: 'json' | 'csv') {
    return requestRawText(`/api/account/export?format=${format}`, token);
  },

  deleteAccount(token: string, password: string) {
    return request<{ deleted: true }>('/api/account', {
      method: 'DELETE',
      token,
      body: JSON.stringify({ password, confirmation: 'DELETE' }),
    });
  },

  stripeCheckout(token: string, interval: 'monthly' | 'yearly', couponCode?: string | null) {
    return request<{ url: string }>('/api/billing/stripe/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ interval, couponCode: couponCode ?? null }),
    });
  },

  applyBillingCoupon(token: string, code: string) {
    return request<{ code: string }>('/api/billing/coupon', {
      method: 'POST',
      token,
      body: JSON.stringify({ code }),
    });
  },

  cancelBilling(token: string) {
    return request<{ cancelled: true }>('/api/billing/cancel', {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  meal(token: string, mealId: string) {
    return request<MealDetailResult>(`/api/meals/${mealId}`, { token });
  },

  confirmMeal(token: string, mealId: string) {
    return request<MealDetailResult>(`/api/meals/${mealId}/confirm`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  updateMeal(
    token: string,
    mealId: string,
    input: {
      title?: string;
      notes?: string;
      mealType?: string;
      finalCalories?: number;
      mealDateTime?: string;
      acknowledgeHighCalories?: boolean;
    },
  ) {
    return request<MealDetailResult>(`/api/meals/${mealId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    });
  },

  cancelMeal(token: string, mealId: string) {
    return request<MealDetailResult>(`/api/meals/${mealId}/cancel`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
  },

  answerClarifications(
    token: string,
    mealId: string,
    answers: Array<{ questionId: string; answer: string }>,
  ) {
    return request<MealDetailResult>(`/api/meals/${mealId}/clarify`, {
      method: 'POST',
      token,
      body: JSON.stringify({ answers }),
    });
  },

  deleteMeal(token: string, mealId: string) {
    return request<{ deleted: true }>(`/api/meals/${mealId}`, {
      method: 'DELETE',
      token,
    });
  },

  async uploadMeal(input: UploadMealInput) {
    // Το global fetch του Expo (WinterCG) ΔΕΝ υποστηρίζει το κλασικό RN file part
    // `{ uri, name, type }` — πετάει "Unsupported FormDataPart implementation".
    // Διαβάζουμε τα bytes του αρχείου και στέλνουμε ένα part με `bytes()`, που
    // αναγνωρίζει το expo/winter/fetch convertFormData.
    const bytes = new Uint8Array(await new ExpoFile(input.image.uri).arrayBuffer());
    const filePart = {
      name: input.image.name,
      type: input.image.type,
      bytes: async () => bytes,
    };

    const form = new FormData();
    form.append('image', filePart as unknown as Blob);
    form.append('mealType', input.mealType);
    form.append('mealDateTime', input.mealDateTime);
    form.append('requestKey', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    if (input.title?.trim()) form.append('title', input.title.trim());
    if (input.notes?.trim()) form.append('notes', input.notes.trim());

    return request<UploadedMealResult>('/api/meals', {
      method: 'POST',
      token: input.token,
      body: form,
    });
  },

  createManualMeal(
    token: string,
    input: {
      mealType: string;
      mealDateTime: string;
      title?: string;
      notes?: string;
      finalCalories?: number;
      proteinGrams?: number;
      carbohydrateGrams?: number;
      fatGrams?: number;
      fiberGrams?: number;
      items?: Array<{ name: string; estimatedQuantity?: string; finalCalories: number }>;
      acknowledgeHighCalories?: boolean;
      requestKey?: string;
    },
  ) {
    return request<{ meal: MealDetailResult['meal']; duplicated: boolean }>('/api/meals', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  quickPickOptions(token: string) {
    return request<QuickPickOptionsResult>('/api/meals/quick-pick/options', { token });
  },

  previewQuickPick(token: string, ref: QuickPickRef, servingMultiplier: number) {
    return request<QuickPickPreviewResult>('/api/meals/quick-pick/preview', {
      method: 'POST',
      token,
      body: JSON.stringify({ ref, servingMultiplier }),
    });
  },

  createQuickPick(
    token: string,
    input: {
      ref: QuickPickRef;
      servingMultiplier: number;
      mealType: string;
      notes?: string;
      overrides?: Partial<MacroValues> & { finalCalories?: number };
      requestKey?: string;
    },
  ) {
    return request<{ meal: MealDetailResult['meal']; duplicated: boolean }>('/api/meals/quick-pick', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  addFavorite(token: string, ref: QuickPickRef) {
    return request<{ favorite: QuickPickOptionsResult['favorites'][number] }>('/api/meals/favorites', {
      method: 'POST',
      token,
      body: JSON.stringify({ ref }),
    });
  },

  removeFavorite(token: string, id: string) {
    return request<{ ok: true }>(`/api/meals/favorites/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  updateProfile(token: string, input: HealthProfileInput) {
    return request<ProfileResult>('/api/profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(input),
    });
  },

  profile(token: string) {
    return request<ProfileResult>('/api/profile', { token });
  },

  weights(token: string) {
    return request<WeightListResult>('/api/weight?limit=30', { token });
  },

  saveWeight(token: string, input: { weightKg: number; entryDate: string; notes?: string }) {
    return request<WeightSaveResult>('/api/weight', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  deleteWeight(token: string, entryId: string) {
    return request<{ deleted: boolean }>(`/api/weight/${entryId}`, {
      method: 'DELETE',
      token,
    });
  },

  notifications(token: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.unreadOnly !== undefined) params.set('unreadOnly', String(options.unreadOnly));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    const query = params.toString();
    return request<NotificationsResult>(`/api/notifications${query ? `?${query}` : ''}`, {
      token,
    });
  },

  markNotificationsRead(token: string, ids?: string[]) {
    return request<{ count: number }>('/api/notifications/read', {
      method: 'POST',
      token,
      body: JSON.stringify(ids ? { ids } : {}),
    });
  },

  registerPushToken(
    token: string,
    input: { pushToken: string; platform?: string; deviceName?: string },
  ) {
    return request<{ registered: true }>('/api/notifications/push-token', {
      method: 'POST',
      token,
      body: JSON.stringify({
        token: input.pushToken,
        platform: input.platform,
        deviceName: input.deviceName,
      }),
    });
  },

  unregisterPushToken(token: string, pushToken: string) {
    return request<{ deleted: boolean }>('/api/notifications/push-token', {
      method: 'DELETE',
      token,
      body: JSON.stringify({ token: pushToken }),
    });
  },
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
