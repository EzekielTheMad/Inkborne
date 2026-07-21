#!/usr/bin/env bash
# Host-side disaster recovery drill. Run from Unraid, not inside the backup
# container. Plaintext artifacts are removed on every exit.

set -euo pipefail

BACKUP_CONTAINER=${BACKUP_CONTAINER:-inkborne-backup}
# Pin the Supabase Postgres 17.6 image so the drill has the extensions present
# in hosted Supabase as well as a matching database major/minor line.
POSTGRES_IMAGE=${POSTGRES_IMAGE:-supabase/postgres:17.6.1.150}
RESTORE_CONTAINER=${RESTORE_CONTAINER:-inkborne-restore-test-$$}
CONTAINER_WORKDIR=/backup-staging/restore-drill-$$
HOST_WORKDIR=$(mktemp -d -t inkborne-restore-drill-XXXXXX)

cleanup() {
  docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
  docker exec "$BACKUP_CONTAINER" rm -rf "$CONTAINER_WORKDIR" >/dev/null 2>&1 || true
  rm -rf "$HOST_WORKDIR"
}
trap cleanup EXIT

echo "[restore] Restoring latest restic snapshot inside $BACKUP_CONTAINER"
docker exec "$BACKUP_CONTAINER" mkdir -p "$CONTAINER_WORKDIR"
docker exec "$BACKUP_CONTAINER" \
  restic restore latest --tag inkborne --target "$CONTAINER_WORKDIR"
docker exec "$BACKUP_CONTAINER" test -s "$CONTAINER_WORKDIR/inkborne.dump"

echo "[restore] Copying the verified archive out of the backup container"
docker cp "$BACKUP_CONTAINER:$CONTAINER_WORKDIR/inkborne.dump" \
  "$HOST_WORKDIR/inkborne.dump"

echo "[restore] Starting isolated $POSTGRES_IMAGE"
docker run -d --name "$RESTORE_CONTAINER" \
  -e POSTGRES_PASSWORD=inkborne-restore-only \
  "$POSTGRES_IMAGE" \
  postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null

ready=0
for _ in $(seq 1 30); do
  if docker exec "$RESTORE_CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "[restore] ERROR: temporary Postgres did not become ready" >&2
  exit 1
fi

docker cp "$HOST_WORKDIR/inkborne.dump" "$RESTORE_CONTAINER:/tmp/inkborne.dump"

echo "[restore] Creating an empty restore database"
docker exec "$RESTORE_CONTAINER" \
  createdb -U postgres --template=template0 inkborne_restore

echo "[restore] Restoring with errors treated as fatal"
docker exec "$RESTORE_CONTAINER" \
  pg_restore --exit-on-error --no-owner --no-privileges \
    -U postgres -d inkborne_restore /tmp/inkborne.dump

echo "[restore] Key restored row counts"
docker exec "$RESTORE_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d inkborne_restore -c \
  "SELECT 'characters' AS table_name, COUNT(*) FROM public.characters
   UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
   UNION ALL SELECT 'feedback', COUNT(*) FROM public.feedback;"

echo "[restore] PASS: archive restored cleanly into $POSTGRES_IMAGE"
