import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const campaignMonsterSourceCheckpoint = "0aec1242c911bc35f92ba413fd37f483b6b83f03";
export const campaignMonsterProcessHelper = { relativePath: "scripts/npc-process.mjs", reviewedAnchor: "846860209041819deb27b1547c06a77720ad3037", reviewedGitBlobOid: "0841bda7b9e785280e684030bf4fe900d81465e5" };
const assetHelper = { relativePath: "scripts/passive-feature-production-assets.mjs", reviewedAnchor: "5fedd6222eeb97c11f7645dac580cbebee845311", reviewedGitBlobOid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" };
const bundledRequired = ["components/campaigns/monster-instance-form.tsx", "components/campaigns/monster-instance-panel.tsx",
  "components/compendium/monster-stat-block.tsx", "lib/campaigns/monster-instance-schema.ts", "lib/campaigns/monster-instance-form.ts"];
const required = ["lib/campaigns/monster-instance-schema.ts", "lib/campaigns/monster-instance-form.ts",
  "lib/supabase/campaign-monster-instances-server.ts", "lib/supabase/campaign-monster-instances.types.ts",
  "app/(app)/campaigns/[id]/monsters/actions.ts", "app/(app)/campaigns/[id]/monsters/page.tsx",
  "app/(app)/campaigns/[id]/monsters/[instanceId]/page.tsx", "app/(app)/campaigns/[id]/page.tsx",
  "components/campaigns/monster-instance-form.tsx", "components/campaigns/monster-instance-panel.tsx",
  "supabase/staged/campaign-monster-instances.sql"];
export const campaignMonsterHarnessFiles = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts",
  "e2e/local-campaign-monster/campaign-monster.spec.ts", "scripts/campaign-monster-production-inputs.mjs",
  "scripts/campaign-monster-scenarios.mjs", "scripts/verify-campaign-monster-local.mjs"];
const fixtureFiles = ["tests/fixtures/campaign-monster-instances.ts"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
function trackedClean(root, relativePath) {
  assert.equal(git(root, ["diff", "--cached", "HEAD", "--", relativePath]).toString().trim(), "", `Staged drift: ${relativePath}`);
  assert.equal(git(root, ["diff", "--", relativePath]).toString().trim(), "", `Mounted drift: ${relativePath}`);
  assert.equal(git(root, ["ls-files", "--unmerged", "--", relativePath]).toString().trim(), "", `Unmerged input: ${relativePath}`);
  assert.equal(git(root, ["ls-files", "--error-unmatch", "--", relativePath]).toString().trim(), relativePath);
}
function representation(root, relativePath) {
  const options = {};
  for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
    try { options[key] = git(root, ["config", "--show-origin", "--get", key]).toString().trim(); }
    catch (error) { if (error.status !== 1) throw error; options[key] = null; }
  }
  const attributes = git(root, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", relativePath]).toString().trim();
  assert.ok(attributes.split(/\r?\n/).includes(`${relativePath}: filter: unspecified`), "Executable checkout filter refused");
  assert.ok(attributes.split(/\r?\n/).includes(`${relativePath}: working-tree-encoding: unspecified`), "Unexpected helper encoding");
  return { options, attributes };
}
/** Independently bind inherited Node executable bytes BEFORE any import/use.
 * Both reviewed inherited modules import only Node builtins; no hidden project
 * transitive dependency may be added without a new anchored review. */
export async function verifyCampaignMonsterInheritedHelper(root, descriptor) {
  const rootCheckout = path.resolve(root, "../equipment-verification");
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "", "Root must be frozen clean");
  assert.equal(git(root, ["rev-parse", `${descriptor.reviewedAnchor}:${descriptor.relativePath}`]).toString().trim(), descriptor.reviewedGitBlobOid);
  const canonical = git(root, ["cat-file", "blob", descriptor.reviewedGitBlobOid]);
  const checkoutIdentities = []; let executedSha256, checkoutRepresentation;
  for (const [role, checkout] of [["worker", root], ["root", rootCheckout]]) {
    trackedClean(checkout, descriptor.relativePath);
    const headBlobOid = git(checkout, ["rev-parse", `HEAD:${descriptor.relativePath}`]).toString().trim();
    const indexBlobOid = git(checkout, ["rev-parse", `:${descriptor.relativePath}`]).toString().trim();
    assert.equal(headBlobOid, descriptor.reviewedGitBlobOid); assert.equal(indexBlobOid, descriptor.reviewedGitBlobOid);
    const currentRepresentation = representation(checkout, descriptor.relativePath);
    if (checkoutRepresentation) assert.deepEqual(currentRepresentation, checkoutRepresentation, "Worker/root helper checkout differs");
    checkoutRepresentation = currentRepresentation;
    const raw = await fs.readFile(path.join(checkout, descriptor.relativePath));
    const projected = git(checkout, ["cat-file", "--filters", `--path=${descriptor.relativePath}`, descriptor.reviewedGitBlobOid]);
    assert.equal(sha(raw), sha(projected), "Executed helper bytes differ from reviewed Git checkout");
    if (executedSha256) assert.equal(sha(raw), executedSha256, "Worker/root executed helper bytes differ");
    executedSha256 = sha(raw); checkoutIdentities.push({ role, headBlobOid, indexBlobOid });
  }
  return { ...descriptor, canonicalBlobSha256: sha(canonical), executedSha256, checkoutIdentities, checkoutRepresentation };
}
/** Owned executable/fixture closure: canonical identity alone does not bind the
 * mounted bytes actually loaded by Node/esbuild. Bind worker and root index,
 * checkout representation and raw bytes; repeat at the acceptance boundary. */
export async function bindCampaignMonsterHarnessFiles(root, paths = campaignMonsterHarnessFiles, anchor) {
  assert.match(anchor ?? "", /^[a-f0-9]{40}$/, "Explicit reviewed checkpoint required; no HEAD fallback");
  const rootCheckout = path.resolve(root, "../equipment-verification"), receipts = [];
  for (const relativePath of paths) {
    const gitBlobOid = git(root, ["rev-parse", `${anchor}:${relativePath}`]).toString().trim();
    const canonical = git(root, ["cat-file", "blob", gitBlobOid]);
    const checkoutIdentities = []; let executedSha256, checkoutRepresentation;
    for (const [role, checkout] of [["worker", root], ["root", rootCheckout]]) {
      trackedClean(checkout, relativePath);
      const headBlobOid = git(checkout, ["rev-parse", `HEAD:${relativePath}`]).toString().trim();
      const indexBlobOid = git(checkout, ["rev-parse", `:${relativePath}`]).toString().trim();
      assert.equal(headBlobOid, gitBlobOid); assert.equal(indexBlobOid, gitBlobOid);
      const currentRepresentation = representation(checkout, relativePath);
      if (checkoutRepresentation) assert.deepEqual(currentRepresentation, checkoutRepresentation);
      checkoutRepresentation = currentRepresentation;
      const raw = await fs.readFile(path.join(checkout, relativePath));
      assert.equal(sha(raw), sha(git(checkout, ["cat-file", "--filters", `--path=${relativePath}`, gitBlobOid])), `Mounted harness differs from Git checkout: ${relativePath}`);
      if (executedSha256) assert.equal(sha(raw), executedSha256, `Worker/root mounted harness differs: ${relativePath}`);
      executedSha256 = sha(raw); checkoutIdentities.push({ role, headBlobOid, indexBlobOid });
    }
    receipts.push({ relativePath, gitBlobOid, gitBlobSha256: sha(canonical), executedSha256, checkoutIdentities, checkoutRepresentation });
  }
  return receipts;
}
export async function loadCampaignMonsterProductionAssets(root, manifestPath, originalProcessReceipt) {
  const descriptor = await reviewedDescriptor(root);
  assert.equal(path.resolve(manifestPath), path.resolve(descriptor.buildManifestPath));
  const inheritedAsset = await verifyCampaignMonsterInheritedHelper(root, assetHelper);
  const inheritedProcess = await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper);
  assert.deepEqual(inheritedProcess, originalProcessReceipt, "Process helper changed after its guarded import");
  const { loadPassiveFeatureProductionAssets } = await import("./passive-feature-production-assets.mjs");
  const result = await loadPassiveFeatureProductionAssets(root, manifestPath);
  result.projectInputPlugin = campaignMonsterProjectInputPlugin;
  result.artifacts.inheritedHelpers = [inheritedAsset, inheritedProcess];
  result.artifacts.campaignMonsterSourceCheckpoint = campaignMonsterSourceCheckpoint;
  result.artifacts.harnessSourceSha = git(root, ["rev-parse", "HEAD"]).toString().trim();
  result.artifacts.harnessFiles = await bindCampaignMonsterHarnessFiles(root, campaignMonsterHarnessFiles, (await reviewedDescriptor(root)).harnessCheckpoint);
  result.artifacts.installedNodeClosure = await bindCampaignMonsterRuntime(root);
  result.artifacts.campaignMonsterSourceFiles = await bindCampaignMonsterHarnessFiles(root, required, campaignMonsterSourceCheckpoint);
  result.artifacts.runtimeConfig = await bindCampaignMonsterHarnessFiles(root, ["package-lock.json", "package.json", "tsconfig.json"], campaignMonsterSourceCheckpoint);
  result.artifacts.fixtureFiles = await bindCampaignMonsterHarnessFiles(root, fixtureFiles, campaignMonsterSourceCheckpoint);
  result.artifacts.reviewedDescriptor = descriptor;
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "node_modules/zod/package.json"), "utf8")).version, lock.packages["node_modules/zod"].version);
  return result;
}
export async function bindCampaignMonsterProjectInputs(root, metafile, captured, artifacts, requiredInputs = bundledRequired) {
  assert.deepEqual(await bindCampaignMonsterHarnessFiles(root, campaignMonsterHarnessFiles, (await reviewedDescriptor(root)).harnessCheckpoint), artifacts.harnessFiles, "Mounted owned harness changed after receipt");
  const receipts = [await verifyCampaignMonsterInheritedHelper(root, assetHelper), await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper)];
  assert.deepEqual(receipts, artifacts.inheritedHelpers, "Inherited executable changed during bundle");
  const rootCheckout = path.resolve(root, "../equipment-verification"), projectInputs = [], syntheticInputs = [];
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), artifacts.currentRootHead);
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "");
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith("campaign-monster-offline:")) {
      const name = input.slice("campaign-monster-offline:".length), expected = boundarySources[name], record = captured.get(input);
      assert.equal(typeof expected, "string", "Unapproved generated boundary"); assert.ok(record);
      assert.equal(record.sha256, sha(expected)); assert.equal(record.bytes, Buffer.byteLength(expected));
      syntheticInputs.push({ input, ...record, boundary: "explicit action/navigation/server-ledger model" }); continue;
    }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath), "Bundled input escaped worker");
    const record = captured.get(absolute); assert.ok(record, `Uncaptured input: ${input}`);
    assert.equal(sha(await fs.readFile(absolute)), record.sha256, `Mounted bytes changed: ${relativePath}`);
    if (relativePath === "e2e/local-campaign-monster/fixture.tsx") {
      trackedClean(root, relativePath); syntheticInputs.push({ ...record, boundary: "original query/entitlement fixture" }); continue;
    }
    if (!relativePath.startsWith("node_modules/")) {
      for (const checkout of [root, rootCheckout]) trackedClean(checkout, relativePath);
      assert.equal(sha(git(root, ["show", `HEAD:${relativePath}`])), sha(git(rootCheckout, ["show", `HEAD:${relativePath}`])), `HEAD input differs: ${relativePath}`);
    }
    assert.equal(sha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256, `Production root bytes differ: ${relativePath}`);
    projectInputs.push(record);
  }
  for (const relativePath of requiredInputs) assert.ok(projectInputs.some(input => input.relativePath === relativePath), `Missing actual input: ${relativePath}`);
  for (const relativePath of ["package-lock.json", "package.json", "tsconfig.json"]) {
    for (const checkout of [root, rootCheckout]) trackedClean(checkout, relativePath);
    const bytes = await fs.readFile(path.join(root, relativePath));
    assert.equal(sha(bytes), sha(await fs.readFile(path.join(rootCheckout, relativePath))));
    if (relativePath === "package-lock.json") assert.equal(sha(bytes), artifacts.dependencyLockSha256);
  }
  return { bundledProjectInputs: projectInputs, syntheticInputs, metafileSha256: sha(JSON.stringify(metafile)) };
}
/** Final re-read of full inherited/owned executable closure, captured product
 * bytes, current root/build/assets/lock/config. Fresh receipts must equal those
 * used for rendering; no acceptance from an earlier successful guard alone. */
export async function rebindCampaignMonsterInputs(root, manifestPath, processReceipt, metafile, captured, artifacts, modelBundle) {
  const fresh = await loadCampaignMonsterProductionAssets(root, manifestPath, processReceipt);
  Object.assign(fresh.artifacts, await bindCampaignMonsterProjectInputs(root, metafile, captured, fresh.artifacts));
  assert.ok(modelBundle, "Actual server-model generated bundle proof required");
  const modelInputs = await bindCampaignMonsterProjectInputs(root, modelBundle.metafile, new Map(modelBundle.captured), fresh.artifacts, fixtureFiles);
  fresh.artifacts.modelBundle = { ...modelBundle, inputs: modelInputs };
  assert.equal(sha(await fs.readFile(modelBundle.outputPath)), modelBundle.outputSha256);
  assert.deepEqual(fresh.artifacts, artifacts, "Final source/build/runtime closure differs from rendered inputs");
  return { artifacts: fresh.artifacts, metafile, captured: [...captured].sort(([a], [b]) => a.localeCompare(b)), modelBundle };
}

/** Capture exactly the bytes supplied to esbuild, including installed runtime. */
export function campaignMonsterProjectInputPlugin(root, captured) {
  return { name: "campaign-monster-actual-byte-capture", setup(builder) {
    builder.onLoad({ filter: /\.(tsx?|jsx?|mjs|cjs|json)$/, namespace: "file" }, async args => {
      const absolute = await fs.realpath(args.path), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
      assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath));
      const bytes = await fs.readFile(absolute);
      captured.set(absolute, { relativePath, sha256: sha(bytes), bytes: bytes.length });
      const extension = path.extname(absolute).slice(1);
      return { contents: bytes.toString("utf8"), loader: extension === "mjs" || extension === "cjs" ? "js" : extension, resolveDir: path.dirname(absolute) };
    });
  } };
}
/** Node-side dependency closure is outside the browser metafile. Bind every
 * installed file in each lock-described transitive package before dynamic import.
 * Do not derive trust from only package versions or newline-normalized bytes. */
export async function bindCampaignMonsterRuntime(root) {
  const rootCheckout = path.resolve(root, "../equipment-verification");
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  const visited = new Set(), receipts = [];
  async function packageClosure(relativePath) {
    if (visited.has(relativePath)) return; visited.add(relativePath);
    const packageFile = path.join(root, relativePath, "package.json");
    const metadata = JSON.parse(await fs.readFile(packageFile, "utf8"));
    assert.equal(metadata.version, lock.packages[relativePath]?.version, "Unbound installed package " + relativePath);
    const files = [];
    async function walk(relative) {
      const actual = path.join(root, relative), info = await fs.lstat(actual);
      const rootInfo = await fs.lstat(path.join(rootCheckout, relative));
      assert.equal(info.isSymbolicLink(), false, "Runtime symlink refused " + relative);
      assert.equal(rootInfo.isSymbolicLink(), false, "Root runtime symlink refused " + relative);
      assert.equal(info.isDirectory(), rootInfo.isDirectory());
      if (info.isDirectory()) {
        const entries = await fs.readdir(actual);
        const rootEntries = await fs.readdir(path.join(rootCheckout, relative));
        assert.deepEqual(entries.sort(), rootEntries.sort(), "Installed runtime file set differs");
        for (const entry of entries) await walk(path.join(relative, entry));
      } else {
        assert.ok(info.isFile()); const bytes = await fs.readFile(actual);
        assert.equal(sha(bytes), sha(await fs.readFile(path.join(rootCheckout, relative))), "Installed runtime raw bytes differ");
        files.push({ relativePath: relative.replaceAll(path.sep, "/"), bytes: bytes.length, sha256: sha(bytes) });
      }
    }
    await walk(relativePath);
    receipts.push({ relativePath, version: metadata.version, files });
    for (const [name, optional] of [
      ...Object.keys(metadata.dependencies ?? {}).map(name => [name, false]),
      ...Object.keys(metadata.optionalDependencies ?? {}).map(name => [name, true]),
    ]) {
      let directory = path.join(root, relativePath), candidate;
      while (directory.startsWith(path.resolve(root))) {
        const possible = path.join(directory, "node_modules", name);
        try { await fs.access(path.join(possible, "package.json")); candidate = path.relative(root, possible).replaceAll(path.sep, "/"); break; }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        if (directory === path.resolve(root)) break; directory = path.dirname(directory);
      }
      let rootDirectory = path.join(rootCheckout, relativePath), rootCandidate;
      while (rootDirectory.startsWith(path.resolve(rootCheckout))) {
        const possible = path.join(rootDirectory, "node_modules", name);
        try { await fs.access(path.join(possible, "package.json")); rootCandidate = path.relative(rootCheckout, possible).replaceAll(path.sep, "/"); break; }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        if (rootDirectory === path.resolve(rootCheckout)) break; rootDirectory = path.dirname(rootDirectory);
      }
      assert.equal(candidate, rootCandidate, "Worker/root Node dependency resolution or optional absence differs");
      if (!candidate) {
        assert.ok(optional, "Missing required Node executable dependency " + name);
        receipts.push({ absentOptional: name, from: relativePath }); continue;
      }
      await packageClosure(candidate);
    }
  }
  for (const name of ["esbuild", "playwright", "playwright-core", "@playwright/test", "next", "react", "react-dom", "zod", "tsx"]) await packageClosure("node_modules/" + name);
  return receipts;
}
export async function verifyCampaignMonsterEntry(root) {
  const descriptor = await reviewedDescriptor(root);
  assert.equal(git(path.resolve(root, "../equipment-verification"), ["rev-parse", "HEAD"]).toString().trim(), descriptor.rootSourceSha);
  const nodeRuntime = { executable: process.execPath, version: process.version, executedSha256: sha(await fs.readFile(process.execPath)) };
  assert.deepEqual(nodeRuntime, descriptor.nodeRuntime, "Actual Node launcher differs from externally reviewed runtime");
  return {
    descriptor,
    nodeRuntime,
    rootHead: git(path.resolve(root, "../equipment-verification"), ["rev-parse", "HEAD"]).toString().trim(),
    harnessFiles: await bindCampaignMonsterHarnessFiles(root, campaignMonsterHarnessFiles, (await reviewedDescriptor(root)).harnessCheckpoint),
    sourceFiles: await bindCampaignMonsterHarnessFiles(root, required, campaignMonsterSourceCheckpoint),
    runtimeConfig: await bindCampaignMonsterHarnessFiles(root, ["package-lock.json", "package.json", "tsconfig.json"], campaignMonsterSourceCheckpoint),
    fixtures: await bindCampaignMonsterHarnessFiles(root, fixtureFiles, campaignMonsterSourceCheckpoint),
    installedNodeClosure: await bindCampaignMonsterRuntime(root),
    inheritedHelpers: [
      await verifyCampaignMonsterInheritedHelper(root, assetHelper),
      await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper),
    ],
  };
}
/** Root supplies this independent descriptor AFTER exact source/budget review.
 * No candidate generator, default artifact, approval or native activation. */
export async function reviewedDescriptor(root) {
  const selected = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR;
  const expected = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
  assert.ok(selected && path.isAbsolute(selected), "Source preparation only: reviewed descriptor absent");
  assert.match(expected ?? "", /^[a-f0-9]{64}$/, "Independent descriptor digest required");
  const bytes = await fs.readFile(selected); assert.ok(bytes.length < 65536); assert.equal(sha(bytes), expected);
  const value = JSON.parse(bytes);
  assert.equal(value.kind, "independently-reviewed-offline-m5-v1");
  assert.equal(value.producerCheckpoint, campaignMonsterSourceCheckpoint);
  assert.match(value.harnessCheckpoint ?? "", /^[a-f0-9]{40}$/); assert.match(value.rootSourceSha ?? "", /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(value.harnessBlobs ?? {}).sort(), [...campaignMonsterHarnessFiles].sort());
  for (const relative of campaignMonsterHarnessFiles) assert.equal(git(root, ["rev-parse", value.harnessCheckpoint + ":" + relative]).toString().trim(), value.harnessBlobs[relative]);
  assert.ok(path.isAbsolute(value.buildManifestPath));
  assert.ok(value.nodeRuntime && path.isAbsolute(value.nodeRuntime.executable));
  assert.match(value.nodeRuntime.executedSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(typeof value.nodeRuntime.version, "string");
  assert.ok(path.isAbsolute(value.fullCheckReceipt?.path)); assert.match(value.fullCheckReceipt.sha256 ?? "", /^[a-f0-9]{64}$/);
  const checkBytes = await fs.readFile(value.fullCheckReceipt.path); assert.equal(sha(checkBytes), value.fullCheckReceipt.sha256);
  const check = JSON.parse(checkBytes); assert.equal(check.gate, "check"); assert.equal(check.exitCode, 0); assert.equal(check.sourceSha, value.rootSourceSha);
  assert.ok(check.sourceStatus === "" || (Array.isArray(check.sourceStatus) && check.sourceStatus.length === 0), "Current full check must have clean-source receipt");
  assert.ok(["pending-measurement", "root-reviewed-measured"].includes(value.phaseAllocation?.status));
  assert.equal(value.phaseAllocation.wholeMs, 900000);
  if (value.phaseAllocation.status === "pending-measurement") return { ...value, descriptorPath: selected, descriptorSha256: expected };
  await requireMeasuredBudget(value);
  return { ...value, descriptorPath: selected, descriptorSha256: expected };
}
export const boundarySources = {
  "next/link": "import React from 'react';export default function Link(props){return React.createElement('a',props)}",
  "next/navigation": "export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser.js';export const useRouter=()=>({push:href=>{if(window.campaignMonster.navigationFailure)throw Error('Modeled router failure');location.assign(href)}})",
  "@/app/(app)/campaigns/[id]/monsters/actions": "export const commitCampaignMonster=(campaign,form)=>window.campaignMonster.commit(campaign,form);export const resolveCampaignMonster=(campaign,operation)=>window.campaignMonster.resolve(campaign,operation);export const previewCampaignMonster=(campaign,source,version)=>window.campaignMonster.preview(campaign,source,version)",
  "server-model": "export * from './tests/fixtures/campaign-monster-instances.ts';export * from './lib/campaigns/monster-instance-schema.ts';export * from './lib/campaigns/monster-instance-form.ts'",
};
/** Pure hooks let root measure complete guards separately; they do not launch a
 * browser or fabricate a measured receipt. Full runner/config still require it. */
export async function measureGuard(label, action, onMeasurement) {
  const start = performance.now();
  try { return await action(); }
  finally { onMeasurement?.({ label, elapsedMs: performance.now() - start, actual: true }); }
}
export async function requireMeasuredBudget(value) {
  const phase = value.phaseAllocation;
  assert.equal(phase?.status, "root-reviewed-measured", "Full browser/force gate remains UNREADY pending actual measured allocation");
  assert.equal(phase.wholeMs, 900000);
  assert.ok(["entryMs", "casesMs", "finalMs", "cleanupMs", "reserveMs"].every(key => Number.isSafeInteger(phase[key]) && phase[key] > 0));
  assert.equal(phase.entryMs + phase.casesMs + phase.finalMs + phase.cleanupMs + phase.reserveMs, 900000);
  assert.ok(["runnerFinalMs", "wrapperFinalMs", "forceProofMs"].every(key => Number.isSafeInteger(phase[key]) && phase[key] > 0));
  assert.equal(phase.runnerFinalMs + phase.wrapperFinalMs, phase.finalMs);
  assert.ok(phase.forceProofMs <= phase.reserveMs && phase.forceProofMs >= phase.wrapperFinalMs, "Fresh force proof requires a measured complete closure reserve");
  assert.ok(phase.forceProofIncluded === true && phase.runnerAndWrapperFinalsIncluded === true);
  assert.ok(path.isAbsolute(phase.measurementReceipt.path)); assert.match(phase.measurementReceipt.sha256, /^[a-f0-9]{64}$/);
  const measurement = await fs.readFile(phase.measurementReceipt.path); assert.equal(sha(measurement), phase.measurementReceipt.sha256);
  assert.ok(path.isAbsolute(value.buildManifestPath));
  return phase;
}
export async function loadCampaignMonsterProcess(root, entryProof) {
  assert.deepEqual(await verifyCampaignMonsterEntry(root), entryProof, "Entry closure changed before process helper import");
  const inherited = await import("./npc-process.mjs");
  return {
    receipt: entryProof.inheritedHelpers[1],
    resources: inherited.npcResources,
    assertNoOtherRunner: inherited.assertNoOtherNpcRunner,
    async freshIdentity(pid, parentPid) {
      assert.deepEqual(await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper), entryProof.inheritedHelpers[1]);
      return inherited.npcOsIdentity(pid, parentPid);
    },
    async absentIdentity(identity) {
      assert.deepEqual(await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper), entryProof.inheritedHelpers[1]);
      const code = "$taskRow=Get-CimInstance Win32_Process -Filter 'ProcessId=" + identity.pid
        + "';if(!$taskRow){'null';exit};@{pid=$taskRow.ProcessId;birthUtc=$taskRow.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress";
      const fresh = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true, timeout: 30000 }));
      return { pid: identity.pid, originalBirthUtc: identity.birthUtc, absent: !fresh || fresh.birthUtc !== identity.birthUtc, freshBirthUtc: fresh?.birthUtc ?? null };
    },
    async ownedSnapshot(identity) {
      assert.deepEqual(await verifyCampaignMonsterInheritedHelper(root, campaignMonsterProcessHelper), entryProof.inheritedHelpers[1]);
      const code = "$taskRows=@(Get-CimInstance Win32_Process);$taskRoot=$taskRows|Where-Object ProcessId -eq " + identity.pid
        + ";if(!$taskRoot -or $taskRoot.CreationDate.ToUniversalTime().ToString('o') -ne '" + identity.birthUtc
        + "'){exit 3};$taskIds=[Collections.Generic.HashSet[int]]::new();$null=$taskIds.Add(" + identity.pid
        + ");do{$taskAdded=$false;foreach($taskRow in $taskRows){if($taskIds.Contains([int]$taskRow.ParentProcessId) -and $taskIds.Add([int]$taskRow.ProcessId)){$taskAdded=$true}}}while($taskAdded);@($taskRows|Where-Object {$taskIds.Contains([int]$_.ProcessId)}|ForEach-Object {@{pid=$_.ProcessId;parentPid=$_.ParentProcessId;birthUtc=$_.CreationDate.ToUniversalTime().ToString('o');command=$_.CommandLine}})|ConvertTo-Json -Compress";
      const rows = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true, timeout: 30000 }));
      return (Array.isArray(rows) ? rows : [rows]).map(row => ({ ...row, cwdKnownFromLaunch: row.pid === identity.pid ? root : null, capturedUtc: new Date().toISOString() }));
    },
    async forceOwnedTree(identity, freshFullRenderedProof, stillRunning) {
      await requireMeasuredBudget(entryProof.descriptor);
      assert.equal(typeof stillRunning, "function"); if (!stillRunning()) return;
      await freshFullRenderedProof();
      if (!stillRunning()) return;
      if ((await this.absentIdentity(identity)).absent) return;
      assert.deepEqual(await verifyCampaignMonsterEntry(root), entryProof, "Full entry closure changed before targeted force");
      if (!stillRunning()) return;
      let fresh;
      try { fresh = await this.freshIdentity(identity.pid, identity.parentPid); }
      catch (error) { if (!stillRunning()) return; throw error; }
      assert.equal(fresh.birthUtc, identity.birthUtc); assert.equal(fresh.command, identity.command);
      assert.ok(fresh.command.includes(path.join(root, "scripts", "verify-campaign-monster-local.mjs")));
      if (!stillRunning()) return;
      execFileSync("taskkill", ["/pid", String(identity.pid), "/T", "/F"], { windowsHide: true });
    },
  };
}
