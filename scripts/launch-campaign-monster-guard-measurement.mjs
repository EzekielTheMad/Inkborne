import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile, fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";

// No project/package imports and no browser force adapter. The clock starts before
// descriptor/bootstrap work; source, bootstrap, child and cleanup share it.
const startedAt = Date.now(), deadline = startedAt + 900000, stopAt = startedAt + 780000;
const script = fileURLToPath(import.meta.url), moduleCheckout = path.resolve(path.dirname(script), "..");
const workspace = path.dirname(moduleCheckout), worker = path.join(workspace, "r13-item-sharing-worker"), upstream = path.join(workspace, "equipment-verification");
const relativeLauncher = "scripts/launch-campaign-monster-guard-measurement.mjs", relativeProbe = "scripts/measure-campaign-monster-guards.mjs";
const output = path.join(upstream, "test-results/campaign-monster-guard-launcher", `run-${startedAt}-${process.pid}`);
const limits = { logBytes: 4 * 1024 * 1024, ipcMessageBytes: 64 * 1024 * 1024, ipcTotalBytes: 128 * 1024 * 1024, ipcMessages: 8, identities: 4096, nativeOutputBytes: 4 * 1024 * 1024, diskReceiptBytes: 16 * 1024 * 1024 };
const cancellationBudget = { graceMs: 20000, nativeMs: 60000, readbackMs: 40000, targetCount: 16, waitPerTargetMs: 2000 };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const result = { kind: "pending-unrendered-guard-launcher-v1", acceptance: false, rendered: false, state: "preparing",
  startedUtc: new Date(startedAt).toISOString(), deadlineUtc: new Date(deadline).toISOString(), stopUtc: new Date(stopAt).toISOString(),
  limits, worker, root: upstream, phases: [], failures: [], observed: [], observers: [], ipc: [], readbacks: [], logs: { receivedBytes: 0, retainedBytes: 0, overflow: false },
  nativeBound: "UNVERIFIED: asynchronous observer availability/speed and short-lived identity coverage require actual observation",
  completeness: "sampled identities; never used as cancellation graph authority", ownExitReadback: "root supervisor must read back launcher exit", forcePolicy: "FAILED-guard-only-handle-policy-v2", cancellationBudget };
let ready = false, stopRequested = false, child, childIdentity, selfIdentity, boot, childOutput, childResult, closed = false;
let sampler, sampling = false, sampleWork = Promise.resolve(), ipcChain = Promise.resolve(), writes = Promise.resolve(), ipcBytes = 0, ipcCount = 0;
const logHashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
let observationIdentity, resolveClose;
let stopRequestedAt, cancellationTimer, cancellationStarted = false, cancellationWork = Promise.resolve();
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
  stopRequestedAt ??= Date.now();
  result.stopRequested ??= { reason, atUtc: new Date().toISOString() };
  if (child?.connected) {
    try { child.send({ type: "stop" }, error => { if (error) { result.stopDeliveryFailure = error.message; void persist(); } }); }
    catch (error) { result.stopDeliveryFailure = error.message; }
  }
  scheduleCancellation();
}
const stopTimer = setTimeout(() => { requestStop("provisional-cleanup-reserve"); void persist(); }, Math.max(0, stopAt - Date.now()));
const deadlineTimer = setTimeout(() => {
  requestStop("whole-deadline");
  void fail("whole-deadline", Error("900000ms exhausted; no further termination allowed, live/refused child remains supervised and cleanup is unproved"));
}, Math.max(0, deadline - Date.now()));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { requestStop(signal); void persist(); });
process.on("message", value => { if (value?.type === "stop") { requestStop("root-stop"); void persist(); } });
process.once("disconnect", () => { requestStop("root-disconnect"); void persist(); });
async function checkpoint(label, reserve = 120000) {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopRequested, false, `Stop before ${label}`);
  assert.ok(remaining() >= reserve, `Shared deadline/reservation before ${label}`);
}
function command(executable, args, maxBuffer = limits.nativeOutputBytes, commandDeadline = deadline) {
  const available = Math.min(deadline, commandDeadline) - Date.now();
  assert.ok(Number.isSafeInteger(commandDeadline) && available > 0, "No remaining scoped deadline for native command");
  return new Promise((resolve, reject) => execFile(executable, args,
    { cwd: upstream, windowsHide: true, timeout: Math.min(30000, available), maxBuffer, encoding: "buffer" },
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
  assert.equal(launcher.kind, "independently-reviewed-failed-guard-cancellation-v2"); assert.equal(probe.kind, "independently-reviewed-guard-only-source-v1");
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
async function osSnapshot(pid, expectedBirth = null, observationDeadline = deadline) {
  assert.ok(Number.isSafeInteger(observationDeadline) && Math.min(deadline, observationDeadline) > Date.now(), "Observation deadline exhausted");
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const birthPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/;
  if (expectedBirth !== null) assert.match(expectedBirth, birthPattern);
  const birthCheck = expectedBirth === null ? "$true" : `$target.CreationDate.ToUniversalTime().ToString('o') -eq '${expectedBirth}'`;
  const code = `$ErrorActionPreference='Stop'
$rows=@(Get-CimInstance Win32_Process);$byId=@{}
foreach($row in $rows){$key=[int]$row.ProcessId;if($byId.ContainsKey($key)){throw 'Ambiguous current PID snapshot'};$byId[$key]=$row}
$target=$byId[${pid}];$matches=$target -and (${birthCheck});$observer=$byId[[int]$PID];$owned=@{}
if($matches){
  $rootParent=$byId[[int]$target.ParentProcessId]
  if(!$target.CreationDate -or !$target.CommandLine -or !$rootParent -or !$rootParent.CreationDate -or !$rootParent.CommandLine -or $rootParent.CreationDate.ToUniversalTime().Ticks -gt $target.CreationDate.ToUniversalTime().Ticks){throw 'Unproved current root parent identity'}
  $owned[[int]$target.ProcessId]=$target
  do{
    $added=$false
    foreach($row in $rows){
      $rowId=[int]$row.ProcessId;$parentId=[int]$row.ParentProcessId
      if($owned.ContainsKey($parentId) -and !$owned.ContainsKey($rowId)){
        $parent=$byId[$parentId];$admittedParent=$owned[$parentId]
        if(!$parent -or !$parent.CreationDate -or !$parent.CommandLine -or !$row.CreationDate -or !$row.CommandLine -or $rowId -eq $parentId){throw 'Missing current ancestry identity'}
        if($parent.ParentProcessId -ne $admittedParent.ParentProcessId -or $parent.CreationDate.ToUniversalTime().Ticks -ne $admittedParent.CreationDate.ToUniversalTime().Ticks -or $parent.CommandLine -ne $admittedParent.CommandLine){throw 'Changed current ancestry parent'}
        if($parent.CreationDate.ToUniversalTime().Ticks -gt $row.CreationDate.ToUniversalTime().Ticks){throw 'Older orphan cannot be task-owned'}
        $owned[$rowId]=$row;$added=$true
      }
    }
  }while($added)
  if($owned.ContainsKey([int]$target.ParentProcessId)){throw 'Ancestry cycle refused'}
}
# Project command lines ONLY after the whole admitted graph passes identity and
# native parent<=child birth checks. Reused root projects birth metadata only.
$project={param($p)@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o');command=$p.CommandLine}}
$all=@(Get-Process)
@{target=$(if($matches){&$project $target}elseif($target){@{pid=$target.ProcessId;birthUtc=$target.CreationDate.ToUniversalTime().ToString('o')}}else{$null});observer=$(if($observer){&$project $observer}else{$null});descendants=@($rows|Where-Object {$owned.ContainsKey([int]$_.ProcessId)}|ForEach-Object {&$project $_});listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue|Where-Object {$owned.ContainsKey([int]$_.OwningProcess)}|Select-Object OwningProcess,LocalAddress,LocalPort);resources=@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$all.Count;workingSetBytes=($all|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($all|Measure-Object CPU -Sum).Sum;listenerCount=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}}|ConvertTo-Json -Depth 8 -Compress`;
  const value = JSON.parse((await command("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], limits.nativeOutputBytes, observationDeadline)).toString("utf8"));
  assert.ok(Date.now() < Math.min(deadline, observationDeadline), "Observation completed after its scoped deadline");
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

// Stock Windows APIs only. This private source is compiled in a fresh, bounded
// PowerShell observer; no install, privilege enablement, project import or PID
// based kill. Every opened process object remains held until finally disposal.
const nativeLeaseSource = `using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public sealed class GuardLease : IDisposable {
  IntPtr handle;
  public readonly uint Pid;
  public readonly long CreationFileTime;
  public readonly string ImagePath;
  [StructLayout(LayoutKind.Sequential)] struct FT { public uint Low, High; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool GetProcessTimes(IntPtr h, out FT creation, out FT exit, out FT kernel, out FT user);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool QueryFullProcessImageNameW(IntPtr h, uint flags, StringBuilder name, ref uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll", SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool TerminateProcess(IntPtr h, uint code);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)] static extern IntPtr CommandLineToArgvW(string command, out int count);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
  static long Value(FT value) { return checked((long)(((ulong)value.High << 32) | value.Low)); }
  public GuardLease(uint pid, bool terminate) {
    Pid=pid; handle=OpenProcess(0x00101000U | (terminate ? 1U : 0U), false, pid);
    if(handle==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      FT c,e,k,u; if(!GetProcessTimes(handle,out c,out e,out k,out u)) throw new Win32Exception(Marshal.GetLastWin32Error());
      CreationFileTime=Value(c); var name=new StringBuilder(32768); uint size=32768;
      if(!QueryFullProcessImageNameW(handle,0,name,ref size)) throw new Win32Exception(Marshal.GetLastWin32Error()); ImagePath=name.ToString();
    } catch { Dispose(); throw; }
  }
  public bool Alive() { uint value=WaitForSingleObject(handle,0); if(value==258) return true; if(value==0) return false; throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public void TerminateAndWait(uint ms, long actionDeadline) {
    if(ms==0 || ms>2000 || !Alive()) throw new InvalidOperationException("Closed handle or invalid bounded wait");
    // Alive and Console progress flushing can block. This final check is AFTER
    // those operations and immediately before the irreversible held-object call.
    if(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=actionDeadline-(long)ms) throw new InvalidOperationException("Action deadline or reserved wait exhausted");
    if(!TerminateProcess(handle,125)) throw new Win32Exception(Marshal.GetLastWin32Error());
    if(WaitForSingleObject(handle,ms)!=0) throw new InvalidOperationException("Termination completion unproved");
  }
  public long ExitFileTime() { if(Alive()) throw new InvalidOperationException("Live exit time unavailable"); FT c,e,k,u; if(!GetProcessTimes(handle,out c,out e,out k,out u)) throw new Win32Exception(Marshal.GetLastWin32Error()); return Value(e); }
  public static string[] Args(string command) {
    int count; IntPtr pointer=CommandLineToArgvW(command,out count); if(pointer==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try { if(count<1 || count>64) throw new InvalidOperationException("Argv cap"); var values=new string[count]; for(int i=0;i<count;i++) values[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer,i*IntPtr.Size)); return values; } finally { LocalFree(pointer); }
  }
  public void Dispose() { if(handle!=IntPtr.Zero) { IntPtr old=handle; handle=IntPtr.Zero; if(!CloseHandle(old)) throw new Win32Exception(Marshal.GetLastWin32Error()); } }
}`;

// Native identity comparison is exact for the original root FILETIME. CIM's
// microsecond view is only a narrow corroborating interval, never substituted
// for the recorded100ns native creation value. Unsupported projection refuses.
const nativeGuardProgram = `$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$request=[Console]::In.ReadToEnd()|ConvertFrom-Json
function Emit($value){[Console]::Out.WriteLine(($value|ConvertTo-Json -Depth 10 -Compress));[Console]::Out.Flush()}
$nativeSelf=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID)
if(!$nativeSelf -or !$nativeSelf.CreationDate -or !$nativeSelf.CommandLine -or $nativeSelf.ParentProcessId -ne $request.launcherPid -or $PID -ne $request.nativePid){throw 'Native observer identity unavailable'}
Emit @{type='native-job-identity';pid=$nativeSelf.ProcessId;parentPid=$nativeSelf.ParentProcessId;birthUtc=$nativeSelf.CreationDate.ToUniversalTime().ToString('o');command=$nativeSelf.CommandLine;cwdKnownFromLaunch=$request.nativeCwd}
Add-Type -TypeDefinition @'
${nativeLeaseSource}
'@
$leases=@{};$done=@{};$baseline=@{};$actions=0
function Budget([int]$reserve=0){if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$request.actionDeadline-$reserve){throw 'Cancellation action deadline exhausted'}}
function RootRow(){
  Budget;$row=Get-CimInstance Win32_Process -Filter ('ProcessId='+$request.root.pid)
  if(!$row -or !$row.CreationDate -or !$row.CommandLine -or $row.ParentProcessId -ne $request.root.parentPid -or $row.CreationDate.ToUniversalTime().ToString('o') -cne $request.root.birthUtc -or $row.CommandLine -cne $request.root.command){throw 'Recorded root missing closed reused or changed'}
  return $row
}
function Correlate($lease,$row){
  if(!$lease.Alive()){throw 'Stable process object already closed'}
  $cim=$row.CreationDate.ToUniversalTime().Ticks;$native=[DateTime]::FromFileTimeUtc($lease.CreationFileTime).Ticks
  if($native -lt $cim -or $native-$cim -ge 10){throw 'Unsupported CIM native precision correspondence'}
}
function CheckFork($lease,$row){
  Correlate $lease $row
  if(![string]::Equals($lease.ImagePath,$request.executable,[StringComparison]::OrdinalIgnoreCase)){throw 'Exact fork executable differs'}
  $argv=[GuardLease]::Args($row.CommandLine)
  if($argv.Count -ne $request.argv.Count){throw 'Exact fork argv differs'}
  for($i=0;$i -lt $argv.Count;$i++){if($argv[$i] -cne $request.argv[$i]){throw 'Exact fork argv differs'}}
}
function Graph(){
  Budget;$root=RootRow;$rows=@(Get-CimInstance Win32_Process);$byId=@{}
  foreach($row in $rows){$key=[int]$row.ProcessId;if($byId.ContainsKey($key)){throw 'Duplicate current PID'};$byId[$key]=$row}
  $current=$byId[[int]$root.ProcessId]
  if(!$current -or $current.ParentProcessId -ne $root.ParentProcessId -or $current.CommandLine -cne $root.CommandLine -or $current.CreationDate.ToUniversalTime().Ticks -ne $root.CreationDate.ToUniversalTime().Ticks){throw 'Root changed during graph read'}
  $parent=$byId[[int]$root.ParentProcessId]
  if(!$parent -or !$parent.CreationDate -or !$parent.CommandLine -or $parent.CreationDate.ToUniversalTime().Ticks -gt $root.CreationDate.ToUniversalTime().Ticks){throw 'Root parent graph gap'}
  $owned=@{};$owned[[int]$root.ProcessId]=$current
  do{$added=$false;foreach($row in $rows){$pidKey=[int]$row.ProcessId;$ppid=[int]$row.ParentProcessId
    if($owned.ContainsKey($ppid) -and !$owned.ContainsKey($pidKey)){
      $p=$byId[$ppid];$accepted=$owned[$ppid]
      if(!$p -or !$p.CreationDate -or !$p.CommandLine -or !$row.CreationDate -or !$row.CommandLine -or $pidKey -eq $ppid -or $p.ParentProcessId -ne $accepted.ParentProcessId -or $p.CommandLine -cne $accepted.CommandLine -or $p.CreationDate.ToUniversalTime().Ticks -ne $accepted.CreationDate.ToUniversalTime().Ticks -or $p.CreationDate.ToUniversalTime().Ticks -gt $row.CreationDate.ToUniversalTime().Ticks){throw 'Ambiguous older orphan or missing current parent link'}
      $owned[$pidKey]=$row;$added=$true;if($owned.Count -gt [int]$request.targetCap){throw 'Cancellation target cap exceeded'}
    }
  }}while($added)
  if($owned.ContainsKey([int]$root.ParentProcessId)){throw 'Current graph cycle'}
  return ,$owned
}
try {
  $root=RootRow;$rootLease=[GuardLease]::new([uint32]$root.ProcessId,($request.mode -eq 'cancel'));$leases[[int]$root.ProcessId]=$rootLease;CheckFork $rootLease $root
  if($request.mode -eq 'capture'){
    Emit @{type='fork-native-capture';creationFileTime=([string]$rootLease.CreationFileTime);imagePath=$rootLease.ImagePath;argv=@([GuardLease]::Args($root.CommandLine))};return
  }
  if($request.mode -ne 'cancel' -or $request.failed -ne $true -or [string]$rootLease.CreationFileTime -cne $request.root.creationFileTime -or !$request.knownCwd){throw 'Failed run native root binding unavailable'}
  $baseline=Graph
  foreach($key in $baseline.Keys){if(!$leases.ContainsKey($key)){$leases[$key]=[GuardLease]::new([uint32]$key,$true)};Correlate $leases[$key] $baseline[$key]}
  foreach($key in $baseline.Keys){$row=$baseline[$key];if($key -ne [int]$request.root.pid -and $leases[[int]$row.ParentProcessId].CreationFileTime -gt $leases[$key].CreationFileTime){throw 'Native parent child birth inconsistency'}}
  Emit @{type='complete-current-provider-graph';nativeCompleteness='UNVERIFIED until actual acceptance';targets=@($baseline.Values|ForEach-Object {@{pid=$_.ProcessId;parentPid=$_.ParentProcessId;birthUtc=$_.CreationDate.ToUniversalTime().ToString('o');command=$_.CommandLine;creationFileTime=([string]$leases[[int]$_.ProcessId].CreationFileTime) }})}
  while($done.Count -lt $baseline.Count){
    Budget;if(!$rootLease.Alive()){throw 'Root closed before next termination; refuse'}
    $fresh=Graph;CheckFork $rootLease (RootRow)
    foreach($key in $fresh.Keys){if(!$baseline.ContainsKey($key) -or $done.ContainsKey($key)){throw 'Current graph changed or stale; refuse'};$row=$fresh[$key];$old=$baseline[$key]
      if($row.ParentProcessId -ne $old.ParentProcessId -or $row.CommandLine -cne $old.CommandLine -or $row.CreationDate.ToUniversalTime().Ticks -ne $old.CreationDate.ToUniversalTime().Ticks){throw 'Current leaf identity changed'};Correlate $leases[$key] $row
    }
    foreach($key in $baseline.Keys){if(!$done.ContainsKey($key) -and !$fresh.ContainsKey($key)){throw 'Current graph identity missing; refuse'}}
    $leaf=@($fresh.Keys|Where-Object {$candidate=$_;!@($fresh.Values|Where-Object {[int]$_.ParentProcessId -eq $candidate}).Count}|Sort-Object)[0]
    if($null -eq $leaf){throw 'No proved current leaf'}
    # Immediately fresh root and leaf metadata, then act on the already held
    # process OBJECT, never on a newly looked-up PID or broad tree/name.
    CheckFork $rootLease (RootRow);$leafRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$leaf);$old=$baseline[$leaf]
    if(!$leafRow -or $leafRow.ParentProcessId -ne $old.ParentProcessId -or $leafRow.CommandLine -cne $old.CommandLine -or $leafRow.CreationDate.ToUniversalTime().Ticks -ne $old.CreationDate.ToUniversalTime().Ticks){throw 'Immediate leaf recheck failed'}
    Correlate $leases[$leaf] $leafRow;Budget ([int]$request.waitMs)
    Emit @{type='before-individual-handle-termination';pid=$leaf;creationFileTime=([string]$leases[$leaf].CreationFileTime);failed=$true}
    $leases[$leaf].TerminateAndWait([uint32]$request.waitMs,[long]$request.actionDeadline);$done[$leaf]=$true;$actions++
    Emit @{type='exact-held-object-signaled';pid=$leaf;creationFileTime=([string]$leases[$leaf].CreationFileTime);actions=$actions;acceptance=$false}
  }
  Budget;$post=@(Get-CimInstance Win32_Process)
  foreach($row in $post){$p=[int]$row.ParentProcessId;$id=[int]$row.ProcessId
    if($baseline.ContainsKey($p) -and !$baseline.ContainsKey($id) -and $row.CreationDate){$ticks=$row.CreationDate.ToUniversalTime().Ticks
      if($ticks+10 -gt [DateTime]::FromFileTimeUtc($leases[$p].CreationFileTime).Ticks -and $ticks -le [DateTime]::FromFileTimeUtc($leases[$p].ExitFileTime()).Ticks){throw 'New possible owned child appeared; closure unproved'}
    }
  }
  $ports=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object {$baseline.ContainsKey([int]$_.OwningProcess)})
  if($ports.Count){throw 'Target PID owned port closure unproved'}
  Emit @{type='cancellation-finished-failed-only';actions=$actions;heldObjectsAllSignaled=$true;targetPidListeners=@();acceptance=$false}
} catch {Emit @{type='cancellation-refused-or-partial';actions=$actions;message=$_.Exception.Message;acceptance=$false};exit 7}
finally{foreach($lease in $leases.Values){$lease.Dispose()}}
`;

async function nativeGuard(mode, maximumMs, scopedEnd = deadline) {
  assert.ok(childIdentity && boot && remaining() > 0);
  assert.ok(Number.isSafeInteger(scopedEnd));
  const actionDeadline = Math.min(deadline, scopedEnd, Date.now() + maximumMs);
  assert.ok(actionDeadline > Date.now());
  const payload = { mode, failed: mode === "cancel", root: childIdentity, knownCwd: worker,
    executable: boot.descriptor.nodeRuntime.executable, argv: [boot.descriptor.nodeRuntime.executable, ...result.fork.commandArguments],
    actionDeadline, targetCap: cancellationBudget.targetCount, waitMs: cancellationBudget.waitPerTargetMs };
  const chunks = [], events = [], decoder = new StringDecoder("utf8"); let buffered = "", received = 0;
  const nativeJob = { mode, atUtc: new Date().toISOString(), actionDeadline, completed: false };
  result.nativeJobs ??= []; result.nativeJobs.push(nativeJob); await persist();
  await new Promise((resolve, reject) => {
    const spawnRemaining = actionDeadline - Date.now();
    assert.ok(spawnRemaining > 0, "No residual native action budget after evidence persistence");
    const job = execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", nativeGuardProgram],
      { cwd: upstream, windowsHide: true, timeout: Math.min(maximumMs, spawnRemaining), maxBuffer: 1024 * 1024, encoding: "buffer" },
      (error) => { nativeJob.completed = true; nativeJob.errorCode = error?.code ?? null; if (error) reject(Error("Native guard refused, timed out or partially failed; retained events are not cleanup acceptance")); else resolve(); });
    nativeJob.pid = job.pid; nativeJob.parentPid = process.pid; nativeJob.cwdKnownFromLaunch = upstream;
    job.stdout.on("data", bytes => {
      received += bytes.length;
      if (received > 1024 * 1024) { nativeJob.outputOverflow = true; return; }
      chunks.push(bytes); buffered += decoder.write(bytes);
      let end;
      while ((end = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, end).trim(); buffered = buffered.slice(end + 1); if (!line) continue;
        try { const event = JSON.parse(line); assert.ok(events.length < 128); events.push(event); nativeJob.events = events; void persist(); }
        catch { nativeJob.malformedOutput = true; }
      }
    });
    job.stdin.end(JSON.stringify({ ...payload, launcherPid: process.pid, nativePid: job.pid, nativeCwd: upstream }));
  }).finally(async () => {
    nativeJob.outputBytes = received; nativeJob.outputSha256 = sha(Buffer.concat(chunks)); nativeJob.endedUtc = new Date().toISOString();
    await fs.writeFile(path.join(output, `native-${mode}.ndjson`), Buffer.concat(chunks), { flag: "wx" }); await persist();
  });
  buffered += decoder.end();
  assert.ok(!nativeJob.outputOverflow && !nativeJob.malformedOutput && !buffered.trim());
  const observer = events[0]; assert.equal(observer?.type, "native-job-identity"); assert.equal(observer.pid, nativeJob.pid); assert.equal(observer.parentPid, process.pid);
  assert.match(observer.birthUtc ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/); assert.ok(observer.command);
  nativeJob.identity = observer;
  return events;
}
function scheduleCancellation() {
  if (!stopRequested || cancellationStarted || cancellationTimer || !childIdentity?.creationFileTime || closed) return;
  const due = stopRequestedAt + cancellationBudget.graceMs;
  cancellationTimer = setTimeout(() => {
    cancellationTimer = undefined;
    cancellationWork = cancelFailedGuard().catch(async error => { result.cleanupUncertain = error.message; await fail("guard-cancellation-refused-or-partial", error); });
  }, Math.max(0, due - Date.now()));
}
async function cancelFailedGuard() {
  if (closed || cancellationStarted) return;
  assert.ok(Number.isSafeInteger(stopRequestedAt));
  const cancellationEnd = Math.min(deadline, stopRequestedAt + 120000);
  result.cancellationWindow = { firstStopUtc: new Date(stopRequestedAt).toISOString(), endUtc: new Date(cancellationEnd).toISOString() };
  cancellationStarted = true; clearInterval(sampler); await sampleWork;
  assert.ok(stopRequested && Date.now() >= stopRequestedAt + cancellationBudget.graceMs);
  const nativeEnd = Math.min(cancellationEnd - cancellationBudget.readbackMs, Date.now() + cancellationBudget.nativeMs);
  const nativeAllowance = nativeEnd - Date.now();
  assert.ok(nativeAllowance >= 1000, "No remaining same-deadline cancellation/readback reservation");
  assert.ok(childIdentity.creationFileTime && childIdentity.parentPid === process.pid && result.fork.cwdKnownFromLaunch === worker);
  result.failures.push({ label: "FAILED-run-cancellation", message: "Cooperative grace expired; any termination keeps this run failed", atUtc: new Date().toISOString() });
  result.state = "failed-or-uncertain"; process.exitCode = 1; await persist();
  const events = await nativeGuard("cancel", nativeAllowance, nativeEnd);
  const completed = events.at(-1); assert.equal(completed?.type, "cancellation-finished-failed-only"); assert.equal(completed.acceptance, false);
  const graph = events.find(event => event.type === "complete-current-provider-graph"); assert.ok(graph && graph.targets.length <= cancellationBudget.targetCount);
  const readbackStart = Date.now(), readbackEnd = Math.min(cancellationEnd, readbackStart + cancellationBudget.readbackMs);
  assert.ok(readbackEnd > readbackStart, "Cancellation readback reservation exhausted");
  result.cancellation = { events, acceptance: false, targets: graph.targets, finishedUtc: new Date().toISOString(),
    nativeEndUtc: new Date(nativeEnd).toISOString(), readbackEndUtc: new Date(readbackEnd).toISOString() };
  for (const target of graph.targets) {
    assert.ok(Date.now() < readbackEnd); const readback = await osSnapshot(target.pid, target.birthUtc, readbackEnd);
    result.readbacks.push({ expected: target, originalIdentityAbsent: readback.originalIdentityAbsent, cancellation: true });
    assert.equal(readback.originalIdentityAbsent, true);
  }
  result.resourcesAfterCancellation = (await osSnapshot(process.pid, null, readbackEnd)).resources;
  assert.ok(Date.now() < readbackEnd && Date.now() < cancellationEnd, "Cancellation closure exceeded its first-stop budget");
  result.cancellation.independentReadbackComplete = true; await persist();
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
  const nativeCapture = (await nativeGuard("capture", 30000)).at(-1);
  assert.equal(nativeCapture?.type, "fork-native-capture"); assert.match(nativeCapture.creationFileTime ?? "", /^[1-9][0-9]{1,18}$/);
  assert.deepEqual(nativeCapture.argv, [boot.descriptor.nodeRuntime.executable, ...result.fork.commandArguments]);
  childIdentity = { ...childIdentity, creationFileTime: nativeCapture.creationFileTime, imagePath: nativeCapture.imagePath, argv: nativeCapture.argv };
  scheduleCancellation();
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
  clearInterval(sampler);
  if (child && !closed) {
    requestStop("launcher-failure"); result.cleanupUncertain = "Child has not closed; only proved failed-run handle cancellation is permitted. Refused/stuck child remains supervised; no guaranteed cleanup.";
    await persist();
    // Never detach/unref a live child and call cleanup complete. If it is stuck,
    // this await can remain live if ownership/handle cancellation refuses.
    // No new native calls after
    // the deadline; late natural close is retained but cannot repair the gate.
    await childClosed;
    result.lateClose = result.close; result.state = "failed-or-uncertain"; process.exitCode = 1;
  }
  clearTimeout(stopTimer); clearTimeout(deadlineTimer); clearTimeout(cancellationTimer);
  await cancellationWork; await sampleWork; await ipcChain; await writes;
  result.logs.stdoutSha256 = logHashes.stdout.digest("hex"); result.logs.stderrSha256 = logHashes.stderr.digest("hex");
  result.endedUtc = new Date().toISOString(); await persist();
}
