import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Builtins only until the externally bound executable closure has been checked.
const startedAt = Date.now(), script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), "..");
const rootCheckout = path.resolve(root, "../equipment-verification");
const relativeScript = "scripts/measure-campaign-monster-guards.mjs";
let stopRequested = false;
process.on("message", value => { if (value?.type === "stop") stopRequested = true; });
process.once("disconnect", () => { stopRequested = true; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopRequested = true; });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const output = path.join(root, "test-results/campaign-monster-guard-measurement", `run-${startedAt}-${process.pid}`);
const result = {
  kind: "unrendered-campaign-monster-guard-measurement-v1", acceptance: false,
  rendered: false, browser: false, server: false, cases: 0, sql: false,
  state: "preparing", startedUtc: new Date(startedAt).toISOString(), worker: root,
  timings: [], phases: [], observed: [], readback: [], failure: null,
  lifecycleBound: "UNVERIFIED: inherited synchronous Git/PowerShell and esbuild operations cannot be preempted by this script",
  observationCompleteness: "sampled; short-lived children can be missed; not an all-process cleanup certificate",
  ownExitReadback: "required from the root-owned launcher after this process exits",
};
let deadline, gateStartedAt, cleanupReserveMs, inputs, processes, esbuild, self, entry, production;
let boot, modelBundle, fixtureBundle, browserBundle, baselineProof;
const captured = new Map(), modelCaptured = new Map();
let outputReady = false;

function timeLeft() { return deadline - Date.now(); }
function synchronousAllowance() {
  assert.ok(Number.isSafeInteger(deadline) && timeLeft() > 0, "External deadline exhausted");
  return Math.max(1, Math.min(30000, timeLeft()));
}
function git(checkout, args) {
  return execFileSync("git", ["-C", checkout, ...args], { windowsHide: true, timeout: synchronousAllowance(), maxBuffer: 32 * 1024 * 1024 });
}
async function checkpoint(label, reserve = cleanupReserveMs ?? 0) {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopRequested, false, `Cooperative stop before ${label}`);
  assert.ok(Number.isSafeInteger(deadline) && timeLeft() >= reserve, `External deadline/reservation before ${label}`);
}
async function persist() {
  if (!outputReady) return;
  result.elapsedMs = Date.now() - startedAt;
  result.stopRequested = stopRequested;
  await fs.writeFile(path.join(output, "measurement.json"), JSON.stringify(result, null, 2));
}
async function prepareOutput() {
  for (const directory of [root, path.join(root, "test-results"), path.dirname(output)]) {
    try {
      const info = await fs.lstat(directory); assert.ok(info.isDirectory() && !info.isSymbolicLink(), "Owned output ancestor symlink refused");
    } catch (error) {
      if (error.code !== "ENOENT" || directory === root) throw error;
      await fs.mkdir(directory);
    }
  }
  await fs.mkdir(output); outputReady = true;
}
async function measured(label, action) {
  await checkpoint(label);
  const start = performance.now(), utc = new Date().toISOString();
  let succeeded = false;
  try { const value = await action(); succeeded = true; return value; }
  finally {
    result.timings.push({ label, startUtc: utc, endUtc: new Date().toISOString(), elapsedMs: performance.now() - start, actual: true, succeeded });
    result.phases.push({ label, succeeded }); await persist();
  }
}
// Early native identity is read-only, before inherited modules or package imports.
// It is not a fallback for a missing/late capture: any failure stops the probe.
function initialOsIdentity() {
  const code = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${process.pid}';if(!$p -or $p.ParentProcessId -ne ${process.ppid} -or !$p.CreationDate -or !$p.CommandLine){exit 3};$all=@(Get-Process);@{identity=@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o');command=$p.CommandLine};resources=@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$all.Count;workingSetBytes=($all|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($all|Measure-Object CPU -Sum).Sum;listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}}|ConvertTo-Json -Compress -Depth 4`;
  const observation = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true, timeout: synchronousAllowance(), maxBuffer: 1024 * 1024 }));
  const value = observation.identity;
  assert.equal(value.pid, process.pid); assert.equal(value.parentPid, process.ppid);
  assert.match(value.birthUtc, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.ok(value.command.includes(script), "Actual command must name this exact probe");
  result.resourcesBefore = observation.resources;
  return { ...value, cwdKnownFromLaunch: root, capturedUtc: new Date().toISOString() };
}
async function readBoundDescriptor() {
  const selected = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR, digest = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
  assert.ok(selected && path.isAbsolute(selected)); assert.match(digest ?? "", /^[a-f0-9]{64}$/);
  const info = await fs.lstat(selected); assert.ok(info.isFile() && !info.isSymbolicLink() && info.size < 65536);
  const bytes = await fs.readFile(selected); assert.equal(sha(bytes), digest);
  const descriptor = JSON.parse(bytes.toString("utf8"));
  assert.equal(descriptor.kind, "independently-reviewed-offline-m5-v1");
  assert.equal(descriptor.producerCheckpoint, "0aec1242c911bc35f92ba413fd37f483b6b83f03");
  assert.deepEqual(descriptor.producerAmendments, {
    "tests/fixtures/campaign-monster-instances.ts": "6b793fe8b3e35e4e6ac2297509a2f4ec5023f5c6",
    "components/campaigns/monster-instance-form.tsx": "d43c3b688abeb4e4765b4f46ba62aa915b5b73dc",
  });
  assert.equal(descriptor.phaseAllocation?.status, "pending-measurement");
  assert.equal(descriptor.phaseAllocation.wholeMs, 900000);
  assert.deepEqual(descriptor.nodeRuntime, { executable: process.execPath, version: process.version, executedSha256: sha(await fs.readFile(process.execPath)) });
  const preparation = descriptor.guardMeasurementPreparation;
  assert.deepEqual(Object.keys(preparation ?? {}).sort(), ["checkpoint", "cleanupReserveMs", "executedSha256", "gitBlobOid", "kind"].sort());
  assert.equal(preparation.kind, "independently-reviewed-guard-only-source-v1");
  assert.match(preparation.checkpoint ?? "", /^[a-f0-9]{40}$/);
  assert.match(preparation.gitBlobOid ?? "", /^[a-f0-9]{40}$/);
  assert.match(preparation.executedSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(preparation.cleanupReserveMs) && preparation.cleanupReserveMs >= 30000 && preparation.cleanupReserveMs < 900000);
  cleanupReserveMs = preparation.cleanupReserveMs;
  assert.match(descriptor.harnessCheckpoint ?? "", /^[a-f0-9]{40}$/);
  assert.match(descriptor.rootSourceSha ?? "", /^[a-f0-9]{40}$/);
  return { descriptor, descriptorPath: selected, descriptorSha256: digest };
}
async function bootstrap() {
  const bound = await readBoundDescriptor(), descriptor = bound.descriptor;
  result.selectedDescriptor = { path: bound.descriptorPath, sha256: bound.descriptorSha256 };
  const own = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts", "e2e/local-campaign-monster/campaign-monster.spec.mts",
    "scripts/campaign-monster-production-inputs.mjs", "scripts/campaign-monster-scenarios.mjs", "scripts/verify-campaign-monster-local.mjs"];
  assert.deepEqual(Object.keys(descriptor.harnessBlobs ?? {}).sort(), [...own].sort());
  const helpers = {
    "scripts/passive-feature-production-assets.mjs": { anchor: "5fedd6222eeb97c11f7645dac580cbebee845311", oid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" },
    "scripts/npc-process.mjs": { anchor: "846860209041819deb27b1547c06a77720ad3037", oid: "0841bda7b9e785280e684030bf4fe900d81465e5" },
  };
  for (const checkout of [root, rootCheckout]) {
    let ancestor = checkout;
    while (true) {
      const info = await fs.lstat(ancestor); assert.ok(info.isDirectory() && !info.isSymbolicLink(), "Checkout ancestor symlink refused");
      const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent;
    }
    assert.equal(git(checkout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "", "Frozen tracked source required");
  }
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), descriptor.rootSourceSha);
  const proof = [];
  result.bootstrapProgress = proof;
  for (const relative of [relativeScript, ...own, ...Object.keys(helpers)]) {
    await checkpoint(`builtin raw binding ${relative}`);
    const anchor = relative === relativeScript ? descriptor.guardMeasurementPreparation.checkpoint : helpers[relative]?.anchor ?? descriptor.harnessCheckpoint;
    const oid = relative === relativeScript ? descriptor.guardMeasurementPreparation.gitBlobOid : helpers[relative]?.oid ?? descriptor.harnessBlobs[relative];
    assert.equal(git(root, ["rev-parse", `${anchor}:${relative}`]).toString().trim(), oid);
    let executedSha256, representation;
    const identities = [];
    for (const checkout of [root, rootCheckout]) {
      const info = await fs.lstat(path.join(checkout, relative)); assert.ok(info.isFile() && !info.isSymbolicLink());
      for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]]) assert.equal(git(checkout, args).toString().trim(), "");
      const head = git(checkout, ["rev-parse", `HEAD:${relative}`]).toString().trim(), index = git(checkout, ["rev-parse", `:${relative}`]).toString().trim();
      assert.equal(head, oid); assert.equal(index, oid);
      const attributes = git(checkout, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", relative]).toString();
      assert.ok(attributes.includes(`${relative}: filter: unspecified`)); assert.ok(attributes.includes(`${relative}: working-tree-encoding: unspecified`));
      const config = {};
      for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
        try { config[key] = git(checkout, ["config", "--show-origin", "--get", key]).toString().trim(); }
        catch (error) { if (error.status !== 1) throw error; config[key] = null; }
      }
      const current = { attributes, config }; if (representation) assert.deepEqual(current, representation); representation = current;
      const raw = await fs.readFile(path.join(checkout, relative));
      assert.equal(sha(raw), sha(git(checkout, ["cat-file", "--filters", `--path=${relative}`, oid])));
      if (executedSha256) assert.equal(sha(raw), executedSha256); executedSha256 = sha(raw);
      identities.push({ checkout, head, index });
    }
    if (relative === relativeScript) assert.equal(executedSha256, descriptor.guardMeasurementPreparation.executedSha256, "Independently supplied mounted probe digest required");
    proof.push({ relative, anchor, oid, executedSha256, representation, identities });
    await persist();
  }
  return { ...bound, proof, workerHead: git(root, ["rev-parse", "HEAD"]).toString().trim() };
}
async function observe(label) {
  await checkpoint(`OS snapshot ${label}`);
  const rows = await processes.ownedSnapshot(self);
  for (const row of rows) {
    assert.ok(row.command && row.birthUtc && Number.isSafeInteger(row.pid) && Number.isSafeInteger(row.parentPid));
    const key = `${row.pid}:${row.birthUtc}`;
    if (!result.observed.some(value => `${value.pid}:${value.birthUtc}` === key)) result.observed.push({ ...row, observationPhase: label });
  }
  await persist();
}
async function fullRebind() {
  const proof = await inputs.rebindCampaignMonsterInputs(root, boot.descriptor.buildManifestPath, processes.receipt,
    browserBundle.metafile, captured, production.artifacts, modelBundle, fixtureBundle);
  assert.deepEqual(proof, baselineProof);
  const bytes = await fs.readFile(modelBundle.outputPath);
  assert.equal(bytes.length, modelBundle.outputBytes); assert.equal(sha(bytes), modelBundle.outputSha256);
  assert.deepEqual(await bootstrap(), boot);
  return proof;
}
try {
  assert.deepEqual(process.argv.slice(2, 3), ["--shared-deadline"]); assert.equal(process.argv.length, 4);
  deadline = Number(process.argv[3]); gateStartedAt = Number(process.env.INKBORNE_M5_GATE_STARTED_AT);
  assert.ok(Number.isSafeInteger(gateStartedAt) && gateStartedAt > 0 && gateStartedAt <= startedAt);
  assert.ok(Number.isSafeInteger(deadline) && deadline === gateStartedAt + 900000 && deadline > Date.now());
  assert.equal(process.cwd(), root, "Root must launch the probe in its exact owned workspace");
  result.externalStartedUtc = new Date(gateStartedAt).toISOString(); result.deadlineUtc = new Date(deadline).toISOString();
  await prepareOutput();
  await checkpoint("initial native identity", 0);
  self = initialOsIdentity(); result.taskProcess = self;
  process.send?.({ type: "guard-measurement-output", path: output, identity: self }); await persist();
  boot = await measured("builtin-entry-bootstrap", bootstrap); result.bootstrap = boot;
  await checkpoint("approved inputs import");
  inputs = await import("./campaign-monster-production-inputs.mjs");
  assert.deepEqual(await inputs.reviewedDescriptor(root), { ...boot.descriptor, descriptorPath: boot.descriptorPath, descriptorSha256: boot.descriptorSha256 });
  entry = await measured("full-entry", () => inputs.verifyCampaignMonsterEntry(root));
  assert.equal(entry.descriptor.phaseAllocation.status, "pending-measurement");
  processes = await measured("repeated-entry-and-process-import", () => inputs.loadCampaignMonsterProcess(root, entry));
  const confirmedSelf = await processes.freshIdentity(process.pid, process.ppid);
  for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(confirmedSelf[key], self[key]);
  processes.assertNoOtherRunner(script, process.pid);
  result.resourcesAfterEntry = processes.resources(); await observe("before-assets");
  production = await measured("matching-build-assets-full-runtime", () => inputs.loadCampaignMonsterProductionAssets(root, boot.descriptor.buildManifestPath, processes.receipt));
  // loadProductionAssets binds the full installed transitive package/file closure
  // before this first package import, even though no browser is launched.
  await checkpoint("approved esbuild import"); esbuild = await import("esbuild");
  const boundaryPlugin = { name: "declared-m5-guard-model-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/app\/|server-model$|server-only$|@\/lib\/supabase\/server$)/ }, args => {
      if (args.path === "next/dist/client/components/unstable-rethrow.browser.js") return;
      assert.ok(Object.hasOwn(inputs.boundarySources, args.path), `Unknown/live boundary refused ${args.path}`);
      return { path: args.path, namespace: "campaign-monster-offline" };
    });
    builder.onLoad({ filter: /.*/, namespace: "campaign-monster-offline" }, args => {
      const contents = inputs.boundarySources[args.path];
      (args.path === "server-model" ? modelCaptured : captured).set(`campaign-monster-offline:${args.path}`, { sha256: sha(contents), bytes: Buffer.byteLength(contents) });
      return { loader: "js", contents, resolveDir: root };
    });
  } };
  const modelPath = path.join(output, "server-model.mjs");
  const nodeBundle = await measured("actual-node-model-bundle", () => esbuild.build({ entryPoints: ["server-model"], absWorkingDir: root, outfile: modelPath,
    bundle: true, platform: "node", format: "esm", metafile: true, plugins: [inputs.campaignMonsterProjectInputPlugin(root, modelCaptured), boundaryPlugin] }));
  const modelBytes = await fs.readFile(modelPath);
  assert.ok(modelBytes.length > 0 && modelBytes.length <= 16_777_216);
  modelBundle = { outputPath: modelPath, outputSha256: sha(modelBytes), outputBytes: modelBytes.length, metafile: nodeBundle.metafile, captured: [...modelCaptured].sort(([a], [b]) => a.localeCompare(b)) };
  result.modelOutput = { path: modelPath, bytes: modelBytes.length, sha256: modelBundle.outputSha256, executed: false };
  modelBundle.inputs = await measured("actual-node-model-metafile-captured-inputs", () => inputs.bindCampaignMonsterProjectInputs(root, nodeBundle.metafile, modelCaptured, production.artifacts, ["tests/fixtures/campaign-monster-instances.ts"]));
  await observe("after-node-bundle");
  const browserPath = path.join(output, "fixture.js");
  browserBundle = await measured("actual-browser-fixture-bundle", () => esbuild.build({ entryPoints: [path.join(root, "e2e/local-campaign-monster/fixture.tsx")], absWorkingDir: root, outfile: browserPath,
    bundle: true, platform: "browser", jsx: "automatic", metafile: true, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [inputs.campaignMonsterProjectInputPlugin(root, captured), boundaryPlugin] }));
  assert.ok(!Object.keys(browserBundle.metafile.outputs).some(value => value.endsWith(".css")), "Fixture CSS refused");
  const browserBytes = Buffer.from(await fs.readFile(browserPath));
  assert.ok(browserBytes.length > 0 && browserBytes.length <= 16_777_216);
  fixtureBundle = { outputPath: browserPath, outputSha256: sha(browserBytes), outputBytes: browserBytes.length };
  result.browserOutput = { ...fixtureBundle, served: false, rendered: false };
  Object.assign(production.artifacts, await measured("actual-browser-metafile-captured-inputs", () => inputs.bindCampaignMonsterProjectInputs(root, browserBundle.metafile, captured, production.artifacts)), { modelBundle, fixtureBundle });
  baselineProof = { artifacts: production.artifacts, metafile: browserBundle.metafile, captured: [...captured].sort(([a], [b]) => a.localeCompare(b)), modelBundle, fixtureBundle };
  await fs.writeFile(path.join(output, "unrendered-inputs.json"), JSON.stringify(baselineProof, null, 2), { flag: "wx" });
  process.send?.({ type: "unrendered-guard-inputs", proof: baselineProof });
  await observe("after-browser-bundle");
  result.esbuildIdentities = result.observed.filter(row => row.command.toLowerCase().includes(root.toLowerCase()) && /[\\/]esbuild(?:\.exe)?(?:["\s]|$)/i.test(row.command));
  assert.ok(result.esbuildIdentities.length > 0, "Esbuild service identity capture is missing; no guessed completion");
  await measured("normal-esbuild-stop-before-finals", async () => { await esbuild.stop(); result.esbuildStopReturned = true; });
  for (const identity of result.esbuildIdentities) {
    await checkpoint("esbuild identity absence before finals");
    const readback = await processes.absentIdentity(identity); result.readback.push(readback);
    assert.equal(readback.absent, true, "Esbuild service remains after normal stop");
  }
  // These invoke the same complete exports as the real runner/wrapper. No UI
  // execution, rendered-proof assertion, or force adapter call is made here.
  await measured("runner-full-fresh-rebind-components", fullRebind);
  await measured("wrapper-full-fresh-rebind-and-entry-components", async () => {
    await fullRebind(); assert.deepEqual(await inputs.verifyCampaignMonsterEntry(root), entry);
  });
  await measured("fresh-force-proof-components-only", async () => {
    await fullRebind(); assert.deepEqual(await inputs.verifyCampaignMonsterEntry(root), entry);
    assert.deepEqual(await inputs.verifyCampaignMonsterInheritedHelper(root, inputs.campaignMonsterProcessHelper), processes.receipt);
    const fresh = await processes.freshIdentity(self.pid, self.parentPid);
    for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(fresh[key], self[key]);
  });
  await checkpoint("complete guard measurements"); result.state = "unrendered-guard-components-complete";
} catch (error) {
  result.failure = { message: error.message, phase: result.timings.at(-1)?.label ?? "pre-bootstrap", name: error.name };
  result.state = "failed-or-uncertain"; process.exitCode = 1;
} finally {
  // Stop the service normally, never invoke forceOwnedTree/taskkill. This is an
  // attempted cleanup, not a promise that inherited sync operations are bounded.
  const cleanupStart = performance.now();
  try {
    if (esbuild) await esbuild.stop();
    result.esbuildStopReturned = Boolean(esbuild);
    if (processes && self && timeLeft() > 0) {
      const freshSelf = await processes.freshIdentity(self.pid, self.parentPid);
      for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(freshSelf[key], self[key]);
      for (const row of result.observed) {
        if (row.pid === process.pid) continue;
        assert.ok(timeLeft() > 0, "No remaining deadline for owned readback");
        result.readback.push(await processes.absentIdentity(row));
      }
      result.resourcesAfter = processes.resources();
      const remainingRows = await processes.ownedSnapshot(self);
      result.finalObserved = remainingRows;
      // The snapshot's own PowerShell observer can be transiently present.
      // Any other descendant requires launcher readback; never assume it exited.
      result.sampledReadbackAbsent = result.readback.every(value => value.absent);
      if (!result.sampledReadbackAbsent) throw Error("An observed child has no absent identity readback");
      const survivors = remainingRows.filter(row => row.pid !== self.pid
        && !(row.parentPid === self.pid && /powershell(?:\.exe)?/i.test(row.command ?? "") && row.command.includes("$taskRows=@(Get-CimInstance Win32_Process)")));
      assert.deepEqual(survivors, [], "Unexpected surviving descendant requires launcher readback");
    } else result.cleanupUncertain = "Process helper unavailable or external deadline exhausted; launcher identity/readback required";
    if (stopRequested || !Number.isSafeInteger(deadline) || timeLeft() <= 0 || result.cleanupUncertain) throw Error("Bounded cleanup/stop is unproved");
  } catch (error) {
    result.cleanupUncertain = error.message; result.failure ??= { message: error.message, phase: "cleanup", name: error.name };
    result.state = "failed-or-uncertain"; process.exitCode = 1;
  }
  result.timings.push({ label: "normal-esbuild-stop-and-sampled-os-readback", elapsedMs: performance.now() - cleanupStart, actual: true });
  result.endedUtc = new Date().toISOString();
  await persist(); process.send?.({ type: "guard-measurement-result", output, state: result.state });
}
