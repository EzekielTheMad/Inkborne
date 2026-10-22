/** Closed preparation/native-row profile. No startup, Auth or gameplay activation. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TARGET, freezeSource, validateFrozen, manifestHash, psql, verifyRuntime,
  type FrozenManifest, type Journal, type RuntimeApproval, type Transport } from "./equipment-runtime";
import { openCharacterPsqlSession, type SessionProcess } from "./character-command-psql";
import { runCharacterCommandConcurrency, type NativeSession, type ConcurrencyReport } from "./character-command-concurrency";

export const CHARACTER_PROFILE = "character-command-rows-native-v1";
export const CHARACTER_FILES = ["scripts/character-command-native.ts", "scripts/character-command-psql.ts",
  "scripts/character-command-concurrency.ts", "supabase/staged/character-command-row-locks.sql",
  "scripts/character-command-verification/catalog.sql", "scripts/character-command-verification/preflight.sql",
  "scripts/character-command-verification/guard-fixture.sql", "scripts/character-command-verification/seed.sql",
  "scripts/character-command-verification/fixture-cleanup.sql"] as const;
export const CHARACTER_OPERATIONS = ["replay-baseline", "capture-selected-catalog", "install-closed-row-checks",
  "synthetic-fixtures", "observe-three-session-contention", "remove-owned-runtime"] as const;
export const CHARACTER_FIXTURE_IDS = Array.from({ length: 7 }, (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
type Fingerprint = { path: string; sha256: string };
export interface CharacterPackage {
  version: 1; scope: typeof CHARACTER_PROFILE; baseline: FrozenManifest; files: Fingerprint[];
  external: Fingerprint[]; operations: typeof CHARACTER_OPERATIONS; fixtureIds: string[];
}
export interface CharacterApproval {
  gate: "G2"; scope: typeof CHARACTER_PROFILE; approvedBy: "Victor"; approvedAtUTC: string;
  sourceSha: string; packageSha256: string; engineId: string; operations: typeof CHARACTER_OPERATIONS;
}
export interface CharacterNativeJournal {
  scope: typeof CHARACTER_PROFILE; execution: "native"; packageSha256: string; sourceSha: string;
  authenticationAccepted: false; complete: boolean; steps: string[]; catalogs: unknown[];
  scenarioReport?: ConcurrencyReport; backendPids: number[]; backendsAbsent: boolean;
  failurePhase?: string; cleanupErrors: string[];
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const characterPackageHash = (value: CharacterPackage) => hash(JSON.stringify(value));
const fail = (): never => { throw new Error("character-command native preparation/refusal"); };
function source(root: string, relative: string) {
  const base = realpathSync(root), file = path.join(base, relative);
  if (path.isAbsolute(relative) || relative.includes("..") || !/^[A-Za-z0-9_./-]+$/.test(relative)
    || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(base + path.sep)) return fail();
  return readFileSync(file);
}
function externalPaths() {
  return [path.join(TARGET.scratch, "bootstrap", "98-webhooks.sql"), path.join(TARGET.scratch, "bootstrap", "99-roles.sql"),
    path.join(TARGET.scratch, "character-command-run.mjs")];
}
export function freezeCharacterPackage(root: string): CharacterPackage {
  const baseline = freezeSource(root);
  const files = CHARACTER_FILES.map(relative => ({ path: relative, sha256: hash(source(root, relative)) }));
  const external = externalPaths().map(file => {
    if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() || realpathSync(file) !== file) return fail();
    return { path: file, sha256: hash(readFileSync(file)) };
  });
  return { version: 1, scope: CHARACTER_PROFILE, baseline, files, external,
    operations: CHARACTER_OPERATIONS, fixtureIds: CHARACTER_FIXTURE_IDS };
}
export function validateCharacterApproval(pkg: CharacterPackage, approval: CharacterApproval, confirmation: string) {
  const keys = ["gate", "scope", "approvedBy", "approvedAtUTC", "sourceSha", "packageSha256", "engineId", "operations"].sort();
  if (!approval || JSON.stringify(Object.keys(approval).sort()) !== JSON.stringify(keys)
    || approval.gate !== "G2" || approval.scope !== CHARACTER_PROFILE || approval.approvedBy !== "Victor"
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(approval.approvedAtUTC)
    || !Number.isFinite(Date.parse(approval.approvedAtUTC)) || approval.sourceSha !== pkg.baseline.sourceSha
    || approval.packageSha256 !== characterPackageHash(pkg) || confirmation !== approval.packageSha256
    || !/^[A-Za-z0-9:_-]{4,128}$/.test(approval.engineId)
    || JSON.stringify(approval.operations) !== JSON.stringify(CHARACTER_OPERATIONS)) return fail();
}
export function loadCharacterPackage(root: string, pkg: CharacterPackage) {
  if (JSON.stringify(freezeCharacterPackage(root)) !== JSON.stringify(pkg)) return fail();
  const files = validateFrozen(root, pkg.baseline);
  for (const file of pkg.files) {
    const bytes = source(root, file.path);
    if (hash(bytes) !== file.sha256) return fail(); files.set(file.path, bytes.toString("utf8"));
  }
  return files;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function baselineMatches(pkg: CharacterPackage, receipt: Journal, resourceIds: Pick<RuntimeApproval, "containerId">) {
  const names = ["official-bootstrap-preflight", ...pkg.baseline.migrations.map(file => file.path), "baseline-assertions"];
  if (!receipt || !receipt.complete || receipt.phase !== "baseline" || receipt.sourceSha !== pkg.baseline.sourceSha
    || receipt.containerId !== resourceIds.containerId || receipt.manifestSha256 !== manifestHash(pkg.baseline)
    || receipt.steps.length !== names.length || receipt.steps.some((step, index) => step.name !== names[index] || step.outcome !== "passed" || step.exitCode !== 0)) return fail();
}

export async function executeCharacterRows(options: {
  root: string; pkg: CharacterPackage; approval: CharacterApproval; confirmation: string; baselineReceipt: Journal;
  resourceIds: Pick<RuntimeApproval, "engineId" | "containerId" | "imageId" | "networkId">;
  transport: Transport; save(journal: CharacterNativeJournal): void; saveProcess(record: SessionProcess): void;
}): Promise<CharacterNativeJournal> {
  // Reject missing/inherited approval before source reads, transport or sessions.
  validateCharacterApproval(options.pkg, options.approval, options.confirmation);
  const files = loadCharacterPackage(options.root, options.pkg);
  baselineMatches(options.pkg, options.baselineReceipt, options.resourceIds);
  if (options.resourceIds.engineId !== options.approval.engineId) return fail();
  const journal: CharacterNativeJournal = { scope: CHARACTER_PROFILE, execution: "native", authenticationAccepted: false,
    packageSha256: characterPackageHash(options.pkg), sourceSha: options.pkg.baseline.sourceSha,
    complete: false, steps: [], catalogs: [], backendPids: [], backendsAbsent: false, cleanupErrors: [] };
  const sessions: NativeSession[] = [];
  let phase = "runtime", seeded = false;
  const save = () => options.save(structuredClone(journal));
  const sql = async (name: string, text: string, json = false) => {
    phase = name; save();
    const result = await options.transport(psql(options.resourceIds, text.replaceAll("\r\n", "\n")));
    if (result.code !== 0 || Buffer.byteLength(result.stdout) > 1_048_576) return fail();
    let value: unknown;
    if (json) { try { value = JSON.parse(result.stdout.trim()); } catch { return fail(); } }
    journal.steps.push(name); save(); return value;
  };
  const file = (name: string) => files.get(`scripts/character-command-verification/${name}.sql`) ?? fail();
  const catalog = async (name: string) => {
    const value = object(await sql(name, `BEGIN READ ONLY; SET LOCAL statement_timeout='15s';\n${file("catalog")}\nCOMMIT;`, true));
    if (value.catalog_version !== 1 || value.status !== "complete" || value.current_role !== "postgres") return fail();
    journal.catalogs.push(value); save(); return value;
  };
  try {
    save(); await verifyRuntime(options.transport, options.resourceIds);
    await catalog("catalog-before");
    const preflight = object(await sql("selected-preflight", file("preflight"), true));
    if (preflight.phase !== "preflight" || preflight.passed !== true) return fail();
    await sql("scratch-guard-fixture", `BEGIN;\n${file("guard-fixture")}\nCOMMIT;`);
    await sql("closed-row-functions", files.get("supabase/staged/character-command-row-locks.sql") ?? fail());
    const after = await catalog("catalog-after-install");
    const definitions = [
      ["private.check_character_command_clock_v1(timestamp with time zone)", "check_character_command_clock_v1", "timestamp with time zone"],
      ["private.lock_character_command_rows_v1(jsonb,uuid)", "lock_character_command_rows_v1", "void"],
    ];
    const staged = (files.get("supabase/staged/character-command-row-locks.sql") ?? fail()).replaceAll("\r\n", "\n");
    for (const [signature, name, returnType] of definitions) {
      const metadata = (after.functions as unknown[]).map(object).find(row => row.signature === signature);
      const start = staged.indexOf(`CREATE FUNCTION private.${name}(`), open = staged.indexOf("AS $$", start), close = staged.indexOf("$$;", open + 5);
      if (!metadata || start < 0 || open < 0 || close < 0 || metadata.owner !== "postgres" || metadata.security_definer !== false
        || metadata.volatility !== "v" || metadata.return_type !== returnType || JSON.stringify(metadata.search_path) !== JSON.stringify(['search_path=""'])
        || metadata.body_md5 !== createHash("md5").update(staged.slice(open + 5, close)).digest("hex")) return fail();
      const execute = (metadata.role_execute as unknown[]).map(object);
      const required = execute.filter(row => ["postgres", "anon", "authenticated", "service_role"].includes(String(row.role)));
      if (required.length !== 4 || new Set(required.map(row => row.role)).size !== 4 || execute.some(row => row.execute !== (row.role === "postgres"))) return fail();
    }
    const seededResult = object(await sql("synthetic-seed", file("seed"), true)); seeded = true;
    if (seededResult.phase !== "seed" || seededResult.passed !== true || seededResult.synthetic !== true) return fail();
    for (const side of ["blocker", "checker", "observer"] as const) {
      const session = await openCharacterPsqlSession({ root: options.root, resourceIds: options.resourceIds,
        transport: options.transport, save: options.saveProcess }, side);
      sessions.push(session); journal.backendPids.push(session.backendPid); save();
    }
    phase = "three-session-contention"; save();
    journal.scenarioReport = await runCharacterCommandConcurrency({ blocker: sessions[0], checker: sessions[1], observer: sessions[2] });
    save(); if (!journal.scenarioReport.passed) return fail();
    journal.steps.push(phase);
  } catch { journal.failurePhase = phase; }
  finally {
    const closed = await Promise.allSettled(sessions.map(session => session.close()));
    if (closed.some(result => result.status !== "fulfilled")) journal.cleanupErrors.push("session-close-refused");
    try {
      if (journal.backendPids.length) {
        const absence = object(await sql("backend-absence", `SELECT jsonb_build_object('absent',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=ANY(ARRAY[${journal.backendPids.join(",")}]::integer[])));`, true));
        journal.backendsAbsent = absence.absent === true;
        if (!journal.backendsAbsent) journal.cleanupErrors.push("owned-backends-remain");
      }
      if (seeded && (journal.backendsAbsent || !journal.backendPids.length)) {
        const clean = object(await sql("fixture-cleanup", file("fixture-cleanup"), true));
        if (clean.phase !== "fixture_cleanup" || clean.passed !== true || clean.exact_fixture_rows_absent !== true) return fail();
      }
      await verifyRuntime(options.transport, options.resourceIds);
    } catch { journal.cleanupErrors.push("final-readback-or-cleanup-refused"); }
    journal.complete = !journal.failurePhase && journal.cleanupErrors.length === 0 && journal.backendsAbsent && journal.scenarioReport?.passed === true;
    save();
  }
  return journal;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3 || process.argv[2] !== "freeze") throw new Error("Use freeze; execution belongs to the separately approved frozen controller");
  const pkg = freezeCharacterPackage(process.cwd());
  console.log(JSON.stringify({ package: pkg, packageSha256: characterPackageHash(pkg) }, null, 2));
}
