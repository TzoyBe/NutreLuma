# Weight Maintenance Mode Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an integrated Weight Maintenance Mode that unlocks on safe target-weight
achievement and layers maintenance tracking onto profile/dashboard/goals/reports.

**Architecture:** Additive Prisma models (`UserGoalMode`, `GoalModeHistory`,
`MaintenanceProfile`, `MaintenanceRangeHistory`, `MaintenanceAlert`). Pure logic in
`src/lib/maintenance.ts` (unit-tested, no DB). Services in
`src/server/services/maintenance.ts` + `goal-mode.ts`. API under `src/app/api/maintenance/*`.
Status/score/recommendations computed on-read (no daily snapshots). English UI.

**Tech Stack:** Next.js 15 App Router, Prisma/Postgres, Vitest, Zod, existing i18n (en.ts/el.ts).

## Global Constraints

- All changes additive; no existing column/data changes. UI language: English (keys in
  el.ts shape + en.ts text). Unlock tolerance ±0.5% of target; default range ±1.5 kg.
  `UserGoalMode` = source of truth, `HealthProfile.goal` kept synced. No auto calorie
  changes — every target/mode change is user-confirmed. Neutral, non-judgmental copy.
  Idempotent migration + idempotent achievement awards. No TODOs/mocks/placeholders.

---

### Task 1: Prisma models + migration
**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_add_maintenance_mode/migration.sql`.
- [ ] Add `GoalMode`, `MaintenanceStatus`, `MaintenanceAlertType`, `MaintenanceAlertSeverity`, `AlertSensitivity` enums.
- [ ] Add models `UserGoalMode`, `GoalModeHistory`, `MaintenanceProfile`, `MaintenanceRangeHistory`, `MaintenanceAlert` + User relations. Extend `AchievementCategory` with `MAINTENANCE`; extend `MilestoneType` with `MAINTENANCE_DAYS_IN_RANGE`, `MAINTENANCE_DURATION_DAYS`, `STABLE_WEEKS`.
- [ ] Write idempotent SQL migration (guarded enum creation, `CREATE TABLE IF NOT EXISTS`, indexes, cascade FKs).
- [ ] `prisma generate` (or validate) succeeds.

### Task 2: Pure logic `src/lib/maintenance.ts` (TDD)
**Files:** Create `src/lib/maintenance.ts`; Test `tests/unit/maintenance.test.ts`.
- [ ] `unlockToleranceKg(target, pct=0.005)`.
- [ ] `computeMaintenanceEligibility(points, target, direction, tolerancePct=0.005)` → `{eligible, method, current}`. Single outlier never unlocks; moving-avg path needs ≥3 pts/7d.
- [ ] `suggestMaintenanceRange(target, toleranceKg=1.5)` → `{lower, upper}`.
- [ ] `movingAverage(points, windowDays)`, `stddev(points)`, `daysWithinRange(points, range)`, `trendDirection(points)` (dead-band).
- [ ] `classifyStatus(avg7, range, nearBandKg=0.3)` → `{status, distanceFromCenter}`.
- [ ] `computeStabilityScore(inputs)` → `{score, breakdown[]}`; never penalizes single day.
- [ ] `deriveAlerts(ctx, sensitivity)` + `deriveRecommendations(ctx)` → neutral English strings; sustained thresholds scale with sensitivity; never from one measurement.
- [ ] Tests: outlier-no-unlock, moving-avg unlock, tolerance, range calc, above/below/within, insufficient data, score determinism + no single-day penalty, trend.

### Task 3: Validation schemas
**Files:** Create `src/lib/validation/maintenance.ts`; Test `tests/unit/maintenance-validation.test.ts`.
- [ ] Zod: `activateMaintenanceSchema`, `updateRangeSchema`, `updateTargetsSchema`, `changeModeSchema`. Boundaries: lower < target < upper; positive calories.

### Task 4: goal-mode service
**Files:** Create `src/server/services/goal-mode.ts`.
- [ ] `getActiveGoalMode(userId)` (defaults LOSS, maps from HealthProfile.goal if no row), `setGoalMode(userId, mode, reason, {targetWeightKg, calorieTarget})` (writes UserGoalMode + GoalModeHistory + syncs HealthProfile.goal), `listModeHistory(userId)`.

### Task 5: maintenance service (on-read compute)
**Files:** Create `src/server/services/maintenance.ts`.
- [ ] `getEligibility(userId)` (loads weight points + target/direction, calls lib).
- [ ] `activateMaintenance(userId, input)` (tx: MaintenanceProfile, RangeHistory, mode→MAINTENANCE; only sets calorie goal if input.calorieTarget provided → via setGoal).
- [ ] `getMaintenanceDashboard(userId)`, `getTrends(userId)`, `getWeeklyReport(userId)`.
- [ ] `updateRange(userId, input)` (+ RangeHistory), `updateTargets(userId, input)` (via setGoal history).
- [ ] `listAlerts`, `dismissAlert(userId, id)`, `evaluateMaintenanceForUser(userId)` (persist alerts idempotently by dedupeKey).
- [ ] Habit/calorie consistency reuse meal/water/activity queries + `getGoalForDay`; timezone via `getUserTimezone`.

### Task 6: wire evaluation hook
**Files:** Modify `src/server/services/goals-evaluator.ts`.
- [ ] Call `evaluateMaintenanceForUser` inside `evaluateGoalsForUser` (best-effort, after achievements).

### Task 7: achievements/milestones extension (TDD)
**Files:** Modify `src/lib/achievements-catalog.ts`, `src/server/services/achievements.ts`; Test add to `tests/unit/achievements-catalog.test.ts`.
- [ ] New metrics union entries + maintenance achievements/badges (New Balance, Stable Week, One Month Stable, Three/Six Months, One Year, Consistent Logging, Maintenance Master).
- [ ] `computeUserAchievementMetrics` adds `maintenanceActivated`, `maintenanceDaysInRange`, `maintenanceDurationDays`, `stableWeeks`, `maintenanceProteinDays`, `maintenanceLoggingDays` (from MaintenanceProfile + weight/meals). Idempotent test.

### Task 8: API routes
**Files:** Create `src/app/api/maintenance/{eligibility,activate,dashboard,range,targets,trends,report,alerts}/route.ts` + `alerts/[id]/dismiss/route.ts` + `mode/route.ts`.
- [ ] Each uses existing auth helper + ownership; zod parse; returns JSON. Follow existing route pattern.

### Task 9: i18n keys
**Files:** Modify `src/i18n/el.ts` (shape) + `src/i18n/en.ts` (text).
- [ ] Add `maintenance.*` section: labels, statuses, onboarding copy, alerts, report, score, mode settings.

### Task 10: UI components + pages
**Files:** Create `src/components/maintenance/*` (LockedCard, UnlockModal, OnboardingWizard, RangeCard, StabilityTrend, CalorieConsistency, HabitConsistency, StabilityScore, RangeChart, TrendChart, WeeklyReport, ModeSettings); pages under `src/app/(app)/maintenance/`; wire LockedCard/UnlockModal into dashboard; add api-client methods.
- [ ] Follow existing component/design patterns; English copy from i18n.

### Task 11: service/integration tests
**Files:** Create `tests/unit/goal-mode.test.ts`, `tests/integration/maintenance-service.test.ts` (or mocked-prisma unit per existing pattern).
- [ ] activation requires confirmation; calorie not auto-changed; mode history; cross-user isolation; timezone boundaries; weekly report.

### Task 12: build + lint + tests
- [ ] `npm run lint`, `npm test`, `npm run build` (typecheck). Fix all. Commit.

## Self-Review notes
Spec sections mapped: unlock(T2), range(T2/5), alerts+recs(T2/5), achievements(T7), models+migration(T1), API(T8), UI(T10), tests(T2/3/7/11/12). Recommendations/status computed on-read per decision — no tables.
