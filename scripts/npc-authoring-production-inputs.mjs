import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export const npcAuthoringSourceCheckpoint = "1fc362009f260ca3469fb4440a4f884b702c2e79";
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
const sha = value => createHash("sha256").update(value).digest("hex");
const required = ["components/library/npc-form.tsx", "lib/homebrew/npc-form.ts", "lib/schemas/content-types/npc.ts"];
const sourcePaths = [...required, "lib/supabase/homebrew-npcs-server.ts", "app/(app)/homebrew/npcs/actions.ts",
  "app/(app)/homebrew/npcs/new/page.tsx", "app/(app)/homebrew/npcs/[id]/edit/page.tsx", "app/(app)/homebrew/page.tsx"];
function cleanFile(root, relative) {
  for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]]) assert.equal(git(root, args).toString().trim(), "", `Unfrozen input ${relative}`);
  assert.equal(git(root, ["ls-files", "--error-unmatch", "--", relative]).toString().trim(), relative);
}
const harnessPaths = ["e2e/local-npc-authoring/fixture.tsx", "e2e/local-npc-authoring/playwright.config.ts", "e2e/local-npc-authoring/npc-authoring.spec.ts", "scripts/npc-authoring-production-inputs.mjs", "scripts/npc-authoring-scenarios.mjs", "scripts/verify-npc-authoring-local.mjs"];
export async function verifyNpcAuthoringHelpers(root) {
  const rootCheckout = path.resolve(root, "../equipment-verification"), dependencies = [];
  // Independently bind executable inherited helpers before dynamic import/use.
  for (const relativePath of ["scripts/npc-process.mjs", "scripts/passive-feature-production-assets.mjs"]) {
    const expected = relativePath === "scripts/npc-process.mjs" ? "0841bda7b9e785280e684030bf4fe900d81465e5" : "e4058f8a31cd911583a312e59fedcf4c3fd4adae";
    assert.equal(git(root, ["rev-parse", `${npcAuthoringSourceCheckpoint}:${relativePath}`]).toString().trim(), expected);
    let actualBytes;
    const records = [];
    for (const [role, checkout] of [["worker", root], ["root", rootCheckout]]) {
      cleanFile(checkout, relativePath);
      const headOid = git(checkout, ["rev-parse", `HEAD:${relativePath}`]).toString().trim(), indexOid = git(checkout, ["rev-parse", `:${relativePath}`]).toString().trim();
      assert.equal(headOid, expected); assert.equal(indexOid, expected);
      const attributes = git(checkout, ["check-attr", "filter", "working-tree-encoding", "text", "eol", "ident", "--", relativePath]).toString().trim();
      assert.ok(attributes.includes(`${relativePath}: filter: unspecified`)); assert.ok(attributes.includes(`${relativePath}: working-tree-encoding: unspecified`));
      const bytes = await fs.readFile(path.join(checkout, relativePath));
      assert.equal(sha(bytes), sha(git(checkout, ["cat-file", "--filters", `--path=${relativePath}`, expected])));
      if (actualBytes) assert.equal(sha(bytes), actualBytes); actualBytes = sha(bytes);
      const options = {};
      for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
        try { options[key] = git(checkout, ["config", "--show-origin", "--get", key]).toString().trim(); }
        catch (error) { if (error.status !== 1) throw error; options[key] = null; }
      }
      records.push({ role, headOid, indexOid, attributes, options, executedSha256: actualBytes });
    }
    dependencies.push({ relativePath, expected, records });
  }
  return dependencies;
}
export async function loadNpcAuthoringAssets(root, manifestPath) {
  const rootCheckout = path.resolve(root, "../equipment-verification"), dependencies = await verifyNpcAuthoringHelpers(root);
  const assetHelper = await import("./passive-feature-production-assets.mjs"), result = await assetHelper.loadPassiveFeatureProductionAssets(root, manifestPath);
  result.projectInputPlugin = assetHelper.passiveFeatureProjectInputPlugin;
  result.artifacts.harnessSourceSha = git(root, ["rev-parse", "HEAD"]).toString().trim();
  result.artifacts.harnessFiles = await Promise.all(harnessPaths.map(async relativePath => {
    cleanFile(root, relativePath);
    const bytes = await fs.readFile(path.join(root, relativePath));
    assert.equal(sha(bytes), sha(git(root, ["cat-file", "--filters", `--path=${relativePath}`, `HEAD:${relativePath}`])));
    return { relativePath, gitBlobSha256: sha(git(root, ["show", `HEAD:${relativePath}`])), executedSha256: sha(bytes) };
  }));
  Object.assign(result.artifacts, { npcAuthoringSourceCheckpoint, authoringHelperDependencies: dependencies,
    authoringSourceFiles: await Promise.all(sourcePaths.map(async relativePath => {
      const expected = sha(git(root, ["show", `${npcAuthoringSourceCheckpoint}:${relativePath}`]));
      for (const checkout of [root, rootCheckout]) { cleanFile(checkout, relativePath); assert.equal(sha(git(checkout, ["show", `HEAD:${relativePath}`])), expected); }
      const raw = await fs.readFile(path.join(root, relativePath));
      assert.equal(sha(raw), sha(await fs.readFile(path.join(rootCheckout, relativePath))));
      assert.equal(sha(raw), sha(git(root, ["cat-file", "--filters", `--path=${relativePath}`, `${npcAuthoringSourceCheckpoint}:${relativePath}`])));
      return { relativePath, gitBlobSha256: expected, executedSha256: sha(raw) };
    })) });
  return result;
}
export async function bindNpcAuthoringInputs(root, metafile, captured, artifacts) {
  const rootCheckout = path.resolve(root, "../equipment-verification"), projectInputs = [], syntheticInputs = [];
  assert.equal(git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), artifacts.currentRootHead);
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "");
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith("npc-authoring-offline:")) { syntheticInputs.push({ input, boundary: "explicit action/router/anchor model" }); continue; }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (relativePath.startsWith("node_modules/") && !relativePath.startsWith("node_modules/next/")) continue;
    const record = captured.get(absolute); assert.ok(record); assert.equal(sha(await fs.readFile(absolute)), record.sha256);
    if (relativePath === "e2e/local-npc-authoring/fixture.tsx") { cleanFile(root, relativePath); syntheticInputs.push({ ...record, boundary: "original action/read fixture" }); continue; }
    if (!relativePath.startsWith("node_modules/")) { cleanFile(root, relativePath); cleanFile(rootCheckout, relativePath);
      assert.equal(sha(git(root, ["show", `HEAD:${relativePath}`])), sha(git(rootCheckout, ["show", `HEAD:${relativePath}`]))); }
    assert.equal(sha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256); projectInputs.push(record);
  }
  for (const relativePath of [...required, "tests/fixtures/npcs.ts"]) assert.ok(projectInputs.some(input => input.relativePath === relativePath), `Missing actual NPC authoring input ${relativePath}`);
  for (const relative of ["package-lock.json", "package.json", "tsconfig.json"]) {
    for (const checkout of [root, rootCheckout]) cleanFile(checkout, relative);
    assert.equal(sha(await fs.readFile(path.join(root, relative))), sha(await fs.readFile(path.join(rootCheckout, relative))));
    if (relative === "package-lock.json") assert.equal(sha(await fs.readFile(path.join(root, relative))), artifacts.dependencyLockSha256);
  }
  for (const dependency of artifacts.authoringHelperDependencies) for (const record of dependency.records) {
    const checkout = record.role === "root" ? rootCheckout : root; cleanFile(checkout, dependency.relativePath);
    assert.equal(sha(await fs.readFile(path.join(checkout, dependency.relativePath))), record.executedSha256);
    assert.equal(git(checkout, ["rev-parse", `:${dependency.relativePath}`]).toString().trim(), dependency.expected);
  }
  for (const input of artifacts.authoringSourceFiles) for (const checkout of [root, rootCheckout]) {
    cleanFile(checkout, input.relativePath); assert.equal(sha(await fs.readFile(path.join(checkout, input.relativePath))), input.executedSha256);
  }
  for (const input of artifacts.harnessFiles) { cleanFile(root, input.relativePath); assert.equal(sha(git(root, ["show", `HEAD:${input.relativePath}`])), input.gitBlobSha256); assert.equal(sha(await fs.readFile(path.join(root, input.relativePath))), input.executedSha256); }
  assert.deepEqual(await verifyNpcAuthoringHelpers(root), artifacts.authoringHelperDependencies);
  return { bundledProjectInputs: projectInputs, syntheticInputs, metafileSha256: sha(JSON.stringify(metafile)) };
}
