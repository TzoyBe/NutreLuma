#!/bin/sh
set -e

echo "[entrypoint] NutreLuma starting (NODE_ENV=${NODE_ENV:-development})"

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "replace_with_secure_random_value" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "[entrypoint] ERROR: AUTH_SECRET must be set to a strong random value." >&2
    exit 1
  fi
  echo "[entrypoint] WARNING: AUTH_SECRET is using the placeholder value."
fi

mkdir -p "${UPLOAD_DIR:-/app/uploads}"

# Εφαρμογή migrations (idempotent). Ο βρόχος καλύπτει και την αναμονή για τη βάση.
attempt=1
until npx prisma migrate deploy; do
  if [ $attempt -ge 15 ]; then
    echo "[entrypoint] ERROR: prisma migrate deploy failed after $attempt attempts." >&2
    exit 1
  fi
  echo "[entrypoint] migrate deploy failed (attempt $attempt) - retrying in 3s..."
  attempt=$((attempt+1))
  sleep 3
done
echo "[entrypoint] migrations applied."

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] running seed..."
  npm run db:seed || echo "[entrypoint] seed failed (continuing)"
fi

exec "$@"
