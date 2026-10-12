/** Preparation only until harness review + root UI release.
 * npm run test:e2e -- --config e2e/local-monster-authoring/playwright.config.ts
 * Requires a verified current root-build manifest containing accepted cda325a; no fallback CSS.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";
import { exerciseMonsterAuthoring } from "./monster-authoring-scenarios.mjs";
import { validateMonsterBuildReceipt } from "./monster-production-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "monster-authoring-local");
const acceptedFoundationCommit = "cda325ae527c6c86ad7e45d4a886c1c85de2800d";
const rootBuild = path.resolve(root, "../equipment-verification/.next");
const inputFlag = process.argv.indexOf("--artifact-manifest");
if (inputFlag !== -1) assert.ok(process.argv[inputFlag + 1], "--artifact-manifest requires a path");
const manifestPath = inputFlag === -1 ? path.join(output, "production-artifacts.json") : path.resolve(process.argv[inputFlag + 1]);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const manifestBytes = await fs.readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8").replace(/^\uFEFF/, ""));
assert.equal(manifest.kind, "next-production");
assert.ok(path.isAbsolute(manifest.staticDirectory), "Static directory must be an explicit absolute path");
assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
const currentRootHead = execFileSync("git", ["-C", path.dirname(rootBuild), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(manifest.sourceCommit, currentRootHead, "Stale root build source receipt");
execFileSync("git", ["-C", path.dirname(rootBuild), "merge-base", "--is-ancestor", acceptedFoundationCommit, currentRootHead]);
assert.equal(await fs.realpath(manifest.staticDirectory), await fs.realpath(path.join(rootBuild, "static")));
assert.match(manifest.htmlClassName, /^dark h-full antialiased [a-zA-Z0-9_-]+ [a-zA-Z0-9_-]+$/);
assert.match(manifest.buildIdSha256, /^[a-f0-9]{64}$/);
assert.equal(digest(await fs.readFile(path.join(rootBuild, "BUILD_ID"))), manifest.buildIdSha256);
assert.equal(manifest.buildReceipt.sourceCommit, currentRootHead);
assert.ok(path.isAbsolute(manifest.buildReceipt.path), "Build receipt must have an explicit absolute path");
assert.match(manifest.buildReceipt.sha256, /^[a-f0-9]{64}$/);
const receiptBytes = await fs.readFile(manifest.buildReceipt.path);
assert.equal(digest(receiptBytes), manifest.buildReceipt.sha256);
validateMonsterBuildReceipt(JSON.parse(receiptBytes.toString("utf8").replace(/^\uFEFF/, "")), currentRootHead);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0);
const assets = new Map();
for (const entry of manifest.assets) {
  assert.match(entry.relativePath, /^(chunks|media)\/[a-zA-Z0-9_.\/-]+$/);
  assert.ok(!entry.relativePath.split("/").includes(".."));
  const absolute = await fs.realpath(path.join(manifest.staticDirectory, entry.relativePath));
  assert.ok(absolute.startsWith((await fs.realpath(manifest.staticDirectory)) + path.sep));
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  const bytes = await fs.readFile(absolute);
  assert.equal(digest(bytes), entry.sha256, `Artifact drift: ${entry.relativePath}`);
  const url = `/_next/static/${entry.relativePath}`;
  assert.ok(!assets.has(url), "Duplicate artifact URL");
  assets.set(url, { ...entry, bytes });
}
const cssUrls = [...assets.keys()].filter(url => url.endsWith(".css"));
assert.ok(cssUrls.length > 0, "Compiled production CSS required");
async function cssFiles(directory, prefix = "") {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) result.push(...await cssFiles(path.join(directory, item.name), relative + "/"));
    else if (item.name.endsWith(".css")) result.push(`/_next/static/${relative}`);
  }
  return result;
}
assert.deepEqual([...cssUrls].sort(), (await cssFiles(manifest.staticDirectory)).sort(), "Manifest must cover all compiled production CSS");
assert.ok([...assets.keys()].some(url => /\.(woff2?|ttf|otf)$/.test(url)), "Local production fonts required");
for (const url of cssUrls) {
  const css = assets.get(url).bytes.toString("utf8");
  for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
    if (match[1].startsWith("data:")) continue;
    const resolved = new URL(match[1], `http://127.0.0.1${url}`);
    assert.equal(resolved.origin, "http://127.0.0.1", "Remote CSS resource refused");
    assert.ok(assets.has(resolved.pathname), `Missing compiled CSS resource: ${resolved.pathname}`);
  }
}
const artifacts = { ...manifest, acceptedFoundationCommit, currentRootHead, manifestPath, manifestSha256: digest(manifestBytes) };
await fs.mkdir(output, { recursive: true });
const sourceRoot = path.dirname(rootBuild);
assert.equal(execFileSync("git", ["-C", sourceRoot, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Root build source is dirty");
const workerSourceCommit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Mounted source is dirty");
const requiredMountedSources = ["components/library/monster-form.tsx", "lib/homebrew/monster-action-response.ts", "lib/homebrew/monster-form.ts",
  "lib/homebrew/monster-draft.ts", "lib/schemas/content-types/monster.ts", "components/compendium/monster-stat-block.tsx", "e2e/local-monster-authoring/fixture.tsx"];
assert.ok(Array.isArray(manifest.authoringSources), "Root must bind reviewed actual authoring sources");
assert.deepEqual(manifest.authoringSources.map(entry => entry.relativePath).sort(), [...requiredMountedSources].sort());
for (const entry of manifest.authoringSources) {
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(digest(await fs.readFile(path.join(sourceRoot, entry.relativePath))), entry.sha256, "Current root authoring source drift: " + entry.relativePath);
  assert.equal(digest(await fs.readFile(path.join(root, entry.relativePath))), entry.sha256, "Mounted authoring differs from current root: " + entry.relativePath);
}
assert.match(manifest.dependencyLockSha256, /^[a-f0-9]{64}$/);
for (const directory of new Set([sourceRoot, root])) assert.equal(digest(await fs.readFile(path.join(directory, "package-lock.json"))), manifest.dependencyLockSha256);
artifacts.workerSourceCommit = workerSourceCommit;
const compiled = await build({
  entryPoints: [path.join(root, "e2e/local-monster-authoring/fixture.tsx")],
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "offline-authoring-boundaries", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local-link" }));
    builder.onLoad({ filter: /.*/, namespace: "local-link" }, () => ({ loader: "tsx", resolveDir: root, contents:
      "import React from 'react';export default function Link(props){return <a {...props}/>}" }));
    builder.onResolve({ filter: /^@\/app\/\(app\)\/homebrew\/monsters\/actions$/ }, () => ({ path: "actions", namespace: "synthetic-actions" }));
    builder.onLoad({ filter: /.*/, namespace: "synthetic-actions" }, () => ({ loader: "js", contents:
      "export async function createHomebrewMonster(previous,input){return window.monsterAuthoringFixture.invoke('create',previous,input)};export async function updateHomebrewMonster(previous,input){return window.monsterAuthoringFixture.invoke('edit',previous,input)}" }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "real-browser-navigation" }));
    builder.onLoad({ filter: /.*/, namespace: "real-browser-navigation" }, () => ({ loader: "js", resolveDir: root,
      contents: "export { unstable_rethrow } from 'next/dist/client/components/unstable-rethrow.browser.js';" }));
  } }],
});
artifacts.mountedProjectInputs = [];
artifacts.actualNextNavigationInputs = [];
for (const input of Object.keys(compiled.metafile.inputs)) {
  if (/^(local-link|synthetic-actions|real-browser-navigation):/.test(input)) continue;
  const absolute = path.resolve(root, input);
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  if (relative.startsWith("node_modules/") && !relative.startsWith("node_modules/next/")) continue;
  assert.ok(!relative.startsWith("../"), "Mounted dependency outside owned project");
  const bytes = await fs.readFile(absolute), hash = digest(bytes);
  assert.equal(digest(await fs.readFile(path.join(sourceRoot, relative))), hash, "Mounted project dependency differs from root: " + relative);
  (relative.startsWith("node_modules/next/") ? artifacts.actualNextNavigationInputs : artifacts.mountedProjectInputs).push({ relativePath: relative, sha256: hash });
}
assert.ok(artifacts.actualNextNavigationInputs.some(entry => entry.relativePath.endsWith("/unstable-rethrow.browser.js")), "Actual Next browser rethrow helper required");

const evidence = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], layoutFailures = [], layoutSamples = [];
let browser, browserServer, browserProcess, browserControlPort, activePage, failure;
let stopping = false;
process.on("message", message => {
  if (message?.type !== "stop") return;
  stopping = true;
  failure = new Error("Harness interrupted by its owning test worker");
  void browser?.close().catch(() => {});
});
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") { unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(405).end(); return; }
    if (assets.has(url.pathname)) {
      const asset = assets.get(url.pathname); assetRequests.push(url.pathname);
      const type = url.pathname.endsWith(".css") ? "text/css" : url.pathname.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      response.setHeader("Content-Type", type); response.end(asset.bytes); return;
    }
    if (url.pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); return; }
    if (url.pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    if (url.pathname === "/authoring") {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><html lang="en" class="${manifest.htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline original monster authoring</title>${cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><main class="px-4 py-6 sm:px-6"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`); return;
    }
    unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(404).end();
  } catch (error) { pageErrors.push(`Local server: ${error.message}`); response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid, command: "node scripts/verify-monster-authoring-local.mjs", cwd: root, startTime: new Date().toISOString(), listeningPort: port };
console.log(JSON.stringify({ taskProcess, artifacts }));
process.send?.({ type: "process", taskProcess });
const record = (size, check, details = {}) => evidence.push({ size, check, passed: true, ...details });
async function layout(page) {
  const dimensions = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const details = node => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 80),
        left: box.left, right: box.right, width: box.width, height: box.height,
        clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
        display: css.display, minWidth: css.minWidth, widthRule: css.width,
        whiteSpace: css.whiteSpace, overflowWrap: css.overflowWrap, overflowX: css.overflowX,
        gridTemplateColumns: css.gridTemplateColumns, flexShrink: css.flexShrink };
    };
    const offenders = [...document.querySelectorAll('body *')].filter(node => {
      const box = node.getBoundingClientRect(); return box.width > 0 && (box.right > viewport + 1 || box.left < -1);
    }).map(node => ({ ...details(node), ancestors: Array.from((function* () {
      for (let current = node.parentElement, count = 0; current && count < 5; current = current.parentElement, count++) yield details(current);
    })()) })).sort((a, b) => b.right - a.right).slice(0, 30);
    const form = document.querySelector("form");
    return { viewport, documentWidth: document.documentElement.scrollWidth, pathname: location.pathname,
      form: form ? details(form) : null, offenders };
  });
  layoutSamples.push({ viewport: dimensions.viewport, documentWidth: dimensions.documentWidth,
    pathname: dimensions.pathname, form: dimensions.form });
  if (dimensions.documentWidth > dimensions.viewport + 1) {
    layoutFailures.push(dimensions);
    console.log(JSON.stringify({ layoutFailure: { viewport: dimensions.viewport, documentWidth: dimensions.documentWidth,
      pathname: dimensions.pathname, diagnosticFile: path.join(output, 'failure-layout.json'),
      offenders: dimensions.offenders.slice(0, 3).map(({ tag, className, width, right, minWidth }) => ({ tag, className, width, right, minWidth })) } }));
    await fs.writeFile(path.join(output, 'failure-layout.json'), JSON.stringify(dimensions, null, 2));
  }
  assert.equal(dimensions.documentWidth <= dimensions.viewport + 1, true, "Horizontal body overflow");
}
async function fonts(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const results = [];
    for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
      const css = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (!css) throw Error(`Missing production font variable ${variable}`);
      const family = css.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      await document.fonts.load(`16px "${family}"`);
      const loaded = [...document.fonts].some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.status === "loaded");
      if (!loaded) throw Error(`Production font not loaded: ${family}`);
      results.push({ variable, family, loaded });
    }
    return results;
  });
}
try {
  browserServer = await chromium.launchServer({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, host: "127.0.0.1" });
  const child = browserServer.process(); browserControlPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { pid: child.pid, parentPid: process.pid, command: child.spawnargs, cwd: root, startTime: new Date().toISOString(), listeningPort: browserControlPort };
  console.log(JSON.stringify({ browserProcess }));
  browser = await chromium.connect(browserServer.wsEndpoint());
  if (stopping) throw failure;
  for (const [size, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport }); context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || request.method() !== "GET") {
        blockedRequests.push({ url: request.url(), method: request.method() }); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page; page.on("pageerror", error => pageErrors.push(error.message));
    await exerciseMonsterAuthoring({ page, origin, output, size, record, fonts, layout });
    await context.close();
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(unexpectedRequests, []);
  assert.ok(assetRequests.some(url => /\.(woff2?|ttf|otf)$/.test(url)), "Verified font assets must actually be requested");
} catch (error) {
  failure = error;
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
} finally {
  try { if (browser) await browser.close(); }
  finally { try { if (browserServer) await browserServer.close(); }
    finally { await new Promise(resolve => server.close(resolve)); } }
}
async function closed(targetPort) {
  if (!targetPort) return true;
  return new Promise(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port: targetPort });
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
  });
}
const portClosed = await closed(port), browserPortClosed = await closed(browserControlPort);
const browserExited = !browserServer || browserServer.process().exitCode !== null;
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false,
  auth: "mocked local account", persistence: "synthetic session store only; database unavailable", actionTransport: "local synthetic functions, not Server Actions HTTP", frameworkNavigation: "actual browser unstable_rethrow; routing unavailable", routing: "native anchors and local reload", appShell: "local padded wrapper, not authenticated application shell",
  artifacts, taskProcess, browserProcess, portClosed, browserPortClosed, browserExited,
  evidence, pageErrors, blockedRequests, unexpectedRequests, assetRequests, layoutFailures, layoutSamples, failure: failure?.message ?? null }, null, 2));
if (process.connected) process.disconnect();
assert.equal(portClosed, true); assert.equal(browserPortClosed, true); assert.equal(browserExited, true);
if (failure) throw failure;
console.log(JSON.stringify({ passed: evidence.length, portClosed, browserPortClosed, browserExited, output }));
