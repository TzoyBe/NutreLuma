# NutreLuma Build And Deploy

## Local build check

From Windows / PowerShell:

```powershell
cd \\TzoyBe-NAS\Container\nutreluma
npx tsc --noEmit -p tsconfig.json
npm run build
```

What this does:

- `npx tsc --noEmit -p tsconfig.json`
  Checks TypeScript without creating output files.
- `npm run build`
  Runs the production Next.js build locally.

## SSH into the NAS

```powershell
ssh TzoyBe@192.168.2.249
```

## Production deploy on the NAS

After you connect with SSH, run:

```sh
cd /share/Container/nutreluma
export DOCKER_HOST=unix:///var/run/docker.sock
export DOCKER_CLI_PLUGIN_EXTRA_DIRS=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/local/lib/docker/cli-plugins
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs:$PATH
/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs/docker compose up -d --build
curl -fsS http://127.0.0.1:8095/api/health
```

## Clean rebuild if the NAS build gets weird

If the production build fails with filesystem or stale-cache errors, first run:

```sh
cd /share/Container/nutreluma
rm -rf .next
```

Then run the deploy again:

```sh
export DOCKER_HOST=unix:///var/run/docker.sock
export DOCKER_CLI_PLUGIN_EXTRA_DIRS=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/local/lib/docker/cli-plugins
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs:$PATH
/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs/docker compose up -d --build
curl -fsS http://127.0.0.1:8095/api/health
```

## Quick flow

1. `cd \\TzoyBe-NAS\Container\nutreluma`
2. `npx tsc --noEmit -p tsconfig.json`
3. `npm run build`
4. `ssh TzoyBe@192.168.2.249`
5. `cd /share/Container/nutreluma`
6. Export Docker env vars
7. Run `docker compose up -d --build`
8. Run `curl -fsS http://127.0.0.1:8095/api/health`

## Optional live check

After deploy, you can also verify the public site:

```sh
curl -I -s https://www.nutreluma.com/login | head -n 6
```
