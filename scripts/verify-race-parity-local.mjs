/** Dedicated offline parity acceptance. Requires an explicit completed root
 * production build receipt; no CSS compilation, Next server, env or hosted setup.
 * Run only after root releases UI: npm run test:e2e -- --config e2e/local-race-parity/playwright.config.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";
import { loadProductionStyles, staticAssetPath, offlineParityPlugin } from "./race-parity-browser-support.mjs";

const startedAt = new Date().toISOString();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "race-parity-local");
const receiptPath = path.join(root, "test-results", "race-parity-build.json");
const production = await loadProductionStyles(receiptPath);
const productionHead = execFileSync("git", ["-C", production.buildRoot, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
assert.equal(productionHead, production.sourceSha, "Production root HEAD must match the explicit build receipt.");
await fs.mkdir(output, { recursive: true });
const seed = await fs.readFile(path.join(root, "supabase", "seed.sql"), "utf8");
const primaryJson = seed.slice(seed.indexOf("'dnd-5e-2014'")).match(/'(\{[\s\S]*?\})'::jsonb/)?.[1];
assert.ok(primaryJson, "Actual canonical 2014 system schema required.");
const schema = JSON.parse(primaryJson.replace(/''/g, "'"));
await build({ entryPoints: [path.join(root, "e2e/local-race-parity/fixture.tsx")], outfile: path.join(output, "fixture.js"),
  bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [offlineParityPlugin(root)] });

const blockedWrites = [];
const unknownLocalRequests = [];
const pageErrors = [];
const blockedRemoteRequests = [];
const evidence = [];
const screenshots = [];
const styleLinks = production.styles.map(style => `<link rel="stylesheet" href="/_next/static/${style.relativePath}">`).join("");
const html = `<!doctype html><html lang="en" class="dark h-full antialiased ${production.fontClasses.join(" ")}"><head><title>Offline race parity</title>${styleLinks}</head>`
  + `<body class="min-h-full flex flex-col font-sans"><div id="root"></div><script>window.raceParitySchema=${JSON.stringify(schema).replace(/</g, "\\u003c")}</script><script src="/fixture.js"></script></body></html>`;
const server = http.createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      blockedWrites.push({ method: request.method, path: request.url }); response.writeHead(405); response.end(); return;
    }
    const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (requestPath === "/") { response.setHeader("Content-Type", "text/html"); response.end(request.method === "HEAD" ? "" : html); return; }
    if (requestPath === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); return; }
    if (requestPath === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    const asset = await staticAssetPath(production.staticRoot, requestPath);
    if (asset) { response.setHeader("Content-Type", asset.endsWith(".css") ? "text/css" : asset.endsWith(".woff2") ? "font/woff2" : "application/octet-stream"); response.end(await fs.readFile(asset)); return; }
    unknownLocalRequests.push(requestPath); response.writeHead(404); response.end();
  } catch (error) { pageErrors.push(`Local fixture server: ${error.message}`); response.writeHead(500); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid, command: "node scripts/verify-race-parity-local.mjs",
  cwd: root, startTime: startedAt, listeningPort: port };
console.log(JSON.stringify({ taskProcess, productionBuildId: production.buildId, productionSourceSha: production.sourceSha }));
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
let browser;
let browserServer;
let browserProcess;
let browserControlPort;
let failure;
const cases = [
  ["imported", 12, 14, false], ["legacy", 14, 16, true], ["scores-only", 12, 14, false],
  ["manual", 14, 14, false], ["conditional-inactive", 12, 14, false], ["conditional-active", 14, 14, false],
  ["formula", 14, 14, false], ["zero", 12, 14, false], ["asi", 12, 14, false], ["raw-subrace", 12, 14, false],
];
const capture = new Set(["imported:Race", "legacy:Abilities", "legacy:Class", "legacy:Sheet notice", "scores-only:Sheet notice", "zero:Sheet notice", "asi:Abilities", "raw-subrace:Abilities"]);
async function previewScore(section, abbr) {
  const preview = section.getByText("Stats", { exact: true }).locator("..");
  return Number(await preview.getByText(abbr, { exact: true }).locator("..").locator("p").nth(1).textContent());
}
async function abilityTotal(section, name) {
  const card = section.getByRole("spinbutton", { name: `${name} score`, exact: true }).locator('xpath=ancestor::*[@data-slot="card"]');
  return Number(await card.getByText("Total", { exact: true }).locator("..").locator("p").nth(1).textContent());
}
try {
  const browserStart = new Date().toISOString();
  browserServer = await chromium.launchServer({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, host: "127.0.0.1" });
  const child = browserServer.process();
  browserControlPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { pid: child.pid, parentPid: process.pid, command: child.spawnargs, cwd: root, startTime: browserStart, listeningPort: null };
  console.log(JSON.stringify({ browserProcess, browserControlPort }));
  await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess, browserProcess, browserControlPort }, null, 2));
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [size, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method())) { blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname }); return route.abort(); }
      if (new URL(request.url()).origin !== origin) { blockedRemoteRequests.push(request.url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(origin);
    for (const [scenario, strength, constitution, notice] of cases) {
      await page.getByLabel("Fixture scenario", { exact: true }).selectOption(scenario);
      for (const view of ["Race", "Abilities", "Class", "Sheet notice"]) {
        await page.getByLabel("Fixture view", { exact: true }).selectOption(view);
        await page.waitForFunction(({ scenario, view }) => window.fixture.proof?.scenario === scenario && window.fixture.proof?.view === view, { scenario, view });
        const section = page.getByRole("region", { name: `Actual ${view}`, exact: true });
        await section.waitFor();
        const proof = await page.evaluate(() => window.fixture.proof);
        assert.equal(proof.strength, strength); assert.equal(proof.constitution, constitution);
        assert.equal(proof.version, 1); assert.equal(proof.snapshotUnchanged, true);
        assert.equal(await previewScore(section, "STR"), strength);
        assert.equal(await previewScore(section, "CON"), constitution);
        assert.equal(await section.getByText(/Both are retained, so totals/).count(), notice ? 1 : 0);
        if (view === "Abilities") {
          assert.equal(await abilityTotal(section, "Strength"), scenario === "asi" ? strength + 2 : strength);
          assert.equal(await abilityTotal(section, "Constitution"), constitution);
          assert.equal(await abilityTotal(section, "Charisma"), scenario === "raw-subrace" ? 12 : 10);
          if (scenario === "asi") assert.equal(await section.getByText(/Stats preview and live sheet currently omit that addition/).count(), 1);
          if (scenario === "raw-subrace") {
            assert.equal(await section.getByText(/Stats preview and live sheet omit those score-only bonuses/).count(), 1);
            assert.equal(proof.canonicalSubraceScoresMissing, true); assert.equal(proof.rawSubraceProjection, true);
          }
        }
        if (view === "Class") {
          const add = section.getByRole("button", { name: strength >= 13 ? /Add a class · 17 levels remaining/ : /Add a class · Locked/ });
          assert.equal(await add.getAttribute("aria-disabled"), strength >= 13 ? null : "true");
        }
        assert.equal(await page.evaluate(() => JSON.stringify(window.fixture.model.pin) === window.fixture.pinBaseline && JSON.stringify(window.fixture.model.snapshot) === window.fixture.snapshotBaseline), true);
        assert.deepEqual(await page.evaluate(() => window.fixture.writes), []);
        assert.deepEqual(await page.evaluate(() => window.fixture.navigation), []);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        if (capture.has(`${scenario}:${view}`)) {
          await page.evaluate(() => document.fonts.ready);
          const name = `${size}-${scenario}-${view.toLowerCase().replace(/ /g, "-")}.png`;
          await page.screenshot({ path: path.join(output, name), fullPage: true }); screenshots.push(name);
        }
        evidence.push({ size, scenario, view, strength, constitution, legacyNotice: notice, passed: true,
          rawSubraceProjection: scenario === "raw-subrace", sidebarVisible: view === "Sheet notice" || size === "desktop" });
      }
    }
    await context.close();
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedWrites, []); assert.deepEqual(blockedRemoteRequests, []); assert.deepEqual(unknownLocalRequests, []);
} catch (error) {
  failure = error.stack ?? String(error);
  if (browser) for (const [index, context] of browser.contexts().entries()) for (const [pageIndex, page] of context.pages().entries()) {
    const name = `failure-${index}-${pageIndex}.png`;
    await page.screenshot({ path: path.join(output, name), fullPage: true }).then(() => screenshots.push(name)).catch(() => {});
  }
} finally {
  try { if (browser) await browser.close(); } catch (error) { failure ??= String(error); }
  try { if (browserServer) await browserServer.close(); } catch (error) { failure ??= String(error); }
  await new Promise(resolve => server.close(resolve));
}
function closed(target) { return target === undefined ? Promise.resolve(true) : new Promise(resolve => {
  const socket = net.connect({ host: "127.0.0.1", port: target });
  socket.once("connect", () => { socket.destroy(); resolve(false); });
  socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
}); }
const portClosed = await closed(port);
const browserPortClosed = await closed(browserControlPort);
const result = { simulated: true, liveSupabase: false, stylesheetSource: "root-production-build", buildRoot: production.buildRoot,
  productionSourceSha: production.sourceSha, buildId: production.buildId, fontClasses: production.fontClasses,
  styles: production.styles.map(({ relativePath, sha256, bytes }) => ({ relativePath, sha256, bytes })),
  taskProcess, browserProcess, browserControlPort, portClosed, browserPortClosed,
  evidence, screenshots, pageErrors, blockedWrites, blockedRemoteRequests, unknownLocalRequests, failure: failure ?? null,
  limits: "Actual builders/StatPreview/shared sheet notice; navigation/draft/persistence stubs. Raw subrace compatibility is an explicit projection, not canonical or hosted acceptance. Mobile builder sidebars remain hidden per product CSS; DOM values and visible shared StatPreview are checked separately." };
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: evidence.length, failure: failure ?? null, portClosed, browserPortClosed, output }));
assert.equal(failure, undefined); assert.equal(portClosed, true); assert.equal(browserPortClosed, true);
