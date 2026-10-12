/** Real ItemForm, simulated actions and summary; no Next server or Supabase.
 * npm run test:e2e -- --config e2e/local-items/playwright.config.ts
 * Requires installed lockfile dependencies and Chrome.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "items-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`,
  "@/app/(app)/homebrew/items/actions": `
    async function submit(kind,previous,data){
      const fields=Object.fromEntries(data);window.fixture.calls.push({kind,fields});
      if(window.fixture.mode==='pending')return new Promise(resolve=>{window.fixture.resolve=resolve});
      if(window.fixture.mode==='conflict')return {status:'conflict',message:'This item changed in another session. Reload it before saving again.'};
      if(window.fixture.mode==='error')return {status:'error',message:'The item could not be saved. Please try again.'};
      window.dispatchEvent(new CustomEvent('fixture-saved',{detail:{kind,fields}}));
      return {status:'idle',message:''};
    }
    export async function createHomebrewItem(previous,data){return submit('create',previous,data)}
    export async function updateHomebrewItem(previous,data){return submit('update',previous,data)}
  `,
};
await build({
  stdin: {
    resolveDir: root, loader: "tsx", sourcefile: "local-items-fixture.tsx",
    contents: `
      import React,{useEffect,useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ItemForm} from '@/components/library/item-form';
      window.fixture={mode:'pending',calls:[],resolve:null};
      const saved={id:'11111111-1111-4111-8111-111111111111',name:'Oathbound Compass',version:location.pathname==='/latest'?2:1,data:{description:'A hinged travel lantern.',equipment_category:'Adventuring Gear',cost:{quantity:2.5,unit:'gp'},weight:1.25}};
      function App(){
        const [summary,setSummary]=useState(null);
        useEffect(()=>{const done=e=>setSummary(e.detail);window.addEventListener('fixture-saved',done);return()=>window.removeEventListener('fixture-saved',done)},[]);
        return <><h1>Isolated item form</h1><p>Actions and saved summary are simulated; form controls are real.</p>
          {summary?<p role='status'>Simulated {summary.kind} confirmed: {summary.fields.name}</p>:<ItemForm mode={location.pathname==='/create'?'create':'edit'} initialValue={location.pathname==='/create'?undefined:saved}/>}</>
      }
      createRoot(document.getElementById('root')).render(<App/>);
    `,
  },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "offline-action-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|@\/app\/\(app\)\/homebrew\/items\/actions)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } }],
});
// Prefer production build styles when available. Otherwise compile existing
// application globals without credentials, a Next server, or hosted setup.
const cssDirectory = path.join(root, ".next/static/chunks");
const cssFiles = (await fs.readdir(cssDirectory).catch(() => [])).filter(name => name.endsWith(".css"));
const stylesheetSource = cssFiles.length ? "production-build" : "compiled-globals";
const css = cssFiles.length
  ? (await Promise.all(cssFiles.map(name => fs.readFile(path.join(cssDirectory, name), "utf8")))).join("\n")
  : (await postcss([tailwind({base: root})]).process(
    await fs.readFile(path.join(root, "app/globals.css"), "utf8"),
    {from: path.join(root, "app/globals.css")},
  )).css;
const server = http.createServer(async (request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Offline items</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px;max-width:960px;margin:auto"><div id="root"></div></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid,
  command: "node scripts/verify-items-local.mjs", cwd: root,
  startTime: new Date().toISOString(), listeningPort: port };
console.log(JSON.stringify({ taskProcess }));
let browser;
let browserServer;
let browserProcess;
let browserControlPort;
const evidence = [];
const pageErrors = [];
const blockedRemoteRequests = [];
try {
  const browserStartTime = new Date().toISOString();
  browserServer = await chromium.launchServer({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, host: "127.0.0.1" });
  const child = browserServer.process();
  browserControlPort = Number(new URL(browserServer.wsEndpoint()).port);
  taskProcess.browserControlPort = browserControlPort;
  browserProcess = { pid: child.pid, parentPid: process.pid, command: child.spawnargs,
    cwd: root, startTime: browserStartTime, listeningPort: null };
  console.log(JSON.stringify({browserProcess,browserControlPort}));
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [size, viewport] of [["desktop", {width:1280,height:900}], ["mobile", {width:390,height:844}]]) {
    const context = await browser.newContext({viewport});
    context.setDefaultTimeout(10_000);
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRemoteRequests.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(origin + "/create");
    await page.getByLabel("Name", {exact:true}).fill("Lantern of Returning");
    await page.getByLabel("Cost quantity", {exact:true}).fill("2.5");
    await page.getByLabel("Cost unit", {exact:true}).fill("gp");
    await page.getByLabel("Weight (lb.)", {exact:true}).fill("1.25");
    await page.getByLabel("Item description", {exact:true}).fill("It remembers every road home.");
    await page.getByLabel("Equipment category", {exact:true}).fill("Adventuring Gear");

    await page.getByRole("button", {name:"Create private item",exact:true}).click();
    await page.getByRole("button", {name:"Saving...",exact:true}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Saving...",exact:true}).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(window.fixture.calls[0].fields).sort()), ["cost_quantity","cost_unit","description","equipment_category","name","weight"]);
    assert.equal(await page.evaluate(() => window.fixture.calls[0].fields.cost_quantity), "2.5");
    evidence.push({size,check:"pending create submits only finite named controls and prevents another submit",passed:true});
    await page.evaluate(() => window.fixture.resolve({status:"error",message:"Check the highlighted fields and try again.",fieldErrors:{name:["Simulated validation error."]}}));
    await page.getByRole("alert").waitFor();
    const retainedFields = {
      name: await page.getByLabel("Name", {exact:true}).inputValue(),
      cost: await page.getByLabel("Cost quantity", {exact:true}).inputValue(),
      unit: await page.getByLabel("Cost unit", {exact:true}).inputValue(),
      weight: await page.getByLabel("Weight (lb.)", {exact:true}).inputValue(),
      description: await page.getByLabel("Item description", {exact:true}).inputValue(),
      category: await page.getByLabel("Equipment category", {exact:true}).inputValue(),

    };
    await page.screenshot({path:path.join(output,`${size}-validation.png`),fullPage:true});
    console.log(JSON.stringify({size,retainedFields}));
    assert.equal(await page.getByLabel("Name", {exact:true}).inputValue(), "Lantern of Returning");
    assert.equal(await page.getByLabel("Name", {exact:true}).getAttribute("aria-invalid"), "true");
    assert.equal(await page.getByLabel("Cost quantity", {exact:true}).inputValue(), "2.5");
    assert.equal(await page.getByLabel("Cost unit", {exact:true}).inputValue(), "gp");
    assert.equal(await page.getByLabel("Weight (lb.)", {exact:true}).inputValue(), "1.25");
    assert.equal(await page.getByLabel("Item description", {exact:true}).inputValue(), "It remembers every road home.");
    assert.equal(await page.getByLabel("Equipment category", {exact:true}).inputValue(), "Adventuring Gear");

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    evidence.push({size,check:"server validation keeps all authored fields and accessible field error",passed:true});
    await page.evaluate(() => {window.fixture.mode="error"});
    await page.getByRole("button", {name:"Create private item",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"could not be saved"}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Create private item",exact:true}).isEnabled(), true);
    evidence.push({size,check:"recoverable persistence error leaves form available for explicit retry",passed:true});
    await page.evaluate(() => {window.fixture.mode="success"});
    await page.getByRole("button", {name:"Create private item",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Simulated create confirmed"}).waitFor();
    evidence.push({size,check:"real form create retry delivers original authored name to simulated action",passed:true});
    await page.goto(origin + "/edit");
    assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "1");
    await page.getByLabel("Name", {exact:true}).fill("Oathbound Compass Revised");
    await page.evaluate(() => {window.fixture.mode="conflict"});
    await page.getByRole("button", {name:"Save new version",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"another session"}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Save new version",exact:true}).isDisabled(), true);
    assert.equal(await page.getByRole("button", {name:"Reload latest",exact:true}).isVisible(), true);
    assert.equal(await page.getByLabel("Name", {exact:true}).inputValue(), "Oathbound Compass Revised");
    assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({path:path.join(output,`${size}-conflict.png`),fullPage:true});
    evidence.push({size,check:"stale edit keeps draft, locks resubmit and exposes explicit reload",passed:true});
    // Serve a v2 fixture on the real reload path; action persistence remains simulated.
    await page.evaluate(() => history.replaceState({},"","/latest"));
    await page.getByRole("button", {name:"Reload latest",exact:true}).click();
    await page.getByRole("button", {name:"Save new version",exact:true}).waitFor();
    assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "2");
    await page.getByLabel("Name", {exact:true}).fill("Oathbound Compass v3 draft");
    await page.evaluate(() => {window.fixture.mode="success"});
    await page.getByRole("button", {name:"Save new version",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Simulated update confirmed"}).waitFor();
    assert.equal(await page.evaluate(() => window.fixture.calls[0].fields.expected_version), "2");
    evidence.push({size,check:"reload initializes latest version and next submission sends that expected version",passed:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await context.close();
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(blockedRemoteRequests, []);
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    try {
      if (browserServer) await browserServer.close();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
}
function isPortClosed(targetPort) { return new Promise(resolve => {
  const socket = net.connect({host:"127.0.0.1",port:targetPort});
  socket.once("connect", () => {socket.destroy();resolve(false)});
  socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
}); }
const portClosed = await isPortClosed(port);
const browserPortClosed = await isPortClosed(browserControlPort);
assert.equal(portClosed, true);
assert.equal(browserPortClosed, true);
await fs.writeFile(path.join(output,"evidence.json"), JSON.stringify({simulated:true,liveSupabase:false,stylesheetSource,
  browser:"installed Chrome",taskProcess,browserProcess,portClosed,browserPortClosed,evidence,pageErrors,blockedRemoteRequests},null,2));
console.log(JSON.stringify({passed:evidence.length,portClosed,browserPortClosed,output}));
