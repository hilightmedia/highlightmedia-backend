#!/bin/bash

APP_DIR="/home/ubuntu/highlightmedia-backend"
LOCK_FILE="/tmp/highlightmedia-cleanup.lock"
LOG_DIR="/home/ubuntu/highlightmedia/logs"
LOG_FILE="$LOG_DIR/highlightmedia-cron.log"
ALERT_LOG="$LOG_DIR/highlightmedia-cron-alert.log"

export PATH="/home/ubuntu/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

mkdir -p "$LOG_DIR"

cd "$APP_DIR" || exit 1

START_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
echo "----- [$START_TIME] JOB START -----" >> "$LOG_FILE"

flock -n "$LOCK_FILE" bash -lc 'npx tsx src/jobs/dailyTask.ts' >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  END_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "----- [$END_TIME] JOB SUCCESS -----" >> "$LOG_FILE"
elif [ "$EXIT_CODE" -eq 1 ]; then
  END_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "----- [$END_TIME] JOB SKIPPED (lock busy) -----" >> "$LOG_FILE"
else
  END_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "----- [$END_TIME] JOB FAILED (exit=$EXIT_CODE) -----" >> "$LOG_FILE"
  echo "[$END_TIME] Cron failed with exit code $EXIT_CODE" >> "$ALERT_LOG"
fi