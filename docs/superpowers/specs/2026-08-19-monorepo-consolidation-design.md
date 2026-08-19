# NutreLuma monorepo consolidation — design

Date: 2026-08-19

## Goal

Consolidate the separate `Container/nutreluma` (web + backend) and
`Container/nutreluma-native` (Expo mobile) folders into a single `nutreluma/`
monorepo with a conventional `apps/*` layout, **without** breaking runtime
functionality, the NAS Docker deploy, or the Cloudflare Tunnel.

## Decisions

- **Scope:** web + native only. The Capacitor wrapper `nutreluma-mobile` was
  already archived to `nutreluma-mobile.zip` and removed; it stays out of the repo.
- **Layout:** `nutreluma/apps/{web,native}`. No npm workspaces / shared packages
  yet (YAGNI — no shared code to extract).
- **Repo root:** move the git root down so `repo root == nutreluma/` via
  `git filter-repo --subdirectory-filter nutreluma` + force-push (history preserved,
  hashes rewritten). Done from a fast local clone, not over the SMB share.

## Non-breaking guarantees

- Compose `name: nutreluma` is unchanged → named volumes
  `nutreluma_db_data` / `nutreluma_uploads_data` reattach → **DB + uploads preserved**.
- Docker build context stays `.` (now `apps/web`).
- Cloudflare Tunnel talks to the `web` container inside the Docker network
  (token-based, not path-based) → unaffected by the folder move.
- Deploy logic identical; only the **path** changes to `apps/web`.

## Changes

- `apps/web/deploy.sh`: `cd …/Container/nutreluma/apps/web`; SSH command updated.
- `codemagic.yaml` (repo root): `cd nutreluma-native` → `cd apps/native`.
- Root config files (`.gitignore`, `.dockerignore`, `.env.example`, `codemagic.yaml`)
  moved into the monorepo root.
- Hardened `.gitignore` (backups/, *.zip, *.tar.gz, tsbuildinfo).

## Safety

- Full backup taken first: `Container/backups/nutreluma-premerge-*.tar.gz`
  (source + `.git` history + `.env` secrets), verified with `gzip -t`.
- Physical moves done on the NAS via SSH (instant local renames); the live site
  keeps running from its image/volumes throughout.
- Git staging is strictly scoped to `nutreluma/` paths — never a bare `git add -A`
  at the `Container` root (which holds many untracked sibling projects).
- Re-deploy from the new path at the end to verify health.
