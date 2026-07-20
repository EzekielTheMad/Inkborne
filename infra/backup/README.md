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

The plaintext working set is staged on a 2 GiB in-memory `tmpfs`; it is never
written to Unraid's persistent appdata. Backup and integrity jobs share a
non-blocking lock, so overlapping manual/cron runs fail visibly instead of
competing for the repository. File logs rotate at 5 MiB and Docker logs are
capped at three 10 MiB files.

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
   - `PGURI` — Supabase dashboard → **Connect → Session pooler**. Use the tenant-qualified username `postgres.<project-ref>` on port **5432**. Port 6543 is transaction mode and is not appropriate for `pg_dump`. A direct `db.<ref>.supabase.co:5432` connection is also valid when Unraid has IPv6 connectivity (or the project has the IPv4 add-on).
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

The hosted Inkborne project currently runs PostgreSQL 17, so both `pg_dump`
and the isolated restore target use PostgreSQL 17. Before alpha #1 ships, run
the host-side drill from this directory:

```bash
chmod +x restore-drill.sh
./restore-drill.sh
```

The script restores the snapshot inside the backup container's tmpfs, copies
the correct `inkborne.dump` container path to a temporary host directory,
starts an isolated pinned `supabase/postgres:17.6` container with hosted
extensions available, creates an empty database from `template0`, restores
with `--exit-on-error`, prints key row counts, and securely removes all
temporary artifacts on exit.

**Pass criteria:** the script prints `PASS` and the displayed counts for
`public.characters`, `auth.users`, and `public.feedback` match production
within reason. A recent insert may not yet appear in the daily snapshot.

Snapshots created before the staging-path hardening may contain the old random
`/tmp/backup-snap-*` prefix. Create one fresh backup before running this drill.

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
Confirm `PGURI` is the Dashboard's Session pooler connection string: tenant-qualified username `postgres.etcaodglvcspcmwecyxq`, the displayed regional pooler host, and port 5432. If the database password rotated, URL-encode any reserved characters, update `.env`, and run `docker compose restart`.

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

- `Dockerfile` — `postgres:17-bookworm` base, plus backup, locking, rotation, and init tooling.
- `docker-compose.yml` — service definition, persistent repo/log mounts, tmpfs staging, and Docker log caps.
- `crontab` — schedule (06:00 UTC daily, 07:00 UTC Sunday).
- `scripts/entrypoint.sh` — env validation, render `rclone.conf`, init repo, exec cron.
- `scripts/run-backup.sh` — daily pipeline.
- `scripts/run-check.sh` — weekly integrity check.
- `restore-drill.sh` — host-side, fail-fast Supabase PostgreSQL 17.6 restore verification.
- `logrotate.conf` — persistent file log retention and size limit.
- `.env.example` — secret template (real `.env` is gitignored).
