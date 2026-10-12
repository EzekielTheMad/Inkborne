/** Real RaceForm, simulated actions and summary; no Next server or Supabase.
 * npm run test:e2e -- --config e2e/local-races/playwright.config.ts
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
const output = path.join(root, "test-results", "races-local");
await fs.mkdir(output, { recursive: true });
const seed = await fs.readFile(path.join(root, 'supabase/seed.sql'), 'utf8');
const primaryJson = seed.slice(seed.indexOf("'dnd-5e-2014'")).match(/'(\{[\s\S]*?\})'::jsonb/)?.[1];
assert.ok(primaryJson, 'Canonical 2014 seed schema must exist.');
const primarySchema = JSON.parse(primaryJson.replace(/''/g, "'"));
const stubs = {
  "next/link": `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`,
  "@/app/(app)/homebrew/races/actions": `
    import {mapHomebrewRaceFormData} from '@/lib/homebrew/race-form';
    async function submit(kind,previous,data){
      const fields=Object.fromEntries(data);window.fixture.calls.push({kind,fields});
      if(window.fixture.mode==='validate'){const parsed=mapHomebrewRaceFormData(data,location.pathname!=='/legacy');if(!parsed.success)return {status:'error',message:'Check the highlighted fields and try again.',fieldErrors:parsed.fieldErrors};}
      if(window.fixture.mode==='pending')return new Promise(resolve=>{window.fixture.resolve=resolve});
      if(window.fixture.mode==='conflict')return {status:'conflict',message:'This race changed in another session. Reload it before saving again.'};
      if(window.fixture.mode==='error')return {status:'error',message:'The race could not be saved. Please try again.'};
      window.dispatchEvent(new CustomEvent('fixture-saved',{detail:{kind,fields}}));
      return {status:'idle',message:''};
    }
    export async function createHomebrewRace(previous,data){return submit('create',previous,data)}
    export async function updateHomebrewRace(previous,data){return submit('update',previous,data)}
  `,
};
await build({
  stdin: {
    resolveDir: root, loader: "tsx", sourcefile: "local-races-fixture.tsx",
    contents: `
      import React,{useEffect,useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {RaceForm} from '@/components/library/race-form';
      import {StatPreview} from '@/components/builder/stat-preview';
      import {raceDataSchema} from '@/lib/schemas/content-types/race';
      import {raceWalkingEffect} from '@/lib/homebrew/race-authoring';
      import {parseContentDefinition,parseContentVersionSnapshot} from '@/lib/supabase/content-definitions-parser';
      import {buildCharacterStructuredSources} from '@/lib/character/structured-sources';
      import {evaluate} from '@/lib/engine/evaluator';
      const schema=${JSON.stringify(primarySchema)};
      const base={strength:10,dexterity:10,constitution:10,intelligence:10,wisdom:10,charisma:10,level:1,hit_die_total:8,spellcasting_ability:10};
      function consumerProof(fields){
        const speed=Number(fields.speed??40);
        const raw={id:'11111111-1111-4111-8111-111111111111',system_id:'22222222-2222-4222-8222-222222222222',slug:'aster-kin',name:fields.name,
          content_type:'race',source:'homebrew',scope:'personal',owner_id:'33333333-3333-4333-8333-333333333333',version:1,
          data:raceDataSchema.parse({size:fields.size,speed,speed_detail:{walk:speed}}),effects:[raceWalkingEffect(speed)]};
        const definition=parseContentDefinition(raw);
        const pin=parseContentVersionSnapshot({content_id:raw.id,version:1,system_id_snapshot:raw.system_id,content_type_snapshot:'race',slug_snapshot:raw.slug,
          name_snapshot:raw.name,data_snapshot:raw.data,effects_snapshot:raw.effects,source_snapshot:raw.source,scope_snapshot:raw.scope,owner_id_snapshot:raw.owner_id});
        if(!definition||!pin)throw Error('Canonical parser rejected synthetic fixture');
        const live=evaluate(base,pin.effects,schema,buildCharacterStructuredSources([{content_definitions:pin}],1));
        return <><p data-testid='live-speed-walk'>Structured walk: {live.speed.walk}</p><p data-testid='computed-movement'>Computed movement: {live.computed.movement_speed}</p>
          <p data-testid='parsed-size'>Recorded size: {pin.data.size}</p><StatPreview baseStats={base} effects={pin.effects} schema={schema} level={1}/></>;
      }
      window.fixture={mode:'pending',calls:[],resolve:null};
      const saved={id:'11111111-1111-4111-8111-111111111111',name:'Aster Kin',version:location.pathname==='/latest'?2:1,walkingEditable:location.pathname!=='/legacy',data:{size:'Medium',speed:40,speed_detail:{walk:40},age_description:'Original age notes.',alignment_description:'Original alignment notes.',size_description:'Original size notes.',language_description:'Original language notes.'}};
      function App(){
        const [summary,setSummary]=useState(null);
        useEffect(()=>{const done=e=>setSummary(e.detail);window.addEventListener('fixture-saved',done);return()=>window.removeEventListener('fixture-saved',done)},[]);
        return <><h1>Isolated race form</h1><p>Actions and saved summary are simulated; form controls are real.</p>
          {summary?<><p role='status'>Simulated {summary.kind} confirmed: {summary.fields.name}</p>{consumerProof(summary.fields)}</>:<RaceForm mode={location.pathname==='/create'?'create':'edit'} initialValue={location.pathname==='/create'?undefined:saved}/>}</>
      }
      createRoot(document.getElementById('root')).render(<App/>);
    `,
  },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "offline-action-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|@\/app\/\(app\)\/homebrew\/races\/actions)$/ }, args => ({ path: args.path, namespace: "fixture" }));
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
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Offline races</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px;max-width:960px;margin:auto"><div id="root"></div></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const taskProcess = { pid: process.pid, parentPid: process.ppid,
  command: "node scripts/verify-races-local.mjs", cwd: root,
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
    await page.getByLabel("Name", {exact:true}).fill("Moonlit Kin");
    await page.getByLabel("Size", {exact:true}).selectOption("Small");
    await page.getByLabel("Walking speed (ft.)", {exact:true}).fill("40.5");
    await page.getByLabel("Age description", {exact:true}).fill("Original age notes.");
    await page.getByLabel("Alignment description", {exact:true}).fill("Original alignment notes.");
    await page.getByLabel("Size description", {exact:true}).fill("Original size notes.");
    await page.getByLabel("Language description", {exact:true}).fill("Original language notes.");
    await page.evaluate(() => {window.fixture.mode="validate"});
    await page.getByRole("button", {name:"Create private race",exact:true}).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("Walking speed (ft.)", {exact:true}).getAttribute("aria-invalid"), "true");
    assert.equal(await page.getByLabel("Walking speed (ft.)", {exact:true}).inputValue(), "40.5");
    evidence.push({size,check:"real mapper rejects fractional walking speed and real form preserves draft",passed:true});
    await page.getByLabel("Walking speed (ft.)", {exact:true}).fill("40");
    await page.evaluate(() => {window.fixture.mode="pending";window.fixture.calls=[]});
    await page.getByRole("button", {name:"Create private race",exact:true}).click();
    await page.getByRole("button", {name:"Saving...",exact:true}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Saving...",exact:true}).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(window.fixture.calls[0].fields).sort()), ["age_description","alignment_description","language_description","name","size","size_description","speed"]);
    assert.equal(await page.evaluate(() => window.fixture.calls[0].fields.speed), "40");
    evidence.push({size,check:"pending create submits only finite named controls and prevents another submit",passed:true});
    await page.evaluate(() => window.fixture.resolve({status:"error",message:"Check the highlighted fields and try again.",fieldErrors:{name:["Simulated validation error."]}}));
    await page.getByRole("alert").waitFor();
    const retainedFields={name:await page.getByLabel('Name',{exact:true}).inputValue(),size:await page.getByLabel('Size',{exact:true}).inputValue(),speed:await page.getByLabel('Walking speed (ft.)',{exact:true}).inputValue()};
    await page.screenshot({path:path.join(output,`${size}-validation.png`),fullPage:true});
    console.log(JSON.stringify({size,retainedFields}));
    assert.equal(retainedFields.name,'Moonlit Kin');assert.equal(retainedFields.size,'Small');assert.equal(retainedFields.speed,'40');
    assert.equal(await page.getByLabel('Name',{exact:true}).getAttribute('aria-invalid'),'true');
    for(const label of ['Age description','Alignment description','Size description','Language description']){
      assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),`Original ${label.toLowerCase().replace(' description','')} notes.`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    evidence.push({size,check:"server validation keeps all authored fields and accessible field error",passed:true});
    await page.evaluate(() => {window.fixture.mode="error"});
    await page.getByRole("button", {name:"Create private race",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"could not be saved"}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Create private race",exact:true}).isEnabled(), true);
    evidence.push({size,check:"recoverable persistence error leaves form available for explicit retry",passed:true});
    await page.evaluate(() => {window.fixture.mode="success"});
    await page.getByRole("button", {name:"Create private race",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Simulated create confirmed"}).waitFor();
    assert.equal(await page.getByTestId('live-speed-walk').textContent(),'Structured walk: 40');
    assert.equal(await page.getByTestId('computed-movement').textContent(),'Computed movement: 40');
    assert.equal(await page.getByTestId('parsed-size').textContent(),'Recorded size: Small');
    assert.equal(await page.getByText('Speed',{exact:true}).locator('..').textContent(),'Speed40');
    evidence.push({size,check:"synthetic creation passes canonical definition/snapshot parsers, real live evaluator and actual StatPreview",passed:true});
    await page.goto(origin + "/edit");
    assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "1");
    await page.getByLabel("Name", {exact:true}).fill("Aster Kin Revised");
    await page.evaluate(() => {window.fixture.mode="conflict"});
    await page.getByRole("button", {name:"Save new version",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"another session"}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Save new version",exact:true}).isDisabled(), true);
    assert.equal(await page.getByRole("button", {name:"Reload latest",exact:true}).isVisible(), true);
    assert.equal(await page.getByLabel("Name", {exact:true}).inputValue(), "Aster Kin Revised");
    assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({path:path.join(output,`${size}-conflict.png`),fullPage:true});
    evidence.push({size,check:"stale edit keeps draft, locks resubmit and exposes explicit reload",passed:true});
    // Serve a v2 fixture on the real reload path; action persistence remains simulated.
    await page.evaluate(() => history.replaceState({},"","/latest"));
    await page.getByRole("button", {name:"Reload latest",exact:true}).click();
    await page.getByRole("button", {name:"Save new version",exact:true}).waitFor();
    assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "2");
    await page.getByLabel("Name", {exact:true}).fill("Aster Kin v3 draft");
    await page.evaluate(() => {window.fixture.mode="validate"});
    await page.getByRole("button", {name:"Save new version",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Simulated update confirmed"}).waitFor();
    assert.equal(await page.evaluate(() => window.fixture.calls[0].fields.expected_version), "2");
    evidence.push({size,check:"reload initializes latest version and next submission sends that expected version",passed:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.goto(origin + '/legacy');
    assert.equal(await page.getByLabel('Walking speed (ft.)',{exact:true}).isDisabled(),true);
    assert.equal(await page.getByText(/Walking speed is read-only/).isVisible(),true);
    await page.getByLabel('Name',{exact:true}).fill('Legacy metadata edit');
    await page.evaluate(() => {window.fixture.mode='validate'});
    await page.getByRole('button',{name:'Save new version',exact:true}).click();
    await page.getByRole('status').waitFor();
    assert.equal(await page.evaluate(() => Object.hasOwn(window.fixture.calls[0].fields,'speed')),false);
    evidence.push({size,check:'legacy walking is disabled and omitted from real form metadata submission',passed:true});
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
