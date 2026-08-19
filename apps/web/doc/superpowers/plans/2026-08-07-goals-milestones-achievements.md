# Goals / Milestones / Achievements — Implementation Plan & Progress Ledger

**Spec:** `docs/superpowers/specs/2026-08-07-goals-milestones-achievements-design.md`
**Local mirror (build/test):** `C:\Users\TzoyBe\AppData\Local\Temp\claude\--tzoybe-nas-Container-\87009f50-0e3e-4a38-86f9-1cd2a518f737\scratchpad\cv-local`
**Workflow:** work in mirror → `npx tsc --noEmit` / `npx vitest run` green → robocopy `src prisma tests` back to NAS → deploy via SSH (entrypoint auto-runs `prisma migrate deploy`).

## How to resume after an interruption
1. Read this ledger's **Progress** section — the last `DONE` line is where to continue.
2. Verify mirror exists + deps installed (`npm ci` in mirror if missing).
3. Re-sync mirror from NAS if unsure: robocopy `src prisma tests` NAS→mirror.
4. Continue at the first unchecked task. Re-run that task's tests before marking DONE.

## Global constraints
- Non-git repo → "Checkpoint" = re-run tests green (no `git`).
- UNC/npm → never `npm` on the UNC path; use the local mirror.
- Every query filters `userId` from session (anti-IDOR). i18n el+en. UTC. Decimal-safe. Macros null=unknown.
- Migration idempotent (`IF NOT EXISTS`, enum guards). Do not alter existing tables' data.

---

## Progress (update after each task)

- [x] Phase 0: spec written + approved; plan + ledger created.
- [x] **Phase 1 — Data model & migration** ✅
  - [x] 1.1 Prisma enums + models (Milestone, MilestoneProgress, AchievementDefinition, UserAchievement, BadgeDefinition, UserBadge, Notification, WaterEntry, ActivityEntry) + User relations
  - [x] 1.2 Idempotent migration SQL (`prisma/migrations/2026080710000_goals_milestones/migration.sql`)
  - [x] 1.3 `prisma validate` + `generate` green; `tsc --noEmit` clean
- [x] **Phase 2 — Pure libs (TDD)** ✅
  - [x] 2.1 `lib/milestone-progress.ts` (percent, 7d moving avg, completion rule, realism/rate) + 17 tests
  - [x] 2.2 `lib/achievements-catalog.ts` (~30 achievements + badges, data-driven metric/threshold) + 4 tests
- [x] **Phase 3 — Logging services (water/activity)** ✅
  - [x] 3.1 `services/water.ts` (+ validation) + tests
  - [x] 3.2 `services/activity.ts` (+ validation) + tests
- [x] **Phase 4 — Milestone + progress services** ✅
  - [x] 4.1 `services/milestones.ts` (CRUD, pause/cancel, realism, suggestions) + tests
  - [x] 4.2 `services/milestone-progress.ts` (compute per type from real data, completion, MISSED, progress notifications) + tests
- [x] **Phase 5 — Achievements / badges / notifications** ✅
  - [x] 5.1 `services/notifications.ts` (create-deduped, list, mark-read, unread) + tests
  - [x] 5.2 `services/badges.ts` (idempotent award) + tests
  - [x] 5.3 `services/achievements.ts` (idempotent evaluation from real data, catalog upsert) + tests
  - [x] 5.4 `services/goals-evaluator.ts` orchestrator `evaluateGoalsForUser` + write hooks (meal confirm, weight, water, activity) best-effort
- [x] **Phase 6 — API routes** (all authed + ownership) ✅
  - [x] 6.1 milestones CRUD + pause/cancel/progress/suggestions
  - [x] 6.2 achievements / badges
  - [x] 6.3 notifications (+read)
  - [x] 6.4 water / activity
- [x] **Phase 7 — UI** ✅
  - [x] 7.1 i18n el+en strings
  - [x] 7.2 `/goals/achievements` page + components (milestones list, create form, badges, notifications, suggestions)
  - [x] 7.3 dashboard compact widget (top milestone + latest achievement)
  - [x] 7.4 minimal water/activity logging UI
- [x] **Phase 8 — Verification & deploy** ✅
  - [x] 8.1 `tsc --noEmit` + full `vitest run` + `next build` green
  - [x] 8.2 robocopy back to NAS
  - [x] 8.3 SSH deploy (rebuild; entrypoint applies migration) + smoke test

---

## Ledger log (append-only)
- 2026-08-07: Phase 0 complete. Spec + plan written. Starting Phase 1.
- 2026-08-07: Phase 3 complete. Water/activity services now runtime-validate tracking inputs, list query ranges/limits are bounded, activity days are distinct for milestone counting, and service/schema tests are green (`tsc --noEmit`, `npx vitest run`).
- 2026-08-07: Phase 4.1 complete. Added milestone validation schemas and `services/milestones.ts` for user-scoped CRUD, pause/resume/cancel, deterministic suggestions, and non-blocking aggressive weight-rate warnings. Checkpoint green (`tsc --noEmit`, `npx vitest run`).
- 2026-08-08: Phase 4.2 complete. Added `services/milestone-progress.ts` for real-data progress computation across weight, logging, nutrition, hydration, steps/activity and custom milestones; persists audit rows and COMPLETED/MISSED state. Checkpoint green (`tsc --noEmit`, `npx vitest run`).
- 2026-08-08: Phase 5 complete. Added notification, badge, achievement, and goals evaluator services with idempotent unlock/award/dedupe behavior and best-effort write hooks. Checkpoint green (`tsc --noEmit`, `npx vitest run`).
- 2026-08-08: Phase 6 complete. Added authenticated API routes for milestones, achievements, badges, notifications, water, and activity with same-origin/write-access protection on mutating endpoints. Checkpoint green (`tsc --noEmit`, `npx vitest run`).
- 2026-08-08: Phase 7 complete and Phase 8.1 verified. Added `/goals/achievements` UI, dashboard widget, quick water/activity logging UI, and el/en strings. Verification green (`tsc --noEmit`, `npx vitest run`, `npx next build`).
- 2026-08-08: Phase 8.2 complete. Robocopied `src`, `prisma`, and `tests` from local mirror back to NAS.
- 2026-08-08: Phase 8.3 blocked. SSH deploy attempt to `TzoyBe@tzoybe-nas` failed with `Permission denied (publickey,password,keyboard-interactive)`, so deploy/smoke test remains unchecked until SSH auth is available or the command is run manually on the NAS.
- 2026-08-08: Phase 8.3 complete. SSH deploy to `192.168.2.249` rebuilt/restarted `nutreluma-web`; entrypoint applied migration `2026080710000_goals_milestones`; smoke test returned `{"status":"ok","database":"up"}`.
- 2026-08-08: Visibility follow-up complete. Added an obvious `/goals` call-to-action to `/goals/achievements`, redeployed with the tunnel compose overlay, and verified both local and public health checks return `{"status":"ok","database":"up"}`.
- 2026-08-08: UX follow-up complete. Redesigned `/goals/achievements` around summary tiles, quick daily logging, one-click smart suggestions, clearer milestone cards, and quieter achievements/badges/notifications side panels. Verification green (`npx next build`, `npx tsc --noEmit`) and public health check returned `{"status":"ok","database":"up"}` after deploy.
