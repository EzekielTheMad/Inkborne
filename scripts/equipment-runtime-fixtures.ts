/** R07.2 source preparation. Every real command requires separately obtained human G2 authority. */
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { makeFixtureDefinitions, makeFixtureSystemSchema, makePassiveRevision } from "./equipment-runtime/fixture-data";
import { actualTransport, auditCounts, freezeSource, manifestHash, psql, runtimeProcessRecords, sha256, TARGET,
  validateApproval, verifyRuntime, type FrozenManifest, type Journal, type RuntimeApproval, type Transport } from "./equipment-runtime";

export const RUN = "r07-2-20261012-a";
export const RUNTIME_LIMITS = { durationMs: 15 * 60 * 1000, commands: 6500 } as const;
const id = (suffix: number) => `07020000-2026-4a12-8e00-${String(suffix).padStart(12, "0")}`;
export const ROOT_IDS = { owner: id(1), foreign: id(2), system: id(3), class: id(10), feature: id(11), asi: id(12), spell: id(13), item: id(14), foreignCharacter: id(20) } as const;
export const BUDGETS = { "auth.users": 2, "public.profiles": 2, "public.game_systems": 1, "public.content_definitions": 5,
  "public.content_versions": 6, "public.characters": 3, "public.character_content_refs": 6, "public.character_feature_grants": 4,
  "public.character_spell_grants": 2, "public.character_spells": 2, "public.character_inventory": 2, "public.character_starting_grants": 2 } as const;
export const PHASES = ["seed", "create", "mechanics", "award", "consume", "replay", "catalog-drift", "copy", "roles"] as const;
type Phase = typeof PHASES[number];
export const FIXTURE_FILES = ["scripts/equipment-runtime-fixtures.ts", "scripts/equipment-runtime/fixture-data.ts", "scripts/equipment-runtime/fixture-preflight.sql",
  ...PHASES.map(phase => `scripts/equipment-runtime/fixture-${phase}.sql`), "scripts/equipment-runtime/fixture-readback.sql", "scripts/equipment-runtime/fixture-ownership.sql", "scripts/equipment-runtime/fixture-cleanup.sql"];
type OwnedIds = Record<keyof typeof BUDGETS, string[]>;
type State = { source?: string; copy?: string; receipt?: Record<string, unknown>; ids: OwnedIds };
type Audit = { rowCounts: { schema: string; table: string; rows: number }[]; [key: string]: unknown };
export type Predecessor = { manifest: FrozenManifest; approval: RuntimeApproval; baseline: Journal; stage: Journal };
export type FixtureManifest = { version: 1; scope: "R07.2-real-role-fixtures"; sourceSha: string; target: typeof TARGET;
  source: FrozenManifest; files: { path: string; sha256: string }[]; run: typeof RUN; fixtureIds: typeof ROOT_IDS; budgets: typeof BUDGETS;
  limits: typeof RUNTIME_LIMITS;
  predecessor: { manifestSha256: string; approvalSha256: string; baselineSha256: string; stageSha256: string; sourceSha: string;
    containerId: string; engineId: string; imageId: string; networkId: string } };
export type FixtureApproval = Omit<RuntimeApproval, "scope"> & { scope: FixtureManifest["scope"]; operations: ["fixtures", "cleanup"] };
export type FixtureJournal = { version: 1; scope: FixtureManifest["scope"]; manifestSha256: string; sourceSha: string; containerId: string;
  status: "incomplete" | "uncertain" | "fixtures-complete" | "cleaned"; state: State; audits: Audit[];
  steps: { phase: string; outcome: "started" | "passed" | "uncertain" }[]; processes: ReturnType<typeof runtimeProcessRecords> };
const hash = (value: unknown) => sha256(JSON.stringify(value));
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const fixtureManifestHash = hash;
function refuse(reason: string): never { throw new Error(`R07.2 refusal: ${reason}`); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) refuse("malformed evidence object"); return value as Record<string, unknown>; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const emptyIds = (): OwnedIds => ({ "auth.users": [], "public.profiles": [], "public.game_systems": [], "public.content_definitions": [],
  "public.content_versions": [], "public.characters": [], "public.character_content_refs": [], "public.character_feature_grants": [],
  "public.character_spell_grants": [], "public.character_spells": [], "public.character_inventory": [], "public.character_starting_grants": [] });
function bytes(root: string, relative: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.includes("..") || path.isAbsolute(relative)) refuse("unsafe source path");
  const base = realpathSync(root), file = path.join(base, relative);
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(base + path.sep)) refuse("source escape");
  return readFileSync(file);
}
function catalog(audit: Audit) { return hash(["extensions", "roles", "tables", "functions", "triggers", "policies", "table_grants"].map(key => audit[key])); }
function counts(audit: Audit) { return new Map(audit.rowCounts.map(row => [`${row.schema}.${row.table}`, row.rows])); }
function sameAudit(a: Audit, b: Audit) { return catalog(a) === catalog(b) && JSON.stringify(a.rowCounts) === JSON.stringify(b.rowCounts); }
function validatePredecessor(predecessor: Predecessor) {
  const { manifest, baseline, stage } = predecessor;
  validateApproval(manifest, predecessor.approval, manifestHash(manifest));
  if (manifest.scope !== "R07.1-baseline-and-stage" || manifest.version !== 1 || JSON.stringify(manifest.target) !== JSON.stringify(TARGET)) refuse("predecessor target/scope");
  const common = (receipt: Journal, phase: Journal["phase"], expected: string[]) => {
    if (!receipt.complete || receipt.phase !== phase || receipt.sourceSha !== manifest.sourceSha || receipt.manifestSha256 !== manifestHash(manifest)
      || !/^[a-f0-9]{64}$/.test(receipt.containerId) || JSON.stringify(receipt.steps.map(step => step.name)) !== JSON.stringify(expected)
      || receipt.steps.some(step => step.outcome !== "passed" || step.exitCode !== 0)) refuse("completed immutable predecessor receipt required");
  };
  common(baseline, "baseline", ["official-bootstrap-preflight", ...manifest.migrations.map(file => file.path), "baseline-assertions"]);
  common(stage, "stage", ["baseline-assertions", "stage-must-be-absent", "supabase/staged/starting-equipment-transaction.sql", "stage-assertions"]);
  if (baseline.audits.length !== 1 || stage.audits.length !== 2 || baseline.containerId !== stage.containerId || stage.containerId !== predecessor.approval.containerId
      || !sameAudit(baseline.audits[0] as Audit, stage.audits[0] as Audit)) refuse("predecessor audit lineage mismatch");
}
export function freezeFixtures(root: string, predecessor: Predecessor): FixtureManifest {
  validatePredecessor(predecessor);
  const source = freezeSource(root);
  // The old helper itself may change additively. Migration, stage and SQL/assertion bytes may not.
  const protectedFiles = [...predecessor.manifest.migrations, ...predecessor.manifest.files.filter(file => file.path !== "scripts/equipment-runtime.ts")];
  const current = new Map([...source.migrations, ...source.files].map(file => [file.path, file.sha256]));
  if (JSON.stringify(source.migrations) !== JSON.stringify(predecessor.manifest.migrations)
      || protectedFiles.some(file => current.get(file.path) !== file.sha256)) refuse("predecessor migration/stage/bootstrap/catalog bytes changed");
  return { version: 1, scope: "R07.2-real-role-fixtures", sourceSha: source.sourceSha, target: TARGET, source,
    files: FIXTURE_FILES.map(file => ({ path: file, sha256: sha256(bytes(root, file)) })), run: RUN, fixtureIds: ROOT_IDS, budgets: BUDGETS, limits: RUNTIME_LIMITS,
    predecessor: { manifestSha256: manifestHash(predecessor.manifest), approvalSha256: hash(predecessor.approval), baselineSha256: hash(predecessor.baseline), stageSha256: hash(predecessor.stage),
      sourceSha: predecessor.manifest.sourceSha, containerId: predecessor.stage.containerId, engineId: predecessor.approval.engineId,
      imageId: predecessor.approval.imageId, networkId: predecessor.approval.networkId } };
}
export function validateFixtureApproval(manifest: FixtureManifest, approval: FixtureApproval, confirmation: string) {
  if (approval.gate !== "G2" || approval.scope !== manifest.scope || approval.approvedBy !== "Victor"
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(approval.approvedAtUTC)
      || approval.sourceSha !== manifest.sourceSha || approval.manifestSha256 !== hash(manifest) || confirmation !== hash(manifest)
      || JSON.stringify(approval.operations) !== JSON.stringify(["fixtures", "cleanup"])) refuse("actual human G2 fixtures+cleanup record and exact confirmation required");
  if (![approval.containerId, approval.networkId].every(value => /^[a-f0-9]{64}$/.test(value)) || !/^sha256:[a-f0-9]{64}$/.test(approval.imageId)
      || !/^[A-Za-z0-9:_-]{4,128}$/.test(approval.engineId)
      || ["containerId", "imageId", "engineId", "networkId"].some(key => approval[key as keyof FixtureApproval] !== manifest.predecessor[key as keyof FixtureManifest["predecessor"]])) refuse("exact predecessor resource IDs required");
}
export function validateState(value: unknown): State {
  const state = object(value), owned = object(state.ids);
  if (Object.keys(state).some(key => !["source", "copy", "receipt", "ids"].includes(key)) || Object.keys(owned).sort().join() !== Object.keys(BUDGETS).sort().join()) refuse("unknown fixture state fields");
  for (const [table, budget] of Object.entries(BUDGETS)) {
    const list = owned[table];
    if (!Array.isArray(list) || list.length > budget || new Set(list).size !== list.length || list.some(value => typeof value !== "string" || !UUID.test(value))) refuse("owned ID budget/identity violated");
  }
  for (const key of ["source", "copy"] as const) if (state[key] !== undefined && (typeof state[key] !== "string" || !UUID.test(state[key]) || !(owned["public.characters"] as string[]).includes(state[key] as string))) refuse("unrecorded generated character");
  if ([state.source, state.copy].some(value => value !== undefined && Object.values(ROOT_IDS).includes(value as typeof ROOT_IDS[keyof typeof ROOT_IDS]))) refuse("generated character reused a fixed root");
  if (state.source && state.copy === state.source) refuse("copy identity reused");
  if (state.receipt !== undefined) {
    const receipt = object(state.receipt);
    if (Object.keys(receipt).sort().join() !== ["awarded_at", "grant_id", "inventory_ids", "plan"].sort().join()
      || typeof receipt.grant_id !== "string" || !(owned["public.character_starting_grants"] as string[]).includes(receipt.grant_id)
      || !Array.isArray(receipt.inventory_ids) || receipt.inventory_ids.length !== 1
      || receipt.inventory_ids.some(item => !(owned["public.character_inventory"] as string[]).includes(item))
      || typeof receipt.awarded_at !== "string" || Number.isNaN(Date.parse(receipt.awarded_at)) || canonical(receipt.plan) !== canonical(PLAN)) refuse("unexpected original receipt");
  }
  return structuredClone(state) as State;
}
export const PICKS = { selections: { "class:0": "a" }, picks: {} };
export const PLAN = { items: [{ content_id: ROOT_IDS.item, content_version: 1, name: "R07 synthetic provisions", content_type: "item", quantity: 2 }], currency: { gp: 15 } };
export const INTENT = { selections: PICKS, sources: { class: { id: ROOT_IDS.class, version: 1 }, background: null }, plan: PLAN };
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
export function renderFixtureSql(sql: string, state: State) {
  validateState(state);
  const definitions = makeFixtureDefinitions(RUN, ROOT_IDS);
  const settings = { run: RUN, roots: JSON.stringify(ROOT_IDS), state: JSON.stringify(state), intent: JSON.stringify(INTENT), definitions: JSON.stringify(definitions),
    feature_v2: JSON.stringify(makePassiveRevision(definitions.find(definition => definition.id === ROOT_IDS.feature)!)), system_schema: JSON.stringify(makeFixtureSystemSchema()) };
  // Values are validated finite synthetic data; never read environment or interpolate identifiers.
  return Object.entries(settings).map(([key, value]) => `SET inkborne.r07.${key} = ${quote(value)};`).join("\n") + "\n" + sql;
}
export function assertPhaseDelta(before: Audit, after: Audit, previous: State, next: State) {
  if (catalog(before) !== catalog(after)) refuse("fixture phase changed catalog");
  const beforeCounts = counts(before), afterCounts = counts(after);
  if (beforeCounts.size !== afterCounts.size) refuse("table inventory drift");
  for (const [table, beforeCount] of beforeCounts) {
    const expected = table in BUDGETS ? next.ids[table as keyof OwnedIds].length - previous.ids[table as keyof OwnedIds].length : 0;
    if (afterCounts.get(table) !== beforeCount + expected) refuse("phase changed unrelated counts or exceeded approved delta");
  }
  for (const table of Object.keys(BUDGETS)) if (!beforeCounts.has(table)) refuse("required fixture table absent from audit");
}
function validatePhaseState(phase: Phase, previous: State, next: State) {
  const changes: Partial<Record<Phase, Partial<Record<keyof OwnedIds, number>>>> = {
    seed: { "auth.users": 2, "public.profiles": 2, "public.game_systems": 1, "public.content_definitions": 5, "public.content_versions": 5, "public.characters": 1 },
    create: { "public.characters": 1, "public.character_starting_grants": 1 },
    mechanics: { "public.character_content_refs": 3, "public.character_feature_grants": 2, "public.character_spell_grants": 1, "public.character_spells": 1 },
    award: { "public.character_inventory": 1 },
    "catalog-drift": { "public.content_versions": 1 },
    copy: { "public.characters": 1, "public.character_content_refs": 3, "public.character_feature_grants": 2, "public.character_spell_grants": 1, "public.character_spells": 1, "public.character_inventory": 1, "public.character_starting_grants": 1 },
  };
  for (const table of Object.keys(BUDGETS) as (keyof OwnedIds)[]) if (next.ids[table].length !== previous.ids[table].length + (changes[phase]?.[table] ?? 0)) refuse("unapproved phase ID delta");
  const exact = (table: keyof OwnedIds, expected: number) => { if (next.ids[table].length !== expected) refuse("phase ID count mismatch"); };
  if (phase === "seed") {
    for (const [table, expected] of [["auth.users", 2], ["public.profiles", 2], ["public.game_systems", 1], ["public.content_definitions", 5], ["public.content_versions", 5], ["public.characters", 1]] as const) exact(table, expected);
    if (next.ids["auth.users"].sort().join() !== [ROOT_IDS.owner, ROOT_IDS.foreign].sort().join()
      || next.ids["public.profiles"].sort().join() !== [ROOT_IDS.owner, ROOT_IDS.foreign].sort().join()
      || next.ids["public.game_systems"].join() !== ROOT_IDS.system || next.ids["public.characters"].join() !== ROOT_IDS.foreignCharacter
      || next.ids["public.content_definitions"].sort().join() !== [ROOT_IDS.class, ROOT_IDS.feature, ROOT_IDS.asi, ROOT_IDS.spell, ROOT_IDS.item].sort().join()) refuse("seed roots mismatch");
  } else if (phase === "create") { exact("public.characters", 2); exact("public.character_starting_grants", 1); if (!next.source) refuse("create ID missing"); }
  else if (phase === "mechanics") { exact("public.character_content_refs", 3); exact("public.character_feature_grants", 2); exact("public.character_spell_grants", 1); exact("public.character_spells", 1); }
  else if (phase === "award") { exact("public.character_inventory", 1); if (!next.receipt) refuse("award receipt missing"); }
  else if (phase === "copy") { for (const table of ["public.character_content_refs", "public.character_feature_grants", "public.character_spell_grants", "public.character_spells", "public.character_inventory", "public.character_starting_grants"] as const) exact(table, previous.ids[table].length * 2); exact("public.characters", 3); if (!next.copy) refuse("copy ID missing"); }
  for (const table of Object.keys(BUDGETS) as (keyof OwnedIds)[]) if (previous.ids[table].some(value => !next.ids[table].includes(value))) refuse("phase lost a recorded ID");
  if (["consume", "replay", "roles"].includes(phase) && hash(previous) !== hash(next)) refuse("non-creating phase changed journal identity/receipt");
  if (previous.source && next.source !== previous.source || previous.receipt && hash(next.receipt) !== hash(previous.receipt)) refuse("source/original receipt changed");
}
export async function executeFixtures(options: { root: string; manifest: FixtureManifest; predecessor: Predecessor; approval: FixtureApproval; confirmation: string;
  transport: Transport; save: (journal: FixtureJournal) => void; cleanupReceipt?: FixtureJournal }) {
  const { root, manifest, predecessor, approval } = options;
  validateFixtureApproval(manifest, approval, options.confirmation);
  if (hash(freezeFixtures(root, predecessor)) !== hash(manifest)) refuse("frozen fixture source/lineage drift");
  const started = Date.now(); let commandCount = 0;
  const transport: Transport = command => {
    const remaining = RUNTIME_LIMITS.durationMs - (Date.now() - started);
    if (remaining <= 0 || ++commandCount > RUNTIME_LIMITS.commands) refuse("runtime duration/command budget exhausted; no continuation");
    return options.transport({ ...command, timeoutMs: Math.min(command.timeoutMs, remaining) });
  };
  const frozen = new Map([...manifest.source.files, ...manifest.files].map(file => {
    const source = bytes(root, file.path); if (sha256(source) !== file.sha256) refuse("source changed while freezing"); return [file.path, source.toString("utf8")];
  }));
  const auditSql = frozen.get("scripts/equipment-runtime/catalog-audit.sql")!;
  const compose = (sql: string) => sql.replace("-- R07.2 OWNERSHIP", frozen.get("scripts/equipment-runtime/fixture-ownership.sql")!);
  await verifyRuntime(transport, approval);
  const initial = await auditCounts(transport, approval, auditSql) as Audit;
  const baseline = predecessor.stage.audits[1] as Audit;
  let journal: FixtureJournal;
  if (options.cleanupReceipt) {
    const receipt = options.cleanupReceipt;
    if (receipt.scope !== manifest.scope || receipt.status !== "fixtures-complete" || receipt.manifestSha256 !== hash(manifest) || receipt.sourceSha !== manifest.sourceSha
        || receipt.containerId !== approval.containerId || receipt.steps.length !== PHASES.length + 1 || receipt.steps.some(step => step.outcome !== "passed")
        || JSON.stringify(receipt.steps.map(step => step.phase)) !== JSON.stringify(["preflight", ...PHASES]) || receipt.audits.length !== PHASES.length + 2) refuse("exact completed fixture receipt required for cleanup");
    validateState(receipt.state);
    journal = structuredClone(receipt);
    if (!sameAudit(initial, journal.audits.at(-1)!)) refuse("cleanup phase freshness drift");
  } else {
    if (!sameAudit(initial, baseline)) refuse("post-stage predecessor freshness drift");
    journal = { version: 1, scope: manifest.scope, manifestSha256: hash(manifest), sourceSha: manifest.sourceSha, containerId: approval.containerId,
      status: "incomplete", state: { ids: emptyIds() }, audits: [initial], steps: [], processes: [] };
  }
  const save = () => { journal.processes = runtimeProcessRecords(); options.save(structuredClone(journal)); };
  save();
  const operation = async (phase: string, stateChanging: boolean) => {
    await verifyRuntime(transport, approval);
    const current = await auditCounts(transport, approval, auditSql) as Audit;
    if (!sameAudit(current, journal.audits.at(-1)!)) refuse("last committed cleanup freshness drift");
    const before = await auditCounts(transport, approval, auditSql) as Audit;
    if (!sameAudit(before, journal.audits.at(-1)!)) refuse("last committed phase freshness drift");
    const previous = structuredClone(journal.state);
    journal.steps.push({ phase, outcome: "started" }); save();
    try {
      const sql = `SET inkborne.r07.phase = ${quote(phase)};\n` + frozen.get(`scripts/equipment-runtime/fixture-${phase}.sql`)!
        + (stateChanging ? "\n" + compose(frozen.get("scripts/equipment-runtime/fixture-readback.sql")!) : "");
      const result = await transport(psql(approval, renderFixtureSql(sql, previous)));
      if (result.code !== 0) refuse("SQL phase failed; raw output suppressed");
      const output = object(JSON.parse(result.stdout.trim()));
      if (output.phase !== phase || output.passed !== true || Object.keys(output).sort().join() !== (stateChanging ? ["phase", "passed", "state"] : ["phase", "passed"]).sort().join()) refuse("phase readback incomplete");
      if (stateChanging) { const next = validateState(output.state); validatePhaseState(phase as Phase, previous, next); journal.state = next; }
      // Save confirmed committed IDs before further SQL. Save failure is an uncertain stop too.
      journal.steps.at(-1)!.outcome = "passed"; save();
      await verifyRuntime(transport, approval);
      const after = await auditCounts(transport, approval, auditSql) as Audit;
      assertPhaseDelta(before, after, previous, journal.state);
      journal.audits.push(after); save();
    } catch {
      journal.status = "uncertain"; journal.steps.at(-1)!.outcome = "uncertain";
      try { save(); } catch { /* Preserve original uncertain outcome; no subsequent SQL or cleanup. */ }
      refuse(`uncertain ${phase}; preserve evidence; no retry, continuation or deletion`);
    }
  };
  if (options.cleanupReceipt) {
    // Closed ownership graph is checked inside cleanup before any exact-ID deletion.
    await verifyRuntime(transport, approval);
    journal.steps.push({ phase: "cleanup", outcome: "started" }); save();
    try {
      const result = await transport(psql(approval, renderFixtureSql(compose(frozen.get("scripts/equipment-runtime/fixture-cleanup.sql")!), journal.state)));
      if (result.code !== 0 || hash(JSON.parse(result.stdout.trim())) !== hash({ phase: "cleanup", passed: true })) refuse("cleanup readback incomplete");
      await verifyRuntime(transport, approval);
      const after = await auditCounts(transport, approval, auditSql) as Audit;
      if (!sameAudit(after, baseline)) refuse("cleanup did not restore post-stage baseline");
      journal.audits.push(after); journal.steps.at(-1)!.outcome = "passed"; journal.status = "cleaned"; save();
    } catch { journal.status = "uncertain"; journal.steps.at(-1)!.outcome = "uncertain"; try { save(); } catch {} refuse("uncertain cleanup; no retry/deletion"); }
  } else {
    await operation("preflight", false);
    for (const phase of PHASES) await operation(phase, true);
    journal.status = "fixtures-complete"; save();
  }
  return journal;
}
function readEvidence(file: string) {
  const base = realpathSync(path.join(TARGET.scratch, "evidence")), resolved = realpathSync(file);
  if (path.extname(resolved) !== ".json" || !resolved.startsWith(base + path.sep) || lstatSync(file).isSymbolicLink()) refuse("existing scratch JSON evidence required");
  const value = readFileSync(file); if (value.length > 2 * 1024 * 1024) refuse("evidence size limit"); return JSON.parse(value.toString("utf8"));
}
async function main() {
  const args = process.argv.slice(2), mode = args.shift();
  if (!["freeze", "fixtures", "cleanup"].includes(mode ?? "")) refuse("use freeze, fixtures or separately confirmed cleanup");
  const flags = new Map<string, string>();
  while (args.length) { const key = args.shift()!, value = args.shift(); if (!key.startsWith("--") || !value || flags.has(key)) refuse("exact arguments required"); flags.set(key, value); }
  const expected = mode === "freeze" ? ["--predecessor"] : mode === "fixtures" ? ["--predecessor", "--manifest", "--approval", "--confirm-g2-manifest"] : ["--predecessor", "--manifest", "--approval", "--confirm-g2-manifest", "--fixture-receipt"];
  if ([...flags.keys()].sort().join() !== expected.sort().join()) refuse("unexpected/missing arguments");
  const predecessor = readEvidence(flags.get("--predecessor")!) as Predecessor;
  if (mode === "freeze") { const manifest = freezeFixtures(process.cwd(), predecessor); console.log(JSON.stringify({ manifest, manifestSha256: hash(manifest) }, null, 2)); return; }
  const manifest = object(readEvidence(flags.get("--manifest")!)).manifest as FixtureManifest;
  const receiptPath = path.join(TARGET.scratch, "evidence", "r07.2", `${mode}-receipt.json`);
  const evidenceBase = realpathSync(path.join(TARGET.scratch, "evidence"));
  if (realpathSync(path.dirname(receiptPath)) !== path.join(evidenceBase, "r07.2")) refuse("receipt directory symlink/escape");
  try { lstatSync(receiptPath); refuse("never overwrite an existing attempt"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let firstSave = true;
  await executeFixtures({ root: process.cwd(), manifest, predecessor, approval: readEvidence(flags.get("--approval")!) as FixtureApproval,
    confirmation: flags.get("--confirm-g2-manifest")!, transport: actualTransport,
    cleanupReceipt: mode === "cleanup" ? readEvidence(flags.get("--fixture-receipt")!) as FixtureJournal : undefined,
    save: journal => { writeFileSync(receiptPath, JSON.stringify(journal, null, 2), { mode: 0o600, flag: firstSave ? "wx" : "w" }); firstSave = false; } });
  console.log(`R07.2 ${mode} receipt saved. Trusted SQL role claims only; HTTP/JWT and concurrency remain untested.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => {
  console.error(error instanceof Error && error.message.startsWith("R07.2 refusal:") ? error.message : "R07.2 failed; raw output suppressed; preserve evidence"); process.exitCode = 1;
});
