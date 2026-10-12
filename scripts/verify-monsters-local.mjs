/** Preparation only until harness review + root UI release.
 * npm run test:e2e -- --config e2e/local-monsters/playwright.config.ts
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "monsters-local");
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
assert.equal(digest(await fs.readFile(manifest.buildReceipt.path)), manifest.buildReceipt.sha256);
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
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-monsters-fixture.tsx", contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {CompendiumBrowser} from '@/components/compendium/compendium-browser';
    import {CompendiumDetail} from '@/components/compendium/compendium-detail';
    import {parseCompendiumQuery} from '@/lib/compendium/catalog';
    import {parseContentDefinition} from '@/lib/supabase/content-definitions-parser';
    import {monsterDataSchema} from '@/lib/schemas/content-types/monster';
    import {monsterFixtures,monsterNames,monsterEnvelope,monsterOwnerId,monsterSystemId,monsterWithBytes} from '@/tests/fixtures/monsters';
    const ids=['11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'];
    const injection='<script>globalThis.compromised=true</script><img src=x onerror="alert(1)"> javascript:alert(1)';
    const rows=monsterFixtures.map((data,index)=>({...monsterEnvelope(data),id:ids[index],name:monsterNames[index],slug:'original-monster-'+index}));
    rows[2].scope='shared';rows[2].owner_id='77777777-7777-4777-8777-777777777777';rows[2].version=7;
    rows[2].data.actions[1].description=injection;
    rows[2].effects=[{type:'mechanical',stat:'armor_class',op:'add',value:99}];
    const long=monsterWithBytes(62000);long.traits[0].description='é'+long.traits[0].description.slice(1);
    long.traits[0].name='LanternMemory'+'Z'.repeat(107);long.traits[19].description='The final lantern keeps its place.';
    const longBytes=new TextEncoder().encode(JSON.stringify(monsterDataSchema.parse(long))).byteLength;
    rows.push({...monsterEnvelope(long),id:ids[3],name:'ReefMemory'+'W'.repeat(500),slug:'long-original-monster'});
    const parsed=rows.map(row=>{const result=parseContentDefinition(row);if(!result)throw Error('Original fixture must pass canonical parser');return result});
    window.fixture={ids,injection,longBytes,auth:'mocked entitled account',persistence:'unavailable',data:'local canonical fixtures'};
    const params=Object.fromEntries(new URLSearchParams(location.search));
    const query={...parseCompendiumQuery(params),system:monsterSystemId};
    const systems=[{id:monsterSystemId,name:'Original 5e fixture',slug:'fixture-5e',versionLabel:'2014'}];
    let content;
    if(location.pathname.startsWith('/library/')){
      const entry=parsed.find(row=>row.id===location.pathname.split('/').at(-1));
      if(!entry)throw Error('No local fixture for this ID');
      const returnHref=typeof params.returnTo==='string'&&(params.returnTo==='/library'||params.returnTo.startsWith('/library?'))?params.returnTo:'/library?category=monsters';
      content=<CompendiumDetail entry={entry} userId={monsterOwnerId} returnHref={returnHref}/>;
    }else{
      let entries=query.category==='monsters'?parsed:[];
      if(query.q)entries=entries.filter(row=>row.name.toLowerCase().includes(query.q.toLowerCase()));
      if(query.size)entries=entries.filter(row=>row.data.size===query.size);
      if(query.provenance==='mine')entries=entries.filter(row=>row.owner_id===monsterOwnerId);
      if(query.provenance==='shared')entries=entries.filter(row=>row.owner_id!==monsterOwnerId);
      if(query.provenance==='srd')entries=entries.filter(row=>row.source==='srd');
      entries=[...entries].sort((a,b)=>a.name.localeCompare(b.name)*(query.sort==='name-desc'?-1:1));
      content=<CompendiumBrowser systems={systems} query={query} result={{entries,total:entries.length,page:query.page,pageSize:24}} userId={monsterOwnerId}/>;
    }
    createRoot(document.getElementById('root')).render(<><p className='mb-4 text-sm'>Offline component QA: mocked account/data; RLS and persistence unavailable.</p>{content}</>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-next-link-only", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local-link" }));
    builder.onLoad({ filter: /.*/, namespace: "local-link" }, () => ({ loader: "tsx", resolveDir: root, contents:
      "import React from 'react';export default function Link(props){return <a {...props}/>}" }));
  } }],
});

const evidence = [], pageErrors = [], blockedRequests = [], unexpectedRequests = [], assetRequests = [];
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
    if (url.pathname === "/library" || /^\/library\/[a-f0-9-]{36}$/.test(url.pathname)) {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><html lang="en" class="${manifest.htmlClassName}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline original monsters</title>${cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body class="min-h-full flex flex-col font-sans"><main class="px-4 py-6 sm:px-6"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`); return;
    }
    unexpectedRequests.push({ method: request.method, path: url.pathname }); response.writeHead(404).end();
  } catch (error) { pageErrors.push(`Local server: ${error.message}`); response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid, command: "node scripts/verify-monsters-local.mjs", cwd: root, startTime: new Date().toISOString(), listeningPort: port };
console.log(JSON.stringify({ taskProcess, artifacts }));
process.send?.({ type: "process", taskProcess });
const record = (size, check, details = {}) => evidence.push({ size, check, passed: true, ...details });
async function keyboardActivate(page, locator) {
  for (let index = 0; index < 35; index++) {
    if (await locator.evaluate(node => node === document.activeElement)) { await page.keyboard.press("Enter"); return; }
    await page.keyboard.press("Tab");
  }
  throw new Error("Expected link was not keyboard reachable");
}
async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, "Horizontal body overflow");
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
  for (const [size, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport }); context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || request.method() !== "GET") {
        blockedRequests.push({ url: request.url(), method: request.method() }); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page; page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`${origin}/library?category=spells`);
    await page.getByRole("heading", { name: "Library", exact: true }).waitFor();
    await keyboardActivate(page, page.getByRole("link", { name: "Monsters", exact: true }));
    await page.getByLabel("Size", { exact: true }).waitFor(); await layout(page);
    record(size, "keyboard category navigation mounts actual Library and size control");
    await page.getByLabel("Search by name").fill("Cinderlit");
    await page.getByLabel("Access", { exact: true }).selectOption("mine");
    await page.getByLabel("Size", { exact: true }).selectOption("Small");
    await page.getByLabel("Sort", { exact: true }).selectOption("newest");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("link", { name: /Cinderlit Kite/ }).waitFor();
    const returnUrl = page.url(); const query = new URL(returnUrl).searchParams;
    for (const [key, value] of Object.entries({ category: "monsters", q: "Cinderlit", provenance: "mine", size: "Small", sort: "newest" })) assert.equal(query.get(key), value);
    const fontEvidence = await fonts(page); await layout(page);
    record(size, "native GET filters preserve size/access/search/sort and production fonts load", { fonts: fontEvidence });
    await page.screenshot({ path: path.join(output, `${size}-library.png`), fullPage: true });
    await keyboardActivate(page, page.getByRole("link", { name: /Cinderlit Kite/ }));
    await page.getByRole("heading", { name: "Cinderlit Kite", exact: true }).waitFor();
    const backHref = await page.getByRole("link", { name: "Back to Library" }).getAttribute("href");
    const expectedBack = new URL(returnUrl); expectedBack.searchParams.delete("page");
    const actualBack = new URL(backHref, origin);
    assert.equal(actualBack.pathname, expectedBack.pathname);
    assert.deepEqual([...actualBack.searchParams].sort(), [...expectedBack.searchParams].sort());
    record(size, "keyboard row navigation mounts actual detail and exact return query");
    for (const text of ["18 (3d6 + 8)", "Strength -1, Wisdom +0", "Ranged weapon attack: +0 to hit; range 20 / 40 ft.; one target", "Damage: 2 (1d4) bludgeoning"]) assert.equal(await page.getByText(text, { exact: true }).isVisible(), true);
    record(size, "small original stat block preserves declared zero/negative bonuses and HP");
    await fonts(page); await layout(page); await page.screenshot({ path: path.join(output, `${size}-small.png`), fullPage: true });
    await keyboardActivate(page, page.getByRole("link", { name: "Back to Library" }));
    await page.getByLabel("Size", { exact: true }).waitFor(); assert.equal(await page.getByLabel("Size", { exact: true }).inputValue(), "Small");
    record(size, "keyboard Back restores the filtered Library controls");
    await page.goto(`${origin}/library/55555555-5555-4555-8555-555555555555`);
    await page.getByRole("heading", { name: "Lantern Reef Regent", exact: true }).waitFor();
    for (const title of ["Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions", "Lair Actions"]) assert.equal(await page.getByRole("region", { name: title, exact: true }).count(), 1);
    assert.deepEqual(await page.getByRole("region", { name: "Actions", exact: true }).getByRole("heading", { level: 3 }).allTextContents(), ["Lantern pulse", "Lantern pulse"]);
    assert.equal(await page.getByText("18 (layered lantern glass)", { exact: true }).count(), 1);
    record(size, "all-field original preserves ordered duplicate actions and ignores envelope effects");
    for (const text of ["Initiative count: 0", "Constitution save DC 0; on success: The glass stays clear.", "Damage: 0 (1d6) radiant (A dim pulse.)", "9 (0 XP)"]) assert.equal(await page.getByText(text, { exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: /^Old light\s*\(Cost 2\)$/, level: 3 }).count(), 1);
    record(size, "all-field zero DC/XP/damage/initiative and valid legendary cost remain explicit");
    const injection = await page.evaluate(() => window.fixture.injection);
    assert.equal(await page.getByText(injection, { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => Object.hasOwn(globalThis, "compromised")), false);
    assert.equal(await page.locator('#root script,#root img,#root [onerror],a[href^="javascript:"]').count(), 0);
    await fonts(page); await layout(page); await page.screenshot({ path: path.join(output, `${size}-all-fields.png`), fullPage: true });
    record(size, "untrusted script/HTML/handler/URL text remains inert and layout wraps");
    await page.goto(`${origin}/library/66666666-6666-4666-8666-666666666666`);
    await page.getByRole("region", { name: "Traits", exact: true }).waitFor();
    const bytes = await page.evaluate(() => window.fixture.longBytes); assert.ok(bytes >= 61_440 && bytes <= 65_536);
    assert.equal(await page.getByRole("region", { name: "Traits", exact: true }).getByRole("heading", { level: 3 }).count(), 20);
    await fonts(page); await layout(page); await page.screenshot({ path: path.join(output, `${size}-long-top.png`) });
    record(size, "near-budget multibyte data and long unbroken title/rules mount without overflow", { bytes });
    const last = page.getByText("The final lantern keeps its place.", { exact: true }); await last.scrollIntoViewIfNeeded();
    assert.equal(await last.isVisible(), true);
    assert.equal(await last.evaluate(node => { const box = node.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight + 1; }), true);
    assert.equal(await last.evaluate(node => {
      for (let current = node; current && current !== document.body; current = current.parentElement) {
        const css = getComputedStyle(current);
        if (["hidden", "clip"].includes(css.overflowY) && current.scrollHeight > current.clientHeight + 1) return false;
      }
      return true;
    }), true, "Last rule clipped by an ancestor");
    await layout(page); await page.screenshot({ path: path.join(output, `${size}-long-final.png`) });
    record(size, "complete last near-budget rule is visible after scrolling with no clipped ancestor");
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
  auth: "mocked local account", persistence: "unavailable", routing: "native anchors/GET replacing Next navigation", appShell: "local padded wrapper, not authenticated application shell",
  artifacts, taskProcess, browserProcess, portClosed, browserPortClosed, browserExited,
  evidence, pageErrors, blockedRequests, unexpectedRequests, assetRequests, failure: failure?.message ?? null }, null, 2));
if (process.connected) process.disconnect();
assert.equal(portClosed, true); assert.equal(browserPortClosed, true); assert.equal(browserExited, true);
if (failure) throw failure;
console.log(JSON.stringify({ passed: evidence.length, portClosed, browserPortClosed, browserExited, output }));
