import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Same successful/clean-build invariants as reviewed monster-production-receipt.mjs.
export function validatePassiveFeatureBuildReceipt(receipt, expectedSourceSha) {
  assert.match(expectedSourceSha, /^[a-f0-9]{40}$/);
  assert.ok(receipt !== null && typeof receipt === "object" && !Array.isArray(receipt), "Build receipt must be a JSON object");
  assert.equal(receipt.gate, "build", "Receipt must record the production build gate");
  assert.equal(receipt.exitCode, 0, "Production build must have succeeded");
  assert.equal(receipt.sourceSha, expectedSourceSha, "Receipt source must match current approved build source");
  const clean = receipt.sourceStatus === "" || (Array.isArray(receipt.sourceStatus) && receipt.sourceStatus.length === 0);
  assert.equal(clean, true, "Build receipt must record clean source status");
}
export const approvedPassiveFeatureSource = "6f43b57b574faaeb7536aad4ded592cb1bb1e449";
export const passiveFeatureSourcePaths = ["components/library/passive-feature-form.tsx", "lib/homebrew/passive-feature-form.ts", "lib/supabase/homebrew-passive-features-server.ts", "app/(app)/homebrew/features/actions.ts"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = bytes => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
const gitText = (root, args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", windowsHide: true }).trim();

export function assertHeadWorkingTree(root, relativePath) {
  // HEAD comparison includes staged AND unstaged tracked changes, unlike plain git diff.
  assert.equal(gitText(root, ["diff", "HEAD", "--", relativePath]), "", `HEAD-to-working-tree drift: ${relativePath}`);
  assert.equal(gitText(root, ["ls-files", "--error-unmatch", "--", relativePath]), relativePath, `Untracked bundled project input: ${relativePath}`);
}

export function passiveFeatureProjectInputPlugin(root, captured) {
  return { name: "passiveFeature-capture-actual-project-bytes", setup(builder) {
    builder.onLoad({ filter: /\.(tsx?|jsx?|mjs|cjs|json)$/, namespace: "file" }, async args => {
      const absolute = await fs.realpath(args.path);
      const relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (relativePath.startsWith("node_modules/") && !relativePath.startsWith("node_modules/next/")) return;
      assert.ok(relativePath && !relativePath.startsWith("../") && !path.isAbsolute(relativePath), "Project input escaped worker");
      const bytes = await fs.readFile(absolute);
      captured.set(absolute, { relativePath, sha256: digest(bytes), bytes: bytes.length });
      const extension = path.extname(absolute).slice(1);
      const loader = extension === "mjs" || extension === "cjs" ? "js" : extension;
      return { contents: bytes.toString("utf8"), loader, resolveDir: path.dirname(absolute) };
    });
  } };
}

/** Bind every actual metafile project input to the bytes supplied to esbuild and root. */
export async function bindPassiveFeatureProjectInputs(root, metafile, captured, artifacts) {
  const rootCheckout = path.resolve(root, "../equipment-verification");
  assert.equal(gitText(rootCheckout, ["rev-parse", "HEAD"]), artifacts.currentRootHead, "Root moved during bundle");
  assert.equal(gitText(rootCheckout, ["status", "--porcelain", "--untracked-files=no"]), "", "Root changed during bundle");
  const bundledProjectInputs = [], syntheticInputs = [], actualNextNavigationInputs = [];
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith("passiveFeature-offline:")) { syntheticInputs.push({ input, boundary: "declared action/navigation stub" }); continue; }
    const absolute = await fs.realpath(path.resolve(root, input));
    const relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (relativePath.startsWith("node_modules/") && !relativePath.startsWith("node_modules/next/")) continue;
    const receipt = captured.get(absolute);
    assert.ok(receipt, `Project bytes were not captured by esbuild onLoad: ${input}`);
    assert.equal(digest(await fs.readFile(absolute)), receipt.sha256, `Worker changed during bundle: ${relativePath}`);
    if (relativePath.startsWith("node_modules/next/")) {
      assert.equal(digest(await fs.readFile(path.join(rootCheckout, relativePath))), receipt.sha256, `Next helper differs from current root: ${relativePath}`);
      actualNextNavigationInputs.push(receipt); continue;
    }
    if (relativePath === "e2e/local-passive-features/fixture.tsx") { assertHeadWorkingTree(root, relativePath); syntheticInputs.push({ ...receipt, boundary: "synthetic fixture" }); continue; }
    assertHeadWorkingTree(root, relativePath);
    assertHeadWorkingTree(rootCheckout, relativePath);
    assert.equal(digest(await fs.readFile(path.join(rootCheckout, relativePath))), receipt.sha256, `Bundled bytes differ from current root: ${relativePath}`);
    const workerBlob = execFileSync("git", ["-C", root, "show", `HEAD:${relativePath}`], { windowsHide: true });
    const rootBlob = execFileSync("git", ["-C", rootCheckout, "show", `HEAD:${relativePath}`], { windowsHide: true });
    assert.equal(digest(workerBlob), digest(rootBlob), `Bundled input HEAD differs from root: ${relativePath}`);
    bundledProjectInputs.push(receipt);
  }
  for (const required of ["components/library/passive-feature-form.tsx", "lib/homebrew/passive-feature-form.ts", "lib/schemas/content-types/feature.ts"]) {
    assert.ok(bundledProjectInputs.some(entry => entry.relativePath === required), `Missing actual required bundled input: ${required}`);
  }
  for (const relativePath of ["package-lock.json", "package.json", "tsconfig.json"]) {
    assertHeadWorkingTree(root, relativePath); assertHeadWorkingTree(rootCheckout, relativePath);
    const worker = await fs.readFile(path.join(root, relativePath));
    assert.equal(digest(worker), digest(await fs.readFile(path.join(rootCheckout, relativePath))), `Worker/root runtime configuration differs: ${relativePath}`);
    if (relativePath === "package-lock.json") assert.equal(digest(worker), artifacts.dependencyLockSha256, "Dependency lock changed during bundle");
  }
  assert.ok(actualNextNavigationInputs.some(entry => entry.relativePath.endsWith("/unstable-rethrow.browser.js")), "Actual Next browser rethrow helper required");
  return { bundledProjectInputs, syntheticInputs, actualNextNavigationInputs, metafileSha256: digest(JSON.stringify(metafile)) };
}

/** Reviewed R16 static asset/receipt guards, applied to this separately bundled form. */
export async function loadPassiveFeatureProductionAssets(root, manifestPath) {
  const rootCheckout = path.resolve(root, "../equipment-verification");
  const rootBuild = path.join(rootCheckout, ".next");
  const manifestBytes = await fs.readFile(manifestPath);
  const manifest = readJson(manifestBytes);
  assert.equal(manifest.kind, "next-production");
  assert.ok(path.isAbsolute(manifest.staticDirectory), "Static directory must be explicit and absolute");
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  const currentRootHead = execFileSync("git", ["-C", rootCheckout, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  assert.equal(manifest.sourceCommit, currentRootHead, "Stale root build source receipt");
  assert.equal(execFileSync("git", ["-C", rootCheckout, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8", windowsHide: true }).trim(), "", "Root tracked source changed since build");
  const staticDirectory = await fs.realpath(manifest.staticDirectory);
  assert.equal(staticDirectory, await fs.realpath(path.join(rootBuild, "static")));
  assert.match(manifest.htmlClassName, /^dark h-full antialiased [a-zA-Z0-9_-]+ [a-zA-Z0-9_-]+$/);
  assert.match(manifest.buildIdSha256, /^[a-f0-9]{64}$/);
  assert.equal(digest(await fs.readFile(path.join(rootBuild, "BUILD_ID"))), manifest.buildIdSha256);
  assert.equal(manifest.buildReceipt.sourceCommit, currentRootHead);
  assert.ok(path.isAbsolute(manifest.buildReceipt.path), "Build receipt path must be explicit and absolute");
  assert.match(manifest.buildReceipt.sha256, /^[a-f0-9]{64}$/);
  const receiptBytes = await fs.readFile(manifest.buildReceipt.path);
  assert.equal(digest(receiptBytes), manifest.buildReceipt.sha256);
  validatePassiveFeatureBuildReceipt(readJson(receiptBytes), currentRootHead);
  assert.match(manifest.dependencyLockSha256, /^[a-f0-9]{64}$/);
  for (const checkout of [root, rootCheckout]) {
    assertHeadWorkingTree(checkout, "package-lock.json");
    assert.equal(digest(await fs.readFile(path.join(checkout, "package-lock.json"))), manifest.dependencyLockSha256, "Worker/root must use exact approved dependency lock bytes");
  }
  const lock = readJson(await fs.readFile(path.join(root, "package-lock.json")));
  for (const name of ["esbuild", "next", "react", "react-dom", "playwright", "@playwright/test"]) {
    assert.equal(readJson(await fs.readFile(path.join(root, "node_modules", name, "package.json"))).version,
      lock.packages[`node_modules/${name}`].version, `Installed ${name} must match the approved lock version`);
  }
  // Cherry-picks need not retain ancestry. Match exact approved Git blobs instead.
  const sourceFiles = passiveFeatureSourcePaths.map(relativePath => {
    const expected = execFileSync("git", ["-C", root, "show", `${approvedPassiveFeatureSource}:${relativePath}`], { windowsHide: true });
    const actual = execFileSync("git", ["-C", rootCheckout, "show", `${currentRootHead}:${relativePath}`], { windowsHide: true });
    assert.equal(digest(actual), digest(expected), `Root build lacks approved passiveFeature source: ${relativePath}`);
    assertHeadWorkingTree(root, relativePath);
    const workerHead = execFileSync("git", ["-C", root, "show", `HEAD:${relativePath}`], { windowsHide: true });
    assert.equal(digest(workerHead), digest(expected), `Worker passiveFeature source drift: ${relativePath}`);
    return { relativePath, gitBlobSha256: digest(actual) };
  });
  assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0);
  const assets = new Map();
  for (const entry of manifest.assets) {
    assert.match(entry.relativePath, /^(chunks|media)\/[a-zA-Z0-9_.\/-]+$/);
    assert.ok(!entry.relativePath.split("/").includes(".."));
    assert.match(entry.relativePath, /\.(css|woff2?|ttf|otf|svg|png|webp)$/);
    const absolute = await fs.realpath(path.join(staticDirectory, entry.relativePath));
    assert.ok(absolute.startsWith(staticDirectory + path.sep), "Static asset must stay inside the root build");
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const bytes = await fs.readFile(absolute);
    assert.equal(digest(bytes), entry.sha256, `Artifact drift: ${entry.relativePath}`);
    const url = `/_next/static/${entry.relativePath}`;
    assert.ok(!assets.has(url), "Duplicate artifact URL");
    assets.set(url, { relativePath: entry.relativePath, sha256: entry.sha256, bytes });
  }
  const cssUrls = [...assets.keys()].filter(url => url.endsWith(".css"));
  assert.ok(cssUrls.length > 0, "Compiled production CSS required; no fallback");
  async function cssFiles(directory, prefix = "") {
    const result = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) result.push(...await cssFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`));
      else if (entry.name.endsWith(".css")) result.push(`/_next/static/${prefix}${entry.name}`);
    }
    return result;
  }
  assert.deepEqual([...cssUrls].sort(), (await cssFiles(staticDirectory)).sort(), "Manifest must cover all production CSS");
  assert.ok([...assets.keys()].some(url => /\.(woff2?|ttf|otf)$/.test(url)), "Local production fonts required");
  for (const url of cssUrls) for (const match of assets.get(url).bytes.toString("utf8").matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
    if (match[1].startsWith("data:")) continue;
    const resolved = new URL(match[1], `http://127.0.0.1${url}`);
    assert.equal(resolved.origin, "http://127.0.0.1", "Remote CSS resource refused");
    assert.ok(assets.has(resolved.pathname), `Missing compiled CSS resource: ${resolved.pathname}`);
  }
  return { assets, cssUrls, htmlClassName: manifest.htmlClassName,
    artifacts: { ...manifest, currentRootHead, approvedPassiveFeatureSource, sourceFiles, manifestPath, manifestSha256: digest(manifestBytes) } };
}

export function passiveFeatureOfflinePlugin(root) {
  const stubs = {
    "next/link": `import React from 'react';export default function Link(props){return React.createElement('a',{...props,onClick:event=>{event.preventDefault();window.passiveFeatureHarness.navigation.push({kind:'anchor',href:props.href});if(props.href==='/homebrew'){window.passiveFeatureHarness.homebrewChecks++;window.dispatchEvent(new Event('passiveFeature-offline-homebrew-check'));}}})}`,
    "next/navigation": `export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser.js';const router={push:href=>{window.passiveFeatureHarness.navigation.push({kind:'router',href});if(window.passiveFeatureHarness.scenario==='create-navigation-failure')throw Error('Simulated navigation failed after saved confirmation') }};export const useRouter=()=>router`,
    "@/app/(app)/homebrew/features/actions": `export const createHomebrewPassiveFeature=(previous,form)=>window.passiveFeatureHarness.submit('create',previous,form);export const updateHomebrewPassiveFeature=(previous,form)=>window.passiveFeatureHarness.submit('edit',previous,form)`,
  };
  return { name: "passiveFeature-declared-offline-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/lib\/supabase\/|@\/app\/\(app\)\/homebrew\/features\/actions|server-only)/ }, args => {
      if (args.path === "next/dist/client/components/unstable-rethrow.browser.js") return;
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: "passiveFeature-offline" };
      throw Error(`Unapproved live boundary: ${args.path}`);
    });
    builder.onLoad({ filter: /.*/, namespace: "passiveFeature-offline" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } };
}
