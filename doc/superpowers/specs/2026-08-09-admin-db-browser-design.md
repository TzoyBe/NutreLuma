# Admin DB Browser — Design Spec

**Date:** 2026-08-09
**App:** NutreLuma (nutreluma) — Next.js 15 App Router, Prisma/Postgres, Vitest.
**Status:** Approved for implementation (single pass).

## Goal

An in-app, ADMIN-only database browser at `/admin/db` to view, edit and delete rows of
any Prisma model. Generic (DMMF-driven) so new models are covered automatically. No raw
SQL, no row creation (out of scope).

## Security (full-database access — must be tight)

- Every page and API route requires `user.role === 'ADMIN'`; unauthorized → `notFound()`
  (never reveal the page exists), matching `/admin/users`.
- `assertSameOrigin` on every mutation (CSRF); `requireApiUser` + role check on all routes.
- Model whitelist derived from `Prisma.dmmf.datamodel.models` — only real models map to a
  delegate; anything else → 404.
- Audit log on every update/delete via `logger.info` (model, id, adminUserId, changed keys).
- Read-only fields: `id`, `createdAt`, `updatedAt`, and relation (object/list) fields.
- Sensitive scalar fields (`passwordHash`, `tokenHash`) are masked as `••••` in the view and
  not editable.
- Delete requires explicit confirmation; UI warns cascade deletes may occur.

## Backend

`src/lib/admin-db-meta.ts` (pure, DMMF-driven, unit-tested):
- `listModelMeta()` → `ModelMeta[]` `{ name, delegate, pkField|null, fields: FieldMeta[] }`.
- `FieldMeta` `{ name, kind: 'scalar'|'enum'|'object', type, isList, isRequired, editable, sensitive, enumValues? }`.
- `coerceValue(field, raw)` → typed value for Prisma (String/Int/Float/Decimal/Boolean/
  DateTime/Json/enum, `null` when empty & nullable). Throws on invalid.
- `delegateName(modelName)` → camelCase.
- Constants: `READONLY_FIELDS`, `SENSITIVE_FIELDS`.

`src/server/services/admin-db.ts`:
- `listModels()`, `listRows(model, {page, pageSize, search})` (+ total count, masking),
  `updateRow(model, id, data, adminId)`, `deleteRow(model, id, adminId)`.
- Rejects unknown models and read-only fields; only single-`id` PK models are editable.

`src/lib/validation/admin-db.ts` (zod): `rowsQuerySchema` (page≥1, pageSize 1..100, search?),
`updateRowSchema` (record of field→string|null|boolean).

## API (`src/app/api/admin/db/*`)

- `GET /models` — model list + counts.
- `GET /[model]` — rows (page/pageSize/search).
- `PATCH /[model]/[id]` — update.
- `DELETE /[model]/[id]` — delete.
All ADMIN-gated + CSRF on mutations.

## UI (`/admin/db`, existing design system)

Server page (ADMIN gate) → client `AdminDbBrowser`: left model list (with counts), right
paginated table + search; row click opens an editor panel with typed inputs
(checkbox/Boolean, textarea/Json, select/enum, masked/readonly for sensitive & managed
fields); Save (PATCH) and Delete (confirm). Toasts + inline Prisma errors. Link added from
`/admin/users`.

## Tests

Coercion per type + null; whitelist rejects unknown model; read-only/sensitive fields
stripped from updates; pagination bounds; masking applied in list output.

## Delivery

tsc clean, vitest green, `next build` ✓, no TODOs/placeholders.
