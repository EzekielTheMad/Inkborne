import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile, fork } from "node:child_process";
import { fileURLToPath } from "node:url";

// No project/package imports and no force adapter. The clock starts before
// descriptor/bootstrap work; source, bootstrap, child and cleanup share it.
const startedAt = Date.now(), deadline = startedAt + 900000, stopAt = startedAt + 780000;
const script = fileURLToPath(import.meta.url), moduleCheckout = path.resolve(path.dirname(script), "..");
const workspace = path.dirname(moduleCheckout), worker = path.join(workspace, "r13-item-sharing-worker"), upstream = path.join(workspace, "equipment-verification");
const relativeLauncher = "scripts/launch-campaign-monster-guard-measurement.mjs", relativeProbe = "scripts/measure-campaign-monster-guards.mjs";
const output = path.join(upstream, "test-results/campaign-monster-guard-launcher", `run-${startedAt}-${process.pid}`);
const limits = { logBytes: 4 * 1024 * 1024, ipcMessageBytes: 64 * 1024 * 1024, ipcTotalBytes: 128 * 1024 * 1024, ipcMessages: 8, identities: 4096, nativeOutputBytes: 4 * 1024 * 1024, diskReceiptBytes: 16 * 1024 * 1024 };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const result = { kind: "pending-unrendered-guard-launcher-v1", acceptance: false, rendered: false, state: "preparing",
  startedUtc: new Date(startedAt).toISOString(), deadlineUtc: new Date(deadline).toISOString(), stopUtc: new Date(stopAt).toISOString(),
  limits, worker, root: upstream, phases: [], failures: [], observed: [], observers: [], ipc: [], readbacks: [], logs: { receivedBytes: 0, retainedBytes: 0, overflow: false },
  nativeBound: "UNVERIFIED: asynchronous observer availability/speed and short-lived identity coverage require actual observation",
  completeness: "sampled identities; no claim that every transient child was observed", ownExitReadback: "root supervisor must read back launcher exit", forcePolicy: "NONE" };
let ready = false, stopRequested = false, child, childIdentity, selfIdentity, boot, childOutput, childResult, closed = false;
let sampler, sampling = false, sampleWork = Promise.resolve(), ipcChain = Promise.resolve(), writes = Promise.resolve(), ipcBytes = 0, ipcCount = 0;
const logHashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
let observationIdentity, resolveClose;
const childClosed = new Promise(resolve => { resolveClose = resolve; });

function remaining() { return deadline - Date.now(); }
async function persist() {
  if (!ready) return;
  writes = writes.then(() => fs.writeFile(path.join(output, "launcher.json"), JSON.stringify({ ...result, elapsedMs: Date.now() - startedAt }, null, 2)));
  await writes;
}
async function fail(label, error) {
  result.failures.push({ label, message: error?.message ?? String(error), atUtc: new Date().toISOString() });
  result.state = "failed-or-uncertain"; process.exitCode = 1;
  requestStop(label); await persist();
}
function requestStop(reason) {
  stopRequested = true;
  result.stopRequested ??= { reason, atUtc: new Date().toISOString() };
  if (child?.connected) {
    try { child.send({ type: "stop" }, error => { if (error) { result.stopDeliveryFailure = error.message; void persist(); } }); }
    catch (error) { result.stopDeliveryFailure = error.message; }
  }
}
const stopTimer = setTimeout(() => { requestStop("provisional-cleanup-reserve"); void persist(); }, Math.max(0, stopAt - Date.now()));
const deadlineTimer = setTimeout(() => {
  requestStop("whole-deadline");
  void fail("whole-deadline", Error("900000ms exhausted; no force policy, live child remains supervised and cleanup is unproved"));
}, Math.max(0, deadline - Date.now()));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { requestStop(signal); void persist(); });
process.on("message", value => { if (value?.type === "stop") { requestStop("root-stop"); void persist(); } });
process.once("disconnect", () => { requestStop("root-disconnect"); void persist(); });
async function checkpoint(label, reserve = 120000) {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopRequested, false, `Stop before ${label}`);
  assert.ok(remaining() >= reserve, `Shared deadline/reservation before ${label}`);
}
function command(executable, args, maxBuffer = limits.nativeOutputBytes) {
  assert.ok(remaining() > 0, "No remaining deadline for native command");
  return new Promise((resolve, reject) => execFile(executable, args,
    { cwd: upstream, windowsHide: true, timeout: Math.max(1, Math.min(30000, remaining())), maxBuffer, encoding: "buffer" },
    (error, stdout) => { if (error) reject(Error(`${path.basename(executable)} failed (${error.code ?? error.name}); bounded native observation unavailable`));
      else if (!Buffer.isBuffer(stdout)) reject(Error("Expected raw native output bytes")); else resolve(stdout); }));
}
async function git(checkout, args) { return command("git", ["-C", checkout, ...args]); }
async function text(checkout, args) { return (await git(checkout, args)).toString("utf8").trim(); }
async function prepareOutput() {
  for (const directory of [upstream, path.join(upstream, "test-results"), path.dirname(output)]) {
    try { const info = await fs.lstat(directory); assert.ok(info.isDirectory() && !info.isSymbolicLink(), "Output ancestor symlink refused"); }
    catch (error) { if (error.code !== "ENOENT" || directory === upstream) throw error; await fs.mkdir(directory); }
  }
  await fs.mkdir(output); ready = true; await persist();
}
async function bootstrap() {
  assert.ok(moduleCheckout === worker || moduleCheckout === upstream); assert.equal(process.cwd(), upstream, "Root-owned launcher cwd must be the root checkout");
  assert.equal(process.argv.length, 2); assert.deepEqual(process.execArgv, []);
  for (const key of ["NODE_OPTIONS", "NODE_PATH", "ESBUILD_BINARY_PATH", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"]) assert.ok(!process.env[key], `Unreviewed environment override: ${key}`);
  const selected = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR, digest = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
  assert.ok(selected && path.isAbsolute(selected)); assert.match(digest ?? "", /^[a-f0-9]{64}$/);
  const info = await fs.lstat(selected); assert.ok(info.isFile() && !info.isSymbolicLink() && info.size < 65536);
  const bytes = await fs.readFile(selected); assert.equal(sha(bytes), digest);
  const descriptor = JSON.parse(bytes.toString("utf8"));
  assert.equal(descriptor.kind, "independently-reviewed-offline-m5-v1"); assert.equal(descriptor.phaseAllocation?.status, "pending-measurement");
  assert.equal(descriptor.producerCheckpoint, "0aec1242c911bc35f92ba413fd37f483b6b83f03");
  assert.deepEqual(descriptor.producerAmendments, {
    "tests/fixtures/campaign-monster-instances.ts": "6b793fe8b3e35e4e6ac2297509a2f4ec5023f5c6",
    "components/campaigns/monster-instance-form.tsx": "d43c3b688abeb4e4765b4f46ba62aa915b5b73dc",
  });
  assert.equal(descriptor.phaseAllocation.wholeMs, 900000); assert.equal(descriptor.guardMeasurementPreparation?.cleanupReserveMs, 120000);
  assert.deepEqual(descriptor.nodeRuntime, { executable: process.execPath, version: process.version, executedSha256: sha(await fs.readFile(process.execPath)) });
  const launcher = descriptor.guardMeasurementLauncher, probe = descriptor.guardMeasurementPreparation;
  assert.deepEqual(Object.keys(launcher ?? {}).sort(), ["kind", "checkpoint", "gitBlobOid", "executedSha256"].sort());
  assert.equal(launcher.kind, "independently-reviewed-no-force-guard-launcher-v1"); assert.equal(probe.kind, "independently-reviewed-guard-only-source-v1");
  for (const source of [launcher, probe]) {
    assert.match(source.checkpoint ?? "", /^[a-f0-9]{40}$/); assert.match(source.gitBlobOid ?? "", /^[a-f0-9]{40}$/); assert.match(source.executedSha256 ?? "", /^[a-f0-9]{64}$/);
  }
  const own = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts", "e2e/local-campaign-monster/campaign-monster.spec.mts", "scripts/campaign-monster-production-inputs.mjs", "scripts/campaign-monster-scenarios.mjs", "scripts/verify-campaign-monster-local.mjs"];
  assert.deepEqual(Object.keys(descriptor.harnessBlobs ?? {}).sort(), [...own].sort()); assert.match(descriptor.harnessCheckpoint ?? "", /^[a-f0-9]{40}$/);
  assert.match(descriptor.rootSourceSha ?? "", /^[a-f0-9]{40}$/);
  const helpers = {
    "scripts/passive-feature-production-assets.mjs": { checkpoint: "5fedd6222eeb97c11f7645dac580cbebee845311", gitBlobOid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" },
    "scripts/npc-process.mjs": { checkpoint: "846860209041819deb27b1547c06a77720ad3037", gitBlobOid: "0841bda7b9e785280e684030bf4fe900d81465e5" },
  };
  for (const checkout of [worker, upstream]) {
    let directory = checkout;
    while (true) { const stat = await fs.lstat(directory); assert.ok(stat.isDirectory() && !stat.isSymbolicLink()); const parent = path.dirname(directory); if (parent === directory) break; directory = parent; }
    assert.equal(await text(checkout, ["status", "--porcelain", "--untracked-files=no"]), "");
  }
  assert.equal(await text(upstream, ["rev-parse", "HEAD"]), descriptor.rootSourceSha);
  const proof = [];
  result.bootstrapProgress = proof;
  for (const relative of [relativeLauncher, relativeProbe, ...own, ...Object.keys(helpers)]) {
    await checkpoint(`pre-fork binding ${relative}`);
    const source = relative === relativeLauncher ? launcher : relative === relativeProbe ? probe : helpers[relative] ?? { checkpoint: descriptor.harnessCheckpoint, gitBlobOid: descriptor.harnessBlobs[relative] };
    assert.equal(await text(worker, ["rev-parse", `${source.checkpoint}:${relative}`]), source.gitBlobOid);
    let rawHash, representation; const checkoutIdentities = [];
    for (const checkout of [worker, upstream]) {
      const stat = await fs.lstat(path.join(checkout, relative)); assert.ok(stat.isFile() && !stat.isSymbolicLink());
      for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]]) assert.equal(await text(checkout, args), "");
      const head = await text(checkout, ["rev-parse", `HEAD:${relative}`]), index = await text(checkout, ["rev-parse", `:${relative}`]);
      assert.equal(head, source.gitBlobOid); assert.equal(index, source.gitBlobOid);
      const attributes = await text(checkout, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", relative]);
      assert.ok(attributes.includes(`${relative}: filter: unspecified`)); assert.ok(attributes.includes(`${relative}: working-tree-encoding: unspecified`));
      const config = {};
      for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
        // Git exit 1 means absent config. Use the bounded native call without
        // conflating absence with any other command failure.
        await checkpoint(`Git config spawn ${relative} ${key}`);
        const configRemaining = remaining();
        assert.ok(!stopRequested && configRemaining > 0 && configRemaining >= 120000, "No stop/deadline/reserve bypass for Git config spawn");
        config[key] = await new Promise((resolve, reject) => execFile("git", ["-C", checkout, "config", "--show-origin", "--get", key],
          { cwd: upstream, timeout: Math.min(30000, configRemaining), maxBuffer: 65536, windowsHide: true },
          (error, stdout) => { if (error && error.code !== 1) reject(Error("Git config read failed")); else resolve(error ? null : stdout.trim()); }));
      }
      const current = { attributes, config }; if (representation) assert.deepEqual(current, representation); representation = current;
      const raw = await fs.readFile(path.join(checkout, relative)); assert.equal(sha(raw), sha(await git(checkout, ["cat-file", "--filters", `--path=${relative}`, source.gitBlobOid])));
      if (rawHash) assert.equal(sha(raw), rawHash); rawHash = sha(raw); checkoutIdentities.push({ checkout, head, index });
    }
    if (source.executedSha256) assert.equal(rawHash, source.executedSha256);
    proof.push({ relative, ...source, rawSha256: rawHash, representation, checkoutIdentities });
    await persist();
  }
  return { descriptorPath: selected, descriptorSha256: digest, descriptor, proof, workerHead: await text(worker, ["rev-parse", "HEAD"]) };
}
async function osSnapshot(pid, expectedBirth = null) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const birthPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/;
  if (expectedBirth !== null) assert.match(expectedBirth, birthPattern);
  const birthCheck = expectedBirth === null ? "$true" : `$target.CreationDate.ToUniversalTime().ToString('o') -eq '${expectedBirth}'`;
  const code = `$ErrorActionPreference='Stop';$rows=@(Get-CimInstance Win32_Process);$target=$rows|Where-Object ProcessId -eq ${pid};$matches=$target -and (${birthCheck});$observer=$rows|Where-Object ProcessId -eq $PID;$ids=[Collections.Generic.HashSet[int]]::new();if($matches){$null=$ids.Add(${pid});do{$added=$false;foreach($row in $rows){if($ids.Contains([int]$row.ParentProcessId) -and $ids.Add([int]$row.ProcessId)){$added=$true}}}while($added)};$project={param($p)@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o');command=$p.CommandLine}};$all=@(Get-Process);@{target=$(if($matches){&$project $target}elseif($target){@{pid=$target.ProcessId;birthUtc=$target.CreationDate.ToUniversalTime().ToString('o')}}else{$null});observer=$(if($observer){&$project $observer}else{$null});descendants=@($rows|Where-Object {$ids.Contains([int]$_.ProcessId)}|ForEach-Object {&$project $_});listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue|Where-Object {$ids.Contains([int]$_.OwningProcess)}|Select-Object OwningProcess,LocalAddress,LocalPort);resources=@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$all.Count;workingSetBytes=($all|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($all|Measure-Object CPU -Sum).Sum;listenerCount=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}}|ConvertTo-Json -Depth 8 -Compress`;
  const value = JSON.parse((await command("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code])).toString("utf8"));
  assert.ok(value.observer?.command && value.observer?.birthUtc); assert.equal(value.observer.parentPid, process.pid); assert.match(value.observer.birthUtc, birthPattern);
  result.observers.push({ ...value.observer, cwdKnownFromLaunch: upstream, capturedUtc: new Date().toISOString() });
  assert.ok(result.observers.length <= limits.identities);
  if (value.target) {
    for (const row of value.descendants) { assert.ok(row.command && row.birthUtc && Number.isSafeInteger(row.pid) && Number.isSafeInteger(row.parentPid)); assert.match(row.birthUtc, birthPattern); }
  }
  assert.ok(value.descendants.length <= limits.identities);
  value.originalIdentityAbsent = !value.target || (expectedBirth !== null && value.target.birthUtc !== expectedBirth);
  return value;
}
async function sample() {
  if (sampling || !childIdentity || closed || remaining() <= 0) return;
  sampling = true;
  try {
    const value = await osSnapshot(childIdentity.pid, childIdentity.birthUtc);
    if (!value.originalIdentityAbsent) {
      for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(value.target[key], childIdentity[key]);
      for (const row of value.descendants) if (!result.observed.some(old => old.pid === row.pid && old.birthUtc === row.birthUtc)) result.observed.push({ ...row, cwdKnownFromLaunch: row.pid === childIdentity.pid ? worker : null, capturedUtc: new Date().toISOString() });
      assert.ok(result.observed.length <= limits.identities); result.lastListeners = value.listeners;
    }
    await persist();
  } catch (error) { await fail("sampled-os-observation", error); }
  finally { sampling = false; }
}
function childEnvironment() {
  const environment = {};
  for (const [key, value] of Object.entries(process.env)) if (/^(PATH|SystemRoot|WINDIR|ComSpec|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|HOME|HOMEDRIVE|HOMEPATH|PATHEXT|PSModulePath)$/i.test(key)) environment[key] = value;
  return { ...environment, INKBORNE_M5_REVIEW_DESCRIPTOR: boot.descriptorPath, INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256: boot.descriptorSha256, INKBORNE_M5_GATE_STARTED_AT: String(startedAt) };
}
async function ipc(message, encoded, index) {
  const file = `ipc-${index}.json`; await fs.writeFile(path.join(output, file), encoded, { flag: "wx" }); result.ipc.push({ file, bytes: encoded.length, sha256: sha(encoded), type: message.type });
  if (message.type === "guard-measurement-output") {
    assert.ok(childIdentity); for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(message.identity?.[key], childIdentity[key]);
    assert.equal(message.identity.cwdKnownFromLaunch, worker);
    assert.equal(path.dirname(message.path), path.join(worker, "test-results/campaign-monster-guard-measurement"));
    assert.match(path.basename(message.path), new RegExp(`^run-[0-9]+-${childIdentity.pid}$`)); childOutput = message.path; result.childOutput = childOutput;
  } else if (message.type === "unrendered-guard-inputs") {
    assert.ok(childOutput && message.proof?.artifacts && message.proof?.modelBundle && message.proof?.fixtureBundle);
    result.unrenderedProofSha256 = sha(Buffer.from(JSON.stringify(message.proof)));
  } else if (message.type === "guard-measurement-result") {
    assert.equal(message.output, childOutput); assert.ok(["unrendered-guard-components-complete", "failed-or-uncertain"].includes(message.state));
    childResult = message; result.childResult = message;
    // Normal release of the completed child's IPC port, not termination. The
    // probe's message listener otherwise keeps its port alive after completion.
    if (child.connected) child.disconnect();
  } else throw Error("Unknown IPC type refused");
  await persist();
}
function log(stream, bytes) {
  logHashes[stream].update(bytes); result.logs.receivedBytes += bytes.length;
  const allowance = Math.max(0, limits.logBytes - result.logs.retainedBytes), retained = bytes.subarray(0, allowance);
  result.logs.retainedBytes += retained.length;
  if (retained.length > 0) writes = writes.then(() => fs.appendFile(path.join(output, `${stream}.log`), retained));
  if (retained.length !== bytes.length && !result.logs.overflow) { result.logs.overflow = true; void fail("bounded-log-overflow", Error("Log cap exceeded; cooperative stop, first retained bytes preserved")); }
}
try {
  await prepareOutput(); await checkpoint("bootstrap");
  boot = await bootstrap(); result.bootstrap = boot; await persist();
  const before = await osSnapshot(process.pid); selfIdentity = before.target;
  assert.ok(selfIdentity && selfIdentity.parentPid === process.ppid && selfIdentity.command.includes(script));
  result.launcherProcess = { ...selfIdentity, cwdKnownFromLaunch: upstream }; result.resourcesBefore = before.resources;
  await checkpoint("fork");
  const probe = path.join(worker, relativeProbe);
  child = fork(probe, ["--shared-deadline", String(deadline)], { cwd: worker, execPath: boot.descriptor.nodeRuntime.executable, execArgv: [], env: childEnvironment(), stdio: ["ignore", "pipe", "pipe", "ipc"], serialization: "json", windowsHide: true });
  result.fork = { pid: child.pid, parentPid: process.pid, commandArguments: [probe, "--shared-deadline", String(deadline)], cwdKnownFromLaunch: worker, atUtc: new Date().toISOString() };
  child.stdout.on("data", bytes => log("stdout", bytes)); child.stderr.on("data", bytes => log("stderr", bytes));
  child.on("error", error => { void fail("child-error", error); });
  child.on("exit", (code, signal) => { result.exit = { code, signal, atUtc: new Date().toISOString() }; void persist(); });
  child.on("close", (code, signal) => { closed = true; result.close = { code, signal, atUtc: new Date().toISOString() }; resolveClose(); });
  // IPC may arrive during independent native capture; queue it behind capture,
  // never substitute the child's reported identity for fresh parent observation.
  observationIdentity = osSnapshot(child.pid);
  child.on("message", message => {
    try {
      assert.ok(message && typeof message === "object");
      const encoded = Buffer.from(JSON.stringify(message)); ipcBytes += encoded.length; const index = ++ipcCount;
      assert.ok(encoded.length <= limits.ipcMessageBytes && ipcBytes <= limits.ipcTotalBytes && index <= limits.ipcMessages, "IPC evidence cap exceeded; decoded IPC allocation is not claimed bounded before receipt");
      ipcChain = ipcChain.then(async () => { await observationIdentity; await ipc(message, encoded, index); }).catch(error => fail("child-ipc", error));
    } catch (error) { void fail("ipc-admission", error); }
  });
  const initial = await observationIdentity; assert.ok(initial.target, "Fast/missed child capture; independent identity unavailable");
  childIdentity = initial.target; assert.equal(childIdentity.pid, child.pid); assert.equal(childIdentity.parentPid, process.pid);
  assert.ok(childIdentity.command.includes(probe) && childIdentity.command.includes(String(deadline)));
  result.childProcess = { ...childIdentity, cwdKnownFromLaunch: worker, capturedUtc: new Date().toISOString() };
  for (const row of initial.descendants) result.observed.push({ ...row, cwdKnownFromLaunch: row.pid === child.pid ? worker : null, capturedUtc: new Date().toISOString() });
  sampler = setInterval(() => { if (!sampling) sampleWork = sample(); }, 2000); await persist();
  await childClosed; clearInterval(sampler); await sampleWork; await ipcChain; await writes;
  assert.ok(remaining() > 0, "Child completed after whole deadline; native cleanup remains unproved");
  assert.ok(result.exit?.code === 0 && result.close?.code === 0 && !result.exit.signal && !result.close.signal);
  assert.ok(childResult && childOutput); assert.equal(childResult.state, "unrendered-guard-components-complete");
  assert.match(result.unrenderedProofSha256 ?? "", /^[a-f0-9]{64}$/);
  const parentReadback = await osSnapshot(childIdentity.pid, childIdentity.birthUtc);
  result.childReadback = { ...parentReadback, expected: childIdentity }; assert.equal(parentReadback.originalIdentityAbsent, true);
  for (const row of result.observed) {
    const readback = await osSnapshot(row.pid, row.birthUtc); result.readbacks.push({ expected: row, originalIdentityAbsent: readback.originalIdentityAbsent, currentTarget: readback.target });
    assert.equal(readback.originalIdentityAbsent, true);
  }
  result.resourcesAfter = parentReadback.resources;
  const receiptPath = path.join(childOutput, "measurement.json"), receiptInfo = await fs.lstat(receiptPath);
  assert.ok(receiptInfo.isFile() && !receiptInfo.isSymbolicLink() && receiptInfo.size <= limits.diskReceiptBytes);
  const receiptBytes = await fs.readFile(receiptPath), receipt = JSON.parse(receiptBytes.toString("utf8"));
  assert.equal(receipt.acceptance, false); assert.equal(receipt.rendered, false); assert.equal(receipt.state, childResult.state); assert.equal(receipt.failure, null);
  assert.equal(receipt.selectedDescriptor.sha256, boot.descriptorSha256); assert.equal(receipt.bootstrap.workerHead, boot.workerHead);
  for (const key of ["pid", "parentPid", "birthUtc", "command"]) assert.equal(receipt.taskProcess[key], childIdentity[key]);
  result.childDiskReceipt = { path: receiptPath, bytes: receiptBytes.length, sha256: sha(receiptBytes) };
  const proofPath = path.join(childOutput, "unrendered-inputs.json"), proofInfo = await fs.lstat(proofPath);
  assert.ok(proofInfo.isFile() && !proofInfo.isSymbolicLink() && proofInfo.size <= limits.ipcMessageBytes);
  const proofBytes = await fs.readFile(proofPath), proof = JSON.parse(proofBytes.toString("utf8"));
  assert.equal(sha(Buffer.from(JSON.stringify(proof))), result.unrenderedProofSha256, "Whole disk/IPC unrendered proof mismatch");
  result.childDiskProof = { path: proofPath, bytes: proofBytes.length, sha256: sha(proofBytes) };
  await checkpoint("fresh final builtin source equality", 0); assert.deepEqual(await bootstrap(), boot);
  assert.ok(result.failures.length === 0 && !result.logs.overflow && !stopRequested && remaining() > 0);
  result.state = "guard-probe-complete-unrendered-no-acceptance";
} catch (error) { await fail("launcher", error); }
finally {
  clearTimeout(stopTimer); clearTimeout(deadlineTimer); clearInterval(sampler);
  if (child && !closed) {
    requestStop("launcher-failure"); result.cleanupUncertain = "Child has not closed; no force policy. Supervisor remains attached pending natural close; deadline cannot guarantee cleanup.";
    await persist();
    // Never detach/unref a live child and call cleanup complete. If it is stuck,
    // this await can remain live: a separately reviewed cancellation policy is
    // required before runtime can promise termination. No new native calls after
    // the deadline; late natural close is retained but cannot repair the gate.
    await childClosed;
    result.lateClose = result.close; result.state = "failed-or-uncertain"; process.exitCode = 1;
  }
  await sampleWork; await ipcChain; await writes;
  result.logs.stdoutSha256 = logHashes.stdout.digest("hex"); result.logs.stderrSha256 = logHashes.stderr.digest("hex");
  result.endedUtc = new Date().toISOString(); await persist();
}
