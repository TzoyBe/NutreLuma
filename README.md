# NutreLuma — monorepo

Nutrition & calorie-tracking platform. A product of **Joybee Digital**.

## Structure

```
nutreluma/
├─ apps/
│  ├─ web/       Next.js 15 web app + backend (Prisma/Postgres). Live: https://nutreluma.com
│  └─ native/    React Native / Expo mobile app (iOS via Codemagic + EAS)
├─ codemagic.yaml   iOS CI (builds apps/native)
├─ .env.example     Root env reference
└─ .gitignore
```

> The Capacitor wrapper (`nutreluma-mobile`) is archived outside this repo as
> `Container/nutreluma-mobile.zip`; it is a thin remote-URL shell of the live site
> and is no longer version-controlled here.

## Web app — deploy (NAS)

The web app runs on the QNAP NAS via Docker Compose, exposed over a Cloudflare
Tunnel (no open ports). SSH to the NAS and run the one-shot deploy:

```sh
sh /share/CACHEDEV1_DATA/Container/nutreluma/apps/web/deploy.sh
```

This builds/starts the `web` container (project name `nutreluma`, so the existing
`nutreluma_db_data` / `nutreluma_uploads_data` volumes are reused), applies the
Prisma migration via the entrypoint, checks health, and grants ADMIN.

Compose files live in `apps/web/` (`docker-compose.yml`, `docker-compose.tunnel.yml`).
The Cloudflare Tunnel connects outbound to the `web` service inside the Docker
network — it is token-based (`CLOUDFLARE_TUNNEL_TOKEN` in `apps/web/.env`) and not
path-dependent.

## Mobile (native) — build

Codemagic reads `codemagic.yaml` at the repo root and builds `apps/native`
(`cd apps/native`). See `apps/native/README.md` for EAS/Expo details.
