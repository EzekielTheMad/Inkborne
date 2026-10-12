/** Actual RichTextEditor/toolbar/MentionList with synthetic mentions and save/reload.
 * npm run test:e2e -- --config e2e/local-editor/playwright.config.ts
 * No Next server, hosted setup, credentials, or provider writes.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "editor-local");
await fs.mkdir(output, { recursive: true });
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-editor-fixture.tsx", contents: `
    import React,{useRef,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {RichTextEditor} from '@/components/editor/rich-text-editor';
    const original={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A lantern waits at the northern gate.'}]}]};
    const initial=JSON.parse(sessionStorage.getItem('offline-editor-saved')||JSON.stringify(original));
    window.fixture={current:initial,updates:0,saved:null};
    function App(){
      const current=useRef(initial);
      const [status,setStatus]=useState('Synthetic content; save/reload and mention results are simulated.');
      return <><h1 className='text-xl mb-2'>Offline mounted editor</h1>
        <p className='mb-4'>Real editor, toolbar and mention list. No account or database.</p>
        <RichTextEditor content={initial} campaignId='offline-campaign' minHeight='180px' onChange={value=>{
          current.current=JSON.parse(JSON.stringify(value));window.fixture.current=current.current;window.fixture.updates++;
        }}/>
        <div className='flex flex-wrap gap-3 mt-4'>
          <button className='border rounded-md px-3 py-2' onClick={()=>{const serialized=JSON.stringify(current.current);sessionStorage.setItem('offline-editor-saved',serialized);window.fixture.saved=serialized;setStatus('Simulated save confirmed.')}}>Save simulated document</button>
          <button className='border rounded-md px-3 py-2' onClick={()=>location.reload()}>Reload simulated document</button>
        </div><p role='status' className='mt-3'>{status}</p></>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
});
const cssArg = process.argv.indexOf("--css-dir");
let css;
let cssSource;
if (cssArg !== -1) assert.ok(process.argv[cssArg + 1], "--css-dir requires a built CSS directory");
const hasProductionBuild = await fs.access(path.join(root, ".next", "BUILD_ID")).then(() => true, () => false);
if (cssArg !== -1 || hasProductionBuild) {
  const directory = cssArg !== -1 ? path.resolve(process.argv[cssArg + 1]) : path.join(root, ".next", "static", "chunks");
  const files = (await fs.readdir(directory)).filter(name => name.endsWith(".css"));
  assert.ok(files.length, "Built production CSS must exist");
  css = (await Promise.all(files.map(name => fs.readFile(path.join(directory, name), "utf8")))).join("\n");
  cssSource = { kind: "built-production-css", directory, files };
} else {
  const from = path.join(root, "app", "globals.css");
  css = (await postcss([tailwind({ base: root })]).process(await fs.readFile(from, "utf8"), { from })).css;
  cssSource = { kind: "compiled-existing-globals", from, boundary: "Actual app CSS via installed PostCSS/Tailwind; not a Next production build." };
}
cssSource.sha256 = createHash("sha256").update(css).digest("hex");
const mentionRequests = [];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  if (url.pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (url.pathname === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else if (url.pathname === "/api/campaigns/offline-campaign/mentions") {
    const kind = url.searchParams.get("kind");
    const query = url.searchParams.get("q");
    mentionRequests.push({ kind, query });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(kind === "character" ? [
      { id: "synthetic-ada", label: "Ada Lantern", entityType: "character" },
      { id: "synthetic-bryn", label: "Bryn North", entityType: "character" },
    ] : [{ id: "synthetic-keep", label: "Northern Keep", entityType: "page" }]));
  } else if (url.pathname === "/") {
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline editor</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:20px;max-width:900px;margin:auto"><div id="root"></div></main><script src="/fixture.js"></script></body></html>');
  } else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid,
  command: "node scripts/verify-editor-local.mjs", cwd: root,
  startTime: new Date().toISOString(), listeningPort: port };
console.log(JSON.stringify({ taskProcess, cssSource }));
let browser;
let browserServer;
let browserProcess;
let browserControlPort;
let failure;
let activePage;
const evidence = [];
const pageErrors = [];
const blockedRemoteRequests = [];
try {
  const startTime = new Date().toISOString();
  browserServer = await chromium.launchServer({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, host: "127.0.0.1" });
  const child = browserServer.process();
  browserControlPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { pid: child.pid, parentPid: process.pid, command: child.spawnargs,
    cwd: root, startTime, listeningPort: browserControlPort };
  console.log(JSON.stringify({ browserProcess }));
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [size, viewport] of [["desktop", {width:1280,height:900}], ["mobile", {width:320,height:844}]]) {
    const context = await browser.newContext({ viewport });
    context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRemoteRequests.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(origin);
    const editor = page.locator('.tiptap[contenteditable="true"]');
    await editor.waitFor();
    assert.match(await editor.innerText(), /A lantern waits/);
    await editor.click();
    await page.keyboard.press("Control+End");
    assert.equal(await editor.evaluate(node => node === document.activeElement), true);
    assert.notEqual(await editor.locator("..").locator("..").evaluate(node => getComputedStyle(node).boxShadow), "none");
    evidence.push({ size, check: "actual editor mounts original synthetic document with focus ring", passed: true });
    await editor.evaluate(node => {
      const data = new DataTransfer();
      data.setData("text/html", '<p><strong>Pasted bold</strong> <a href="https://example.com/guide">safe guide</a> <a href="javascript:window.offlineAttack=1">unsafe link</a><img src="invalid" onerror="window.offlineAttack=1"><script>window.offlineAttack=1</script></p>');
      data.setData("text/plain", "Pasted bold safe guide unsafe link");
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await editor.locator("strong", { hasText: "Pasted bold" }).waitFor();
    assert.equal(await editor.locator('a[href="https://example.com/guide"]').innerText(), "safe guide");
    assert.equal(await editor.locator('script,img,[onerror],a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.offlineAttack), undefined);
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify(window.fixture.current)), /javascript:|onerror|offlineAttack/);
    evidence.push({ size, check: "mounted real HTML paste handler preserves bold/HTTPS and rejects malicious payload", passed: true });
    await page.getByRole("button", {name:"Bold",exact:true}).click();
    await page.waitForFunction(() => document.activeElement?.isContentEditable === true);
    await page.keyboard.type(" Toolbar bold");
    assert.equal(await editor.evaluate(node => node === document.activeElement), true);
    await editor.locator("strong", { hasText: "Toolbar bold" }).waitFor();
    await page.getByRole("button", {name:"Bold",exact:true}).click();
    await page.waitForFunction(() => document.activeElement?.isContentEditable === true);
    evidence.push({ size, check: "actual toolbar applies bold and returns keyboard focus to editor", passed: true });
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" @Ad");
    await page.getByRole("button", {name:"Ada Lantern character",exact:true}).waitFor();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await editor.locator('a.mention[href="/characters/synthetic-bryn"]').waitFor();
    assert.match(await editor.innerText(), /@Bryn North/);
    evidence.push({ size, check: "character suggestion keyboard selection persists label/id/route", passed: true });
    await page.keyboard.type(" #Nor");
    await page.getByRole("button", {name:"Northern Keep page",exact:true}).waitFor();
    await page.screenshot({path:path.join(output,`${size}-page-suggestions.png`),fullPage:true});
    await page.keyboard.press("Enter");
    await editor.locator('a.mention[href="/campaigns/offline-campaign/pages/synthetic-keep"]').waitFor();
    const serialized = await page.evaluate(() => JSON.stringify(window.fixture.current));
    const mentions = JSON.parse(serialized).content.flatMap(node => node.content ?? []).filter(node => node.type === "mention");
    assert.deepEqual(mentions.map(node => [node.attrs.id,node.attrs.label,node.attrs.mentionSuggestionChar]), [["synthetic-bryn","Bryn North","@"],["synthetic-keep","Northern Keep","#"]]);
    evidence.push({ size, check: "page suggestion keyboard selection preserves distinct # trigger and campaign route", passed: true });
    await page.getByRole("button", {name:"Save simulated document",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Simulated save confirmed"}).waitFor();
    assert.equal(await page.evaluate(() => window.fixture.saved), serialized);
    await page.getByRole("button", {name:"Reload simulated document",exact:true}).click();
    await editor.locator('a.mention[href="/characters/synthetic-bryn"]').waitFor();
    await editor.locator('a.mention[href="/campaigns/offline-campaign/pages/synthetic-keep"]').waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(window.fixture.current)), serialized);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const rows = await page.getByRole("button", {name:"Bold",exact:true}).locator("..").locator("button").evaluateAll(nodes => [...new Set(nodes.map(node => Math.round(node.getBoundingClientRect().top)))]);
    assert.equal(rows.length > 1, size === "mobile");
    await editor.click();
    assert.equal(await editor.evaluate(node => node === document.activeElement), true);
    await page.screenshot({path:path.join(output,`${size}-reloaded.png`),fullPage:true});
    evidence.push({ size, check: "serializable JSON simulated save/page reload survives with responsive toolbar/focus", passed: true, toolbarRows: rows.length });
    await context.close();
  }
  assert.ok(mentionRequests.some(item => item.kind === "character" && item.query === "Ad"));
  assert.ok(mentionRequests.some(item => item.kind === "page" && item.query === "Nor"));
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(blockedRemoteRequests, []);
} catch (error) {
  failure = error;
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({path:path.join(output,"failure.png"),fullPage:true});
    await fs.writeFile(path.join(output,"failure-dom.json"), JSON.stringify(await activePage.evaluate(() => ({
      text:document.body.innerText,focused:document.activeElement?.outerHTML,current:window.fixture?.current,
    })),null,2));
  }
}
finally {
  try { if (browser) await browser.close(); }
  finally { try { if (browserServer) await browserServer.close(); }
    finally { await new Promise(resolve => server.close(resolve)); } }
}
function isPortClosed(targetPort) { return new Promise(resolve => {
  if (!targetPort) { resolve(true); return; }
  const socket = net.connect({host:"127.0.0.1",port:targetPort});
  socket.once("connect", () => {socket.destroy();resolve(false)});
  socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
}); }
const portClosed = await isPortClosed(port);
const browserPortClosed = await isPortClosed(browserControlPort);
const browserExited = !browserServer || browserServer.process().exitCode !== null;
await fs.writeFile(path.join(output,"evidence.json"), JSON.stringify({simulatedPersistence:true,liveSupabase:false,
  browser:"installed Chrome",taskProcess,browserProcess,cssSource,portClosed,browserPortClosed,browserExited,
  evidence,pageErrors,blockedRemoteRequests,mentionRequests,failure:failure?.message??null},null,2));
assert.equal(portClosed, true);
assert.equal(browserPortClosed, true);
assert.equal(browserExited, true);
if (failure) throw failure;
console.log(JSON.stringify({passed:evidence.length,portClosed,browserPortClosed,browserExited,output}));
