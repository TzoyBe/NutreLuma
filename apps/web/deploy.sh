#!/bin/sh
# One-shot deploy for NutreLuma on the NAS.
# Run inside an SSH session on the NAS with a single command:
#   sh /share/CACHEDEV1_DATA/Container/nutreluma/apps/web/deploy.sh
#
# Does: build+start the web container (with retry), let the entrypoint apply the
# Prisma migration, verify health, then grant ADMIN to tzoybe@msn.com.

export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy
export DOCKER_CONFIG=$HOME/.docker
mkdir -p "$DOCKER_CONFIG"
cd /share/CACHEDEV1_DATA/Container/nutreluma/apps/web || exit 1

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.tunnel.yml --env-file .env"

echo "==> Building & starting (with retry for the known flaky build)..."
n=1; ec=1
while [ $n -le 4 ]; do
  if $COMPOSE up --build -d; then
    ec=0
    break
  else
    ec=$?
  fi
  echo "   build attempt $n failed (exit $ec) - retrying in 3s..."
  n=$((n + 1)); sleep 3
done
echo "==> BUILD EXIT=$ec"
if [ $ec -ne 0 ]; then
  echo "!! Build failed after retries - the OLD image is still running. Fix and re-run."
  exit $ec
fi

# Recreating `web` gives it a new internal Docker network IP. cloudflared
# resolved and cached the old one, so it keeps dialing a dead address and the
# public site 502s until it reconnects. Force that reconnect every deploy.
echo "==> Restarting the Cloudflare tunnel so it picks up the new web container..."
$COMPOSE restart cloudflared

echo "==> Waiting for the app to come up..."
sleep 6
echo "==> Health (local):"
curl -s http://127.0.0.1:8095/api/health; echo
echo "==> Health (public):"
curl -s https://nutreluma.com/api/health; echo
echo "==> Migration log (expect 20260808140000_add_maintenance_mode applied):"
$COMPOSE logs --tail=60 web | grep -i "migrat" || echo "   (no migrate lines found in last 60 log lines)"

echo "==> Granting ADMIN to tzoybe@msn.com ..."
$COMPOSE exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
UPDATE users SET role = 'ADMIN' WHERE email = 'tzoybe@msn.com';
SELECT email, role FROM users WHERE email = 'tzoybe@msn.com';
SQL

echo ""
echo "==> Done. Now LOG OUT and LOG IN again (the role is baked into your session),"
echo "    then open  https://nutreluma.com/admin/db  and  https://nutreluma.com/maintenance"
