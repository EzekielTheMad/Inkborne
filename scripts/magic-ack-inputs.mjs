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
  // Installed Node resolution + full file-set/raw-byte binding, following the
  // reviewed R13 walker. All work stays within finite lock-described packages.
  const limits = { maxPackages: 256, maxEdges: 4096, maxFiles: 60_000, maxEntries: 120_000, maxBytes: 1_073_741_824,
    maxFileBytes: 268_435_456, maxDepth: 32, maxMetadataBytes: 1_048_576, maxLockBytes: 8_388_608, maxLockPackages: 4096, maxNodeBytes: 268_435_456 };
  const roots = ["esbuild", "playwright", "playwright-core", "@playwright/test", "next", "react", "react-dom", "zod"];
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
    assert.equal(worker.length, info.worker.size); assert.equal(built.length, info.built.size); assert.equal(magicAckSha(worker), magicAckSha(built), `Installed raw bytes differ: ${relative}`);
    return worker;
  }
  const lockPath = path.join(root, "package-lock.json"), rootLockPath = path.join(rootCheckout, "package-lock.json");
  const lockInfo = await fs.lstat(lockPath), rootLockInfo = await fs.lstat(rootLockPath);
  assert.ok(lockInfo.isFile() && rootLockInfo.isFile() && !lockInfo.isSymbolicLink() && !rootLockInfo.isSymbolicLink());
  assert.ok(lockInfo.size <= limits.maxLockBytes && rootLockInfo.size <= limits.maxLockBytes);
  const lockBytes = await fs.readFile(lockPath); assert.equal(magicAckSha(lockBytes), magicAckSha(await fs.readFile(rootLockPath)));
  const lock = JSON.parse(lockBytes.toString("utf8")); assert.ok(lock.packages && Object.keys(lock.packages).length <= limits.maxLockPackages);
  const nodeInfo = await fs.lstat(process.execPath); assert.ok(nodeInfo.isFile() && !nodeInfo.isSymbolicLink() && nodeInfo.size <= limits.maxNodeBytes);
  const nodeExecutable = { path: process.execPath, version: process.version, bytes: nodeInfo.size, sha256: magicAckSha(await fs.readFile(process.execPath)) };
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
        inputs.push({ relativePath: current, bytes: actual.length, sha256: magicAckSha(actual) });
      }
    }
    await walk(relative, 0);
    packages.push({ name: metadata.name, relativePath: relative, version: metadata.version, platformConstraints: constraints(locked), packageJsonSha256: magicAckSha(metadataBytes), directories, inputs });
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
  return { ...closure, closureSha256: magicAckSha(JSON.stringify(closure)) };
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
