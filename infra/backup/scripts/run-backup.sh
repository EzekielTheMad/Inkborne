#!/usr/bin/env bash
# Daily backup pipeline:
#   1. pg_dump to staging
#   2. rclone sync Supabase Storage to staging
#   3. restic backup staging dir to local repo
#   4. restic forget --prune (retention)
#   5. Discord webhook on success or failure
#
# Run via cron from /app/crontab. Exit non-zero on any failure; the trap
# captures stderr and posts to Discord before exiting.

set -euo pipefail

# Cron drops env vars; pull them back in.
set -a
# shellcheck disable=SC1091
source /etc/environment 2>/dev/null || true
set +a

START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_TAG=$(date -u +%Y-%m-%d)

LOG_FILE=$(mktemp -t backup-log-XXXXXX)
SNAPSHOT_DIR=$(mktemp -d -t backup-snap-XXXXXX)

cleanup() {
  rm -rf "$SNAPSHOT_DIR"
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

post_discord() {
  local payload="$1"
  curl -sS --max-time 15 -X POST -H "Content-Type: application/json" \
    -d "$payload" "$DISCORD_WEBHOOK_URL" >/dev/null || true
}

post_success() {
  local snapshot_id="$1"
  local size_bytes="$2"
  local size_h
  size_h=$(numfmt --to=iec --suffix=B "$size_bytes" 2>/dev/null || echo "$size_bytes B")
  local content
  content=$(printf '✅ Inkborne backup %s — snapshot \`%s\` (%s)' \
    "$START_TS" "$snapshot_id" "$size_h")
  post_discord "$(jq -nc --arg c "$content" '{content: $c}')"
}

post_failure() {
  local tail_lines
  tail_lines=$(tail -n 15 "$LOG_FILE" | sed 's/`/'\''/g')
  local content
  content=$(printf '❌ Inkborne backup %s FAILED\n```\n%s\n```' \
    "$START_TS" "$tail_lines")
  post_discord "$(jq -nc --arg c "$content" '{content: $c}')"
}

run_pipeline() {
  echo "[$(date -u +%H:%M:%S)] Starting backup ($START_TS)"

  echo "[$(date -u +%H:%M:%S)] Step 1: pg_dump"
  pg_dump --format=custom --no-owner --no-privileges "$PGURI" \
    > "${SNAPSHOT_DIR}/inkborne.dump"
  local dump_size
  dump_size=$(stat -c%s "${SNAPSHOT_DIR}/inkborne.dump")
  echo "[$(date -u +%H:%M:%S)]   dump = ${dump_size} bytes"

  echo "[$(date -u +%H:%M:%S)] Step 2: rclone sync supabase-storage"
  mkdir -p "${SNAPSHOT_DIR}/storage"
  rclone sync supabase-storage: "${SNAPSHOT_DIR}/storage/" \
    --transfers=4 --checkers=8 --quiet

  echo "[$(date -u +%H:%M:%S)] Step 3: restic backup"
  restic backup "$SNAPSHOT_DIR" \
    --tag inkborne \
    --tag "$DATE_TAG" \
    --host inkborne-backup

  echo "[$(date -u +%H:%M:%S)] Step 4: restic forget --keep-daily 30 --keep-monthly 12 --prune"
  restic forget \
    --keep-daily 30 \
    --keep-monthly 12 \
    --tag inkborne \
    --prune

  echo "[$(date -u +%H:%M:%S)] Step 5: Discord notify"
  local snap_json
  snap_json=$(restic snapshots --tag inkborne --latest 1 --json)
  local snap_id snap_size
  snap_id=$(echo "$snap_json" | jq -r '.[0].short_id')
  snap_size=$(echo "$snap_json" | jq -r '.[0].summary.total_bytes_processed // 0')
  post_success "$snap_id" "$snap_size"

  echo "[$(date -u +%H:%M:%S)] Done"
}

# Tee the entire run to the log file so post_failure can grab the tail.
if run_pipeline 2>&1 | tee -a "$LOG_FILE"; then
  exit 0
else
  post_failure
  exit 1
fi
