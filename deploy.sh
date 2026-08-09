#!/bin/sh
# One-shot deploy for NutreLuma on the NAS.
# Run inside an SSH session on the NAS with a single command:
#   sh /share/CACHEDEV1_DATA/Container/nutreluma/deploy.sh
#
# Does: build+start the web container (with retry), let the entrypoint apply the
# Prisma migration, verify health, then grant ADMIN to tzoybe@msn.com.

export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy
export DOCKER_CONFIG=$HOME/.docker
mkdir -p "$DOCKER_CONFIG"
cd /share/CACHEDEV1_DATA/Container/nutreluma || exit 1

echo "==> Building & starting (with retry for the known flaky build)..."
n=1; ec=1
while [ $n -le 4 ]; do
  if docker compose --env-file .env up --build -d; then ec=0; break; fi
  ec=$?
  echo "   build attempt $n failed (exit $ec) - retrying in 3s..."
  n=$((n + 1)); sleep 3
done
echo "==> BUILD EXIT=$ec"
if [ $ec -ne 0 ]; then
  echo "!! Build failed after retries - the OLD image is still running. Fix and re-run."
  exit $ec
fi

echo "==> Waiting for the app to come up..."
sleep 6
echo "==> Health:"
curl -s http://127.0.0.1:8095/api/health; echo
echo "==> Migration log (expect 20260808140000_add_maintenance_mode applied):"
docker compose logs --tail=60 web | grep -i "migrat" || echo "   (no migrate lines found in last 60 log lines)"

echo "==> Granting ADMIN to tzoybe@msn.com ..."
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
UPDATE users SET role = 'ADMIN' WHERE email = 'tzoybe@msn.com';
SELECT email, role FROM users WHERE email = 'tzoybe@msn.com';
SQL

echo ""
echo "==> Done. Now LOG OUT and LOG IN again (the role is baked into your session),"
echo "    then open  https://nutreluma.com/admin/db  and  https://nutreluma.com/maintenance"
