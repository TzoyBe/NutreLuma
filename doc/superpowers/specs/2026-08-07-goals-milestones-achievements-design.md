# Goals, Milestones, Achievements & Badges — Design Spec

**Date:** 2026-08-07
**App:** NutreLuma / NutreLuma (`\\tzoybe-nas\Container\nutreluma`)
**Status:** Approved — proceeding to implementation plan.

## Goal

Extend the existing **Goals** feature with short-term **milestones**, **achievements**, and **badges**, plus in-app **notifications** and deterministic **suggested milestones**. Do **not** break the existing target-weight or daily-calorie/nutrition-goal features. All new data added via **non-destructive** migrations.

## Approved decisions

1. **Full + logging:** water, steps and activity are not tracked today, so we add `WaterEntry` and `ActivityEntry` models + minimal logging UI/endpoints so all 12 milestone types work end-to-end from real data.
2. **Recompute-on-read + best-effort write hooks:** a central orchestrator `evaluateGoalsForUser(userId)` runs (a) when the Goals page loads, and (b) best-effort (non-fatal) after key writes: confirm meal, log weight, log water, log activity. No cron.
3. **Backend-verified only:** the frontend never marks a milestone/achievement complete. `CUSTOM_NUMERIC` is the only manual-progress type, and even that goes through an authenticated backend endpoint that records progress server-side.

## Existing state (analysis)

- **Target weight:** `HealthProfile.targetWeightKg` (Decimal). Also `currentWeightKg`, `dailyCalorieTarget`, `goal` (LOSE/MAINTAIN/GAIN), `timezone`.
- **Nutrition goals:** `NutritionGoal` history keyed by `effectiveFrom` — `calorieTarget`, `proteinGrams`, `waterMl` (target only), etc. Service `getGoalForDay` resolves the goal for a day. (`src/server/services/goals.ts`)
- **Weight history:** `WeightEntry` — `weightKg` Decimal, `entryDate` Date, unique `[userId, entryDate]`. (`src/server/services/weight.ts`)
- **Daily compliance already computed:** calories `total>0 && total<=target`; protein/macros summed per day from CONFIRMED meals. (`src/server/services/stats.ts`)
- **Not present (added here):** `WaterEntry`, `ActivityEntry`, achievements, badges, streaks, notifications, milestones.

## Data model (new — Prisma / PostgreSQL 16, decimal-safe, UTC)

### Enums
- `MilestoneType`: `TARGET_WEIGHT`, `WEIGHT_LOSS_AMOUNT`, `WEIGHT_GAIN_AMOUNT`, `MEAL_LOGGING_DAYS`, `MEAL_LOGGING_STREAK`, `WEIGH_IN_FREQUENCY`, `CALORIE_TARGET_DAYS`, `PROTEIN_TARGET_DAYS`, `WATER_TARGET_DAYS`, `STEP_TARGET_DAYS`, `ACTIVITY_TARGET`, `CUSTOM_NUMERIC`
- `MilestoneStatus`: `DRAFT`, `ACTIVE`, `COMPLETED`, `MISSED`, `CANCELLED`, `PAUSED`
- `BadgeTier`: `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`
- `AchievementCategory`: `LOGGING`, `WEIGHT`, `NUTRITION`, `HYDRATION`, `ACTIVITY`, `MILESTONE`
- `NotificationType`: `MILESTONE_DEADLINE`, `MILESTONE_COMPLETED`, `MILESTONE_MISSED`, `MILESTONE_PROGRESS`, `ACHIEVEMENT_UNLOCKED`, `BADGE_UNLOCKED`
- `ActivityKind`: `WORKOUT`, `WALK`, `RUN`, `CYCLE`, `OTHER`

### Models
- **Milestone**: `id`, `userId`, `title`, `description?`, `type`, `unit?`, `startValue Decimal(10,2)?`, `targetValue Decimal(10,2)`, `currentValue Decimal(10,2) @default(0)`, `dailyThreshold Decimal(10,2)?` (per-day threshold for STEP_TARGET_DAYS and optional overrides), `startDate Date`, `endDate Date?`, `status @default(ACTIVE)`, `completedAt DateTime?`, `progressMethod String?`, `createdAt`, `updatedAt`. Indexes: `[userId,status]`, `[userId,endDate]`. `@@map("milestones")`.
- **MilestoneProgress** (audit): `id`, `milestoneId`, `value Decimal(10,2)`, `method String`, `recordedAt DateTime @default(now())`. Index `[milestoneId,recordedAt]`. FK cascade. `@@map("milestone_progress")`.
- **AchievementDefinition** (catalog, code-seeded): `id`, `code @unique`, `name`, `description`, `category`, `icon String`, `threshold Int?`, `badgeCode String?`, `sortOrder Int @default(0)`. `@@map("achievement_definitions")`.
- **UserAchievement**: `id`, `userId`, `achievementCode`, `unlockedAt`. `@@unique([userId,achievementCode])`, index `[userId]`. `@@map("user_achievements")`.
- **BadgeDefinition** (catalog): `id`, `code @unique`, `name`, `description`, `iconKey String`, `category`, `tier`, `criteria String`, `sortOrder Int @default(0)`. `@@map("badge_definitions")`.
- **UserBadge**: `id`, `userId`, `badgeCode`, `unlockedAt`. `@@unique([userId,badgeCode])`, index `[userId]`. `@@map("user_badges")`.
- **Notification**: `id`, `userId`, `type`, `title`, `body`, `readAt DateTime?`, `milestoneId String?`, `dedupeKey String?`, `createdAt`. Indexes `[userId,readAt]`, `[userId,createdAt]`, `@@unique([userId,dedupeKey])`. `@@map("notifications")`.
- **WaterEntry**: `id`, `userId`, `entryDate Date`, `volumeMl Int`, `createdAt`, `updatedAt`. Index `[userId,entryDate]`. Multiple per day; summed. `@@map("water_entries")`.
- **ActivityEntry**: `id`, `userId`, `entryDate Date`, `kind ActivityKind`, `steps Int?`, `durationMin Int?`, `note String?`, `createdAt`, `updatedAt`. Index `[userId,entryDate]`. `@@map("activity_entries")`.

`User` gains relations: `milestones`, `userAchievements`, `userBadges`, `notifications`, `waterEntries`, `activityEntries`. No existing field is altered.

## Progress & completion logic (all backend-verified)

- **Weight (`TARGET_WEIGHT`/`WEIGHT_LOSS_AMOUNT`/`WEIGHT_GAIN_AMOUNT`):** baseline = weight at/just before `startDate` (or explicit `startValue`). Current = **7-day moving average** of `WeightEntry` when ≥3 entries in the last 7 days, else most recent valid entry. `progressMethod` records `moving_avg_7d` or `latest_entry`. **Completion:** moving average reaches target, OR two consecutive entries within tolerance (±0.2 kg) of target. Never complete from a single outlier if history exists.
- **Count-based** (`MEAL_LOGGING_DAYS`, `WEIGH_IN_FREQUENCY`, `CALORIE_TARGET_DAYS`, `PROTEIN_TARGET_DAYS`, `WATER_TARGET_DAYS`, `STEP_TARGET_DAYS`, `ACTIVITY_TARGET`): count of distinct qualifying days (user timezone) inside `[startDate, endDate]`. Thresholds: calorie/protein/water from `NutritionGoal` for that day; steps from `Milestone.dailyThreshold`; activity counts entries. Complete when count ≥ `targetValue`.
- **`MEAL_LOGGING_STREAK`:** longest run of consecutive days with ≥1 CONFIRMED meal in the window; complete when ≥ `targetValue`.
- **`CUSTOM_NUMERIC`:** progress set via authenticated `POST /api/milestones/[id]/progress`; complete when `currentValue ≥ targetValue`.
- **Percent** = `clamp((current - start) / (target - start), 0, 1) * 100`.
- **MISSED:** ACTIVE milestone past `endDate` without completion → status `MISSED` (non-punitive notification).

## Safe evaluation
- On create, compute implied weekly rate for weight goals; **warning** (not block) when > ~1.0 kg/week. Hard-block only technically-invalid input (`targetValue ≤ 0`, `endDate < startDate`, non-numeric). Never auto-lower calorie targets. Neutral, supportive copy.
- Disclaimer wherever progress shown: *"Οι εκτιμήσεις προόδου είναι ενημερωτικές και δεν αντικαθιστούν συμβουλή γιατρού ή διαιτολόγου."*

## Central services (no achievement logic in UI)
`MilestoneService`, `MilestoneProgressService`, `AchievementService`, `BadgeAwardService`, `NotificationService`, plus deterministic `suggestMilestones`. Pure libs: `lib/milestone-progress.ts`, `lib/achievements-catalog.ts`. Orchestrator `evaluateGoalsForUser(userId)` (idempotent) called on Goals-page read + best-effort after key writes.

## Achievements & badges
Catalog defined in `lib/achievements-catalog.ts` (source of truth), upserted idempotently into `AchievementDefinition`/`BadgeDefinition` on evaluation. Covers all listed achievements (Logging / Weight / Nutrition / Hydration & Activity / Milestones) with category, icon key, optional badge (tier bronze→platinum), human-readable criteria. Badges: awarded only by backend verification, idempotent (`@@unique`), never revoked, timestamped, shown on profile/goals page. No image bytes in DB — only `iconKey`.

## Notifications
In-app only. Deduped via `dedupeKey` (e.g. `milestone:{id}:progress:50`). Types: deadline-approaching, completed, missed, progress 25/50/75/100, achievement unlocked, badge unlocked. Non-punitive missed copy. Surfaced on Goals page (list + unread count) and a small dashboard indicator. `POST /api/notifications/read` marks read.

## API (all authed + ownership `where {id,userId}` → NOT_FOUND)
`POST/GET /api/milestones`, `GET/PATCH /api/milestones/[id]`, `POST /api/milestones/[id]/pause`, `/cancel`, `/progress`, `GET /api/milestones/suggestions`, `GET /api/achievements`, `GET /api/badges`, `GET /api/notifications`, `POST /api/notifications/read`, `POST/GET /api/water`, `POST/GET /api/activity`. Reuse existing http helpers, guards, Zod, `requireWriteAccess`.

## UI
- New page **«Στόχοι και Επιτεύγματα»** at `/goals/achievements`: active/completed/missed milestones with progress bars, deadlines, remaining amount; create (templates + custom + realism warning); recent achievements; badge collection (unlocked + locked-with-description); suggested next milestone; notifications list.
- Dashboard: compact widget — top active milestone + progress + most recent achievement only.
- Minimal water/activity logging UI (buttons/inputs).
- i18n el + en for every new string (Greek is source).

## Suggested milestones (deterministic, no AI)
From profile + history: e.g. "log weight 3× this week", "log all main meals for 5 days", "hit water target 4 days this week". Computed deterministically.

## Migration & testing
- Non-destructive, idempotent migration (`IF NOT EXISTS`, enum guards) — same style as the meal-history migration. No existing data touched.
- Tests: milestone creation, invalid date range, weight-loss/gain progress, moving-average, logging streak, water/protein target days, completion verification, missed handling, achievement idempotency, badge uniqueness, cross-user isolation (IDOR), timezone boundaries, deadline calc, notification creation.

## Constraints (inherited from repo)
- Not a git repo → "Checkpoint" (re-run tests) instead of commit.
- UNC/npm → build/test on a **local mirror**, robocopy back; deploy via NAS SSH + Docker (entrypoint auto-runs `prisma migrate deploy`).
- User isolation mandatory; macros `null`=unknown; i18n el+en; UTC timestamps; decimal-safe.
