#!/bin/sh
set -eu

# One-time migration/deploy from the old calorievision Docker project to NutreLuma.
# Run on the NAS:
#   sh /share/Container/nutreluma/deploy-rename-from-calorievision.sh
#
# It creates a fresh NutreLuma DB volume, copies old DB data and uploads, builds the
# new image, switches traffic, and rolls back the old stack if the new healthcheck fails.

export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy
export DOCKER_CONFIG=$HOME/.docker
mkdir -p "$DOCKER_CONFIG"

find_project_dir() {
  name="$1"
  if [ -d "/share/CACHEDEV1_DATA/Container/$name" ]; then
    printf '%s\n' "/share/CACHEDEV1_DATA/Container/$name"
  elif [ -d "/share/Container/$name" ]; then
    printf '%s\n' "/share/Container/$name"
  else
    echo "ERROR: cannot find project folder: $name" >&2
    exit 1
  fi
}

OLD_DIR="$(find_project_dir calorievision)"
NEW_DIR="$(find_project_dir nutreluma)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$NEW_DIR/backups"
DUMP_FILE="$BACKUP_DIR/calorievision-to-nutreluma-$STAMP.sql"

old_compose() {
  cd "$OLD_DIR"
  if [ -f docker-compose.tunnel.yml ]; then
    docker compose --env-file .env -f docker-compose.yml -f docker-compose.tunnel.yml "$@"
  else
    docker compose --env-file .env "$@"
  fi
}

new_compose() {
  cd "$NEW_DIR"
  if [ -f docker-compose.tunnel.yml ]; then
    docker compose --env-file .env -f docker-compose.yml -f docker-compose.tunnel.yml "$@"
  else
    docker compose --env-file .env "$@"
  fi
}

rollback_old() {
  echo "!! New NutreLuma healthcheck failed. Rolling old calorievision stack back up..."
  old_compose up -d
}

echo "==> Old project: $OLD_DIR"
echo "==> New project: $NEW_DIR"

if docker ps -a --format '{{.Names}}' | grep -qx 'nutreluma-db'; then
  echo "ERROR: nutreluma-db already exists. Refusing to overwrite an existing NutreLuma DB container." >&2
  echo "       Remove the failed NutreLuma stack manually only after taking a backup, then rerun." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> Dumping old calorievision database..."
old_compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' > "$DUMP_FILE"
ls -lh "$DUMP_FILE"

echo "==> Starting new NutreLuma database..."
cd "$NEW_DIR"
docker compose --env-file .env up -d db

echo "==> Waiting for nutreluma-db to become healthy..."
i=1
while [ "$i" -le 60 ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' nutreluma-db 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 2
  i=$((i + 1))
done
[ "$(docker inspect -f '{{.State.Health.Status}}' nutreluma-db 2>/dev/null || true)" = "healthy" ] || {
  echo "ERROR: nutreluma-db did not become healthy." >&2
  exit 1
}

echo "==> Restoring old data into nutreluma_app..."
docker compose --env-file .env exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP_FILE"

echo "==> Copying uploads volume..."
docker volume create nutreluma_uploads_data >/dev/null
docker run --rm \
  -v calorievision_uploads_data:/from:ro \
  -v nutreluma_uploads_data:/to \
  alpine sh -c 'cd /from && tar cf - . | tar xf - -C /to'

echo "==> Building NutreLuma web image..."
docker compose --env-file .env build web

echo "==> Stopping old calorievision stack..."
old_compose down

echo "==> Starting NutreLuma stack..."
cd "$NEW_DIR"
new_compose up -d

echo "==> Waiting for NutreLuma health..."
i=1
ok=0
while [ "$i" -le 60 ]; do
  if curl -fsS http://127.0.0.1:8095/api/health >/tmp/nutreluma-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
  i=$((i + 1))
done

if [ "$ok" -ne 1 ]; then
  new_compose logs --tail=120 web || true
  new_compose down || true
  rollback_old
  exit 1
fi

echo "==> Health OK:"
cat /tmp/nutreluma-health.json
echo

echo "==> Granting ADMIN to tzoybe@msn.com..."
docker compose --env-file .env exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
UPDATE users SET role = 'ADMIN' WHERE email = 'tzoybe@msn.com';
SELECT email, role FROM users WHERE email = 'tzoybe@msn.com';
SQL

echo "==> Done. Verify https://nutreluma.com, then delete the old folder only after manual confirmation:"
echo "    rm -rf \"$OLD_DIR\""
