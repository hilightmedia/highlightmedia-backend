#!/bin/bash

APP_DIR="/home/ubuntu/highlightmedia-backend"
LOCK_FILE="/tmp/highlightmedia-cleanup.lock"
LOG_FILE="/var/log/highlightmedia-cron.log"

cd "$APP_DIR" || exit 1

echo "----- $(date) -----" >> "$LOG_FILE"

flock -n "$LOCK_FILE" /usr/bin/npx tsx src/jobs/dailyTask.ts >> "$LOG_FILE" 2>&1