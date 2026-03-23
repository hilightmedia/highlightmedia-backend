#!/bin/bash

APP_DIR="/home/ubuntu/highlightmedia-backend"
LOCK_FILE="/tmp/highlightmedia-cleanup.lock"
LOG_DIR="/home/ubuntu/highlightmedia/logs"
LOG_FILE="$LOG_DIR/highlightmedia-cron.log"

mkdir -p "$LOG_DIR"

cd "$APP_DIR" || exit 1

echo "----- $(date) -----" >> "$LOG_FILE"

flock -n "$LOCK_FILE" /usr/bin/npx tsx src/jobs/dailyTask.ts >> "$LOG_FILE" 2>&1