# Progress / History / Stats / Insights — Universe Theme Redesign

**Date:** 2026-09-12
**App:** NutreLuma (`\\tzoybe-nas\Container\nutreluma`, apps/web + apps/native)
**Status:** Approved — proceeding to implementation plan.

## Goal

Bring the four remaining non-themed pages — **Progress**, **History**, **Stats**, **Insights** — onto the same "universe" visual language already used by Recipes/Profile/Goals (web) and Recipes/Goals (native): an orbital hero card with a headline stat and 3-4 tone-coded satellite metrics, sitting above the page's existing functional content. No functional content is rebuilt — charts, filters, and lists stay exactly as they are today, only visually re-skinned to the shared tone palette.

## Non-goals

- No new backend endpoints, no new Prisma models, no new queries beyond what each page already fetches (Progress's teaser satellites reuse existing history/stats/insights fetch functions).
- No change to chart/filter/list *behavior* — only wrapping/restyling.
- No shared `components/universe/` package extraction — follows the existing per-feature duplication convention (`recipes-universe.tsx` + `recipes-universe-model.ts`, `goals-universe.tsx` + `goals-universe-model.ts`, etc.).

## Reference pattern (existing code, verified)

**Web** — `components/recipes/recipes-universe-model.ts` exports `buildRecipeUniverseModel(input) -> { calories, macros: [{key,label,value,unit,tone}], journey: {...} }`. `components/recipes/recipes-universe.tsx` renders it inside a `<Card className="recipes-universe-card universe-app-hero universe-app-reveal">` with a `.recipes-universe` orbital section (center hero number + positioned macro satellites via `data-tone`). The page (`app/(app)/recipes/page.tsx`) renders `<RecipesUniverse>` first, then a small 2-col "journey strip" `Card` for secondary stats, then the existing functional panels unchanged.

**Native** — `src/personal-universe-model.ts` exports the same-shaped `buildNativeRecipeUniverse(input) -> NativeRecipeUniverseModel` (`NativeUniverseTone = 'cyan'|'gold'|'violet'|'emerald'|'blue'`). `src/personal-universe-ui.tsx` exports `<UniverseHero eyebrow title subtitle center satellites accessibilityLabel>` (glass card, orbital drift animation, `useReducedMotionPreference`-gated) and `<UniverseMetric label value unit tone>`. `RecipesOverviewScreen` in `App.tsx` (~line 4073) renders `<UniverseHero center={<calories>} satellites={macros.map(...)} />` followed by extra `<UniverseMetric>`s for journey stats, then existing screen content unchanged.

Both platforms follow this exact shape: `{ hero: number|null, satellites: Array<{key,label,value,unit?,tone}> }`. The new pages copy this shape 1:1.

## Architecture

**Web**: for each of the four pages, add:
- `components/{page}/{page}-universe-model.ts` — `build{Page}UniverseModel(input): {Page}UniverseModel`
- `components/{page}/{page}-universe.tsx` — presentational component, same Card/orbital structure as `RecipesUniverse`

The page's `page.tsx` computes the model from data it already fetches, renders `<{Page}Universe>` first, then existing content unchanged below.

**Native**: for each of the four `*Screen` components in `App.tsx`, add a `buildNative{Page}Universe(input)` function to `src/personal-universe-model.ts` (co-located with the existing ones, same file — it's already the shared model file for all native universe screens), then render `<UniverseHero>` + `<UniverseMetric>` satellites at the top of the screen using data the screen already fetches, with existing screen content unchanged below.

## Hero / satellite mapping

| Page | Hero | Satellites | Data source (already fetched) |
|---|---|---|---|
| **Progress** (hub) | Current weight vs. target (delta, kg) | Week total kcal → taps to History; avg7 kcal → taps to Stats; calibration score % → taps to Insights | `listWeightEntries` + profile target (existing); teaser numbers via the same fetch functions History/Stats/Insights already use |
| **History** | Day total kcal | Week total, week average, month average (kcal) | Existing `StatTile`/header data (web), existing header/meal-list totals (native) |
| **Stats** | avg7 kcal | avg30 kcal, week total kcal, days-within-target % | Existing `StatTile`/`MetricCard` data |
| **Insights** | Calibration score % | Data confidence score %, 30-day correction rate %, energy-estimate confidence % | Existing `Metric`/`MetricCard` data |

Tone assignment follows existing convention: 3 satellites get `cyan`/`gold`/`violet` in that order; a 4th (Progress's third teaser, Stats' 4th metric) gets `emerald`. Progress's three satellites are tappable (native: `Pressable` wrapping `UniverseMetric`; web: satellite wrapped in a `Link`) since they're navigational teasers, unlike the other three pages' satellites which are purely informational (matching how Recipes' journey-strip stats are non-interactive today).

## Data flow

No new server queries. Each page/screen's existing data-fetching (already used to render its `StatTile`/`MetricCard`/chart data) is read once and mapped into the `build{Page}Universe` input shape. Progress is the only page gaining new reads — three small numbers borrowed from the History/Stats/Insights fetch functions (called directly, not via HTTP, since Progress is itself a server component on web / a screen with access to the same API client on native).

## Error handling

Same as existing pattern: hero/satellite values that can't be computed (e.g. no weight entries yet, no meals logged) render `'--'`/`null` exactly like `RecipesUniverse` does for `hasPlan: false` — no error states, no loading spinners beyond what the page already has (data is fetched server-side on web, screen-load on native, same as today).

## Testing

- Web: one unit test per new `*-universe-model.ts` (`build{Page}UniverseModel`) covering the null/zero-data case and a populated case — mirrors existing `notifications-cron.test.ts` style (plain vitest, no component rendering needed since the model is pure).
- Native: same — one test per `buildNative{Page}Universe` in `apps/native` vitest suite.
- No new integration/e2e tests; existing page/screen tests (if any) continue to cover the unchanged functional content.
- Manual verification: `npm run build --webpack` (web) and `npm run typecheck` (native) must pass; visually spot-check each of the 4 pages/screens in the browser/simulator before commit.

## Rollout

Single implementation pass covering all 4 pages × 2 platforms (per user's choice), in this order to build confidence early: **Stats → History → Insights → Progress** (Progress last since it's the only one needing the cross-page teaser data). One commit per page (8 commits) or one combined commit — decided at implementation time based on how cleanly each page separates. Push to `main` on completion, matching this project's "always commit and deploy" convention. No NAS deploy needed for native (ships via next EAS build); web changes get the standard `deploy.sh` NAS deploy.
