import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Source checkpoint, subject to independent review; no arbitrary current-root bypass.
export const npcSourceCheckpoint = "4c077c62b45c1c713617905e9065e26d9cbe6224";
const required = ["lib/schemas/content-types/npc.ts", "lib/schemas/content-types/index.ts", "lib/supabase/content-definitions-parser.ts",
  "lib/compendium/catalog.ts", "lib/compendium/presentation.ts", "components/compendium/npc-profile.tsx",
  "components/compendium/compendium-detail.tsx", "components/compendium/compendium-row.tsx"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
function assertHeadWorkingTree(root, relativePath) {
  assert.equal(git(root, ["diff", "HEAD", "--", relativePath]).toString().trim(), "", `HEAD/index/working drift: ${relativePath}`);
  assert.equal(git(root, ["ls-files", "--error-unmatch", "--", relativePath]).toString().trim(), relativePath);
}
const inheritedPath = "scripts/passive-feature-production-assets.mjs";
const inheritedAnchor = "5fedd622", inheritedBlob = "e4058f8a31cd911583a312e59fedcf4c3fd4adae";
function checkoutRepresentation(root) {
  const options = {};
  for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
    try { options[key] = git(root, ["config", "--show-origin", "--get", key]).toString().trim(); }
    catch (error) { if (error.status !== 1) throw error; options[key] = null; }
  }
  const attributes = git(root, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", inheritedPath]).toString().trim();
  assert.ok(attributes.includes(`${inheritedPath}: filter: unspecified`), "No executable checkout filter may supply inherited helper bytes");
  assert.ok(attributes.includes(`${inheritedPath}: working-tree-encoding: unspecified`), "Unexpected helper checkout encoding");
  return { options, attributes };
}
async function verifyInheritedHelper(root) {
  const rootCheckout = path.resolve(root, "../equipment-verification");
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "", "Root must be frozen clean");
  assert.equal(git(root, ["rev-parse", `${inheritedAnchor}:${inheritedPath}`]).toString().trim(), inheritedBlob);
  const canonical = git(root, ["cat-file", "blob", inheritedBlob]);
  let executedSha256, representation;
  for (const checkout of [root, rootCheckout]) {
    assertHeadWorkingTree(checkout, inheritedPath);
    assert.equal(git(checkout, ["rev-parse", `HEAD:${inheritedPath}`]).toString().trim(), inheritedBlob);
    const currentRepresentation = checkoutRepresentation(checkout);
    if (representation) assert.deepEqual(currentRepresentation, representation, "Inherited helper worker/root checkout configuration differs");
    representation = currentRepresentation;
    const raw = await fs.readFile(path.join(checkout, inheritedPath));
    // This repository checks text out as CRLF. Bind actual executed bytes to
    // Git's reviewed-blob checkout, not a guessed newline-normalized string.
    const checkoutBytes = git(checkout, ["cat-file", "--filters", `--path=${inheritedPath}`, inheritedBlob]);
    assert.equal(sha(raw), sha(checkoutBytes), "Inherited helper mounted bytes differ from anchored Git checkout");
    if (executedSha256) assert.equal(sha(raw), executedSha256, "Inherited helper worker/root actual bytes differ");
    executedSha256 = sha(raw);
  }
  return { relativePath: inheritedPath, reviewedAnchor: inheritedAnchor, reviewedGitBlobOid: inheritedBlob,
    canonicalBlobSha256: sha(canonical), executedSha256, representation, checkoutRepresentation: "git cat-file --filters of reviewed blob; raw worker/root equality" };
}
// Reuse the reviewed complete CSS/font/clean-build/lock/installed-runtime validator.
export async function loadNpcProductionAssets(root, manifestPath) {
  // Verify the executable dependency independently BEFORE importing/invoking it.
  const inheritedHelper = await verifyInheritedHelper(root);
  const { loadPassiveFeatureProductionAssets, passiveFeatureProjectInputPlugin } = await import("./passive-feature-production-assets.mjs");
  const result = await loadPassiveFeatureProductionAssets(root, manifestPath);
  result.projectInputPlugin = passiveFeatureProjectInputPlugin;
  result.artifacts.inheritedHelper = inheritedHelper;
  const rootCheckout = path.resolve(root, "../equipment-verification");
  result.artifacts.npcSourceCheckpoint = npcSourceCheckpoint;
  result.artifacts.harnessSourceSha = git(root, ["rev-parse", "HEAD"]).toString().trim();
  result.artifacts.harnessFiles = ["e2e/local-npcs/fixture.tsx", "e2e/local-npcs/playwright.config.ts", "e2e/local-npcs/npcs.spec.ts",
    "scripts/npc-production-inputs.mjs", "scripts/npc-process.mjs", "scripts/verify-npcs-local.mjs"].map(relativePath => {
    assertHeadWorkingTree(root, relativePath);
    return { relativePath, gitBlobSha256: sha(git(root, ["show", `HEAD:${relativePath}`])) };
  });
  result.artifacts.npcSourceFiles = required.map(relativePath => {
    const expected = sha(git(root, ["show", `${npcSourceCheckpoint}:${relativePath}`]));
    for (const checkout of [root, rootCheckout]) {
      assertHeadWorkingTree(checkout, relativePath);
      assert.equal(sha(git(checkout, ["show", `HEAD:${relativePath}`])), expected, `NPC source checkpoint drift: ${relativePath}`);
    }
    return { relativePath, gitBlobSha256: expected };
  });
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "node_modules/zod/package.json"), "utf8")).version, lock.packages["node_modules/zod"].version);
  return result;
}
export async function bindNpcProjectInputs(root, metafile, captured, artifacts) {
  assert.deepEqual(await verifyInheritedHelper(root), artifacts.inheritedHelper, "Inherited helper changed during execution");
  const rootCheckout = path.resolve(root, "../equipment-verification"), projectInputs = [], syntheticInputs = [];
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), artifacts.currentRootHead);
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "");
  for (const input of Object.keys(metafile.inputs)) {
    if (input === "npc-offline:next/link") { syntheticInputs.push({ input, boundary: "native anchor replaces Next link router" }); continue; }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (relativePath.startsWith("node_modules/") && !relativePath.startsWith("node_modules/next/")) continue;
    const record = captured.get(absolute); assert.ok(record, `Uncaptured project input: ${input}`);
    assert.equal(sha(await fs.readFile(absolute)), record.sha256, `Mounted bytes changed: ${relativePath}`);
    if (relativePath === "e2e/local-npcs/fixture.tsx") {
      assertHeadWorkingTree(root, relativePath); syntheticInputs.push({ ...record, boundary: "original fixture/query simulation" }); continue;
    }
    if (!relativePath.startsWith("node_modules/")) {
      for (const checkout of [root, rootCheckout]) assertHeadWorkingTree(checkout, relativePath);
      assert.equal(sha(git(root, ["show", `HEAD:${relativePath}`])), sha(git(rootCheckout, ["show", `HEAD:${relativePath}`])), `HEAD input differs: ${relativePath}`);
    }
    assert.equal(sha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256, `Bundled project input differs from production root: ${relativePath}`);
    projectInputs.push(record);
  }
  for (const relativePath of [...required, "tests/fixtures/npcs.ts"]) assert.ok(projectInputs.some(entry => entry.relativePath === relativePath), `Missing actual NPC input: ${relativePath}`);
  for (const relativePath of ["package-lock.json", "package.json", "tsconfig.json"]) {
    for (const checkout of [root, rootCheckout]) assertHeadWorkingTree(checkout, relativePath);
    const bytes = await fs.readFile(path.join(root, relativePath));
    assert.equal(sha(bytes), sha(await fs.readFile(path.join(rootCheckout, relativePath))));
    if (relativePath === "package-lock.json") assert.equal(sha(bytes), artifacts.dependencyLockSha256);
  }
  return { bundledProjectInputs: projectInputs, syntheticInputs, metafileSha256: sha(JSON.stringify(metafile)) };
}
