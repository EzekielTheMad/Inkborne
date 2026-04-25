# Backup system design — Inkborne M1

**Date:** 2026-04-25
**Status:** Design approved, ready for implementation plan
**Scope:** Daily encrypted backups of the Supabase project, off-site secondary, restore drill before alpha #1.

---

## Goal

Get to a state where:

1. The Inkborne Supabase project is backed up daily without manual intervention.
2. Backups are encrypted, retained for 30 days + 12 monthly snapshots.
3. Backups exist in two places: Unraid (primary) and Backblaze B2 (offsite secondary).
4. Active failures are visible (Discord webhook).
5. We have proven the dump actually restores (drill before alpha #1).

This is alpha-grade backup. Point-in-time recovery and app-on-restored-DB drills are out of scope and tracked as post-alpha follow-ups.

## Non-goals

- Point-in-time recovery (PITR) — requires Supabase Pro tier.
- Multi-region B2 replication — alpha cost not justified.
- Backup of the Unraid host itself — orthogonal, separate concern.
- Automated app-level smoke test on the restored DB — post-alpha.
- Detection of silent failures (cron didn't run, container died and never woke up) — accepted trade-off in exchange for not running healthchecks.io.

## Architecture

A single Docker container on Unraid runs daily. One bash entrypoint chains the steps; if any step fails, the script exits non-zero and posts a failure message to a Discord webhook. On success, posts a brief success message with snapshot ID + size.

```
Unraid host (pull-based, no inbound)
└── Docker: inkborne-backup
    ├── cron @ 06:00 UTC daily  →  /usr/local/bin/run-backup.sh
    │
    └── run-backup.sh:
          1. mkdir /tmp/snapshot           (tmpfs — never hits disk)
          2. pg_dump -Fc                   → /tmp/snapshot/inkborne.dump
          3. rclone sync supabase-storage: → /tmp/snapshot/storage/
          4. restic backup /tmp/snapshot   → local repo (Unraid)
          5. restic copy                   → B2 repo
          6. restic forget --keep-daily 30 --keep-monthly 12 --prune  (both repos)
          7. rm -rf /tmp/snapshot
          8. Discord webhook: success or failure with snapshot ID + size
```

### Why these choices

- **Docker over User Scripts:** pinned `pg_dump`, `rclone`, and `restic` versions inside the image. Survives Unraid OS upgrades. Updating is `docker pull` + restart, not "fix bash script after NerdTools changed."
- **Restic over rolling our own:** client-side AES-256 encryption, deduplication, retention policy as a one-line flag, repo integrity verification (`restic check`). Boring tech, ~10 years in production use.
- **Single staging dir, single snapshot:** the storage backup needs a directory tree, and once we have one, dropping the DB dump in the same dir means **one restic snapshot per night** containing both. Simpler restore mental model. Staging lives on tmpfs (RAM), so the unencrypted dump never touches a disk before restic encrypts it.
- **Custom-format `pg_dump -Fc`:** dedupes well across daily snapshots in restic, supports selective `pg_restore` (tables/schemas) on the recovery side.

## Components

### Container

Single image (Debian-slim base) with these tools installed:

- `postgresql-client-15` (matches Supabase's Postgres major version)
- `restic` (latest stable)
- `rclone` (latest stable)
- `curl` (for Discord webhook)
- `cron` + a small wrapper that loads `.env` before invoking the script

Mounted volumes:

- `/mnt/user/appdata/inkborne-backup/` → `/config` (read-only `.env` and `rclone.conf`)
- `/mnt/user/appdata/inkborne-backup/repo` → `/repo` (local restic repo)

The restic local repo is on the Unraid array / cache pool. Specific share/disk is the operator's choice; the design only requires that it be persistent storage Victor backs up via his existing Unraid means (separate concern).

### Secrets (`.env`, `chmod 600`)

```
PGURI=postgres://postgres:<pw>@db.etcaodglvcspcmwecyxq.supabase.co:5432/postgres
SUPABASE_S3_ENDPOINT=https://etcaodglvcspcmwecyxq.supabase.co/storage/v1/s3
SUPABASE_S3_KEY_ID=...
SUPABASE_S3_SECRET=...
SUPABASE_S3_REGION=us-east-1
B2_KEY_ID=...
B2_APP_KEY=...
B2_BUCKET=inkborne-backups
RESTIC_PASSWORD=<long random>
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

The S3 access keys are generated in the Supabase dashboard under **Storage → Settings → S3 Connection**.

The restic passphrase is a long random string. Once generated and the first snapshot is written, it cannot be rotated without re-encrypting the entire repo.

**Disaster recovery for the secrets themselves:** the same `.env` contents must also live in a password manager Victor controls (Bitwarden, 1Password, etc.). If the Unraid flash drive dies, the offsite B2 repo is unreadable without the restic passphrase + B2 keys.

### Discord notifications

Webhook URL is a per-channel Discord URL. The script posts:

- **Success:** snapshot ID, total snapshot size, time taken (1-line message).
- **Failure:** which step failed, exit code, last 10 lines of output (multi-line code block).

## Data flow

1. **DB dump.** `pg_dump --format=custom $PGURI > /tmp/snapshot/inkborne.dump`
   - Uses the project's `postgres` superuser. No dedicated read-only role for alpha; the account already has the password we need, and adding role management is more maintenance for no security gain when the same secret would be stored in `.env` either way.
   - Custom format (`-Fc`) for restore flexibility.

2. **Storage sync.** `rclone sync supabase-storage:/ /tmp/snapshot/storage/`
   - Mirrors all buckets the S3 keys can see. As of 2026-04-25 that's `avatars` and any narrative-related buckets in use; the design does not enumerate them so new buckets are auto-included.
   - `sync` (not `copy`) so deletions in Supabase Storage propagate to the staging dir → restic snapshot reflects the current state of Storage.

3. **Restic backup.** `restic backup /tmp/snapshot --tag inkborne` to the local repo first.

4. **Restic copy.** `restic copy --from-repo $LOCAL_REPO` to the B2 repo. Same passphrase on both repos.

5. **Retention.** `restic forget --keep-daily 30 --keep-monthly 12 --prune` against both repos.

6. **Integrity:** `restic check` runs weekly (separate cron entry, not every day — it reads the entire repo).

## Restore drill (pre-alpha gate)

Before alpha #1 ships, run this drill once and document the outcome in this spec or a follow-up note:

```bash
# 1. Pull the most recent snapshot to a working dir on Unraid
mkdir -p /tmp/restore-test
restic -r $LOCAL_REPO restore latest --target /tmp/restore-test

# 2. Spin up an ephemeral Postgres container
docker run -d --name inkborne-restore-test \
  -e POSTGRES_PASSWORD=test postgres:15
docker cp /tmp/restore-test/snapshot/inkborne.dump \
  inkborne-restore-test:/tmp/

# 3. Restore the dump into it
docker exec inkborne-restore-test \
  pg_restore -U postgres -d postgres /tmp/inkborne.dump

# 4. Spot-check
docker exec inkborne-restore-test psql -U postgres -d postgres -c \
  "SELECT count(*) FROM characters; SELECT count(*) FROM auth.users;"
# Confirm counts match prod.

# 5. Tear down
docker rm -f inkborne-restore-test
rm -rf /tmp/restore-test
```

**Pass criteria:** the dump restores without error AND row counts on `characters` + `auth.users` match the prod numbers from the Supabase dashboard at the time of the snapshot.

The drill should be re-run any time pg_dump/restic/rclone versions change in the container image, and post-alpha shifts to a recurring quarterly cadence.

## Error handling

Each step in `run-backup.sh` runs under `set -euo pipefail`. The wrapper catches non-zero exits, captures the last lines of stderr, and posts to Discord. Examples of failure modes the design must surface:

- pg_dump connection refused (Supabase password rotated, network issue) → Discord with the connection error.
- rclone S3 401 (S3 keys rotated) → Discord with the rclone error.
- restic local-repo locked (a previous run hung) → Discord with the lock message; operator clears `restic unlock`.
- B2 quota exceeded or 503 → Discord. Local backup still completes; only the copy step fails.
- Discord webhook fails → script logs locally and exits non-zero. Discord failures don't fail-loud, since by definition we can't ping; this is acceptable for alpha.

## Operational tasks

- **Initial setup:** clone repo onto Unraid, populate `.env`, build & start the container, run a manual `run-backup.sh` to seed both repos. Document the rclone S3 config generation steps.
- **First-time restic init:** `restic init` against both repos with the same passphrase. The B2 bucket is created via the B2 dashboard before this.
- **Restore drill:** run the procedure above once. Document the outcome.
- **Monitoring rotation:** Discord channel must be one Victor checks. Verify the webhook delivers by triggering an intentional failure (wrong PG password) on first run.

## Out of scope / follow-ups

| Item | Why deferred |
|---|---|
| healthchecks.io watchdog (silent failure detection) | Accepted Q3 trade-off. Add when alpha tester volume justifies it. |
| App-on-restored-DB smoke test | Post-alpha; bigger setup, app changes during alpha would invalidate it constantly. |
| Point-in-time recovery (WAL streaming) | Requires Supabase Pro. Reconsider before public beta. |
| Backup of `restic` repo metadata to a third location | The repo is itself encrypted and its layout is restic-stable; B2 is the third location for the snapshots. |
| Migration to recurring quarterly drills | Calendar reminder once first drill passes; not a phase. |

## Implementation references

- restic docs: <https://restic.readthedocs.io/>
- rclone S3 backend: <https://rclone.org/s3/>
- Supabase Storage S3 connection: <https://supabase.com/docs/guides/storage/s3/authentication>
- Postgres `pg_dump -Fc`: <https://www.postgresql.org/docs/15/app-pgdump.html>
- Backblaze B2 + restic: <https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#backblaze-b2>
