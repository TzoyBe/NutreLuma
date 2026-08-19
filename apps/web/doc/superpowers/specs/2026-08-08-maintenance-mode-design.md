# Weight Maintenance Mode — Design Spec

**Date:** 2026-08-08
**App:** NutreLuma (internal id: nutreluma) — Next.js 15 App Router, Prisma/Postgres, Vitest.
**Status:** Approved for implementation (single pass, no checkpoints).

## Goal

Add an integrated **Weight Maintenance Mode** that unlocks when the user safely reaches
their target weight. It is woven into the existing profile, dashboard, goals, meals,
reports and weight tracking — not a separate app. All existing data is preserved; every
change is additive.

## Locked decisions

1. **Unlock tolerance:** ±0.5% of target weight (configurable). **Maintenance range:** ±1.5 kg
   around the maintenance target by default (configurable).
2. **No daily snapshots.** Status, stability score, trends and recommendations are computed
   on-read from `WeightEntry` / meals / goals. `MaintenanceStatusSnapshot` and
   `MaintenanceRecommendation` are **not** tables.
3. **`UserGoalMode` is the source of truth** for the active mode. `HealthProfile.goal`
   stays synced for backward compatibility.
4. **UI language: English** (app is English-only). Keys added to both `el.ts` (shape) and
   `en.ts` (displayed text). Messages are neutral and non-judgmental.

## Existing building blocks reused

- `src/lib/milestone-progress.ts` — `resolveWeightCurrent` (7-day moving avg, ≥3 pts) and
  `isWeightGoalReached` (moving-avg OR two-consecutive-within-tolerance). Maintenance
  eligibility extends this.
- `src/lib/calories.ts` — `suggestDailyCalorieTarget({goal:'MAINTAIN'})` for the suggested
  maintenance calorie target.
- `NutritionGoal` (effectiveFrom history) — already provides Goal History; maintenance
  calorie changes are recorded here so old reports never mutate.
- Achievement/badge system — data-driven catalog + idempotent `evaluateAchievementsForUser`,
  `Notification.dedupeKey`. New maintenance achievements plug into the same metric pipeline.
- `evaluateGoalsForUserBestEffort` fires after every weigh-in — the hook point for
  eligibility + maintenance evaluation.

## Data model (new, additive)

```
enum GoalMode { LOSS, MAINTENANCE, GAIN }

enum MaintenanceStatus {           // computed, not stored — enum for typing
  WITHIN_RANGE, NEAR_UPPER, NEAR_LOWER, ABOVE_RANGE, BELOW_RANGE, INSUFFICIENT_DATA
}

enum MaintenanceAlertType {
  APPROACHING_UPPER, ABOVE_RANGE_SUSTAINED, BELOW_RANGE_SUSTAINED,
  INSUFFICIENT_WEIGH_INS, PERSISTENT_UPWARD_TREND, PERSISTENT_DOWNWARD_TREND
}
enum MaintenanceAlertSeverity { INFO, ATTENTION }
enum AlertSensitivity { LOW, MEDIUM, HIGH }

model UserGoalMode {
  id, userId @unique, mode GoalMode @default(LOSS), activatedAt, updatedAt
}

model GoalModeHistory {
  id, userId, mode GoalMode, startDate @db.Date, endDate @db.Date?,
  targetWeightKg Decimal?, calorieTarget Int?, reason String?, createdAt
  @@index([userId, startDate])
}

model MaintenanceProfile {
  id, userId @unique,
  targetWeightKg Decimal, lowerBoundaryKg Decimal, upperBoundaryKg Decimal,
  weighInsPerWeek Int @default(3),
  calorieTarget Int,
  proteinGrams Decimal?, carbohydrateGrams Decimal?, fatGrams Decimal?,
  weeklyCalorieMin Int?, weeklyCalorieMax Int?,
  toleranceKg Decimal @default(1.5),
  alertSensitivity AlertSensitivity @default(MEDIUM),
  activatedAt, updatedAt
}

model MaintenanceRangeHistory {
  id, userId, targetWeightKg Decimal, lowerBoundaryKg Decimal, upperBoundaryKg Decimal,
  effectiveFrom @db.Date, reason String?, createdAt
  @@index([userId, effectiveFrom])
}

model MaintenanceAlert {
  id, userId, type MaintenanceAlertType, severity MaintenanceAlertSeverity,
  message String, dedupeKey String, createdAt, dismissedAt DateTime?
  @@unique([userId, dedupeKey])
  @@index([userId, createdAt])
}
```

New `User` relations: `goalMode`, `goalModeHistory`, `maintenanceProfile`,
`maintenanceRangeHistory`, `maintenanceAlerts`.

## Pure logic — `src/lib/maintenance.ts` (fully unit-tested, no DB)

- `unlockTolerance(target, pct = 0.005)` → kg tolerance.
- `computeMaintenanceEligibility(points, target, direction, tolerancePct)` → reuses
  `resolveWeightCurrent` + two-consecutive-within-tolerance. Single outlier never unlocks;
  needs ≥3 points in the 7-day window for the moving-avg path.
- `suggestMaintenanceRange(target, toleranceKg = 1.5)` → `{ lower, upper }`.
- `classifyStatus(avg7, range, nearBandKg)` → `MaintenanceStatus` + `distanceFromCenter`.
- `movingAverage(points, windowDays)`, `variability(points)` (stddev), `daysWithinRange`,
  `trendDirection(points)` (least-squares sign with dead-band).
- `computeStabilityScore(inputs)` → 0–100 with transparent weighted breakdown:
  `% days in range`, `weigh-in adequacy`, `logging completeness`, `calorie consistency`,
  `no sustained deviation`. Never penalizes a single day.
- `deriveAlerts(context, sensitivity)` and `deriveRecommendations(context)` → deterministic,
  neutral English messages. No alert from a single measurement; sustained = N days over a
  boundary where N scales with sensitivity.

## Services — `src/server/services/maintenance.ts` (+ mode helpers)

- `getEligibility(userId)`, `activateMaintenance(userId, input)` (requires confirmed input;
  writes `MaintenanceProfile`, `UserGoalMode=MAINTENANCE`, `GoalModeHistory`,
  `MaintenanceRangeHistory`; **does not** change calories unless the user supplied a target).
- `getMaintenanceDashboard`, `getTrends`, `getWeeklyReport`, `updateRange`, `updateTargets`
  (targets go through `setGoal` → NutritionGoal history), `listAlerts`, `dismissAlert`,
  `changeGoalMode` (never automatic; writes history with reason).
- `evaluateMaintenanceForUser(userId)` — recomputes status, persists new alerts idempotently
  by `dedupeKey`. Called from `evaluateGoalsForUser`.
- Mode helper: `getActiveGoalMode`, `syncProfileGoal`.

## Achievements / milestones

- New `AchievementCategory.MAINTENANCE`; new `MilestoneType` values
  (`MAINTENANCE_DAYS_IN_RANGE`, `MAINTENANCE_DURATION_DAYS`, `STABLE_WEEKS`).
- New metrics in `computeUserAchievementMetrics`: `maintenanceActivated`,
  `maintenanceDaysInRange`, `maintenanceDurationDays`, `stableWeeks`,
  `maintenanceProteinDays`, `maintenanceLoggingDays`.
- Badges: New Balance, Stable Week (7d), One Month Stable, Three Months Maintaining,
  Six Months Maintaining, One Year Maintaining, Consistent Logging, Maintenance Master —
  all idempotent, backend-awarded. Also the unlock achievement "Weight goal reached"
  (existing `TARGET_WEIGHT_REACHED` is reused / aligned).

## API — `src/app/api/maintenance/*`

`eligibility` (GET), `activate` (POST), `dashboard` (GET), `range` (PUT), `targets` (PUT),
`trends` (GET), `report` (GET), `alerts` (GET), `alerts/[id]/dismiss` (POST), `mode` (PUT).
All wrapped with the existing auth helper; every mutation checks resource ownership by
`userId`. Zod schemas under `src/lib/validation/maintenance.ts`.

## UI (existing design system, English)

- **Before unlock:** locked maintenance card on dashboard + progress toward unlock with the
  copy "Maintenance mode unlocks when you reach your target weight range." Not framed as an
  end/punishment.
- **Unlock:** neutral celebratory modal → offer to activate (no auto calorie change).
- **Onboarding wizard:** explains maintenance (weight fluctuates daily; target is a range;
  calorie needs may adjust; estimates, not medical advice). Collects target, lower/upper
  boundary (auto-suggested, confirm required), weigh-in frequency, calorie target
  (old vs suggested vs diff + explanation; accept / custom / gradual / later), macros,
  optional weekly calorie range, alert sensitivity.
- **Maintenance dashboard:** range card (7-day avg, range, distance from center, status),
  stability trend (7/14/30-day, variability, days in range), calorie consistency
  (7d/30d avg, diff from target, complete-log days), habit consistency (meal/protein/water/
  activity/weigh-in), stability score with breakdown.
- **Charts:** range chart (avg + band), trend chart.
- **Weekly report:** moving average, range, days in range, avg calories, logging/protein/
  water/activity consistency, week-over-week comparison, trend direction, suggested next
  action.
- **Mode settings:** switch Loss / Maintenance / Gain (manual), adjust range, view history.
  When persistently out of range, offer: adjust range / new loss milestone / new gain
  milestone / keep tracking.

## Migration

Single idempotent SQL migration `add_maintenance_mode`: `CREATE TYPE IF NOT EXISTS` for
enums (guarded via DO block), `CREATE TABLE IF NOT EXISTS`, indexes, FKs with
`ON DELETE CASCADE`. No changes to existing columns.

## Tests (Vitest)

Pure lib: eligibility calc; single outlier does **not** unlock; moving-average unlock;
tolerance handling (±0.5%); range calculations; above/below-range detection; insufficient
data; stability score determinism + no single-day penalty; trend direction; weekly report
aggregation. Service/integration: activation requires confirmation; calorie target not
changed automatically; mode history recorded; achievement idempotency; cross-user
isolation; timezone boundaries for day bucketing.

## Delivery checklist

Explain unlock logic, range, alerts/recommendations, new achievements, migrations & files.
Run build + lint + tests; fix all errors; no TODOs/mocks/placeholders.
