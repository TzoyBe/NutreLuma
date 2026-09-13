# Orbital Aurora Dashboard Design Spec

## Source

- Visual reference: `C:\Users\TzoyBe\Downloads\ChatGPT Image Sep 13, 2026, 02_02_43 PM.png`
- Product brief: `C:\Users\TzoyBe\.codex\attachments\a2081691-50ea-484c-936f-7f23671181fd\pasted-text.txt`

The attached material is treated as product and visual guidance. Repository conventions, existing data contracts, accessibility requirements, and the user's explicit branch instructions remain authoritative.

## Required outcome

Build a responsive native and web dashboard inspired by the reference's orbital composition while preserving NutreLuma's live data and existing actions.

- Dark navy cosmic canvas with restrained blue, cyan, violet, emerald, and amber glow.
- Brand header, time-aware greeting, notification control, and current date navigation.
- Two concise insight cards derived from current dashboard state.
- Central calorie planet with four macro satellites and visible orbital paths.
- Water and steps controls below the main orbit, retaining the existing write behavior for today.
- Focus summary card and access to today's meals and existing secondary content.
- Mobile navigation reads Home, Insights, Add Meal, Recipes, Profile, with Add Meal visually elevated.
- Desktop/web layout expands horizontally without losing the orbital hierarchy.
- Reduced-motion support and accessible names for interactive controls.

## Constraints

- No new backend or API endpoints.
- Do not hard-code the reference values; render real dashboard data and targets.
- Do not merge into `main`; work and push only on `feat/orbital-aurora-dashboard`.
- Avoid new runtime dependencies unless the existing stack cannot express the design.
