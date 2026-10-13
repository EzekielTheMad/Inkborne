import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const itemSharingSourceCheckpoint = "b569b8f050cc61b565a46b89c064b299d48535e3";
export const itemSharingProcessHelper = { relativePath: "scripts/npc-process.mjs", reviewedAnchor: "846860209041819deb27b1547c06a77720ad3037", reviewedGitBlobOid: "0841bda7b9e785280e684030bf4fe900d81465e5" };
const assetHelper = { relativePath: "scripts/passive-feature-production-assets.mjs", reviewedAnchor: "5fedd6222eeb97c11f7645dac580cbebee845311", reviewedGitBlobOid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" };
const bundledRequired = ["components/library/item-form.tsx", "components/library/item-sharing-panel.tsx", "lib/homebrew/item-form.ts", "lib/schemas/content-types/item.ts"];
const required = ["lib/supabase/homebrew-items-server.ts", "app/(app)/homebrew/items/actions.ts",
  "components/library/item-sharing-panel.tsx", "app/(app)/homebrew/items/[id]/edit/page.tsx", "components/library/item-form.tsx",
  "app/(app)/homebrew/page.tsx", "lib/supabase/campaign-shared-content-server.ts", "app/(app)/campaigns/actions.ts",
  "supabase/staged/item-campaign-sharing.sql"];
export const itemSharingHarnessFiles = ["e2e/local-item-sharing/fixture.tsx", "e2e/local-item-sharing/playwright.config.ts", "e2e/local-item-sharing/item-sharing.spec.ts",
  "scripts/item-sharing-production-inputs.mjs", "scripts/item-sharing-scenarios.mjs", "scripts/verify-item-sharing-local.mjs"];
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
export async function verifyItemSharingInheritedHelper(root, descriptor) {
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
export async function bindItemSharingHarnessFiles(root, paths = itemSharingHarnessFiles, anchor = null) {
  const rootCheckout = path.resolve(root, "../equipment-verification"), receipts = [];
  for (const relativePath of paths) {
    const gitBlobOid = git(root, ["rev-parse", `${anchor ?? "HEAD"}:${relativePath}`]).toString().trim();
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
export async function loadItemSharingProductionAssets(root, manifestPath, originalProcessReceipt) {
  const inheritedAsset = await verifyItemSharingInheritedHelper(root, assetHelper);
  const inheritedProcess = await verifyItemSharingInheritedHelper(root, itemSharingProcessHelper);
  assert.deepEqual(inheritedProcess, originalProcessReceipt, "Process helper changed after its guarded import");
  const { loadPassiveFeatureProductionAssets } = await import("./passive-feature-production-assets.mjs");
  const result = await loadPassiveFeatureProductionAssets(root, manifestPath);
  result.projectInputPlugin = itemSharingProjectInputPlugin;
  result.artifacts.inheritedHelpers = [inheritedAsset, inheritedProcess];
  result.artifacts.itemSharingSourceCheckpoint = itemSharingSourceCheckpoint;
  result.artifacts.harnessSourceSha = git(root, ["rev-parse", "HEAD"]).toString().trim();
  result.artifacts.harnessFiles = await bindItemSharingHarnessFiles(root);
  result.artifacts.installedNodeClosure = await bindItemSharingRuntime(root);
  result.artifacts.itemSharingSourceFiles = await bindItemSharingHarnessFiles(root, required, itemSharingSourceCheckpoint);
  result.artifacts.runtimeConfig = await bindItemSharingHarnessFiles(root, ["package-lock.json", "package.json", "tsconfig.json"], itemSharingSourceCheckpoint);
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "node_modules/zod/package.json"), "utf8")).version, lock.packages["node_modules/zod"].version);
  return result;
}
export async function bindItemSharingProjectInputs(root, metafile, captured, artifacts) {
  assert.deepEqual(await bindItemSharingHarnessFiles(root), artifacts.harnessFiles, "Mounted owned harness changed after receipt");
  const receipts = [await verifyItemSharingInheritedHelper(root, assetHelper), await verifyItemSharingInheritedHelper(root, itemSharingProcessHelper)];
  assert.deepEqual(receipts, artifacts.inheritedHelpers, "Inherited executable changed during bundle");
  const rootCheckout = path.resolve(root, "../equipment-verification"), projectInputs = [], syntheticInputs = [];
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), artifacts.currentRootHead);
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "");
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith("item-sharing-offline:")) { syntheticInputs.push({ input, boundary: "explicit action/navigation model" }); continue; }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath), "Bundled input escaped worker");
    const record = captured.get(absolute); assert.ok(record, `Uncaptured input: ${input}`);
    assert.equal(sha(await fs.readFile(absolute)), record.sha256, `Mounted bytes changed: ${relativePath}`);
    if (relativePath === "e2e/local-item-sharing/fixture.tsx") {
      trackedClean(root, relativePath); syntheticInputs.push({ ...record, boundary: "original query/entitlement fixture" }); continue;
    }
    if (!relativePath.startsWith("node_modules/")) {
      for (const checkout of [root, rootCheckout]) trackedClean(checkout, relativePath);
      assert.equal(sha(git(root, ["show", `HEAD:${relativePath}`])), sha(git(rootCheckout, ["show", `HEAD:${relativePath}`])), `HEAD input differs: ${relativePath}`);
    }
    assert.equal(sha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256, `Production root bytes differ: ${relativePath}`);
    projectInputs.push(record);
  }
  for (const relativePath of bundledRequired) assert.ok(projectInputs.some(input => input.relativePath === relativePath), `Missing actual input: ${relativePath}`);
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
export async function rebindItemSharingInputs(root, manifestPath, processReceipt, metafile, captured, artifacts) {
  const fresh = await loadItemSharingProductionAssets(root, manifestPath, processReceipt);
  Object.assign(fresh.artifacts, await bindItemSharingProjectInputs(root, metafile, captured, fresh.artifacts));
  assert.deepEqual(fresh.artifacts, artifacts, "Final source/build/runtime closure differs from rendered inputs");
  return { passed: true, currentRootHead: fresh.artifacts.currentRootHead, harnessSourceSha: fresh.artifacts.harnessSourceSha,
    harnessFiles: fresh.artifacts.harnessFiles, inheritedHelpers: fresh.artifacts.inheritedHelpers, metafileSha256: fresh.artifacts.metafileSha256 };
}

/** Capture exactly the bytes supplied to esbuild, including installed runtime. */
export function itemSharingProjectInputPlugin(root, captured) {
  return { name: "item-sharing-actual-byte-capture", setup(builder) {
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
export async function bindItemSharingRuntime(root) {
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
      const candidate = "node_modules/" + name;
      try { await fs.access(path.join(root, candidate, "package.json")); }
      catch (error) { if (optional && error.code === "ENOENT") continue; throw error; }
      await packageClosure(candidate);
    }
  }
  for (const name of ["esbuild", "playwright", "playwright-core", "@playwright/test", "next", "react", "react-dom", "zod"]) await packageClosure("node_modules/" + name);
  return receipts;
}
export async function verifyItemSharingEntry(root) {
  return {
    nodeRuntime: { executable: process.execPath, version: process.version, executedSha256: sha(await fs.readFile(process.execPath)) },
    rootHead: git(path.resolve(root, "../equipment-verification"), ["rev-parse", "HEAD"]).toString().trim(),
    harnessFiles: await bindItemSharingHarnessFiles(root),
    sourceFiles: await bindItemSharingHarnessFiles(root, required, itemSharingSourceCheckpoint),
    runtimeConfig: await bindItemSharingHarnessFiles(root, ["package-lock.json", "package.json", "tsconfig.json"], itemSharingSourceCheckpoint),
    installedNodeClosure: await bindItemSharingRuntime(root),
    inheritedHelpers: [
      await verifyItemSharingInheritedHelper(root, assetHelper),
      await verifyItemSharingInheritedHelper(root, itemSharingProcessHelper),
    ],
  };
}
export async function loadItemSharingProcess(root, entryProof) {
  assert.deepEqual(await verifyItemSharingEntry(root), entryProof, "Entry closure changed before process helper import");
  const inherited = await import("./npc-process.mjs");
  return {
    receipt: entryProof.inheritedHelpers[1],
    resources: inherited.npcResources,
    assertNoOtherRunner: inherited.assertNoOtherNpcRunner,
    async freshIdentity(pid, parentPid) {
      assert.deepEqual(await verifyItemSharingInheritedHelper(root, itemSharingProcessHelper), entryProof.inheritedHelpers[1]);
      return inherited.npcOsIdentity(pid, parentPid);
    },
    async forceOwnedTree(identity, freshFullRenderedProof) {
      await freshFullRenderedProof();
      assert.deepEqual(await verifyItemSharingEntry(root), entryProof, "Full entry closure changed before targeted force");
      const fresh = await this.freshIdentity(identity.pid, identity.parentPid);
      assert.equal(fresh.birthUtc, identity.birthUtc); assert.equal(fresh.command, identity.command);
      assert.ok(fresh.command.includes(path.join(root, "scripts", "verify-item-sharing-local.mjs")));
      execFileSync("taskkill", ["/pid", String(identity.pid), "/T", "/F"], { windowsHide: true });
    },
  };
}
