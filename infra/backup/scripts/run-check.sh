#!/usr/bin/env bash
# Weekly restic repo integrity check. Reads metadata + a random subset of
# data and verifies hashes. Catches silent corruption before a restore
# would.

set -euo pipefail

set -a
# shellcheck disable=SC1091
source /etc/environment 2>/dev/null || true
set +a

START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOG_FILE=$(mktemp -t check-log-XXXXXX)
trap 'rm -f "$LOG_FILE"' EXIT

post_discord() {
  curl -sS --max-time 15 -X POST -H "Content-Type: application/json" \
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
