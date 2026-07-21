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
source "${BACKUP_ENVIRONMENT_FILE:-/etc/environment}" 2>/dev/null || true
set +a

START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_TAG=$(date -u +%Y-%m-%d)

STAGING_ROOT=${BACKUP_STAGING_ROOT:-/backup-staging}
LOCK_FILE=${BACKUP_LOCK_FILE:-/run/lock/inkborne-maintenance.lock}

mkdir -p "$STAGING_ROOT" "$(dirname "$LOCK_FILE")"
chmod 700 "$STAGING_ROOT"

# One non-blocking lock is shared with the integrity checker. Concurrent
# restic prune/check/backup operations can otherwise fail or, worse, make a
# cron overlap look like a successful maintenance window.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -u +%H:%M:%S)] ERROR: another backup or integrity check holds $LOCK_FILE" >&2
  exit 75
fi

LOG_FILE=$(mktemp -p "$STAGING_ROOT" backup-log-XXXXXX)
SNAPSHOT_DIR=$(mktemp -d -p "$STAGING_ROOT" backup-snap-XXXXXX)

cleanup() {
  rm -rf "$SNAPSHOT_DIR"
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

post_discord() {
  local payload="$1"
  "${BACKUP_CURL_BIN:-curl}" -sS --max-time 15 -X POST -H "Content-Type: application/json" \
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
  if ! pg_dump --format=custom --no-owner --no-privileges --no-subscriptions \
    "$PGURI" > "${SNAPSHOT_DIR}/inkborne.dump"; then
    echo "[$(date -u +%H:%M:%S)] ERROR: pg_dump failed" >&2
    return 1
  fi
  local dump_size
  if ! dump_size=$(stat -c%s "${SNAPSHOT_DIR}/inkborne.dump"); then
    echo "[$(date -u +%H:%M:%S)] ERROR: could not inspect the dump archive" >&2
    return 1
  fi
  echo "[$(date -u +%H:%M:%S)]   dump = ${dump_size} bytes"
  # Defensive: pg_dump can succeed (exit 0) and produce a tiny file in
  # edge cases. A real Inkborne dump is well over 100 KB. Fail loudly
  # rather than ship an unusable snapshot.
  if [[ "$dump_size" -lt 10240 ]]; then
    echo "[$(date -u +%H:%M:%S)] ERROR: dump suspiciously small (${dump_size} bytes)" >&2
    return 1
  fi

  # Parsing the archive directory catches truncated/corrupt custom dumps now,
  # rather than discovering them during a disaster-recovery restore.
  if ! pg_restore --list "${SNAPSHOT_DIR}/inkborne.dump" >/dev/null; then
    echo "[$(date -u +%H:%M:%S)] ERROR: pg_restore could not read the dump archive" >&2
    return 1
  fi

  echo "[$(date -u +%H:%M:%S)] Step 2: rclone sync supabase-storage"
  if ! mkdir -p "${SNAPSHOT_DIR}/storage"; then
    echo "[$(date -u +%H:%M:%S)] ERROR: could not create Storage staging directory" >&2
    return 1
  fi
  if ! rclone sync supabase-storage: "${SNAPSHOT_DIR}/storage/" \
    --transfers=4 --checkers=8 --quiet; then
    echo "[$(date -u +%H:%M:%S)] ERROR: Storage sync failed" >&2
    return 1
  fi

  echo "[$(date -u +%H:%M:%S)] Step 3: restic backup"
  # Run from the staging directory so every snapshot restores directly to
  # <target>/inkborne.dump and <target>/storage instead of preserving a
  # random mktemp path.
  if ! (
    cd "$SNAPSHOT_DIR"
    restic backup . \
      --tag inkborne \
      --tag "$DATE_TAG" \
      --host inkborne-backup
  ); then
    echo "[$(date -u +%H:%M:%S)] ERROR: restic backup failed" >&2
    return 1
  fi

  echo "[$(date -u +%H:%M:%S)] Step 4: restic forget --keep-daily 30 --keep-monthly 12 --prune"
  if ! restic forget \
    --keep-daily 30 \
    --keep-monthly 12 \
    --tag inkborne \
    --prune; then
    echo "[$(date -u +%H:%M:%S)] ERROR: restic retention/prune failed" >&2
    return 1
  fi

  echo "[$(date -u +%H:%M:%S)] Step 5: Discord notify"
  local snap_json
  if ! snap_json=$(restic snapshots --tag inkborne --latest 1 --json); then
    echo "[$(date -u +%H:%M:%S)] ERROR: could not read the completed snapshot metadata" >&2
    return 1
  fi
  local snap_id snap_size
  if ! snap_id=$(echo "$snap_json" | jq -er '.[0].short_id'); then
    echo "[$(date -u +%H:%M:%S)] ERROR: completed snapshot has no ID" >&2
    return 1
  fi
  if ! snap_size=$(echo "$snap_json" | jq -er '.[0].summary.total_bytes_processed // 0'); then
    echo "[$(date -u +%H:%M:%S)] ERROR: completed snapshot has invalid size metadata" >&2
    return 1
  fi
  post_success "$snap_id" "$snap_size"

  echo "[$(date -u +%H:%M:%S)] Done"
}

# Tee the entire run to the log file so post_failure can grab the tail.
# Don't wrap run_pipeline in an `if` test directly — that suppresses
# `set -e` inside the function (bash gotcha). Capture PIPESTATUS instead.
# Every critical operation above has an explicit failure check. Disable
# errexit only around this pipeline so we can always capture the function's
# real status, notify Discord, and return that status to cron.
set +e
run_pipeline 2>&1 | tee -a "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -eq 0 ]]; then
  exit 0
else
  post_failure
  exit 1
fi
