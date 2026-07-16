# Inkborne backup container

Daily encrypted backups of the Inkborne Supabase project (Postgres + Storage), running as a Docker container on Unraid. Uses [restic](https://restic.net/) for encryption, deduplication, and retention.

Design spec: [`docs/superpowers/specs/2026-04-25-backup-system-design.md`](../../docs/superpowers/specs/2026-04-25-backup-system-design.md).

## What it does

Every day at 06:00 UTC, the container:

1. Runs `pg_dump --format=custom` against the Supabase project.
2. Runs `rclone sync` against Supabase Storage (S3-compatible API).
3. Bundles both into a single restic snapshot in `/repo` (mounted from Unraid).
4. Prunes snapshots older than 30 days (keeping 12 monthly snapshots).
5. Posts success or failure to a Discord webhook.

A weekly integrity check runs Sundays at 07:00 UTC.

Backblaze B2 / offsite secondary is **deferred** — the architecture supports adding it later via `restic copy` to a second repo.

## Deploying on Unraid

### One-time setup

1. **Create the appdata directory.**
   ```bash
   mkdir -p /mnt/user/appdata/inkborne-backup
   cd /mnt/user/appdata/inkborne-backup
   ```

2. **Clone or copy the `infra/backup/` directory contents** to `/mnt/user/appdata/inkborne-backup/`.

3. **Create `.env`** from the template and fill in real values:
   ```bash
   cp .env.example .env
   chmod 600 .env
   nano .env
   ```

   Where each value comes from:
   - `PGURI` — Supabase dashboard → Project Settings → Database → Connection string. Use port **5432** (direct), not 6543 (pooler).
   - `SUPABASE_S3_*` — Supabase dashboard → Storage → Settings → S3 Connection. Generate access keys.
   - `RESTIC_PASSWORD` — generate with `openssl rand -base64 32`.
   - `DISCORD_WEBHOOK_URL` — Discord channel → Server Settings → Integrations → Webhooks.

4. **Save the same `.env` values to your password manager.** Without `RESTIC_PASSWORD` the encrypted repo is unrecoverable. Without the others, you'd have to regenerate them from each service's dashboard.

5. **Build and start the container.**
   ```bash
   docker compose up -d --build
   ```

6. **Trigger an initial backup** to verify the pipeline end-to-end. Either set `RUN_ON_START=1` in `.env` and `docker compose up -d` again, or:
   ```bash
   docker exec inkborne-backup /app/scripts/run-backup.sh
   ```
   Watch logs with `docker logs -f inkborne-backup`. A success message should appear in your Discord channel.

7. **Run the restore drill** (see below) before declaring the system live.

### Daily operation

Nothing. Cron in the container runs automatically. Watch the Discord channel for daily success messages and weekly integrity-check messages.

### Updating

```bash
cd /mnt/user/appdata/inkborne-backup
git pull           # if you cloned the repo here
docker compose up -d --build
```

The `.env`, `repo/`, and `logs/` directories are preserved across rebuilds.

## Restore drill (pre-alpha gate)

Before alpha #1 ships, run this once and confirm row counts match production:

```bash
# 1. Restore the most recent snapshot to a working dir on Unraid.
mkdir -p /tmp/restore-test
docker exec inkborne-backup \
  restic restore latest --target /tmp/restore-test
# (Paths inside container; pick latest snapshot.)

# 2. Spin up an ephemeral Postgres container.
docker run -d --name inkborne-restore-test \
  -e POSTGRES_PASSWORD=test \
  postgres:15

# 3. Copy the dump and restore it.
docker cp /mnt/user/appdata/inkborne-backup/restore-test/snapshot/inkborne.dump \
  inkborne-restore-test:/tmp/

docker exec inkborne-restore-test \
  pg_restore -U postgres -d postgres /tmp/inkborne.dump

# 4. Spot-check counts.
docker exec inkborne-restore-test psql -U postgres -d postgres -c \
  "SELECT 'characters' AS t, COUNT(*) FROM characters
   UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
   UNION ALL SELECT 'feedback', COUNT(*) FROM feedback;"

# Compare against the Supabase dashboard.

# 5. Tear down.
docker rm -f inkborne-restore-test
rm -rf /tmp/restore-test
```

**Pass criteria:** the dump restores without error AND row counts on `characters` + `auth.users` match prod within reason (a snapshot is a moment-in-time, so a recent insert may not yet appear).

## Recovering after a disaster

If Unraid is gone but you still have the password manager:

1. Stand up a new Linux box with Docker.
2. Recreate `/mnt/user/appdata/inkborne-backup/` (or any path).
3. Restore the `.env` from your password manager.
4. Restore the `repo/` directory from whatever offline copy you have, OR — once B2 is added — restore from B2 via:
   ```bash
   restic -r b2:inkborne-backups restore latest --target /tmp/restore
   ```
5. From there, the standard restore drill applies.

## Troubleshooting

**"restic init" fails on first start.**
Likely `RESTIC_REPOSITORY` permissions on the mounted volume. Check `/repo` in the container is writable.

**"connection refused" from `pg_dump`.**
Confirm the Supabase project allows direct connections (it does by default). The Inkborne project ID is `etcaodglvcspcmwecyxq`. If the password rotated, update `PGURI` in `.env` and `docker compose restart`.

**"401 Unauthorized" from `rclone`.**
Supabase Storage S3 keys rotated or never enabled. Regenerate in the Supabase dashboard.

**Discord webhook returns 404.**
Webhook deleted in Discord. Make a new one and update `DISCORD_WEBHOOK_URL`.

**Repo lock errors.**
A previous run was interrupted. Run:
```bash
docker exec inkborne-backup restic unlock
```

## Files

- `Dockerfile` — `postgres:15-bookworm` base, plus `restic`, `rclone`, `cron`, `tini`, `jq`.
- `docker-compose.yml` — service definition, mounts `repo/` and `logs/`.
- `crontab` — schedule (06:00 UTC daily, 07:00 UTC Sunday).
- `scripts/entrypoint.sh` — env validation, render `rclone.conf`, init repo, exec cron.
- `scripts/run-backup.sh` — daily pipeline.
- `scripts/run-check.sh` — weekly integrity check.
- `.env.example` — secret template (real `.env` is gitignored).
