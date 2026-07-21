#!/usr/bin/env bash
# Container entrypoint: validate env, render rclone config, init repo if
# needed, install crontab, run cron in the foreground.

set -euo pipefail

REQUIRED_VARS=(
  PGURI
  SUPABASE_S3_ENDPOINT
  SUPABASE_S3_KEY_ID
  SUPABASE_S3_SECRET
  RESTIC_PASSWORD
  RESTIC_REPOSITORY
  DISCORD_WEBHOOK_URL
)

for v in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[entrypoint] FATAL: required env var $v is not set" >&2
    exit 1
  fi
done

# Render rclone.conf from env. Keeping rclone config in env (instead of a
# separate config file) means secrets live in one place: .env.
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf <<EOF
[supabase-storage]
type = s3
provider = Other
endpoint = ${SUPABASE_S3_ENDPOINT}
access_key_id = ${SUPABASE_S3_KEY_ID}
secret_access_key = ${SUPABASE_S3_SECRET}
region = ${SUPABASE_S3_REGION:-us-east-1}
EOF
chmod 600 /root/.config/rclone/rclone.conf

# Initialize only a truly empty repository. A non-empty repo that cannot be
# opened means a wrong password, corruption, or permissions problem and must
# stop startup instead of being misreported as an uninitialized repository.
mkdir -p "$RESTIC_REPOSITORY"
if [[ -z "$(find "$RESTIC_REPOSITORY" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "[entrypoint] Initializing restic repo at ${RESTIC_REPOSITORY}"
  restic init
elif ! restic cat config >/dev/null 2>&1; then
  echo "[entrypoint] FATAL: existing restic repository cannot be opened" >&2
  exit 1
fi

# Cron runs without the docker env, so persist the secrets it needs into
# /etc/environment. Quote values to handle special characters in passwords.
{
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  for v in "${REQUIRED_VARS[@]}" SUPABASE_S3_REGION; do
    val="${!v:-}"
    [[ -n "$val" ]] && printf '%s=%q\n' "$v" "$val"
  done
} > /etc/environment
chmod 600 /etc/environment

# Install the crontab for root.
crontab /app/crontab
echo "[entrypoint] Cron installed:"
crontab -l | sed 's/^/    /'

# Optional: trigger a backup immediately on container start. A requested
# initial backup is a startup gate: failure stops the service instead of
# leaving a falsely healthy container behind.
if [[ "${RUN_ON_START:-0}" == "1" ]]; then
  echo "[entrypoint] RUN_ON_START=1 — running initial backup"
  /app/scripts/run-backup.sh
fi

# Stream cron output to stdout so docker logs sees it.
echo "[entrypoint] Tailing /var/log/inkborne-backup.log to stdout"
touch /var/log/inkborne-backup.log
tail -F /var/log/inkborne-backup.log &

# Foreground cron — PID 1 (under tini) so the container stays alive and
# signals propagate cleanly.
exec cron -f
