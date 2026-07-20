import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backupRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(backupRoot, relativePath), "utf8");

function findBash() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
      ]
    : ["/usr/bin/bash", "/bin/bash"];
  return candidates.find(existsSync);
}

function bashPath(value) {
  if (process.platform !== "win32") return value;
  const normalized = path.resolve(value).replaceAll("\\", "/");
  return `/${normalized[0].toLowerCase()}${normalized.slice(2)}`;
}

function writeStub(directory, name, body) {
  const target = path.join(directory, name);
  writeFileSync(target, `#!/usr/bin/env bash\nset -u\n${body}\n`, "utf8");
  chmodSync(target, 0o755);
}

function createHarness(overrides = {}) {
  // Keep failure-injection fixtures inside the writable workspace. This also
  // lets managed Windows CI run without Docker, WSL, or profile temp access.
  const root = mkdtempSync(path.join(backupRoot, "tests", ".tmp-"));
  const bin = path.join(root, "bin");
  const calls = path.join(root, "calls");
  const staging = path.join(root, "staging");
  mkdirSync(bin);
  mkdirSync(calls);
  mkdirSync(staging);

  writeStub(bin, "flock", 'exit "${FAKE_FLOCK_STATUS:-0}"');
  writeStub(bin, "pg_dump", `
touch "$CALLS/pg_dump"
if [[ "\${FAKE_PG_DUMP_STATUS:-0}" -ne 0 ]]; then exit "$FAKE_PG_DUMP_STATUS"; fi
head -c 12288 /dev/zero
`);
  writeStub(bin, "pg_restore", `
touch "$CALLS/pg_restore"
exit "\${FAKE_PG_RESTORE_STATUS:-0}"
`);
  writeStub(bin, "rclone", `
touch "$CALLS/rclone"
exit "\${FAKE_RCLONE_STATUS:-0}"
`);
  writeStub(bin, "restic", `
command_name="\${1:-missing}"
touch "$CALLS/restic-$command_name"
case "$command_name" in
  backup) exit "\${FAKE_RESTIC_BACKUP_STATUS:-0}" ;;
  forget) exit "\${FAKE_RESTIC_FORGET_STATUS:-0}" ;;
  check) exit "\${FAKE_RESTIC_CHECK_STATUS:-0}" ;;
  snapshots) printf '%s\\n' '[{"short_id":"abc123","summary":{"total_bytes_processed":12288}}]' ;;
esac
`);
  writeStub(bin, "jq", `
case "$*" in
  *short_id*) echo abc123 ;;
  *total_bytes_processed*) echo 12288 ;;
  *) echo '{}' ;;
esac
`);
  writeStub(bin, "curl", 'touch "$CALLS/curl"; exit 0');
  writeStub(bin, "numfmt", 'echo 12KiB');

  const env = {
    ...process.env,
    PATH: `${bashPath(bin)}:/usr/bin:/bin`,
    CALLS: bashPath(calls),
    BACKUP_STAGING_ROOT: bashPath(staging),
    BACKUP_LOCK_FILE: `${bashPath(root)}/maintenance.lock`,
    BACKUP_ENVIRONMENT_FILE: "/dev/null",
    BACKUP_CURL_BIN: `${bashPath(bin)}/curl`,
    PGURI: "postgres://backup.invalid/postgres",
    RESTIC_REPOSITORY: bashPath(path.join(root, "repo")),
    RESTIC_PASSWORD: "test-only",
    DISCORD_WEBHOOK_URL: "https://discord.invalid/test",
    ...overrides,
  };

  return {
    calls,
    env,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function runScript(relativePath, overrides = {}) {
  const bash = findBash();
  assert.ok(bash, "Git Bash (Windows) or bash (Linux) is required for failure injection tests");
  const harness = createHarness(overrides);
  const result = spawnSync(bash, [bashPath(path.join(backupRoot, relativePath))], {
    cwd: backupRoot,
    env: harness.env,
    encoding: "utf8",
  });
  return { ...harness, result };
}

test("static deployment contracts keep credentials, plaintext, versions, and logs safe", () => {
  assert.match(read(".dockerignore"), /^\.env$/m);
  assert.match(read(".dockerignore"), /^repo\/$/m);
  assert.match(read(".dockerignore"), /^logs\/$/m);
  assert.match(read("Dockerfile"), /^FROM postgres:17-bookworm$/m);
  assert.match(read("docker-compose.yml"), /\/backup-staging:rw,noexec,nosuid,nodev,size=/);
  assert.match(read("docker-compose.yml"), /max-size: "10m"/);
  assert.match(read("logrotate.conf"), /maxsize 5M/);
  assert.match(read("scripts/run-backup.sh"), /flock -n 9/);
  assert.match(read("scripts/run-check.sh"), /flock -n 9/);
  assert.match(read("README.md"), /Session pooler/);
  assert.match(read("README.md"), /supabase\/postgres:17\.6/);
  assert.doesNotMatch(read("README.md"), /postgres:15/);
  assert.match(read("restore-drill.sh"), /supabase\/postgres:17\.6\.1\.150/);
  assert.match(read(".env.example"), /pooler\.supabase\.com:5432\/postgres\?sslmode=require/);
});

test("shell files are syntactically valid", () => {
  const bash = findBash();
  assert.ok(bash, "Git Bash (Windows) or bash (Linux) is required for syntax tests");
  for (const file of [
    "scripts/entrypoint.sh",
    "scripts/run-backup.sh",
    "scripts/run-check.sh",
    "restore-drill.sh",
  ]) {
    execFileSync(bash, ["-n", bashPath(path.join(backupRoot, file))]);
  }
});

test("pg_dump failure exits nonzero, skips downstream work, and alerts", () => {
  const run = runScript("scripts/run-backup.sh", { FAKE_PG_DUMP_STATUS: "9" });
  try {
    assert.equal(run.result.status, 1, run.result.stderr);
    assert.ok(existsSync(path.join(run.calls, "pg_dump")));
    assert.ok(!existsSync(path.join(run.calls, "rclone")));
    assert.ok(!existsSync(path.join(run.calls, "restic-backup")));
    assert.ok(existsSync(path.join(run.calls, "curl")), `${run.result.stdout}\n${run.result.stderr}`);
  } finally {
    run.cleanup();
  }
});

test("Storage failure exits nonzero and never creates a restic snapshot", () => {
  const run = runScript("scripts/run-backup.sh", { FAKE_RCLONE_STATUS: "8" });
  try {
    assert.equal(run.result.status, 1, run.result.stderr);
    assert.ok(existsSync(path.join(run.calls, "pg_restore")));
    assert.ok(existsSync(path.join(run.calls, "rclone")));
    assert.ok(!existsSync(path.join(run.calls, "restic-backup")));
    assert.ok(existsSync(path.join(run.calls, "curl")), `${run.result.stdout}\n${run.result.stderr}`);
  } finally {
    run.cleanup();
  }
});

test("restic snapshot failure exits nonzero and skips retention", () => {
  const run = runScript("scripts/run-backup.sh", { FAKE_RESTIC_BACKUP_STATUS: "12" });
  try {
    assert.equal(run.result.status, 1, run.result.stderr);
    assert.ok(existsSync(path.join(run.calls, "restic-backup")));
    assert.ok(!existsSync(path.join(run.calls, "restic-forget")));
    assert.ok(existsSync(path.join(run.calls, "curl")), `${run.result.stdout}\n${run.result.stderr}`);
  } finally {
    run.cleanup();
  }
});

test("successful pipeline validates, snapshots, applies retention, and alerts", () => {
  const run = runScript("scripts/run-backup.sh");
  try {
    assert.equal(run.result.status, 0, `${run.result.stdout}\n${run.result.stderr}`);
    for (const call of [
      "pg_dump",
      "pg_restore",
      "rclone",
      "restic-backup",
      "restic-forget",
      "restic-snapshots",
      "curl",
    ]) {
      assert.ok(existsSync(path.join(run.calls, call)), `missing ${call}`);
    }
  } finally {
    run.cleanup();
  }
});

test("lock contention returns temporary-failure status before pg_dump", () => {
  const run = runScript("scripts/run-backup.sh", { FAKE_FLOCK_STATUS: "1" });
  try {
    assert.equal(run.result.status, 75, run.result.stderr);
    assert.ok(!existsSync(path.join(run.calls, "pg_dump")));
  } finally {
    run.cleanup();
  }
});

test("integrity-check failure exits nonzero and alerts", () => {
  const run = runScript("scripts/run-check.sh", { FAKE_RESTIC_CHECK_STATUS: "4" });
  try {
    assert.equal(run.result.status, 1, run.result.stderr);
    assert.ok(existsSync(path.join(run.calls, "restic-check")));
    assert.ok(existsSync(path.join(run.calls, "curl")), `${run.result.stdout}\n${run.result.stderr}`);
  } finally {
    run.cleanup();
  }
});
