/** Explicit local config only; no install/build/server/provider fallback. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMagicAckAssets, bindMagicAckInputs, verifyMagicAckHelpers, magicAckInputPlugin, magicAckCapturedEntries, magicAckSha, freshMagicAckProof } from "./magic-ack-inputs.mjs";


const script = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(script), "..");
const output = path.join(root, "test-results/magic-ack-local");
let browserServer, browser, browserProcess, browserPort, activePage, failure, finished = false;
const stop = () => { if (!finished) { failure = Error("Interrupted by owning worker"); void browser?.close().catch(() => {}); } };
process.on("message", message => { if (message?.type === "stop") stop(); }); process.on("disconnect", stop);
const firstHelperProof = await verifyMagicAckHelpers(root);
const { build } = await import("esbuild");
const { chromium } = await import("playwright");
const { runMagicAckCases } = await import("./magic-ack-scenarios.mjs");
const { npcOsIdentity, npcResources, assertNoOtherNpcRunner } = await import("./npc-process.mjs");
assertNoOtherNpcRunner(script, process.pid);
await fs.mkdir(output, { recursive: true });
// Preserve historical failures/screenshots; never replace a prior evidence receipt.
const old = (await fs.readdir(output)).filter(name => /^(evidence\.json|failure.*|(?:desktop|mobile)-.*\.png|process-start\.json|bundle-metafile\.json|initial-rendered-proof\.json|captured-inputs\.json|wrapper-cleanup\.json|fixture\.js)$/.test(name));
if (old.length) {
  const archive = path.join(output, `archive-${Date.now()}`); await fs.mkdir(archive);
  for (const name of old) await fs.rename(path.join(output, name), path.join(archive, name));
}
const taskProcess = { ...npcOsIdentity(process.pid, process.ppid), cwd: root, startTime: new Date().toISOString(), listeningPort: null };
process.send?.({ type: "process", taskProcess });
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
const flag = process.argv.indexOf("--artifact-manifest");
if (flag !== -1) assert.ok(process.argv[flag + 1], "Manifest argument required");
const manifestPath = flag === -1 ? path.join(output, "production-artifacts.json") : path.resolve(process.argv[flag + 1]);
const production = await loadMagicAckAssets(root, manifestPath);
assert.deepEqual(production.artifacts.initialSourceProof, firstHelperProof);
const captured = new Map();
const bundle = await build({ entryPoints: [path.join(root, "e2e/local-magic-ack/fixture.tsx")], absWorkingDir: root,
  outfile: path.join(output, "fixture.js"), bundle: true, metafile: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, plugins: [magicAckInputPlugin(root, captured), {
    name: "magic-ack-explicit-modeled-boundaries", setup(builder) {
      const stubs = {
        "next/link": "import React from 'react';export default function Link(props){return React.createElement('a',{...props,onClick:event=>{event.preventDefault();window.magicAck.navigation.push({kind:'anchor',href:props.href});}})}",
        "next/navigation": "export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser.js';export function useRouter(){return{push(href){window.magicAck.navigation.push({kind:'push',href});if(window.magicAck.scenario==='saved-navigation')throw Error('Modeled navigation failure after confirmed save')}}}",
        "@/app/(app)/homebrew/magic-items/actions": "export const createHomebrewMagicItem=(s,f)=>window.magicAck.submit('create',s,f);export const updateHomebrewMagicItem=(s,f)=>window.magicAck.submit('edit',s,f);",
      };
      builder.onResolve({ filter: /^(next\/|@\/app\/|@\/lib\/supabase\/server|server-only)/ }, args => {
        if (args.path === "next/dist/client/components/unstable-rethrow.browser.js") return;
        if (!Object.hasOwn(stubs, args.path)) throw Error(`Unapproved live boundary: ${args.path}`);
        return { path: args.path, namespace: "magic-ack-offline" };
      });
      builder.onLoad({ filter: /.*/, namespace: "magic-ack-offline" }, args => {
        const contents = stubs[args.path]; captured.set(`magic-ack-offline:${args.path}`, { relativePath: `magic-ack-offline:${args.path}`, sha256: magicAckSha(contents), bytes: Buffer.byteLength(contents) });
        return { loader: "js", contents, resolveDir: root };
      });
    },
  }] });
assert.ok(!Object.keys(bundle.metafile.outputs).some(file => file.endsWith(".css")), "Fallback/fixture CSS refused");
Object.assign(production.artifacts, await bindMagicAckInputs(root, bundle.metafile, captured, production.artifacts));
await fs.writeFile(path.join(output, "bundle-metafile.json"), JSON.stringify(bundle.metafile, null, 2));
await fs.writeFile(path.join(output, "captured-inputs.json"), JSON.stringify(magicAckCapturedEntries(captured), null, 2));
production.artifacts.fixtureBundleSha256 = magicAckSha(await fs.readFile(path.join(output, "fixture.js")));
const initialBindings = { artifacts: structuredClone(production.artifacts) };
await fs.writeFile(path.join(output, "initial-rendered-proof.json"), JSON.stringify(initialBindings, null, 2));
if (process.connected) process.send({ type: "rendered-proof", initialBindings });
const fixtureBytes = await fs.readFile(path.join(output, "fixture.js"));
assert.equal(magicAckSha(fixtureBytes), initialBindings.artifacts.fixtureBundleSha256);
const evidence = [], screenshots = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], fontEvidence = [], diagnostics = [];
const resourcesBefore = npcResources();
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") { unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(405).end(); return; }
    const asset = production.assets.get(url.pathname);
    if (asset) { assetRequests.push({ path: url.pathname, sha256: asset.sha256 }); response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "application/octet-stream"); response.end(asset.bytes); return; }
    if (url.pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); assetRequests.push({ path: "/fixture.js", sha256: magicAckSha(fixtureBytes) }); response.end(fixtureBytes); return; }
    if (url.pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    if (url.pathname === "/fixture") {
      response.setHeader("Content-Type", "text/html"); response.end(`<!doctype html><html lang="en" class="${production.htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${production.cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><main class="px-4 py-6 sm:px-6"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`); return;
    }
    unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(404).end();
  } catch (error) { pageErrors.push(error.message); response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, origin = `http://127.0.0.1:${port}`; taskProcess.listeningPort = port;
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
if (process.connected) process.send({ type: "resources", taskProcess });
async function inspect(page, size, scenario) {
  const sample = await page.evaluate(async () => {
    const fonts = [];
    for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
      const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim().split(",")[0].replace(/^['"]|['"]$/g, "");
      if (!family) throw Error(`Missing production font variable ${variable}`);
      for (const style of variable === "--font-eb-garamond" ? ["normal", "italic"] : ["normal"]) {
        const query = `${style} 400 16px "${family}"`, faces = await document.fonts.load(query, "Original Compass");
        if (!faces.length || !document.fonts.check(query, "Original Compass") || !faces.some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.status === "loaded" && face.style === style)) throw Error("Expected production FontFace failed");
        fonts.push({ family, style, statuses: faces.map(face => face.status) });
      }
    }
    return { fonts, width: innerWidth, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth };
  });
  assert.ok(sample.bodyWidth <= sample.width + 1 && sample.documentWidth <= sample.width + 1, `Horizontal overflow ${size}/${scenario}`);
  for (const fontClass of production.artifacts.fontClassProof) assert.equal(await page.evaluate(name => document.documentElement.classList.contains(name), fontClass.className), true);
  fontEvidence.push({ size, scenario, ...sample });
  const file = `${size}-${scenario}.png`; await page.screenshot({ path: path.join(output, file) }); screenshots.push(file);
}
try {
  if (failure) throw failure;
  browserServer = await chromium.launchServer({ channel: "chrome", headless: true, host: "127.0.0.1", port: 0 });
  browserPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { ...npcOsIdentity(browserServer.process().pid, process.pid), cwd: root, startTime: new Date().toISOString(), listeningPort: browserPort };
  await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess, browserProcess }, null, 2));
  if (process.connected) process.send({ type: "resources", taskProcess, browserProcess });
  browser = await chromium.connect(browserServer.wsEndpoint());
  await runMagicAckCases({ browser, origin, root, inspect, pageErrors, blockedRequests, unexpectedRequests, diagnostics, evidence, setActive: value => { activePage = value; } });
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(diagnostics, []);
  assert.ok(assetRequests.some(asset => /\.(woff2?|ttf|otf)$/.test(asset.path)));
} catch (error) {
  failure = error;
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
    await fs.writeFile(path.join(output, "failure-dom.json"), JSON.stringify({ html: await activePage.content().catch(() => "unavailable"), pageErrors, blockedRequests, unexpectedRequests, evidence }, null, 2));
  }
} finally {
  await browser?.close().catch(() => {}); await browserServer?.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));
}
const closed = target => target ? new Promise(resolve => { const socket = net.connect({ host: "127.0.0.1", port: target });
  socket.setTimeout(2_000, () => { socket.destroy(); resolve(false); }); socket.once("connect", () => { socket.destroy(); resolve(false); }); socket.once("error", error => resolve(error.code === "ECONNREFUSED")); }) : Promise.resolve(true);
const portClosed = await closed(port), browserPortClosed = await closed(browserPort), browserExited = !browserServer || browserServer.process().exitCode !== null;
let finalBindings;
try {
  const artifacts = await freshMagicAckProof(root, manifestPath, bundle.metafile, captured, initialBindings.artifacts);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, "initial-rendered-proof.json"), "utf8")), initialBindings);
  assert.equal(magicAckSha(JSON.stringify(JSON.parse(await fs.readFile(path.join(output, "captured-inputs.json"), "utf8")))), initialBindings.artifacts.capturedInputsSha256);
  finalBindings = { matchedRenderedProof: true, artifacts };
} catch (error) {
  failure ??= error;
  finalBindings = { matchedRenderedProof: false, failure: error.message };
}
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false, persistence: "unavailable", simulatedAuth: true, localOnly: true, providerWrites: false,
  artifacts: production.artifacts, initialBindings, finalBindings, taskProcess, browserProcess, resourcesBefore, resourcesAfter: npcResources(), portClosed, browserPortClosed, browserExited,
  evidence, screenshots, fontEvidence, assetRequests, pageErrors, blockedRequests, unexpectedRequests, diagnostics, failure: failure?.message ?? null,
  limits: "Actual MagicItemForm, mapper, response and canonical current/immutable pin parsers and native events/reset/reload. Actions, Auth/DAL, current rows, CAS/no-op/MAX, writes/pin confirmation, cache, router/Homebrew navigation and reload reads are explicitly modeled. No SQL/RLS/persistence/provider/latest-private/exactly-once or authenticated server-shell acceptance. All six harness files, eight frozen6aa core paths, inherited0841/e405 helpers, all compiled project/runtime inputs, installed runtime and fresh current clean root build/CSS/font envelope are independently bound; no fallback styles." }, null, 2));
finished = true; if (process.connected) process.disconnect();
assert.ok(portClosed && browserPortClosed && browserExited, "Task-owned private resources must be gone");
if (failure) throw failure;
console.log(JSON.stringify({ checks: evidence.length, screenshots: screenshots.length, portClosed, browserPortClosed, browserExited }));
