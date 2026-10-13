import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
let wrapperStopRequested = false;
process.on("message", (message: unknown) => { if ((message as { type?: string })?.type === "stop") wrapperStopRequested = true; });
async function entryCheckpoint(label: string) {
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(wrapperStopRequested, false, "Cooperative stop before " + label);
  const started = Number(process.env.INKBORNE_M5_GATE_STARTED_AT);
  assert.ok(Number.isSafeInteger(started) && started > 0 && Date.now() < started + 900000, "Whole gate deadline before " + label);
}
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const git = (root: string, args: string[]) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
async function bootstrap(root: string) {
  const file = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR, digest = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
  assert.ok(file && path.isAbsolute(file)); assert.match(digest ?? "", /^[a-f0-9]{64}$/);
  const bytes = await fs.readFile(file); assert.equal(hash(bytes), digest);
  const input = JSON.parse(bytes); assert.equal(input.kind, "independently-reviewed-offline-m5-v1");
  assert.equal(input.producerCheckpoint, "0aec1242c911bc35f92ba413fd37f483b6b83f03");
  assert.deepEqual(input.nodeRuntime, { executable: process.execPath, version: process.version, executedSha256: hash(await fs.readFile(process.execPath)) });
  assert.match(input.harnessCheckpoint, /^[a-f0-9]{40}$/);
  const own = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts", "e2e/local-campaign-monster/campaign-monster.spec.mts",
    "scripts/campaign-monster-production-inputs.mjs", "scripts/campaign-monster-scenarios.mjs", "scripts/verify-campaign-monster-local.mjs"];
  assert.deepEqual(Object.keys(input.harnessBlobs).sort(), own.sort());
  const helpers: Record<string, string> = { "scripts/passive-feature-production-assets.mjs": "e4058f8a31cd911583a312e59fedcf4c3fd4adae", "scripts/npc-process.mjs": "0841bda7b9e785280e684030bf4fe900d81465e5" };
  const upstream = path.resolve(root, "../equipment-verification"); assert.equal(git(upstream, ["rev-parse", "HEAD"]).toString().trim(), input.rootSourceSha);
  const proof = [];
  for (const relative of [...own, ...Object.keys(helpers)]) {
    await entryCheckpoint("bootstrap " + relative);
    const expected = helpers[relative] ?? input.harnessBlobs[relative];
    if (!helpers[relative]) assert.equal(git(root, ["rev-parse", input.harnessCheckpoint + ":" + relative]).toString().trim(), expected);
    let rawHash: string | undefined, representation: { attributes: string; config: Record<string, string | null> } | undefined;
    for (const checkout of [root, upstream]) {
      for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]])
        assert.equal(git(checkout, args).toString().trim(), "");
      assert.equal(git(checkout, ["rev-parse", "HEAD:" + relative]).toString().trim(), expected);
      assert.equal(git(checkout, ["rev-parse", ":" + relative]).toString().trim(), expected);
      const attributes = git(checkout, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", relative]).toString();
      assert.ok(attributes.includes(relative + ": filter: unspecified")); assert.ok(attributes.includes(relative + ": working-tree-encoding: unspecified"));
      const config: Record<string, string | null> = {};
      for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
        try { config[key] = git(checkout, ["config", "--show-origin", "--get", key]).toString().trim(); }
        catch (error) { if ((error as { status?: number }).status !== 1) throw error; config[key] = null; }
      }
      const current = { attributes, config }; if (representation) assert.deepEqual(current, representation); representation = current;
      const actual = hash(await fs.readFile(path.join(checkout, relative)));
      assert.equal(actual, hash(git(checkout, ["cat-file", "--filters", "--path=" + relative, expected])));
      if (rawHash) assert.equal(actual, rawHash); rawHash = actual;
    }
    proof.push({ relative, gitBlob: expected, executedSha256: rawHash, representation });
  }
  return { descriptorSha256: digest, proof };
}
const launchTime = Number(process.env.INKBORNE_M5_GATE_STARTED_AT), root = process.cwd();
assert.ok(Number.isSafeInteger(launchTime) && launchTime > 0 && launchTime <= Date.now() && Date.now() < launchTime + 900000);
await entryCheckpoint("bootstrap entry");
const boot = await bootstrap(root);
await entryCheckpoint("owned binder");
const inputs = await import("../../scripts/campaign-monster-production-inputs.mjs");
const entry = await inputs.verifyCampaignMonsterEntry(root);
const descriptor = await inputs.reviewedDescriptor(root), phase = await inputs.requireMeasuredBudget(descriptor);
const processes = await inputs.loadCampaignMonsterProcess(root, entry);
await entryCheckpoint("framework import");
const { test, expect } = await import("@playwright/test");
const { spawn } = await import("node:child_process");
test("actual campaign monster forms; all authority/persistence boundaries modeled", async () => {
  const runner = path.join(root, "scripts/verify-campaign-monster-local.mjs"), deadline = launchTime + phase.wholeMs;
  assert.ok(deadline - Date.now() >= phase.casesMs + phase.finalMs + phase.cleanupMs + phase.reserveMs);
  const wrapperIdentity = { ...await processes.freshIdentity(process.pid, process.ppid), cwdKnownFromLaunch: root, startUtc: new Date().toISOString() };
  const resourcesBefore = processes.resources(), wrapperTiming: unknown[] = [];
  await entryCheckpoint("owned runner launch");
  const child = spawn(process.execPath, [runner, "--shared-deadline", String(deadline)], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  type RenderedProof = { artifacts: Parameters<typeof inputs.rebindCampaignMonsterInputs>[5]; metafile: Parameters<typeof inputs.rebindCampaignMonsterInputs>[3]; captured: Array<[string, unknown]>; modelBundle: Parameters<typeof inputs.rebindCampaignMonsterInputs>[6]; fixtureBundle: Parameters<typeof inputs.rebindCampaignMonsterInputs>[7] };
  let output = "", outputDir: string | undefined, renderedProof: RenderedProof | undefined;
  child.stdout!.on("data", bytes => { output += bytes; }); child.stderr!.on("data", bytes => { output += bytes; });
  child.on("message", (raw: unknown) => {
    const value = raw as { type?: string; path?: string; proof?: RenderedProof };
    if (value?.type === "output") { assert.equal(outputDir, undefined); assert.equal(typeof value.path, "string"); outputDir = value.path!; assert.ok(path.resolve(outputDir).startsWith(path.join(root, "test-results/campaign-monster-local/run-"))); }
    if (value?.type === "rendered-inputs") { assert.equal(renderedProof, undefined); renderedProof = value.proof; }
  });
  const completed = new Promise<number | null>((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  let identity: { pid: number; parentPid: number; command: string; birthUtc: string } | undefined;
  async function fullFreshProof() {
    assert.ok(renderedProof && outputDir, "No force/acceptance without actual first rendered proof");
    const disk = JSON.parse(await fs.readFile(path.join(outputDir, "rendered-inputs.json"), "utf8")); assert.deepEqual(disk, renderedProof);
    await inputs.measureGuard("wrapper-complete-fresh-proof", async () => {
      const fresh = await inputs.rebindCampaignMonsterInputs(root, descriptor.buildManifestPath, processes.receipt, renderedProof!.metafile,
        new Map(renderedProof!.captured), renderedProof!.artifacts, renderedProof!.modelBundle, renderedProof!.fixtureBundle);
      assert.deepEqual(fresh, renderedProof); assert.deepEqual(await inputs.verifyCampaignMonsterEntry(root), entry);
      assert.deepEqual(await bootstrap(root), boot);
    }, (record: { elapsedMs: number }) => { wrapperTiming.push(record); assert.ok(record.elapsedMs <= phase.wrapperFinalMs, "Measured wrapper final exceeds approved allocation"); });
  }
  try {
    assert.ok(child.pid);
    try { identity = await processes.freshIdentity(child.pid, process.pid); } catch (error) { if (child.exitCode === null) throw error; }
    if (identity) assert.ok(identity.command.includes(runner));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const code = await Promise.race([completed, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(Error("Shared deadline reserves wrapper final and cleanup")), Math.max(1, deadline - Date.now() - phase.wrapperFinalMs - phase.cleanupMs - phase.reserveMs));
    })]).finally(() => clearTimeout(timer)); console.log(output); expect(code, output).toBe(0);
    assert.ok(outputDir && renderedProof && identity, "Missing actual output/initial proof/OS birth is unproved");
    const result = JSON.parse(await fs.readFile(path.join(outputDir, "evidence.json"), "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.persistence).toBe("modeled-memory-only");
    expect(result.sourceCheckpoint).toBe("0aec1242c911bc35f92ba413fd37f483b6b83f03");
    expect(result.sourceAmendments).toEqual(inputs.campaignMonsterSourceAmendments);
    expect(result.evidence).toHaveLength(44); expect(result.evidence.every((row: { passed: boolean }) => row.passed)).toBe(true);
    expect(result.screenshots).toHaveLength(44); expect(new Set(result.screenshots).size).toBe(44); expect(result.fontEvidence).toHaveLength(44);
    expect(result.pageErrors).toEqual([]); expect(result.networkErrors).toEqual([]); expect(result.diagnostics).toEqual([]);
    expect(result.failure).toBeNull(); expect(result.portClosed).toBe(true); expect(result.browserPortClosed).toBe(true);
    expect(result.browserReadback?.absent).toBe(true); expect(result.observedReadback.every((row: { absent: boolean }) => row.absent)).toBe(true);
    expect(result.taskProcess.birthUtc).toBe(identity?.birthUtc); assert.deepEqual(result.finalProof, renderedProof);
    assert.ok(deadline - Date.now() >= phase.cleanupMs);
    await fullFreshProof();
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise<boolean>(resolve => { const timer = setTimeout(() => resolve(false), 10000); child.once("exit", () => { clearTimeout(timer); resolve(true); });
        if (child.exitCode !== null) { clearTimeout(timer); resolve(true); } });
      if (!ended && child.exitCode === null) {
        assert.ok(identity); assert.ok(deadline - Date.now() >= phase.finalMs + phase.cleanupMs);
        await processes.forceOwnedTree(identity, fullFreshProof, () => child.exitCode === null);
      }
    }
    assert.deepEqual(await bootstrap(root), boot);
    const readback = identity ? await processes.absentIdentity(identity) : null;
    const resourcesAfter = processes.resources();
    if (outputDir) await fs.writeFile(path.join(outputDir, "wrapper-cleanup.json"), JSON.stringify({ wrapperIdentity, childIdentity: identity ?? null,
      childReadback: readback, resourcesBefore, resourcesAfter, timing: wrapperTiming, wholeStartUtc: new Date(launchTime).toISOString(), deadlineUtc: new Date(deadline).toISOString(),
      observedUtc: new Date().toISOString(), sourceOnlyAuthority: "Offline fixture only; Auth/RPC/ledger/provider unverified" }, null, 2), { flag: "wx" });
    assert.ok(readback?.absent, "Exact owned child completion remains unproved");
  }
});
