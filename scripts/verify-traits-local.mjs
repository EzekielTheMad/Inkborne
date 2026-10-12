/** Source preparation only until review, fresh clean root build and explicit UI release.
 * npm run test:e2e -- --config e2e/local-traits/playwright.config.ts
 * Actions/rows/navigation are simulated. No Next server, fallback CSS, env or provider writes.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { bindTraitProjectInputs, loadTraitProductionAssets, traitOfflinePlugin, traitProjectInputPlugin } from "./trait-production-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "traits-local");
const startedAt = new Date().toISOString();
let browser, browserServer, browserProcess, browserControlPort, activePage, failure, stopping = false, finished = false;
function stop() {
  if (finished) return;
  stopping = true; failure = new Error("Trait harness interrupted by its owning test worker");
  void browser?.close().catch(() => {});
}
process.on("message", message => { if (message?.type === "stop") stop(); });
process.on("disconnect", stop);
await fs.mkdir(output, { recursive: true });
const taskProcess = { pid: process.pid, parentPid: process.ppid, command: "node scripts/verify-traits-local.mjs", cwd: root, startTime: startedAt, listeningPort: null };
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
const manifestFlag = process.argv.indexOf("--artifact-manifest");
if (manifestFlag !== -1) assert.ok(process.argv[manifestFlag + 1], "--artifact-manifest requires a path");
const manifestPath = manifestFlag === -1 ? path.join(output, "production-artifacts.json") : path.resolve(process.argv[manifestFlag + 1]);
const { assets, cssUrls, htmlClassName, artifacts } = await loadTraitProductionAssets(root, manifestPath);
const capturedInputs = new Map();
const bundle = await build({ absWorkingDir: root, entryPoints: [path.join(root, "e2e/local-traits/fixture.tsx")], outfile: path.join(output, "fixture.js"),
  bundle: true, metafile: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [traitOfflinePlugin(root), traitProjectInputPlugin(root, capturedInputs)] });
Object.assign(artifacts, await bindTraitProjectInputs(root, bundle.metafile, capturedInputs, artifacts));
await fs.writeFile(path.join(output, "bundle-metafile.json"), JSON.stringify(bundle.metafile, null, 2));
await fs.writeFile(path.join(output, "bundle-inputs.json"), JSON.stringify({ dependencyLockSha256: artifacts.dependencyLockSha256,
  bundledProjectInputs: artifacts.bundledProjectInputs, syntheticInputs: artifacts.syntheticInputs, metafileSha256: artifacts.metafileSha256 }, null, 2));
assert.equal(stopping, false, "Trait harness interrupted during preparation");
const evidence = [], screenshots = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], fontEvidence = [], layoutSamples = [];
const reloads = new Map();
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") { unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(405).end(); return; }
    if (assets.has(url.pathname)) {
      const asset = assets.get(url.pathname); assetRequests.push({ path: url.pathname, sha256: asset.sha256, bytes: asset.bytes.length });
      response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : url.pathname.endsWith(".woff2") ? "font/woff2" : "application/octet-stream"); response.end(asset.bytes); return;
    }
    if (url.pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); return; }
    if (url.pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    if (url.pathname === "/") {
      const key = `${url.searchParams.get("case")}:${url.searchParams.get("size")}`;
      const count = (reloads.get(key) ?? 0) + 1; reloads.set(key, count);
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><html lang="en" class="${htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline trait form</title>${cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><div id="root"></div><script>window.traitReloadCount=${count}</script><script src="/fixture.js"></script></body></html>`); return;
    }
    unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(404).end();
  } catch (error) { pageErrors.push(`Local fixture server: ${error.message}`); response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, origin = `http://127.0.0.1:${port}`;
taskProcess.listeningPort = port;
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
console.log(JSON.stringify({ taskProcess, productionSource: artifacts.sourceCommit, buildIdSha256: artifacts.buildIdSha256 }));
process.send?.({ type: "process", taskProcess });
const scenarios = ["create-scalar", "create-blank", "create-zero", "edit-safe", "edit-locked", "create-pending", "create-invalid",
  "create-rejected", "create-malformed", "create-uncertain", "create-saved", "create-navigation-failure", "edit-conflict", "edit-uncertain"];
const capture = new Set(["create-scalar", "create-zero", "edit-safe", "edit-locked", "create-invalid", "create-rejected", "create-navigation-failure", "edit-conflict"]);
async function calls(page) { return page.evaluate(() => window.traitHarness.calls); }
async function nav(page) { return page.evaluate(() => window.traitHarness.navigation); }
async function draft(page) { return Promise.all([page.getByLabel("Name", { exact: true }).inputValue(), page.getByLabel("Description", { exact: true }).inputValue(), page.getByLabel("Uses", { exact: true }).inputValue(), page.getByLabel("Recovery", { exact: true }).inputValue()]); }
async function layout(page, size, scenario) {
  const sample = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll('form input:not([type="hidden"]),form textarea,form select,form button,form a')].map(node => {
      const box = node.getBoundingClientRect(); return { tag: node.tagName, text: node.getAttribute("aria-label") ?? node.textContent?.trim(), left: box.left, right: box.right, width: box.width, height: box.height };
    }).filter(node => node.width > 0 && node.height > 0);
    return { viewport, documentWidth: document.documentElement.scrollWidth, controls };
  });
  layoutSamples.push({ size, scenario, ...sample });
  if (sample.documentWidth > sample.viewport + 1 || sample.controls.some(node => node.left < -1 || node.right > sample.viewport + 1)) await fs.writeFile(path.join(output, "failure-layout.json"), JSON.stringify({ size, scenario, ...sample }, null, 2));
  assert.equal(sample.documentWidth <= sample.viewport + 1, true, "Horizontal body overflow");
  assert.ok(sample.controls.every(node => node.left >= -1 && node.right <= sample.viewport + 1), "Form controls must fit the real viewport");
}
async function keyboardReach(page, locator) {
  await page.getByRole("heading", { name: "Offline private trait form" }).click();
  for (let count = 0; count < 30; count++) {
    if (await locator.evaluate(node => node === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw Error("Expected form control/link was not keyboard reachable");
}
async function loadedFonts(page) {
  return page.evaluate(async () => {
    const results = [];
    for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (!value) throw Error(`Missing production font class/variable ${variable}`);
      const family = value.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      for (const style of variable === "--font-eb-garamond" ? ["normal", "italic"] : ["normal"]) {
        const query = `${style} 400 16px "${family}"`;
        const faces = await document.fonts.load(query, "Inkborne Trait Memory");
        if (!faces.length || !document.fonts.check(query, "Inkborne Trait Memory") || !faces.some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.style === style && face.status === "loaded")) throw Error(`Production font did not load: ${family} ${style}`);
        results.push({ variable, family, style, loadedFaces: faces.map(face => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })) });
      }
    }
    await document.fonts.ready; return results;
  });
}
try {
  assert.equal(stopping, false);
  browserServer = await chromium.launchServer({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, host: "127.0.0.1" });
  const child = browserServer.process(); browserControlPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { pid: child.pid, parentPid: process.pid, command: child.spawnargs, cwd: root, startTime: new Date().toISOString(), listeningPort: browserControlPort };
  await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess, browserProcess }, null, 2));
  console.log(JSON.stringify({ browserProcess }));
  browser = await chromium.connect(browserServer.wsEndpoint());
  assert.equal(stopping, false);
  for (const [size, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport }); context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || request.method() !== "GET") { blockedRequests.push({ url: request.url(), method: request.method() }); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page; page.on("pageerror", error => pageErrors.push(error.message));
    for (const scenario of scenarios) {
      await page.goto(`${origin}/?case=${scenario}&size=${size}`);
      await page.getByLabel("Name", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.innerWidth), viewport.width, "Viewport meta must preserve actual mobile CSS width");
      const fontResults = await loadedFonts(page); fontEvidence.push({ size, scenario, fonts: fontResults });
      const edit = scenario.startsWith("edit-");
      const submit = page.getByRole("button", { name: edit ? "Save new version" : "Create private trait", exact: true });
      if (!edit) {
        await page.getByLabel("Name", { exact: true }).fill("Original Lantern Memory");
        await page.getByLabel("Description", { exact: true }).fill("Original rights-safe synthetic trait description.");
        const uses = scenario === "create-blank" ? "" : scenario === "create-zero" ? "0" : scenario === "create-invalid" ? "-1" : "2";
        await page.getByLabel("Uses", { exact: true }).fill(uses);
        await page.getByLabel("Recovery", { exact: true }).selectOption(uses === "" || uses === "0" ? "" : "short rest");
      } else if (scenario === "edit-locked") {
        assert.equal(await page.getByLabel("Uses", { exact: true }).isDisabled(), true);
        assert.equal(await page.getByLabel("Recovery", { exact: true }).isDisabled(), true);
        assert.equal(await page.getByText(/Uses by level 1–20/).count(), 1);
        assert.equal(await page.getByText(/currently recover on a long rest/).count(), 1);
        await page.getByLabel("Description", { exact: true }).fill("Revised metadata only; legacy resource remains locked.");
      } else if (scenario === "edit-safe") {
        assert.equal(await page.getByLabel("Uses", { exact: true }).inputValue(), "9007199254740991");
      } else await page.getByLabel("Name", { exact: true }).fill("Retained edit draft");
      const originalDraft = await draft(page);
      await layout(page, size, `${scenario}:before`);
      await keyboardReach(page, submit); await page.keyboard.press("Enter");
      if (scenario === "create-pending") {
        await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
        await page.evaluate(() => document.querySelector("form").requestSubmit());
        assert.equal((await calls(page)).length, 1);
        await page.evaluate(() => window.traitHarness.releasePending());
      }
      if (scenario === "create-invalid") {
        await page.getByRole("alert").waitFor();
        await page.waitForFunction(() => document.activeElement?.id === "trait-usages");
        assert.equal(await page.getByLabel("Uses", { exact: true }).getAttribute("aria-invalid"), "true");
        assert.equal(await page.getByLabel("Uses", { exact: true }).evaluate(node => node === document.activeElement), true);
        assert.equal((await calls(page))[0].mapped.success, false); assert.deepEqual(await nav(page), []);
        await page.evaluate(() => document.querySelector("form").reset()); assert.deepEqual(await draft(page), originalDraft);
      } else if (["create-rejected", "create-malformed", "create-uncertain"].includes(scenario)) {
        await page.getByRole("alert").waitFor(); assert.equal(await submit.isDisabled(), true);
        await page.evaluate(() => document.querySelector("form").reset()); assert.deepEqual(await draft(page), originalDraft);
        assert.deepEqual(await nav(page), []); await layout(page, size, `${scenario}:uncertain`);
        const check = page.getByRole("link", { name: "Check Homebrew", exact: true });
        await keyboardReach(page, check); await page.keyboard.press("Enter");
        await page.getByRole("status", { name: "Simulated Homebrew check" }).waitFor();
        assert.equal(await page.evaluate(() => window.traitHarness.homebrewChecks), 1);
        assert.equal((await calls(page)).length, 1);
        const acknowledge = page.getByRole("button", { name: "I checked Homebrew; allow another create", exact: true });
        await keyboardReach(page, acknowledge); await page.keyboard.press("Enter");
        await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
        assert.equal(await submit.isEnabled(), true); assert.equal((await calls(page)).length, 1);
        assert.equal(await page.getByRole("alert").count(), 1); assert.deepEqual(await draft(page), originalDraft);
        if (scenario === "create-rejected") {
          await submit.click(); await page.waitForFunction(() => window.traitHarness.calls.length === 2);
          await page.waitForFunction(() => document.querySelector('button[type="submit"]').disabled);
          assert.equal(await page.evaluate(() => window.traitHarness.simulatedInsertCount), 2);
          assert.notEqual((await calls(page))[0].simulatedId, (await calls(page))[1].simulatedId);
          assert.deepEqual((await nav(page)).filter(item => item.kind === "router"), []);
        }
      } else if (scenario === "edit-conflict" || scenario === "edit-uncertain") {
        await page.getByRole("alert").waitFor(); assert.equal(await submit.isDisabled(), true);
        await page.evaluate(() => document.querySelector("form").reset()); assert.deepEqual(await draft(page), originalDraft);
        assert.deepEqual(await nav(page), []);
      } else {
        await page.getByRole("status").filter({ hasText: "Trait saved." }).waitFor();
        const actionCalls = await calls(page); assert.equal(actionCalls.length, 1); assert.equal(actionCalls[0].mapped.success, true);
        assert.deepEqual(await nav(page), [{ kind: "router", href: `/homebrew?${edit ? "updated" : "created"}=${actionCalls[0].simulatedId ?? "33333333-3333-4333-8333-333333333331"}` }]);
        assert.equal(await submit.isDisabled(), true);
        if (scenario === "create-blank") assert.equal(actionCalls[0].mapped.data.resource.usages, undefined);
        if (scenario === "create-zero") assert.equal(actionCalls[0].mapped.data.resource.usages, 0);
        if (scenario === "edit-safe") assert.equal(actionCalls[0].mapped.data.resource.usages, Number.MAX_SAFE_INTEGER);
        if (scenario === "edit-locked") {
          assert.equal(Object.hasOwn(actionCalls[0].fields, "usages"), false); assert.equal(Object.hasOwn(actionCalls[0].fields, "recovery"), false);
          assert.equal(actionCalls[0].mapped.data.resource, undefined);
        }
        await page.evaluate(() => document.querySelector("form").requestSubmit()); assert.equal((await calls(page)).length, 1);
      }
      await layout(page, size, `${scenario}:after`);
      if (capture.has(scenario)) { const name = `${size}-${scenario}.png`; await page.screenshot({ path: path.join(output, name), fullPage: true }); screenshots.push(name); }
      const beforeReload = { calls: await calls(page), navigation: await nav(page), draft: await draft(page) };
      if (scenario === "edit-conflict" || scenario === "edit-uncertain") {
        const reload = page.getByRole("button", { name: "Reload latest", exact: true }); await keyboardReach(page, reload);
        await Promise.all([page.waitForEvent("load"), page.keyboard.press("Enter")]);
        await page.getByLabel("Name", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Simulated latest trait");
        assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "4");
        assert.equal(await page.getByLabel("Uses", { exact: true }).isDisabled(), true);
        assert.equal(await page.getByLabel("Recovery", { exact: true }).inputValue(), "dawn");
        assert.equal(await page.getByRole("button", { name: "Save new version", exact: true }).isEnabled(), true);
        assert.equal((await calls(page)).length, 0); await loadedFonts(page); await layout(page, size, `${scenario}:reload`);
      }
      evidence.push({ size, scenario, passed: true, ...beforeReload });
    }
    await context.close();
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRequests, []); assert.deepEqual(unexpectedRequests, []);
  assert.ok(assetRequests.some(request => /\.(woff2?|ttf|otf)$/.test(request.path)), "Production font assets must actually be requested");
} catch (error) {
  failure = error;
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(output, "failure-dom.json"), JSON.stringify(await activePage.evaluate(() => ({ text: document.body.innerText, focused: document.activeElement?.outerHTML, calls: window.traitHarness?.calls, navigation: window.traitHarness?.navigation })).catch(() => ({})), null, 2));
  }
} finally {
  try { if (browser) await browser.close(); } catch (error) { failure ??= error; }
  try { if (browserServer) await browserServer.close(); } catch (error) { failure ??= error; }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
function closed(targetPort) {
  if (!targetPort) return Promise.resolve(true);
  return new Promise(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port: targetPort }); socket.setTimeout(2_000, () => { socket.destroy(); resolve(false); });
    socket.once("connect", () => { socket.destroy(); resolve(false); }); socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
  });
}
const portClosed = await closed(port), browserPortClosed = await closed(browserControlPort), browserExited = !browserServer || browserServer.process().exitCode !== null;
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false, simulatedActions: true, simulatedNavigation: true,
  artifacts, taskProcess, browserProcess, portClosed, browserPortClosed, browserExited, evidence, screenshots, pageErrors, blockedRequests, unexpectedRequests, assetRequests, fontEvidence, layoutSamples,
  failure: failure?.message ?? null, limits: "Actual TraitForm/mapper and native browser reset/reload; simulated responses/owned list/router/links, no auth/DAL/SQL/real attachment. Check Homebrew stub keeps form mounted; not real Next navigation or durable draft recovery. CSS/fonts are real verified root production output; fixture bundle/layout is not the authenticated Next shell." }, null, 2));
finished = true; if (process.connected) process.disconnect();
assert.equal(portClosed, true); assert.equal(browserPortClosed, true); assert.equal(browserExited, true);
if (failure) throw failure;
console.log(JSON.stringify({ passed: evidence.length, screenshots: screenshots.length, portClosed, browserPortClosed, browserExited, output }));
