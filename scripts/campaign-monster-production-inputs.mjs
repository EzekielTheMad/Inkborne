import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const campaignMonsterSourceCheckpoint = "0aec1242c911bc35f92ba413fd37f483b6b83f03";
export const campaignMonsterSourceAmendments = {
  "tests/fixtures/campaign-monster-instances.ts": "6b793fe8b3e35e4e6ac2297509a2f4ec5023f5c6",
  "components/campaigns/monster-instance-form.tsx": "d43c3b688abeb4e4765b4f46ba62aa915b5b73dc",
};
export const campaignMonsterProcessHelper = { relativePath: "scripts/npc-process.mjs", reviewedAnchor: "846860209041819deb27b1547c06a77720ad3037", reviewedGitBlobOid: "0841bda7b9e785280e684030bf4fe900d81465e5" };
const assetHelper = { relativePath: "scripts/passive-feature-production-assets.mjs", reviewedAnchor: "5fedd6222eeb97c11f7645dac580cbebee845311", reviewedGitBlobOid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" };
const bundledRequired = ["components/campaigns/monster-instance-form.tsx", "components/campaigns/monster-instance-panel.tsx",
  "components/compendium/monster-stat-block.tsx", "lib/campaigns/monster-instance-schema.ts", "lib/campaigns/monster-instance-form.ts",
  "tests/fixtures/campaign-monster-instances.ts"];
const required = ["lib/campaigns/monster-instance-schema.ts", "lib/campaigns/monster-instance-form.ts",
  "lib/supabase/campaign-monster-instances-server.ts", "lib/supabase/campaign-monster-instances.types.ts",
  "app/(app)/campaigns/[id]/monsters/actions.ts", "app/(app)/campaigns/[id]/monsters/page.tsx",
  "app/(app)/campaigns/[id]/monsters/[instanceId]/page.tsx", "app/(app)/campaigns/[id]/page.tsx",
  "components/campaigns/monster-instance-form.tsx", "components/campaigns/monster-instance-panel.tsx",
  "supabase/staged/campaign-monster-instances.sql"];
export const campaignMonsterHarnessFiles = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts",
  "e2e/local-campaign-monster/campaign-monster.spec.mts", "scripts/campaign-monster-production-inputs.mjs",
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
    const sourceAnchor = anchor === campaignMonsterSourceCheckpoint ? campaignMonsterSourceAmendments[relativePath] ?? anchor : anchor;
    const gitBlobOid = git(root, ["rev-parse", `${sourceAnchor}:${relativePath}`]).toString().trim();
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
    receipts.push({ relativePath, sourceAnchor, gitBlobOid, gitBlobSha256: sha(canonical), executedSha256, checkoutIdentities, checkoutRepresentation });
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
export async function rebindCampaignMonsterInputs(root, manifestPath, processReceipt, metafile, captured, artifacts, modelBundle, fixtureBundle) {
  const fresh = await loadCampaignMonsterProductionAssets(root, manifestPath, processReceipt);
  Object.assign(fresh.artifacts, await bindCampaignMonsterProjectInputs(root, metafile, captured, fresh.artifacts));
  assert.ok(modelBundle, "Actual server-model generated bundle proof required");
  const modelInputs = await bindCampaignMonsterProjectInputs(root, modelBundle.metafile, new Map(modelBundle.captured), fresh.artifacts, fixtureFiles);
  fresh.artifacts.modelBundle = { ...modelBundle, inputs: modelInputs };
  assert.equal(sha(await fs.readFile(modelBundle.outputPath)), modelBundle.outputSha256);
  assert.ok(fixtureBundle && Number.isSafeInteger(fixtureBundle.outputBytes) && fixtureBundle.outputBytes > 0 && fixtureBundle.outputBytes <= 16_777_216, "Served browser bundle proof required");
  const browserInfo = await fs.lstat(fixtureBundle.outputPath);
  assert.ok(browserInfo.isFile() && !browserInfo.isSymbolicLink()); assert.equal(browserInfo.size, fixtureBundle.outputBytes);
  const browserBytes = await fs.readFile(fixtureBundle.outputPath);
  assert.equal(browserBytes.length, fixtureBundle.outputBytes); assert.equal(sha(browserBytes), fixtureBundle.outputSha256, "Served browser bundle changed on disk");
  fresh.artifacts.fixtureBundle = fixtureBundle;
  assert.deepEqual(fresh.artifacts, artifacts, "Final source/build/runtime closure differs from rendered inputs");
  return { artifacts: fresh.artifacts, metafile, captured: [...captured].sort(([a], [b]) => a.localeCompare(b)), modelBundle, fixtureBundle };
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
  root = path.resolve(root); const rootCheckout = path.resolve(root, "../equipment-verification");
  // Root and every path ancestor must be actual directories, never reparse links.
  for (const checkout of [root, rootCheckout]) {
    let ancestor = checkout;
    while (true) {
      const info = await fs.lstat(ancestor); assert.ok(info.isDirectory() && !info.isSymbolicLink(), "Runtime root/ancestor symlink refused");
      const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent;
    }
    assert.equal(await fs.realpath(checkout), checkout, "Runtime root resolves elsewhere");
  }
  // Installed Node resolution + full file-set/raw-byte binding, following the
  // reviewed R13 walker. All work stays within finite lock-described packages.
  const limits = { maxPackages: 256, maxEdges: 4096, maxFiles: 60_000, maxEntries: 120_000, maxBytes: 1_073_741_824,
    maxFileBytes: 268_435_456, maxDepth: 32, maxMetadataBytes: 1_048_576, maxLockBytes: 8_388_608, maxLockPackages: 4096, maxNodeBytes: 268_435_456 };
  const roots = ["esbuild", "playwright", "playwright-core", "@playwright/test", "next", "react", "react-dom", "zod", "tsx"];
  assert.equal(process.platform, "win32", "This private process harness supports Windows only");
  const platform = { os: process.platform, cpu: process.arch, libc: null };
  const counts = { packages: 0, edges: 0, files: 0, entries: 0, bytes: 0 }, packages = [], edges = [], visited = new Set();
  const stat = async absolute => { try { return await fs.lstat(absolute); } catch (error) { if (error.code === "ENOENT") return null; throw error; } };
  async function pair(relative) {
    assert.ok(relative.startsWith("node_modules/") || relative === "node_modules");
    assert.ok(relative.split("/").every(part => part && part !== "." && part !== ".."));
    const worker = await stat(path.join(root, relative)), built = await stat(path.join(rootCheckout, relative));
    assert.equal(Boolean(worker), Boolean(built), `Installed runtime existence differs: ${relative}`);
    if (!worker) return null;
    assert.equal(worker.isSymbolicLink(), false, `Worker runtime symlink refused: ${relative}`);
    assert.equal(built.isSymbolicLink(), false, `Root runtime symlink refused: ${relative}`);
    assert.equal(worker.isDirectory(), built.isDirectory()); assert.equal(worker.isFile(), built.isFile());
    return { worker, built };
  }
  async function candidate(relative) {
    const parts = relative.split("/"); assert.ok(parts.length <= limits.maxDepth);
    for (let length = 1; length <= parts.length; length++) {
      const entry = await pair(parts.slice(0, length).join("/")); if (!entry) return false;
      assert.ok(entry.worker.isDirectory(), `Package ancestor is not a directory: ${relative}`);
    }
    // An existing closer package directory without metadata could shadow an
    // ancestor through Node's index.js fallback; never silently skip it.
    const metadata = await pair(`${relative}/package.json`); assert.ok(metadata, `Installed candidate lacks package.json: ${relative}`);
    assert.ok(metadata.worker.isFile()); return true;
  }
  async function bytes(relative, budget) {
    const info = await pair(relative); assert.ok(info && info.worker.isFile());
    assert.ok(info.worker.size <= budget && info.built.size <= budget, `Runtime file size exceeds bound: ${relative}`);
    assert.equal(info.worker.size, info.built.size);
    const worker = await fs.readFile(path.join(root, relative)), built = await fs.readFile(path.join(rootCheckout, relative));
    assert.equal(worker.length, info.worker.size); assert.equal(built.length, info.built.size); assert.equal(sha(worker), sha(built), `Installed raw bytes differ: ${relative}`);
    return worker;
  }
  const lockPath = path.join(root, "package-lock.json"), rootLockPath = path.join(rootCheckout, "package-lock.json");
  const lockInfo = await fs.lstat(lockPath), rootLockInfo = await fs.lstat(rootLockPath);
  assert.ok(lockInfo.isFile() && rootLockInfo.isFile() && !lockInfo.isSymbolicLink() && !rootLockInfo.isSymbolicLink());
  assert.ok(lockInfo.size <= limits.maxLockBytes && rootLockInfo.size <= limits.maxLockBytes);
  const lockBytes = await fs.readFile(lockPath); assert.equal(sha(lockBytes), sha(await fs.readFile(rootLockPath)));
  const lock = JSON.parse(lockBytes.toString("utf8")); assert.ok(lock.packages && Object.keys(lock.packages).length <= limits.maxLockPackages);
  const nodeInfo = await fs.lstat(process.execPath); assert.ok(nodeInfo.isFile() && !nodeInfo.isSymbolicLink() && nodeInfo.size <= limits.maxNodeBytes);
  const nodeExecutable = { path: process.execPath, version: process.version, bytes: nodeInfo.size, sha256: sha(await fs.readFile(process.execPath)) };
  function constraints(entry) { return { os: entry?.os ?? [], cpu: entry?.cpu ?? [], libc: entry?.libc ?? [] }; }
  function compatible(entry) {
    return Object.entries(constraints(entry)).every(([field, values]) => {
      assert.ok(Array.isArray(values) && values.every(value => typeof value === "string"));
      const actual = platform[field], positive = values.filter(value => !value.startsWith("!"));
      return !values.includes(`!${actual}`) && (!positive.length || positive.includes("any") || positive.includes(actual));
    });
  }
  function packageName(name) { assert.match(name, /^(?:@[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)?[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/); }
  async function resolve(from, name) {
    packageName(name); let directory = path.join(root, from); const attempted = [];
    while (directory === root || directory.startsWith(root + path.sep)) {
      if (path.basename(directory) !== "node_modules") {
        const relative = path.relative(root, path.join(directory, "node_modules", name)).replaceAll(path.sep, "/"); attempted.push(relative);
        assert.ok(attempted.length <= limits.maxDepth);
        if (await candidate(relative)) return { resolved: relative, attempted };
      }
      if (directory === root) break; directory = path.dirname(directory);
    }
    return { resolved: null, attempted };
  }
  async function packageClosure(relative, depth = 0) {
    if (visited.has(relative)) return; assert.ok(depth <= limits.maxDepth); visited.add(relative);
    counts.packages++; assert.ok(counts.packages <= limits.maxPackages); assert.ok(await candidate(relative), `Required runtime package absent: ${relative}`);
    const locked = lock.packages[relative]; assert.ok(locked && typeof locked.version === "string", `Package not described by lock: ${relative}`);
    const metadataBytes = await bytes(`${relative}/package.json`, limits.maxMetadataBytes), metadata = JSON.parse(metadataBytes.toString("utf8"));
    assert.equal(metadata.version, locked.version); assert.equal(typeof metadata.name, "string"); if (locked.name) assert.equal(metadata.name, locked.name);
    for (const key of ["dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta"]) assert.deepEqual(metadata[key] ?? {}, locked[key] ?? {}, `Installed declarations differ from lock: ${relative}/${key}`);
    assert.deepEqual(constraints(metadata), constraints(locked)); assert.equal(compatible(locked), true, `Installed package contradicts current platform: ${relative}`);
    const inputs = [], directories = [];
    async function walk(current, level) {
      assert.ok(level <= limits.maxDepth); const info = await pair(current); assert.ok(info);
      counts.entries++; assert.ok(counts.entries <= limits.maxEntries);
      if (info.worker.isDirectory()) {
        const entries = async checkout => {
          const names = [], directory = await fs.opendir(path.join(checkout, current));
          for await (const entry of directory) { assert.ok(names.length < limits.maxEntries - counts.entries, `Directory entry bound exceeded: ${current}`); names.push(entry.name); }
          return names.sort();
        };
        const workerEntries = await entries(root), rootEntries = await entries(rootCheckout);
        assert.deepEqual(workerEntries, rootEntries, `Installed directory/file set differs: ${current}`); assert.ok(workerEntries.length <= limits.maxEntries - counts.entries);
        directories.push({ relativePath: current, entries: workerEntries });
        for (const entry of workerEntries) await walk(`${current}/${entry}`, level + 1);
      } else {
        assert.ok(info.worker.isFile()); assert.ok(info.worker.size <= limits.maxFileBytes && counts.bytes + info.worker.size <= limits.maxBytes);
        counts.files++; assert.ok(counts.files <= limits.maxFiles); const actual = await bytes(current, limits.maxFileBytes); counts.bytes += actual.length;
        inputs.push({ relativePath: current, bytes: actual.length, sha256: sha(actual) });
      }
    }
    await walk(relative, 0);
    packages.push({ name: metadata.name, relativePath: relative, version: metadata.version, platformConstraints: constraints(locked), packageJsonSha256: sha(metadataBytes), directories, inputs });
    const declarations = [];
    for (const [name, spec] of Object.entries(metadata.dependencies ?? {})) if (!Object.hasOwn(metadata.optionalDependencies ?? {}, name)) declarations.push({ name, spec, kind: "dependency", optional: false });
    for (const [name, spec] of Object.entries(metadata.optionalDependencies ?? {})) declarations.push({ name, spec, kind: "optionalDependency", optional: true });
    for (const [name, spec] of Object.entries(metadata.peerDependencies ?? {})) declarations.push({ name, spec, kind: "peer", optional: metadata.peerDependenciesMeta?.[name]?.optional === true });
    declarations.sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
    for (const declaration of declarations) {
      assert.equal(typeof declaration.spec, "string"); counts.edges++; assert.ok(counts.edges <= limits.maxEdges);
      const resolution = await resolve(relative, declaration.name), omittedCandidates = resolution.attempted.filter(candidate => Object.hasOwn(lock.packages, candidate)).map(candidate => ({ relativePath: candidate, version: lock.packages[candidate].version, platformConstraints: constraints(lock.packages[candidate]), compatible: compatible(lock.packages[candidate]) }));
      if (!resolution.resolved) {
        assert.equal(declaration.optional, true, `Required declared dependency missing: ${relative}/${declaration.name}`);
        edges.push({ from: relative, ...declaration, ...resolution, status: omittedCandidates.length && omittedCandidates.every(entry => !entry.compatible) ? "platform-omitted" : "optional-not-installed", omittedCandidates });
      } else {
        assert.ok(lock.packages[resolution.resolved], `Resolved installed dependency unbound to lock: ${resolution.resolved}`);
        edges.push({ from: relative, ...declaration, ...resolution, status: "installed", omittedCandidates: [] }); await packageClosure(resolution.resolved, depth + 1);
      }
    }
  }
  for (const name of roots) await packageClosure(`node_modules/${name}`);
  packages.sort((a, b) => a.relativePath.localeCompare(b.relativePath)); edges.sort((a, b) => `${a.from}:${a.kind}:${a.name}`.localeCompare(`${b.from}:${b.kind}:${b.name}`));
  const closure = { nodeExecutable, roots, platform, limits, counts, packages, edges };
  return { ...closure, closureSha256: sha(JSON.stringify(closure)) };
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
  assert.deepEqual(value.producerAmendments, campaignMonsterSourceAmendments);
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
