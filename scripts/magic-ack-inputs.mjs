import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export const magicAckSourceCheckpoint = "6aa858ac57fe518c236e5baa2497ce425c47839e";
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
export const magicAckSha = bytes => createHash("sha256").update(bytes).digest("hex");
const sourcePaths = ["components/library/magic-item-form.tsx", "lib/homebrew/magic-item-form.ts", "lib/supabase/homebrew-magic-items-server.ts", "app/(app)/homebrew/magic-items/actions.ts",
  "lib/schemas/content-types/magic-item.ts", "lib/schemas/effects.ts", "lib/schemas/content.ts", "lib/supabase/content-definitions-parser.ts"];
const harnessPaths = ["e2e/local-magic-ack/fixture.tsx", "e2e/local-magic-ack/playwright.config.ts", "e2e/local-magic-ack/magic-ack.spec.mjs", "scripts/magic-ack-inputs.mjs", "scripts/magic-ack-scenarios.mjs", "scripts/verify-magic-ack-local.mjs"];
const configurations = ["package-lock.json", "package.json", "tsconfig.json"];
const inherited = { "scripts/npc-process.mjs": "0841bda7b9e785280e684030bf4fe900d81465e5", "scripts/passive-feature-production-assets.mjs": "e4058f8a31cd911583a312e59fedcf4c3fd4adae" };
function cleanFile(root, relative) {
  for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]]) assert.equal(git(root, args).toString().trim(), "", `Unfrozen input ${relative}`);
  assert.equal(git(root, ["ls-files", "--error-unmatch", "--", relative]).toString().trim(), relative);
  assert.equal(git(root, ["rev-parse", `HEAD:${relative}`]).toString().trim(), git(root, ["rev-parse", `:${relative}`]).toString().trim(), `Index differs from HEAD: ${relative}`);
}
function checkout(root, relative) {
  const attributes = git(root, ["check-attr", "filter", "working-tree-encoding", "text", "eol", "ident", "--", relative]).toString().trim();
  assert.ok(attributes.includes(`${relative}: filter: unspecified`)); assert.ok(attributes.includes(`${relative}: working-tree-encoding: unspecified`));
  const options = {};
  for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
    try { options[key] = git(root, ["config", "--show-origin", "--get", key]).toString().trim(); } catch (error) { if (error.status !== 1) throw error; options[key] = null; }
  }
  return { attributes, options };
}
async function boundFile(root, relative, expected) {
  cleanFile(root, relative); const configuration = checkout(root, relative);
  const headOid = git(root, ["rev-parse", `HEAD:${relative}`]).toString().trim(), indexOid = git(root, ["rev-parse", `:${relative}`]).toString().trim();
  if (expected) assert.equal(headOid, expected);
  const bytes = await fs.readFile(path.join(root, relative)), executedSha256 = magicAckSha(bytes);
  assert.equal(executedSha256, magicAckSha(git(root, ["cat-file", "--filters", `--path=${relative}`, headOid])));
  return { relativePath: relative, headOid, indexOid, ...configuration, executedSha256, gitBlobSha256: magicAckSha(git(root, ["show", `HEAD:${relative}`])) };
}
/** Builtins-only independent proof before ANY inherited executable import in runner and wrapper. */
export async function verifyMagicAckHelpers(root) {
  const rootCheckout = path.resolve(root, "../equipment-verification"), files = [], helperDependencies = [];
  assert.equal(git(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]).toString().trim(), "", "Root must be clean");
  for (const relative of [...harnessPaths, ...sourcePaths, ...configurations]) {
    const expected = sourcePaths.includes(relative) ? git(root, ["rev-parse", `${magicAckSourceCheckpoint}:${relative}`]).toString().trim() : undefined;
    const worker = await boundFile(root, relative, expected), built = await boundFile(rootCheckout, relative, expected);
    assert.equal(worker.headOid, built.headOid); assert.equal(worker.executedSha256, built.executedSha256);
    files.push({ relativePath: relative, worker, root: built });
  }
  for (const [relative, expected] of Object.entries(inherited)) {
    assert.equal(git(root, ["rev-parse", `${magicAckSourceCheckpoint}:${relative}`]).toString().trim(), expected);
    const worker = await boundFile(root, relative, expected), built = await boundFile(rootCheckout, relative, expected);
    assert.equal(worker.executedSha256, built.executedSha256); helperDependencies.push({ relativePath: relative, expected, worker, root: built });
  }
  return { rootHead: git(rootCheckout, ["rev-parse", "HEAD"]).toString().trim(), workerHead: git(root, ["rev-parse", "HEAD"]).toString().trim(), files, helperDependencies,
    installedRuntime: await runtimeProof(root, rootCheckout) };
}
async function runtimeProof(root, rootCheckout) {
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  const packages = [], nodeExecutable = { path: process.execPath, version: process.version, sha256: magicAckSha(await fs.readFile(process.execPath)) };
  // Next's actually executed browser closure is captured below. Other executable
  // Node/browser package trees (including esbuild native binary) are byte-bound.
  for (const name of ["esbuild", "@esbuild/win32-x64", "next", "react", "react-dom", "playwright", "playwright-core", "@playwright/test", "zod"]) {
    const directory = path.join(root, "node_modules", name), relativePackage = `node_modules/${name}`;
    const bytes = await fs.readFile(path.join(directory, "package.json")), version = JSON.parse(bytes.toString("utf8")).version;
    assert.equal(version, lock.packages[relativePackage].version); assert.equal(magicAckSha(bytes), magicAckSha(await fs.readFile(path.join(rootCheckout, relativePackage, "package.json"))));
    const inputs = [];
    async function visit(current) {
      for (const entry of (await fs.readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        assert.equal(entry.isSymbolicLink(), false, "Runtime package symlinks refused");
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) { await visit(absolute); continue; }
        const relativePath = path.relative(root, absolute).replaceAll(path.sep, "/"), actual = await fs.readFile(absolute);
        assert.equal(magicAckSha(actual), magicAckSha(await fs.readFile(path.join(rootCheckout, relativePath))));
        inputs.push({ relativePath, sha256: magicAckSha(actual), bytes: actual.length });
      }
    }
    if (name !== "next") await visit(directory);
    else inputs.push({ relativePath: `${relativePackage}/package.json`, sha256: magicAckSha(bytes), bytes: bytes.length });
    packages.push({ name, version, inputs, packageJsonSha256: magicAckSha(bytes) });
  }
  return { nodeExecutable, packages };
}
export async function loadMagicAckAssets(root, manifestPath) {
  const proof = await verifyMagicAckHelpers(root), rootCheckout = path.resolve(root, "../equipment-verification");
  const helper = await import("./passive-feature-production-assets.mjs");
  const result = await helper.loadPassiveFeatureProductionAssets(root, manifestPath);
  assert.equal(result.artifacts.currentRootHead, proof.rootHead);
  const generatedFontClasses = result.htmlClassName.split(" ").slice(3), fontClassProof = [];
  assert.equal(generatedFontClasses.length, 2);
  for (const className of generatedFontClasses) {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), expression = new RegExp(`\\.${escaped}(?=[\\s{.:#>+~\\[])`);
    const css = result.cssUrls.filter(url => expression.test(result.assets.get(url).bytes.toString("utf8")));
    assert.ok(css.length, `Generated font class absent from production CSS: ${className}`);
    fontClassProof.push({ className, css: css.map(url => ({ url, sha256: result.assets.get(url).sha256 })) });
  }
  Object.assign(result.artifacts, { magicAckSourceCheckpoint, harnessSourceSha: proof.workerHead, initialSourceProof: proof,
    harnessFiles: proof.files.filter(file => harnessPaths.includes(file.relativePath)), magicSourceFiles: proof.files.filter(file => sourcePaths.includes(file.relativePath)),
    magicHelperDependencies: proof.helperDependencies, installedRuntime: proof.installedRuntime, fontClassProof });
  return result;
}
/** Supply and capture ALL actual bundled bytes, including React/Zod/Next/runtime inputs. */
export function magicAckInputPlugin(root, captured) {
  return { name: "magic-ack-capture-all-executed-bundle-bytes", setup(builder) {
    builder.onLoad({ filter: /\.(tsx?|jsx?|mjs|cjs|json)$/, namespace: "file" }, async args => {
      const absolute = await fs.realpath(args.path), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
      assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath));
      const bytes = await fs.readFile(absolute); captured.set(absolute, { relativePath, sha256: magicAckSha(bytes), bytes: bytes.length });
      const extension = path.extname(absolute).slice(1), loader = extension === "mjs" || extension === "cjs" ? "js" : extension;
      return { contents: bytes.toString("utf8"), loader, resolveDir: path.dirname(absolute) };
    });
  } };
}
export function magicAckCapturedEntries(captured) { return [...captured.entries()].sort(([a], [b]) => a.localeCompare(b)); }
export async function bindMagicAckInputs(root, metafile, captured, artifacts) {
  assert.deepEqual(await verifyMagicAckHelpers(root), artifacts.initialSourceProof);
  const rootCheckout = path.resolve(root, "../equipment-verification"), bundledProjectInputs = [], bundledRuntimeInputs = [], syntheticInputs = [];
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith("magic-ack-offline:")) {
      const record = captured.get(input); assert.ok(record, `Synthetic executed bytes uncaptured: ${input}`);
      assert.ok(["next/link", "next/navigation", "@/app/(app)/homebrew/magic-items/actions"].some(name => input === `magic-ack-offline:${name}`));
      syntheticInputs.push({ input, ...record, boundary: "explicit action/router/anchor model" }); continue;
    }
    const absolute = await fs.realpath(path.resolve(root, input)), relativePath = path.relative(root, absolute).replaceAll(path.sep, "/"), record = captured.get(absolute);
    assert.ok(record); assert.equal(magicAckSha(await fs.readFile(absolute)), record.sha256);
    assert.equal(magicAckSha(await fs.readFile(path.join(rootCheckout, relativePath))), record.sha256);
    if (relativePath.startsWith("node_modules/")) { bundledRuntimeInputs.push(record); continue; }
    cleanFile(root, relativePath); cleanFile(rootCheckout, relativePath);
    const worker = await boundFile(root, relativePath), built = await boundFile(rootCheckout, relativePath); assert.equal(worker.headOid, built.headOid);
    if (relativePath === "e2e/local-magic-ack/fixture.tsx") syntheticInputs.push({ ...record, boundary: "original modeled read/write fixture" });
    else bundledProjectInputs.push(record);
  }
  for (const required of sourcePaths.filter(relative => !relative.startsWith("app/") && !relative.includes("homebrew-magic-items-server")))
    assert.ok(bundledProjectInputs.some(input => input.relativePath === required), `Missing actual form/mapper/pin parser ${required}`);
  assert.ok(bundledRuntimeInputs.some(input => input.relativePath.endsWith("/unstable-rethrow.browser.js")));
  assert.equal(magicAckSha(await fs.readFile(path.join(root, "package-lock.json"))), artifacts.dependencyLockSha256);
  assert.deepEqual(artifacts.initialSourceProof.installedRuntime, artifacts.installedRuntime);
  return { bundledProjectInputs, bundledRuntimeInputs, syntheticInputs, metafileSha256: magicAckSha(JSON.stringify(metafile)), capturedInputsSha256: magicAckSha(JSON.stringify(magicAckCapturedEntries(captured))) };
}
/** Rebind entire source/build/CSS/fonts/runtime envelope, not just inherited helpers. */
export async function freshMagicAckProof(root, manifestPath, metafile, captured, rendered) {
  const fresh = await loadMagicAckAssets(root, manifestPath);
  Object.assign(fresh.artifacts, await bindMagicAckInputs(root, metafile, captured, fresh.artifacts),
    { fixtureBundleSha256: magicAckSha(await fs.readFile(path.join(root, "test-results/magic-ack-local/fixture.js"))) });
  assert.deepEqual(fresh.artifacts, rendered, "Fresh complete envelope differs from actually rendered proof");
  return fresh.artifacts;
}
