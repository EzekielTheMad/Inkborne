/** Source preparation only until review, fresh clean root build and explicit UI release.
 * npm run test:e2e -- --config e2e/local-asi-parity/playwright.config.ts
 * Actions/rows/navigation are simulated. No Next server, fallback CSS, env or provider writes.
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
import { asiScenarios, executeAsiScenario } from "./asi-parity-scenarios.mjs";
import { asiOfflinePlugin } from "./asi-parity-offline-boundaries.mjs";
import { bindAsiProjectInputs, loadAsiProductionAssets, loadAsiSeedSchema, asiProjectInputPlugin } from "./asi-parity-production-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "asi-parity-local");
const startedAt = new Date().toISOString();
function osIdentity(pid, parentPid) {
  assert.ok(Number.isInteger(pid) && Number.isInteger(parentPid));
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}';if(!$p -or $p.ParentProcessId -ne ${parentPid} -or !$p.CreationDate){exit 3};@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;command=$p.CommandLine;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`], {encoding:"utf8",windowsHide:true});
  const identity=JSON.parse(output);assert.equal(identity.pid,pid);assert.equal(identity.parentPid,parentPid);
  assert.match(identity.birthUtc,/^\d{4}-\d{2}-\d{2}T.*Z$/);assert.ok(identity.command);return identity;
}
function resourceSnapshot() {
  return JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    `$p=@(Get-Process);@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$p.Count;workingSetBytes=($p|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($p|Measure-Object CPU -Sum).Sum;listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}|ConvertTo-Json -Compress`], {encoding:"utf8",windowsHide:true}));
}
let browser, browserServer, browserProcess, browserControlPort, activePage, failure, stopping = false, finished = false;
function stop() {
  if (finished) return;
  stopping = true; failure = new Error("Asi harness interrupted by its owning test worker");
  void browser?.close().catch(() => {});
}
process.on("message", message => { if (message?.type === "stop") stop(); });
process.on("disconnect", stop);
await fs.mkdir(output, { recursive: true });
const taskProcess = { ...osIdentity(process.pid, process.ppid), cwd: root, startTime: startedAt, listeningPort: null };
await fs.writeFile(path.join(output, "process-start.json"), JSON.stringify({ taskProcess }, null, 2));
const manifestFlag = process.argv.indexOf("--artifact-manifest");
if (manifestFlag !== -1) assert.ok(process.argv[manifestFlag + 1], "--artifact-manifest requires a path");
const manifestPath = manifestFlag === -1 ? path.join(output, "production-artifacts.json") : path.resolve(process.argv[manifestFlag + 1]);
const { assets, cssUrls, htmlClassName, artifacts } = await loadAsiProductionAssets(root, manifestPath);
const seedSchema = await loadAsiSeedSchema(root, artifacts);
const capturedInputs = new Map(), cssModuleMaps = [];
const bundle = await build({ absWorkingDir: root, entryPoints: [path.join(root, "e2e/local-asi-parity/fixture.tsx")], outfile: path.join(output, "fixture.js"),
  bundle: true, metafile: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [asiOfflinePlugin(root), asiProjectInputPlugin(root, capturedInputs, assets, cssModuleMaps)] });
assert.ok(!Object.keys(bundle.metafile.outputs).some(file => file.endsWith(".css")), "No fixture/fallback stylesheet may be compiled");
Object.assign(artifacts, await bindAsiProjectInputs(root, bundle.metafile, capturedInputs, artifacts));
await fs.writeFile(path.join(output, "bundle-metafile.json"), JSON.stringify(bundle.metafile, null, 2));
await fs.writeFile(path.join(output, "bundle-inputs.json"), JSON.stringify({ dependencyLockSha256: artifacts.dependencyLockSha256,
  bundledProjectInputs: artifacts.bundledProjectInputs, syntheticInputs: artifacts.syntheticInputs, metafileSha256: artifacts.metafileSha256 }, null, 2));
assert.equal(stopping, false, "Asi harness interrupted during preparation");
const evidence = [], screenshots = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [], fontEvidence = [], layoutSamples = [];
const resourcesBefore = resourceSnapshot();
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
      response.end(`<!doctype html><html lang="en" class="${htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline earned ASI parity</title>${cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><div id="root"></div><script>window.asiSeedSchema=${JSON.stringify(seedSchema).replace(/</g, "\\u003c")};window.asiReloadCount=${count}</script><script src="/fixture.js"></script></body></html>`); return;
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
async function layout(page, size, scenario) {
  const sample = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select,button,a')].map(node => {
      const box = node.getBoundingClientRect();
      let left = Math.max(0, box.left), right = Math.min(viewport, box.right), scrollContained = false;
      const clippingAncestors = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
          const clip = parent.getBoundingClientRect(); scrollContained = true;
          left = Math.max(left, clip.left); right = Math.min(right, clip.right);
          clippingAncestors.push({ tag: parent.tagName, overflowX: style.overflowX, left: clip.left, right: clip.right });
        }
      }
      return { tag: node.tagName, text: node.getAttribute("aria-label") ?? node.textContent?.trim(), left: box.left, right: box.right,
        width: box.width, height: box.height, scrollContained, clippingAncestors, intersectsCurrentViewport: right > left };
    }).filter(node => node.width > 0 && node.height > 0);
    return { viewport, documentWidth: document.documentElement.scrollWidth, controls };
  });
  layoutSamples.push({ size, scenario, ...sample });
  if (sample.documentWidth > sample.viewport + 1 || sample.controls.some(node => !node.scrollContained && (node.left < -1 || node.right > sample.viewport + 1))) await fs.writeFile(path.join(output, "failure-layout.json"), JSON.stringify({ size, scenario, ...sample }, null, 2));
  assert.equal(sample.documentWidth <= sample.viewport + 1, true, "Horizontal body overflow");
  assert.ok(sample.controls.every(node => node.scrollContained || (node.left >= -1 && node.right <= sample.viewport + 1)), "Non-scroll-contained controls must fit the real viewport; scroll-snap panels are recorded separately");
}
async function keyboardReach(page, locator) {
  await page.getByRole("heading", { name: "Offline earned ASI parity" }).click();
  for (let count = 0; count < 100; count++) {
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
        const faces = await document.fonts.load(query, "Inkborne ASI Parity");
        if (!faces.length || !document.fonts.check(query, "Inkborne ASI Parity") || !faces.some(face => face.family.replace(/^['"]|['"]$/g, "") === family && face.style === style && face.status === "loaded")) throw Error(`Production font did not load: ${family} ${style}`);
        results.push({ variable, family, style, loadedFaces: faces.map(face => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })) });
      }
    }
    await document.fonts.ready; return results;
  });
}
try {
 assert.equal(stopping,false);
 browserServer=await chromium.launchServer({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,host:"127.0.0.1"});
 const child=browserServer.process();browserControlPort=Number(new URL(browserServer.wsEndpoint()).port);
 browserProcess={...osIdentity(child.pid,process.pid),spawnargs:child.spawnargs,cwd:root,startTime:new Date().toISOString(),listeningPort:browserControlPort};
 await fs.writeFile(path.join(output,"process-start.json"),JSON.stringify({taskProcess,browserProcess},null,2));
 console.log(JSON.stringify({browserProcess}));browser=await chromium.connect(browserServer.wsEndpoint());assert.equal(stopping,false);
 for(const [size,viewport] of [["desktop",{width:1280,height:900}],["mobile",{width:390,height:844}]]){
  const context=await browser.newContext({viewport});context.setDefaultTimeout(10000);
  await context.route("**/*",route=>{const request=route.request();if(new URL(request.url()).origin!==origin||request.method()!=="GET"){blockedRequests.push({url:request.url(),method:request.method()});return route.abort();}return route.continue();});
  for(const scenario of asiScenarios){
   const page=await context.newPage();activePage=page;page.on("pageerror",error=>pageErrors.push(error.message));
   await page.goto(`${origin}/?case=${scenario}&size=${size}`);await page.getByRole("heading",{name:"Offline earned ASI parity"}).waitFor();
   assert.equal(await page.evaluate(()=>window.innerWidth),viewport.width,"Actual mobile viewport preserved");
   fontEvidence.push({size,scenario,fonts:await loadedFonts(page)});
   const result=await executeAsiScenario(page,scenario,{layout,keyboardReach,size,capture:async(stage="final")=>{
    const name=`${size}-${scenario}-${stage}.png`;await page.screenshot({path:path.join(output,name),fullPage:true});screenshots.push(name);
   }});
   evidence.push({size,scenario,passed:true,...result});
   await page.close({runBeforeUnload:false});
  }
  await context.close();
 }
 assert.deepEqual(pageErrors,[]);assert.deepEqual(blockedRequests,[]);assert.deepEqual(unexpectedRequests,[]);
 assert.ok(assetRequests.some(request=>/\.(woff2?|ttf|otf)$/.test(request.path)),"Actual production fonts requested");
}catch(error){
 failure=error;
 if(activePage&&!activePage.isClosed()){
  await activePage.screenshot({path:path.join(output,"failure.png"),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(output,"failure-dom.json"),JSON.stringify(await activePage.evaluate(()=>({text:document.body.innerText,focused:document.activeElement?.outerHTML,calls:window.asiHarness?.calls,journal:window.asiHarness?.journal, snapshot:window.asiHarness?.snapshot,navigation:window.asiHarness?.navigation})).catch(()=>({})),null,2));
 }
}finally{
 try{if(browser)await browser.close();}catch(error){failure??=error;}
 try{if(browserServer)await browserServer.close();}catch(error){failure??=error;}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
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
  artifacts, cssModuleMaps, taskProcess, browserProcess, resourcesBefore, resourcesAfter:resourceSnapshot(), portClosed, browserPortClosed, browserExited, evidence, screenshots, pageErrors, blockedRequests, unexpectedRequests, assetRequests, fontEvidence, layoutSamples,
  failure: failure?.message ?? null, limits: "Actual canonical parsers, evaluator, earned resolver, builders/StatPreview, browser-memory draft store and SheetPanel/provider desktop/mobile/HP/weapon/spell/rest/print consumers; original synthetic pins and modeled complete grant DTO. Auth subscriptions, SQL/action responses, persistence/CAS, navigation and print invocation are explicitly simulated and journaled. Native RNG executes normally; only critical-hit accepted result may be explicitly modeled after the real roll, with both results recorded. No hosted credentials/SQL/RPC authority/receipt proof or authenticated Next shell. Production CSS/fonts and print CSS class map are hash-verified root build output, no fallback styles. Browser native reset/reload can lose page-local fixture state." }, null, 2));
finished = true; if (process.connected) process.disconnect();
assert.equal(portClosed, true); assert.equal(browserPortClosed, true); assert.equal(browserExited, true);
if (failure) throw failure;
console.log(JSON.stringify({ passed: evidence.length, screenshots: screenshots.length, portClosed, browserPortClosed, browserExited, output }));
