#!/bin/sh
# Triggers the meal-reminder notification sweep for every user.
# Runs on the NAS via crontab; the web app itself has no scheduler.
set -e
cd /share/CACHEDEV1_DATA/Container/nutreluma/apps/web
SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2-)
curl -fsS -X POST http://127.0.0.1:8095/api/cron/notifications \
  -H "Authorization: Bearer $SECRET" \
  >> /share/CACHEDEV1_DATA/Container/nutreluma/apps/web/backups/cron-notifications.log 2>&1
