#!/usr/bin/env bash
# Weekly restic repo integrity check. Reads metadata + a random subset of
# data and verifies hashes. Catches silent corruption before a restore
# would.

set -euo pipefail

set -a
# shellcheck disable=SC1091
source "${BACKUP_ENVIRONMENT_FILE:-/etc/environment}" 2>/dev/null || true
set +a

START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STAGING_ROOT=${BACKUP_STAGING_ROOT:-/backup-staging}
LOCK_FILE=${BACKUP_LOCK_FILE:-/run/lock/inkborne-maintenance.lock}

mkdir -p "$STAGING_ROOT" "$(dirname "$LOCK_FILE")"
chmod 700 "$STAGING_ROOT"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -u +%H:%M:%S)] ERROR: another backup or integrity check holds $LOCK_FILE" >&2
  exit 75
fi

LOG_FILE=$(mktemp -p "$STAGING_ROOT" check-log-XXXXXX)
trap 'rm -f "$LOG_FILE"' EXIT

post_discord() {
  "${BACKUP_CURL_BIN:-curl}" -sS --max-time 15 -X POST -H "Content-Type: application/json" \
    -d "$1" "$DISCORD_WEBHOOK_URL" >/dev/null || true
}

if restic check --read-data-subset=5% 2>&1 | tee "$LOG_FILE"; then
  msg=$(printf '✅ Inkborne restic check OK — %s' "$START_TS")
  post_discord "$(jq -nc --arg c "$msg" '{content: $c}')"
  exit 0
else
  tail_lines=$(tail -n 15 "$LOG_FILE" | sed 's/`/'\''/g')
  msg=$(printf '⚠️ Inkborne restic check FAILED — %s\n```\n%s\n```' "$START_TS" "$tail_lines")
  post_discord "$(jq -nc --arg c "$msg" '{content: $c}')"
  exit 1
fi
