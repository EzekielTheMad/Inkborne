import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const companionSourceCheckpoint = "5cc9aad4ae1c875c915a36d7fed6966441e44e49";
export const companionProcessHelper = { relativePath: "scripts/npc-process.mjs", reviewedAnchor: "846860209041819deb27b1547c06a77720ad3037", reviewedGitBlobOid: "0841bda7b9e785280e684030bf4fe900d81465e5" };
const assetHelper = { relativePath: "scripts/passive-feature-production-assets.mjs", reviewedAnchor: "5fedd6222eeb97c11f7645dac580cbebee845311", reviewedGitBlobOid: "e4058f8a31cd911583a312e59fedcf4c3fd4adae" };
const required = ["lib/schemas/content-types/companion.ts", "lib/schemas/content-types/monster.ts", "lib/schemas/content-types/index.ts", "lib/supabase/content-definitions-parser.ts",
  "lib/compendium/catalog.ts", "lib/compendium/presentation.ts", "components/compendium/companion-profile.tsx", "components/compendium/monster-stat-block.tsx",
  "components/compendium/compendium-detail.tsx", "components/compendium/compendium-row.tsx", "tests/fixtures/companions.ts"];
export const companionHarnessFiles = ["e2e/local-companions/fixture.tsx", "e2e/local-companions/playwright.config.ts", "e2e/local-companions/companions.spec.ts",
  "scripts/companion-production-inputs.mjs", "scripts/companion-process.mjs", "scripts/verify-companions-local.mjs"];
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
export async function verifyCompanionInheritedHelper(root, descriptor) {
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
export async function loadCompanionProductionAssets(root, manifestPath, originalProcessReceipt) {
  const inheritedAsset = await verifyCompanionInheritedHelper(root, assetHelper);
  const inheritedProcess = await verifyCompanionInheritedHelper(root, companionProcessHelper);
  assert.deepEqual(inheritedProcess, originalProcessReceipt, "Process helper changed after its guarded import");
  const { loadPassiveFeatureProductionAssets, passiveFeatureProjectInputPlugin } = await import("./passive-feature-production-assets.mjs");
  const result = await loadPassiveFeatureProductionAssets(root, manifestPath);
  result.projectInputPlugin = passiveFeatureProjectInputPlugin;
  result.artifacts.inheritedHelpers = [inheritedAsset, inheritedProcess];
  result.artifacts.companionSourceCheckpoint = companionSourceCheckpoint;
  result.artifacts.harnessSourceSha = git(root, ["rev-parse", "HEAD"]).toString().trim();
  result.artifacts.harnessFiles = companionHarnessFiles.map(relativePath => {
    trackedClean(root, relativePath);
    return { relativePath, gitBlobSha256: sha(git(root, ["show", `HEAD:${relativePath}`])) };
  });
  const rootCheckout = path.resolve(root, "../equipment-verification");
  result.artifacts.companionSourceFiles = required.map(relativePath => {
    const expected = sha(git(root, ["show", `${companionSourceCheckpoint}:${relativePath}`]));
    for (const checkout of [root, rootCheckout]) {
      trackedClean(checkout, relativePath);
      assert.equal(sha(git(checkout, ["show", `HEAD:${relativePath}`])), expected, `Companion checkpoint drift: ${relativePath}`);
    }
    return { relativePath, gitBlobSha256: expected };
  });
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "node_modules/zod/package.json"), "utf8")).version, lock.packages["node_modules/zod"].version);
  return result;
}
export async function bindCompanionProjectInputs(root, metafile, captured, artifacts) {
  const receipts = [await verifyCompanionInheritedHelper(root, assetHelper), await verifyCompanionInheritedHelper(root, companionProcessHelper)];
  assert.deepEqual(receipts, artifacts.inheritedHelpers, "Inherited executable changed during bundle");
  const rootCheckout = path.resolve(root, "../equipment-verification"), projectInputs = [], syntheticInputs = [];
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), artifacts.currentRootHead);
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "");
  for (const input of Object.keys(metafile.inputs)) {
    if (input === "companion-offline:next/link") { syntheticInputs.push({ input, boundary: "native anchor replaces Next link router" }); continue; }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (relativePath.startsWith("node_modules/") && !relativePath.startsWith("node_modules/next/")) continue;
    assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath), "Bundled input escaped worker");
    const record = captured.get(absolute); assert.ok(record, `Uncaptured input: ${input}`);
    assert.equal(sha(await fs.readFile(absolute)), record.sha256, `Mounted bytes changed: ${relativePath}`);
    if (relativePath === "e2e/local-companions/fixture.tsx") {
      trackedClean(root, relativePath); syntheticInputs.push({ ...record, boundary: "original query/entitlement fixture" }); continue;
    }
    if (!relativePath.startsWith("node_modules/")) {
      for (const checkout of [root, rootCheckout]) trackedClean(checkout, relativePath);
      assert.equal(sha(git(root, ["show", `HEAD:${relativePath}`])), sha(git(rootCheckout, ["show", `HEAD:${relativePath}`])), `HEAD input differs: ${relativePath}`);
    }
    assert.equal(sha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256, `Production root bytes differ: ${relativePath}`);
    projectInputs.push(record);
  }
  for (const relativePath of required) assert.ok(projectInputs.some(input => input.relativePath === relativePath), `Missing actual input: ${relativePath}`);
  for (const relativePath of ["package-lock.json", "package.json", "tsconfig.json"]) {
    for (const checkout of [root, rootCheckout]) trackedClean(checkout, relativePath);
    const bytes = await fs.readFile(path.join(root, relativePath));
    assert.equal(sha(bytes), sha(await fs.readFile(path.join(rootCheckout, relativePath))));
    if (relativePath === "package-lock.json") assert.equal(sha(bytes), artifacts.dependencyLockSha256);
  }
  return { bundledProjectInputs: projectInputs, syntheticInputs, metafileSha256: sha(JSON.stringify(metafile)) };
}
