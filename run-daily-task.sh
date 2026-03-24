#!/bin/bash

APP_DIR="/home/ubuntu/highlightmedia-backend"
LOCK_FILE="/tmp/highlightmedia-cleanup.lock"
LOG_DIR="/home/ubuntu/highlightmedia/logs"
LOG_FILE="$LOG_DIR/highlightmedia-cron.log"
ALERT_LOG="$LOG_DIR/highlightmedia-cron-alert.log"

# Ensure proper PATH (important for cron)
export PATH="/home/ubuntu/.nvm/versions/node/v24.12.0/bin:/usr/bin:/bin"

mkdir -p "$LOG_DIR"

cd "$APP_DIR" || exit 1

START_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
echo "----- [$START_TIME] JOB START -----" >> "$LOG_FILE"

# Use full path for flock + add timeout protection
/usr/bin/timeout 15m /usr/bin/flock -n "$LOCK_FILE" bash -c '
  npx tsx src/jobs/dailyTask.ts
  exit $?
' >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

END_TIME="$(date '+%Y-%m-%d %H:%M:%S')"

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "----- [$END_TIME] JOB SUCCESS -----" >> "$LOG_FILE"
elif [ "$EXIT_CODE" -eq 1 ]; then
  echo "----- [$END_TIME] JOB SKIPPED (lock busy) -----" >> "$LOG_FILE"
elif [ "$EXIT_CODE" -eq 124 ]; then
  echo "----- [$END_TIME] JOB TIMEOUT -----" >> "$LOG_FILE"
  echo "[$END_TIME] Cron timeout after 15 minutes" >> "$ALERT_LOG"
else
  echo "----- [$END_TIME] JOB FAILED (exit=$EXIT_CODE) -----" >> "$LOG_FILE"
  echo "[$END_TIME] Cron failed with exit code $EXIT_CODE" >> "$ALERT_LOG"
fi