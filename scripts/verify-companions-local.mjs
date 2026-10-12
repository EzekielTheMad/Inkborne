/** Explicit local config only; no install/build/server/provider fallback. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { loadCompanionProductionAssets, bindCompanionProjectInputs, rebindCompanionInputs } from "./companion-production-inputs.mjs";
import { loadCompanionProcess } from "./companion-process.mjs";

const script = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(script), "..");
const output = path.join(root, "test-results/companions-local");
const processes = await loadCompanionProcess(root);
processes.assertNoOtherRunner(script, process.pid);
await fs.mkdir(output, { recursive: true });
// Preserve historical failures/screenshots; never replace a prior evidence receipt.
const old = (await fs.readdir(output)).filter(name => /^(evidence\.json|failure.*|(?:desktop|mobile)-.*\.png|process-start\.json|bundle-metafile\.json)$/.test(name));
if (old.length) {
  const archive = path.join(output, `archive-${Date.now()}`); await fs.mkdir(archive);
  for (const name of old) await fs.rename(path.join(output, name), path.join(archive, name));
}
const taskProcess = { ...(await processes.freshIdentity(process.pid, process.ppid)), cwd: root, startTime: new Date().toISOString(), listeningPort: null };
process.send?.({ type: "process", taskProcess });
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
const flag = process.argv.indexOf("--artifact-manifest");
if (flag !== -1) assert.ok(process.argv[flag + 1], "Manifest argument required");
const manifestPath = flag === -1 ? path.join(output, "production-artifacts.json") : path.resolve(process.argv[flag + 1]);
const production = await loadCompanionProductionAssets(root, manifestPath, processes.receipt);
const captured = new Map();
const bundle = await build({ entryPoints: [path.join(root, "e2e/local-companions/fixture.tsx")], absWorkingDir: root,
  outfile: path.join(output, "fixture.js"), bundle: true, metafile: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, plugins: [production.projectInputPlugin(root, captured), {
    name: "companion-native-link-only", setup(builder) {
      builder.onResolve({ filter: /^(next\/|@\/lib\/supabase\/server|server-only)/ }, args => {
        if (args.path !== "next/link") throw Error(`Unapproved live boundary: ${args.path}`);
        return { path: args.path, namespace: "companion-offline" };
      });
      builder.onLoad({ filter: /.*/, namespace: "companion-offline" }, () => ({ loader: "js", resolveDir: root, contents: "import React from 'react';export default function Link(props){return React.createElement('a',props)}" }));
    },
  }] });
assert.ok(!Object.keys(bundle.metafile.outputs).some(file => file.endsWith(".css")), "Fallback/fixture CSS refused");
Object.assign(production.artifacts, await bindCompanionProjectInputs(root, bundle.metafile, captured, production.artifacts));
await fs.writeFile(path.join(output, "bundle-metafile.json"), JSON.stringify(bundle.metafile, null, 2));
const evidence = [], screenshots = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], fontEvidence = [], diagnostics = [];
let browserServer, browser, browserProcess, browserPort, activePage, failure, finished = false;
const resourcesBefore = processes.resources();
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
        const query = `${style} 400 16px "${family}"`, faces = await document.fonts.load(query, "Original companion");
        if (!faces.length || !document.fonts.check(query, "Original companion") || !faces.some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.status === "loaded" && face.style === style)) throw Error("Expected production FontFace failed");
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
  throw Error("Companion link not keyboard reachable");
}
try {
  if (failure) throw failure;
  browserServer = await chromium.launchServer({ channel: "chrome", headless: true, host: "127.0.0.1", port: 0 });
  browserPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { ...(await processes.freshIdentity(browserServer.process().pid, process.pid)), cwd: root, startTime: new Date().toISOString(), listeningPort: browserPort };
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
    const id = n => `c1811111-1111-4111-8111-${String(n).padStart(12, "0")}`;
    const record = async scenario => { await inspect(page, size, scenario); evidence.push({ size, check: scenario, passed: true }); };
    async function profile(label) {
      await page.getByRole("region", { name: "Companion template", exact: true }).waitFor();
      assert.equal(await page.getByRole("heading", { name: label, exact: true }).isVisible(), true);
      assert.match(await page.getByRole("region", { name: "Companion template" }).innerText(), /Read-only companion template/);
      assert.equal(await page.getByRole("button").count(), 0);
      assert.equal(await page.getByText("Version 1", { exact: true }).isVisible(), true);
    }
    async function declaredStats() {
      assert.match(await page.getByRole("region", { name: "Statistics", exact: true }).innerText(), /30 \(\+10\)/);
      assert.match(await page.getByRole("region", { name: "Statistics", exact: true }).innerText(), /Athletics \+20/);
    }
    await page.goto(`${origin}/library?category=companions`);
    await page.getByRole("heading", { name: "Companions", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Companions", exact: true }).getAttribute("aria-current"), "page");
    assert.equal(await page.getByRole("link", { name: /Original Workshop Companion/ }).count(), 1);
    await record("library");
    await keyboardActivate(page, page.getByRole("link", { name: /Original Workshop Companion/ }));
    await profile("Mount template"); await declaredStats(); await record("mount-profile");
    await page.getByRole("link", { name: "Back to Library" }).click();
    await page.getByLabel("Search by name", { exact: true }).fill("Grove");
    await page.getByLabel("Search by name", { exact: true }).press("Enter");
    await page.getByRole("link", { name: /Original Grove Beast Form/ }).waitFor();
    assert.equal(await page.getByRole("link", { name: /Original Workshop Companion/ }).count(), 0);
    await page.getByRole("link", { name: /Original Grove Beast Form/ }).click();
    await profile("Beast form template"); await declaredStats(); await record("beast-profile");
    await page.goto(`${origin}/library/${id(5)}`);
    await profile("Summon template"); await declaredStats(); await record("summon-profile");
    await page.goto(`${origin}/library/${id(6)}`); await profile("Beast form template");
    assert.equal(await page.getByRole("heading", { name: "Description", exact: true }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Actions", exact: true }).count(), 0);
    assert.equal(await page.getByText(/Athletics \+20/).count(), 0);
    await record("absent-profile");
    await page.goto(`${origin}/library/${id(7)}`); await profile("Mount template"); await record("long-top");
    const final = page.getByText("The final original companion action is still reachable.", { exact: true });
    await final.scrollIntoViewIfNeeded(); assert.equal(await final.isVisible(), true); await record("long-bottom");
    await page.goto(`${origin}/library/${id(8)}`); await profile("Summon template");
    await page.getByText('<script>window.compromised=true</script><img src=x onerror="alert(1)">', { exact: true }).waitFor();
    assert.equal(await page.getByText("Campaign shared", { exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => Boolean(window.compromised)), false); assert.equal(await page.locator("img").count(), 0);
    await record("escaped-shared");
    for (const scenario of ["empty", "malformed", "denied"]) {
      await page.goto(`${origin}/library?category=companions&scenario=${scenario}`);
      if (scenario === "denied") await page.getByRole("alert").waitFor();
      else await page.getByRole("heading", { name: "Companions", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: /Original Workshop Companion/ }).count(), 0);
      if (scenario === "malformed") assert.match(await page.getByRole("status").innerText(), /rejected without altering its effects/);
      if (scenario === "denied") assert.match(await page.getByRole("alert").innerText(), /No companion data was delivered/);
      await record(scenario);
    }
    await context.close(); activePage = undefined;
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(unexpectedRequests, []);
  assert.ok(diagnostics.every(text => text === "[content-definitions] Companion template requires explicit empty effects and a bounded version"));
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
let finalBindings = null;
try { finalBindings = await rebindCompanionInputs(root, manifestPath, processes.receipt, bundle.metafile, captured, production.artifacts); }
catch (error) { failure ??= error; }
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false, persistence: "unavailable", simulatedAuth: true,
  artifacts: production.artifacts, finalBindings, taskProcess, browserProcess, resourcesBefore, resourcesAfter: processes.resources(), portClosed, browserPortClosed, browserExited,
  evidence, screenshots, fontEvidence, assetRequests, pageErrors, blockedRequests, unexpectedRequests, diagnostics, failure: failure?.message ?? null,
  limits: "Actual canonical companion parser and Library browser/detail/profile; original fixtures. Auth/entitlements/queries/Next native links and failed-read alert simulated. No SQL, Data API role proof, catalog write, real sharing, private instance, persistence, eligibility, transformation, summoning, gameplay, server page or authenticated Next shell. Hash-bound production CSS/fonts and all bundled project bytes; no fallback CSS. Viewport screenshots plus long-profile end show reachability, not a full-page export." }, null, 2));
finished = true; if (process.connected) process.disconnect();
assert.ok(portClosed && browserPortClosed && browserExited, "Task-owned private resources must be gone");
if (failure) throw failure;
console.log(JSON.stringify({ checks: evidence.length, screenshots: screenshots.length, portClosed, browserPortClosed, browserExited }));
