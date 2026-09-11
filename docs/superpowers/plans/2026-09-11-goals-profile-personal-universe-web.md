# Goals & Profile Personal Universe Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the web Goals and Profile primary experiences around a simple, animated Personal Universe hierarchy while preserving every existing operation.

**Architecture:** Keep data fetching in the existing server route components and stateful mutations in the existing client boundaries. Add focused presentational components and pure summary helpers, then apply narrowly scoped CSS classes that reuse the current NutreLuma glass tokens and reduced-motion fallback.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Lucide React

**Spec:** `docs/superpowers/specs/2026-09-11-goals-profile-personal-universe-design.md`

## Global Constraints

- No backend endpoint, Prisma schema, or business-rule changes.
- Preserve all current Goals, Profile, Coaching, Plan, Account, billing, export, password, and deletion operations.
- Use the existing CSS token system, `Card`, `buttonVariants`, and field components.
- Decorative layers must use `aria-hidden="true"`; controls require visible keyboard focus.
- Disable decorative motion under `prefers-reduced-motion: reduce`.
- Keep narrow mobile web layouts free of horizontal page scrolling.

---

### Task 1: Goals summary model and orbital hero

**Files:**
- Create: `apps/web/src/components/goals/goals-universe-model.ts`
- Create: `apps/web/src/components/goals/goals-universe.tsx`
- Create: `apps/web/tests/unit/goals-universe-model.test.ts`
- Modify: `apps/web/src/app/(app)/goals/page.tsx`

**Interfaces:**
- Produces: `buildGoalUniverseModel(input: GoalUniverseInput): GoalUniverseModel`
- Produces: `GoalsUniverse({ model }: { model: GoalUniverseModel }): React.ReactElement`
- Consumes: current goal, suggestion, achievements, badges, and milestones from existing services.

- [ ] **Step 1: Write the failing model test**

```ts
import { describe, expect, it } from 'vitest';
import { buildGoalUniverseModel } from '@/components/goals/goals-universe-model';

describe('buildGoalUniverseModel', () => {
  it('derives progress counts and keeps nullable macro targets explicit', () => {
    expect(buildGoalUniverseModel({
      calorieTarget: 2100,
      proteinGrams: 132,
      carbohydrateGrams: null,
      fatGrams: 70,
      achievementsUnlocked:4,
      achievementsTotal:12,
      badgesUnlocked:3,
      activeMilestones:2,
      historyCount:6,
    })).toEqual({
      calories:2100,
      macros:[
        { key:'protein', label:'Protein', value:132, unit:'g', tone:'cyan' },
        { key:'carbohydrate', label:'Carbs', value:null, unit:'g', tone:'gold' },
        { key:'fat', label:'Fat', value:70, unit:'g', tone:'violet' },
      ],
      journey:{ achievements:'4/12', badges:'3', activeMilestones:'2', history:'6' },
    });
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `cd apps/web && corepack pnpm test -- tests/unit/goals-universe-model.test.ts`

Expected: FAIL because `goals-universe-model.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

Create literal `GoalUniverseInput`, `GoalUniverseModel`, and `buildGoalUniverseModel` exports matching the tested shape. Do not add formatting or locale work to the helper.

- [ ] **Step 4: Run the model test**

Run: `cd apps/web && corepack pnpm test -- tests/unit/goals-universe-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Implement `GoalsUniverse`**

Render one `Card` with:

```tsx
<section className="goals-universe glass-specular" aria-labelledby="goals-universe-title">
  <div className="universe-app-orbit" aria-hidden="true" />
  <div className="goals-universe-center">
    <span>{model.calories ?? '--'}</span><span>kcal</span>
  </div>
  {model.macros.map((macro) => <div key={macro.key} data-tone={macro.tone}>...</div>)}
</section>
```

Keep every data label visible as text, not encoded only by color.

- [ ] **Step 6: Extend the server loader and replace the old target block**

Import `listAchievements`, `listBadges`, and `listMilestones`; fetch them in the existing `Promise.all`. Compute unlocked/active counts, build the model, render `GoalsUniverse`, and replace the two plain destination cards with a compact journey strip. Preserve links to `/goals/achievements` and `/maintenance`.

- [ ] **Step 7: Run focused tests and typecheck**

Run: `cd apps/web && corepack pnpm test -- tests/unit/goals-universe-model.test.ts && corepack pnpm typecheck`

Expected: PASS with zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/goals/goals-universe-model.ts apps/web/src/components/goals/goals-universe.tsx apps/web/src/app/\(app\)/goals/page.tsx apps/web/tests/unit/goals-universe-model.test.ts
git commit -m "feat(web): add goals universe summary"
```

---

### Task 2: Goals progressive editor and smart-action hierarchy

**Files:**
- Modify: `apps/web/src/components/goals/goals-panel.tsx`
- Create: `apps/web/tests/unit/goals-panel.test.ts`

**Interfaces:**
- Consumes: existing `GoalValues`, `GoalSuggestionValues`, and `GoalHistoryRow` props unchanged.
- Produces: a collapsed initial state with `Edit goals`, optional `Use suggestion`, expandable form, smart ideas/history below.

- [ ] **Step 1: Write the failing server-render behavior test**

Mock `next/navigation`, toast, and translation hooks as in `admin-user-list.test.ts`; render `GoalsPanel` with `renderToStaticMarkup`. Assert the initial HTML contains `Edit goals` and does not contain `id="calorieTarget"`.

- [ ] **Step 2: Run the focused test**

Run: `cd apps/web && corepack pnpm test -- tests/unit/goals-panel.test.ts`

Expected: FAIL because the calorie editor is currently rendered immediately.

- [ ] **Step 3: Add collapsed editor state**

Add `const [editing, setEditing] = React.useState(false)`. Render the form only when editing, add a button with `aria-expanded={editing}` and `aria-controls="daily-goals-editor"`, and close the editor after a successful save. Applying a suggestion must populate fields and open the editor.

- [ ] **Step 4: Simplify secondary content**

Keep at most six goal-history rows visible, move history under a quiet `Card`, and place explanatory copy below—not between—the primary actions. Do not change API payload construction or error mapping.

- [ ] **Step 5: Run focused and existing goal tests**

Run: `cd apps/web && corepack pnpm test -- tests/unit/goals-panel.test.ts tests/unit/goals-evaluator.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/goals/goals-panel.tsx apps/web/tests/unit/goals-panel.test.ts
git commit -m "feat(web): simplify goals editing"
```

---

### Task 3: Profile identity hero and edit-on-demand flow

**Files:**
- Create: `apps/web/src/components/profile/profile-universe-model.ts`
- Create: `apps/web/src/components/profile/profile-universe.tsx`
- Create: `apps/web/tests/unit/profile-universe-model.test.ts`
- Modify: `apps/web/src/app/(app)/profile/page.tsx`
- Modify: `apps/web/src/components/profile/profile-tabs.tsx`

**Interfaces:**
- Produces: `buildProfileUniverseModel(input: ProfileUniverseInput): ProfileUniverseModel`
- Produces: `ProfileUniverse({ model }: { model: ProfileUniverseModel }): React.ReactElement`
- Extends `ProfileTabs` with `profileSummary` and `profileEditor` slots while preserving the four existing tab keys.

- [ ] **Step 1: Write the failing profile model test**

```ts
import { describe, expect, it } from 'vitest';
import { buildProfileUniverseModel } from '@/components/profile/profile-universe-model';

describe('buildProfileUniverseModel', () => {
  it('creates a compact identity and health summary', () => {
    expect(buildProfileUniverseModel({
      displayName:'Ada Lovelace', email:'ada@example.com', dailyTarget:1900,
      age:31, bmi:{ value:22.4, label:'Healthy' }, currentWeightKg:64,
      targetWeightKg:61, activityLevel:'MODERATE', goal:'LOSE',
    })).toMatchObject({ initials:'AL', dailyTarget:'1900', age:'31', bmi:'22.4' });
  });
});
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `cd apps/web && corepack pnpm test -- tests/unit/profile-universe-model.test.ts`

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement model and hero**

Derive at most two initials, string fallbacks (`'--'`), and explicit health-summary items. `ProfileUniverse` renders name, email, daily target, plan/status input, and compact summary chips in one labeled glass section.

- [ ] **Step 4: Add edit-on-demand state to `ProfileTabs`**

Within the Profile tab, show `profileSummary` by default and a button labeled `Edit profile`. The button controls a panel with `aria-expanded`/`aria-controls`; the panel contains the existing `ProfileForm` plus daily water/steps settings where currently available. Preserve Coaching, Plan, and Account slot behavior.

- [ ] **Step 5: Recompose the server profile page**

Build the model from existing user/profile values, render `ProfileUniverse` above the tabs, pass compact health summary into `profileSummary`, and pass the current `ProfileForm` card into `profileEditor`. Keep billing, intelligence, admin links, legal links, export, password, and danger-zone content unchanged.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `cd apps/web && corepack pnpm test -- tests/unit/profile-universe-model.test.ts tests/unit/i18n-parity.test.ts && corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/profile/profile-universe-model.ts apps/web/src/components/profile/profile-universe.tsx apps/web/src/components/profile/profile-tabs.tsx apps/web/src/app/\(app\)/profile/page.tsx apps/web/tests/unit/profile-universe-model.test.ts
git commit -m "feat(web): redesign profile universe"
```

---

### Task 4: Shared application glass motion and responsive polish

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/el.ts`
- Test: `apps/web/tests/unit/i18n-parity.test.ts`

**Interfaces:**
- Produces CSS classes: `.universe-app-hero`, `.universe-app-orbit`, `.universe-app-particle`, `.universe-app-reveal`, `.universe-app-chip`, `.universe-app-tabs`.

- [ ] **Step 1: Add translation keys symmetrically**

Add matching EL/EN keys for the new visible action and summary labels: edit/close goals, edit/close profile, journey, active milestones, and profile summary. Keep English fallback copy concise and Greek copy natural.

- [ ] **Step 2: Run parity test**

Run: `cd apps/web && corepack pnpm test -- tests/unit/i18n-parity.test.ts`

Expected: PASS; deliberately remove one new key locally to confirm the test detects asymmetry, then restore it before continuing.

- [ ] **Step 3: Add scoped styling and motion**

Use the existing variables `--glass-bg`, `--glass-border`, `--liquid-edge`, `--liquid-depth`, `--primary`, and `--brand-purple`. Add one slow `universe-app-drift` keyframe and one short `universe-app-enter` keyframe. Limit blur to hero/card surfaces; use transforms and opacity for animation.

- [ ] **Step 4: Add reduced-motion and fallback rules**

```css
@media (prefers-reduced-motion: reduce) {
  .universe-app-orbit,
  .universe-app-particle,
  .universe-app-reveal { animation: none !important; transform: none !important; }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .universe-app-hero { background: hsl(var(--card) / 0.98); }
}
```

- [ ] **Step 5: Verify responsive class behavior**

Confirm the orbital hero uses `clamp()` sizing, chips wrap, segmented tabs scroll or compress without clipping, and no decorative layer can capture pointer events.

- [ ] **Step 6: Run complete web verification**

Run: `cd apps/web && corepack pnpm test && corepack pnpm typecheck && corepack pnpm build`

Expected: all tests pass, TypeScript exits 0, and Next production build exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/i18n/en.ts apps/web/src/i18n/el.ts apps/web/tests/unit/i18n-parity.test.ts
git commit -m "feat(web): polish personal universe motion"
```

---

### Task 5: Web visual review and NAS deployment

**Files:**
- Modify only files required by issues found during review.

**Interfaces:**
- Produces: verified production web deployment at `https://nutreluma.com`.

- [ ] **Step 1: Review narrow and desktop layouts**

Use representative widths near 390px and 1440px. Verify Goals/Profile hierarchy, focus states, tab overflow, expanded editors, empty states, and reduced motion. Capture screenshots when the runtime supports authenticated state.

- [ ] **Step 2: Fix only observed visual or accessibility defects**

For each defect, write or extend the closest behavior test first when the defect is mechanically testable, then apply the smallest correction.

- [ ] **Step 3: Re-run complete web verification**

Run: `cd apps/web && corepack pnpm test && corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 4: Push verified commits**

Run: `git push origin main`

Expected: remote `main` advances without force-push.

- [ ] **Step 5: Deploy and verify**

Run on NAS: `sh /share/CACHEDEV1_DATA/Container/nutreluma/apps/web/deploy.sh`

Expected: Docker build exit 0, migrations applied/no pending migrations, `curl -fsS https://nutreluma.com/api/health` returns `{"status":"ok","database":"up"}`, and the active container contains the new Goals/Profile build artifacts.
