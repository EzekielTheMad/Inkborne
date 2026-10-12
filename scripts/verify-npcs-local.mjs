/** Explicit local config only; no install/build/server/provider fallback. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { loadNpcProductionAssets, bindNpcProjectInputs, npcProjectInputPlugin } from "./npc-production-inputs.mjs";
import { npcOsIdentity, npcResources, assertNoOtherNpcRunner } from "./npc-process.mjs";

const script = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(script), "..");
const output = path.join(root, "test-results/npcs-local");
assertNoOtherNpcRunner(script, process.pid);
await fs.mkdir(output, { recursive: true });
// Preserve historical failures/screenshots; never replace a prior evidence receipt.
const old = (await fs.readdir(output)).filter(name => /^(evidence\.json|failure.*|(?:desktop|mobile)-.*\.png|process-start\.json|bundle-metafile\.json)$/.test(name));
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
const production = await loadNpcProductionAssets(root, manifestPath);
const captured = new Map();
const bundle = await build({ entryPoints: [path.join(root, "e2e/local-npcs/fixture.tsx")], absWorkingDir: root,
  outfile: path.join(output, "fixture.js"), bundle: true, metafile: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, plugins: [npcProjectInputPlugin(root, captured), {
    name: "npc-native-link-only", setup(builder) {
      builder.onResolve({ filter: /^(next\/|@\/lib\/supabase\/server|server-only)/ }, args => {
        if (args.path !== "next/link") throw Error(`Unapproved live boundary: ${args.path}`);
        return { path: args.path, namespace: "npc-offline" };
      });
      builder.onLoad({ filter: /.*/, namespace: "npc-offline" }, () => ({ loader: "js", contents: "import React from 'react';export default function Link(props){return React.createElement('a',props)}" }));
    },
  }] });
assert.ok(!Object.keys(bundle.metafile.outputs).some(file => file.endsWith(".css")), "Fallback/fixture CSS refused");
Object.assign(production.artifacts, await bindNpcProjectInputs(root, bundle.metafile, captured, production.artifacts));
await fs.writeFile(path.join(output, "bundle-metafile.json"), JSON.stringify(bundle.metafile, null, 2));
const evidence = [], screenshots = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], fontEvidence = [], diagnostics = [];
let browserServer, browser, browserProcess, browserPort, activePage, failure, finished = false;
const resourcesBefore = npcResources();
const stop = () => { if (!finished) { failure = Error("Interrupted by owning worker"); void browser?.close().catch(() => {}); } };
process.on("message", message => { if (message?.type === "stop") stop(); }); process.on("disconnect", stop);
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") { unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(405).end(); return; }
    const asset = production.assets.get(url.pathname);
    if (asset) { assetRequests.push({ path: url.pathname, sha256: asset.sha256 }); response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "application/octet-stream"); response.end(asset.bytes); return; }
    if (url.pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); return; }
    if (url.pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    if (url.pathname === "/library" || /^\/library\/[a-f0-9-]{36}$/.test(url.pathname)) {
      response.setHeader("Content-Type", "text/html"); response.end(`<!doctype html><html lang="en" class="${production.htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${production.cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><main class="px-4 py-6 sm:px-6"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`); return;
    }
    unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(404).end();
  } catch (error) { pageErrors.push(error.message); response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, origin = `http://127.0.0.1:${port}`; taskProcess.listeningPort = port;
async function inspect(page, size, scenario) {
  const sample = await page.evaluate(async () => {
    const fonts = [];
    for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
      const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim().split(",")[0].replace(/^['"]|['"]$/g, "");
      if (!family) throw Error(`Missing production font variable ${variable}`);
      for (const style of variable === "--font-eb-garamond" ? ["normal", "italic"] : ["normal"]) {
        const query = `${style} 400 16px "${family}"`, faces = await document.fonts.load(query, "Original NPC");
        if (!faces.length || !document.fonts.check(query, "Original NPC") || !faces.some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.status === "loaded" && face.style === style)) throw Error("Expected production FontFace failed");
        fonts.push({ family, style, statuses: faces.map(face => face.status) });
      }
    }
    return { fonts, width: innerWidth, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth };
  });
  assert.ok(sample.bodyWidth <= sample.width + 1 && sample.documentWidth <= sample.width + 1, `Horizontal overflow ${size}/${scenario}`);
  fontEvidence.push({ size, scenario, ...sample });
  const file = `${size}-${scenario}.png`; await page.screenshot({ path: path.join(output, file) }); screenshots.push(file);
}
async function keyboardActivate(page, locator) {
  for (let index = 0; index < 80; index++) {
    if (await locator.evaluate(node => node === document.activeElement)) { await page.keyboard.press("Enter"); return; }
    await page.keyboard.press("Tab");
  }
  throw Error("NPC link not keyboard reachable");
}
try {
  if (failure) throw failure;
  browserServer = await chromium.launchServer({ channel: "chrome", headless: true, host: "127.0.0.1", port: 0 });
  browserPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { ...npcOsIdentity(browserServer.process().pid, process.pid), cwd: root, startTime: new Date().toISOString(), listeningPort: browserPort };
  await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess, browserProcess }, null, 2));
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [size, width] of [["desktop", 1280], ["mobile", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
      if (route.request().method() !== "GET") { unexpectedRequests.push({ method: route.request().method(), url: route.request().url() }); return route.abort(); }
      return route.continue();
    });
    const page = activePage = await context.newPage(); page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
    await page.goto(`${origin}/library?category=npcs`); await page.getByRole("heading", { name: "NPCs", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "NPCs", exact: true }).getAttribute("aria-current"), "page");
    await inspect(page, size, "library");
    await keyboardActivate(page, page.getByRole("link", { name: /Original Bridge Keeper/ }));
    await page.getByRole("region", { name: "NPC profile", exact: true }).waitFor();
    assert.match(await page.getByRole("region", { name: "Personality traits" }).innerText(), /Counts footsteps/);
    assert.match(await page.getByRole("region", { name: "Template relationship ideas" }).innerText(), /The bell maker/);
    assert.equal(await page.getByRole("button").count(), 0);
    await inspect(page, size, "profile"); evidence.push({ size, check: "keyboard actual Library/detail/narrative controls", passed: true });
    await page.getByRole("link", { name: "Back to Library" }).click();
    await page.getByLabel("Search by name", { exact: true }).fill("Quiet Visitor");
    await page.getByLabel("Search by name", { exact: true }).press("Enter");
    await page.getByRole("link", { name: /Original Quiet Visitor/ }).waitFor();
    assert.equal(await page.getByRole("link", { name: /Original Bridge Keeper/ }).count(), 0);
    await page.getByRole("link", { name: /Original Quiet Visitor/ }).click();
    await page.getByRole("region", { name: "NPC profile", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Description", exact: true }).count(), 0);
    await inspect(page, size, "minimal"); evidence.push({ size, check: "native search and absent fields remain absent", passed: true });
    await page.goto(`${origin}/library/b1711111-1111-4111-8111-000000000005`);
    await page.getByRole("region", { name: "Template relationship ideas" }).waitFor(); await inspect(page, size, "long-top");
    const final = page.getByText("The final original hook is still reachable.", { exact: true }); await final.scrollIntoViewIfNeeded(); assert.equal(await final.isVisible(), true);
    await inspect(page, size, "long-bottom"); evidence.push({ size, check: "maximum bounded profile/name contained and final hook reachable", passed: true });
    await page.goto(`${origin}/library/b1711111-1111-4111-8111-000000000006`);
    await page.getByText('<script>window.compromised=true</script><img src=x onerror="alert(1)">', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Boolean(window.compromised)), false); assert.equal(await page.locator("img").count(), 0);
    await inspect(page, size, "escaped"); evidence.push({ size, check: "original escaped content and simulated shared provenance", passed: true });
    for (const scenario of ["empty", "malformed", "denied"]) {
      await page.goto(`${origin}/library?category=npcs&scenario=${scenario}`);
      if (scenario === "denied") await page.getByRole("alert").waitFor(); else await page.getByRole("heading", { name: "NPCs", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: /Original Bridge Keeper/ }).count(), 0);
      if (scenario === "malformed") assert.match(await page.getByRole("status").innerText(), /rejected without altering/);
      await inspect(page, size, scenario); evidence.push({ size, check: `${scenario}: no invented accepted NPC`, passed: true });
    }
    await context.close(); activePage = undefined;
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(unexpectedRequests, []);
  assert.ok(diagnostics.every(text => text === "[content-definitions] NPC envelope requires explicit empty effects"));
  assert.equal(diagnostics.length, 2);
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
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false, persistence: "unavailable", simulatedAuth: true,
  artifacts: production.artifacts, taskProcess, browserProcess, resourcesBefore, resourcesAfter: npcResources(), portClosed, browserPortClosed, browserExited,
  evidence, screenshots, fontEvidence, assetRequests, pageErrors, blockedRequests, unexpectedRequests, diagnostics, failure: failure?.message ?? null,
  limits: "Actual canonical NPC parser and Library browser/detail/profile; original fixtures. Auth/entitlements/queries/Next native links and failed-read alert simulated. No SQL, Data API role proof, catalog write, sharing, private instance, persistence, gameplay, server page or authenticated Next shell. Hash-bound production CSS/fonts and all bundled project bytes; no fallback CSS. Viewport screenshots plus long-profile end show reachability, not a full-page export." }, null, 2));
finished = true; if (process.connected) process.disconnect();
assert.ok(portClosed && browserPortClosed && browserExited, "Task-owned private resources must be gone");
if (failure) throw failure;
console.log(JSON.stringify({ checks: evidence.length, screenshots: screenshots.length, portClosed, browserPortClosed, browserExited }));
