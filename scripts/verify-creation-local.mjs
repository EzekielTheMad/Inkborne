/** Offline browser behavior only: real form/boundary; explicit Auth, action
 * and router doubles. No Next server, SDK, env-file or hosted import.
 * Run after integrating the prepared UI: node scripts/verify-creation-local.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

assert.equal(process.argv.length, 2, "This fixed offline runner accepts no arguments.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = randomUUID(), runStartedUtc = new Date().toISOString();
const outputRoot = path.join(root, "test-results", "creation-local");
const output = path.join(outputRoot, runStartedUtc.replaceAll(/[:.]/g, "-") + "-" + runId);
const digest = value => createHash("sha256").update(value).digest("hex");
await fs.mkdir(output, { recursive: true });
const lockPath = path.join(outputRoot, "runner.lock.json");
const lockText = JSON.stringify({ runId, pid: process.pid, parentPid: process.ppid, root, runStartedUtc });
// An existing record must be inspected rather than creating a second server.
const lock = await fs.open(lockPath, "wx");
await lock.writeFile(lockText); await lock.close();
const evidencePath = path.join(output, "evidence.json");
const evidence = [], pageErrors = [], blockedRemoteRequests = [];
let server, browserServer, browser, origin, serverIdentity, browserIdentity, browserControlIdentity, browserExit;
let result = { simulated: true, liveSupabase: false, realNextServer: false, status: "running", runId, runStartedUtc };
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000004";
const TARGET = "10000000-0000-4000-8000-000000000003";
const pendingKey = account => "inkborne:pending-creation:v1:" + account;
const pendingClassKey = account => "inkborne:pending-first-class:v1:" + account + ":" + TARGET;
const stubs = {
  "next/navigation": "export function useRouter(){return {push(to){window.fixture.navigation.push(to);window.fixture.navigate?.(to)},refresh(){}}}",
  "next/link": "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}",
  "@/lib/supabase/client": "export function createClient(){return {auth:{onAuthStateChange(callback){window.fixture.authChange=callback;return {data:{subscription:{unsubscribe(){if(window.fixture.authChange===callback)window.fixture.authChange=null}}}}}}}}",
};
const fixtureSource = String.raw`
  import React,{useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import {OriginCreationForm} from '@/app/(app)/characters/new/origin-form';
  import {FirstClassForm} from '@/app/(app)/characters/[id]/builder/first-class/first-class-form';
  import {CreationSessionBoundary} from '@/components/auth/creation-session-boundary';
  import {getCreationScope,persistPendingCreation} from '@/lib/character/pending-creation-storage';
  import {persistPendingFirstClass} from '@/lib/character/pending-first-class-storage';
  const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000004';
  const system='10000000-0000-4000-8000-000000000005',target='10000000-0000-4000-8000-000000000003';
  const storedAccount=sessionStorage.getItem('fixture-account');
  const initial=storedAccount==='signed-out'?null:storedAccount===B?B:A;
  window.fixture={calls:JSON.parse(sessionStorage.getItem('fixture-calls')||'[]'),navigation:[],authChange:null,
    createMode:'pending',checkMode:'absent',classMode:'pending',classCheckMode:'absent',deferred:[],account:initial,staleWrite:null,signOutAttempts:0};
  const fixture=window.fixture;
  function send(kind,expectedAccount,intent){
    const lease=getCreationScope(),clone=JSON.parse(JSON.stringify(intent));
    const raw=sessionStorage.getItem('inkborne:pending-creation:v1:'+expectedAccount);
    if(!raw||JSON.stringify(JSON.parse(raw).intent)!==JSON.stringify(clone))throw Error('No exact durable original before action');
    fixture.calls.push({kind,expectedAccount,intent:clone,storedBeforeRequest:true});
    sessionStorage.setItem('fixture-calls',JSON.stringify(fixture.calls));
    fixture.staleWrite=()=>persistPendingCreation(clone,lease,sessionStorage);
    const answer=mode=>mode==='confirmed'?{status:'confirmed',account_id:expectedAccount,operation_id:clone.operation_id,character_id:target}:{status:mode};
    const mode=kind==='create'?fixture.createMode:fixture.checkMode;
    if(mode==='pending')return new Promise(resolve=>fixture.deferred.push({resolve:()=>resolve(answer('confirmed'))}));
    return Promise.resolve(answer(mode));
  }
  function sendClass(kind,expectedAccount,intent){
    const lease=getCreationScope(),clone=JSON.parse(JSON.stringify(intent));
    const raw=sessionStorage.getItem('inkborne:pending-first-class:v1:'+expectedAccount+':'+target);
    if(!raw||JSON.stringify(JSON.parse(raw).intent)!==JSON.stringify(clone))throw Error('No exact durable original class before action');
    fixture.calls.push({kind,expectedAccount,intent:clone,storedBeforeRequest:true});
    sessionStorage.setItem('fixture-calls',JSON.stringify(fixture.calls));
    fixture.staleWrite=()=>persistPendingFirstClass(clone,lease,sessionStorage);
    const answer=mode=>mode==='confirmed'?{status:'confirmed',account_id:expectedAccount,operation_id:clone.operation_id,character_id:target}
      :mode==='mismatch'?{status:'confirmed',account_id:expectedAccount,operation_id:clone.operation_id,character_id:system}:{status:mode};
    const mode=kind==='class-save'?fixture.classMode:fixture.classCheckMode;
    if(mode==='pending')return new Promise(resolve=>fixture.deferred.push({resolve:()=>resolve(answer('confirmed'))}));
    return Promise.resolve(answer(mode));
  }
  function App(){
    const [account,setAccount]=useState(initial);
    const [stage,setStage]=useState(sessionStorage.getItem('fixture-stage')||'creation');
    const [available,setAvailable]=useState(true);
    fixture.navigate=to=>{if(to.endsWith('/builder/first-class')){sessionStorage.setItem('fixture-stage','class');setStage('class')}};
    fixture.hideCatalog=()=>setAvailable(false);
    fixture.changeAccount=id=>{
      sessionStorage.setItem('fixture-account',id);
      fixture.account=id;fixture.authChange?.('SIGNED_IN',{user:{id}});setAccount(id);
    };
    fixture.failSignOut=()=>{fixture.signOutAttempts++;return {error:'simulated network failure'}};
    fixture.confirmSignOut=()=>{
      sessionStorage.setItem('fixture-account','signed-out');
      fixture.account=null;fixture.authChange?.('SIGNED_OUT',null);setAccount(null);
    };
    fixture.seedCurrentPending=intent=>persistPendingCreation(intent,getCreationScope(),sessionStorage);
    fixture.seedClassPending=intent=>persistPendingFirstClass(intent,getCreationScope(),sessionStorage);
    return <main><h1>Local creation behavior fixture</h1>
      <p>Simulated Auth and actions; real creation form and account boundary.</p>
      <CreationSessionBoundary accountId={account}/>
      {account?stage==='class'?<FirstClassForm accountId={account} characterId={target} canStart={available}
        classes={available?[{id:system,name:'Fighter',version:1}]:[]}
        submitAction={intent=>sendClass('class-save',account,intent)} checkAction={intent=>sendClass('class-check',account,intent)}/>:<OriginCreationForm accountId={account}
        systems={[{id:system,name:'D&D 5e',slug:'dnd-5e-2014'}]}
        submitAction={intent=>send('create',account,intent)} checkAction={intent=>send('check',account,intent)}/>
        :<p role='status'>Fixture signed out.</p>}
    </main>
  }
  createRoot(document.getElementById('root')).render(<App/>);
`;
try {
  await fs.writeFile(evidencePath, JSON.stringify(result, null, 2));
  const bundle = await build({
    stdin: { contents: fixtureSource, resolveDir: root, sourcefile: "local-creation-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, metafile: true, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "offline-creation-boundaries",
      setup(builder) {
        builder.onResolve({ filter: /^(next\/navigation|next\/link|@\/lib\/supabase\/client)$/ },
          args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
        builder.onResolve({ filter: /^(server-only|@supabase\/|@\/lib\/auth\/|@\/lib\/supabase\/.*server|.*origin-actions|.*\.env)/ },
          args => { throw Error("Forbidden real server/Auth/env boundary: " + args.path); });
      },
    }],
  });
  const code = bundle.outputFiles[0].contents;
  const inputs = [];
  for (const name of Object.keys(bundle.metafile.inputs).sort()) {
    if (name === "local-creation-fixture.tsx" || name === "<stdin>" || name.startsWith("fixture:")) continue;
    const absolute = path.resolve(root, name);
    assert.ok(absolute.startsWith(root + path.sep), "Bundle input outside this workspace");
    assert.ok(!/(^|[\\/])\.env(?:\.|$)|[\\/]@supabase[\\/]|origin-actions|character-command-server/.test(name), "Forbidden bundle input");
    inputs.push({ path: name.replaceAll("\\", "/"), sha256: digest(await fs.readFile(absolute)) });
  }
  for (const required of ["app/(app)/characters/new/origin-form.tsx", "app/(app)/characters/[id]/builder/first-class/first-class-form.tsx", "components/auth/creation-session-boundary.tsx"]) {
    assert.ok(inputs.some(row => row.path === required), "Missing actual UI source: " + required);
  }
  result.source = { bundleSha256: digest(code), fixtureSha256: digest(fixtureSource), inputs };
  await fs.writeFile(path.join(output, "fixture.js"), code);
  const css = "body{margin:0;background:#111827;color:#f8fafc;font:16px system-ui}main{max-width:36rem;margin:auto;padding:24px}button,input,select{font:inherit;margin:8px 0;padding:10px;max-width:100%;box-sizing:border-box}button{margin-right:8px}input,select{display:block;width:100%}button:disabled{opacity:.5}a{color:#fde68a}p{line-height:1.6}";
  server = http.createServer((request, response) => {
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(code); }
    else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
    else if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); }
    else if (request.url === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local creation fixture</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  origin = "http://127.0.0.1:" + port;
  serverIdentity = { pid: process.pid, parentPid: process.ppid, command: process.execPath,
    arguments: process.argv.slice(1), cwd: root, runStartedUtc, listeningPort: port, listeningSinceUtc: new Date().toISOString() };
  console.log(JSON.stringify({ ownedHttpServer: serverIdentity }));
  // Narrow child environment: never pass project Supabase/private variables.
  const browserEnv = Object.fromEntries(["SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LOCALAPPDATA", "PATH"]
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  browserServer = await chromium.launchServer({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, env: browserEnv, host: "127.0.0.1",
  });
  const ownedBrowser = browserServer.process();
  browserExit = new Promise(resolve => ownedBrowser.once("exit", (code, signal) => resolve({ code, signal })));
  browserIdentity = { pid: ownedBrowser.pid, parentPid: process.pid, command: ownedBrowser.spawnfile,
    arguments: ownedBrowser.spawnargs.slice(1), cwd: root, observedStartedUtc: new Date().toISOString(), listeningPort: null };
  browserControlIdentity = { pid: process.pid, parentPid: process.ppid, cwd: root,
    listeningPort: Number(new URL(browserServer.wsEndpoint()).port), listeningHost: "127.0.0.1",
    observedStartedUtc: new Date().toISOString() };
  console.log(JSON.stringify({ ownedBrowser: browserIdentity }));
  console.log(JSON.stringify({ ownedBrowserControl: browserControlIdentity }));
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) {
        blockedRemoteRequests.push({ viewport: label, url: route.request().url() }); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push({ viewport: label, message: error.message }));
    const note = check => evidence.push({ viewport: label, check, passed: true });
    const fresh = async () => {
      await page.goto(origin);
      await page.evaluate(() => { sessionStorage.clear(); });
      await page.reload();
      await page.getByRole("textbox", { name: "What will they be called?" }).waitFor();
    };
    const createPending = async () => {
      await page.getByRole("textbox", { name: "What will they be called?" }).fill(" Elara ");
      await page.getByRole("button", { name: "Open the notebook" }).click();
      await page.waitForFunction(() => window.fixture.calls.length === 1);
      return JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)));
    };
    await fresh();
    const original = await createPending();
    assert.equal(original.intent.fields.name, "Elara");
    assert.equal(await page.evaluate(() => window.fixture.calls[0].storedBeforeRequest), true);
    const rawBefore = await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A));
    await page.reload(); // Actual full document reload, same origin/tab storage.
    await page.getByRole("button", { name: "Check result" }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), rawBefore);
    assert.equal(await page.getByRole("textbox").count(), 0);
    note("actual reload retains exact original ID/intent; editing remains unavailable");
    await page.getByRole("button", { name: "Check result" }).click();
    await page.getByRole("status").filter({ hasText: "No saved result was found yet" }).waitFor();
    await page.evaluate(() => { window.fixture.createMode = "unavailable"; });
    await page.getByRole("button", { name: "Retry original request" }).click();
    await page.getByRole("status").filter({ hasText: "The result is not confirmed yet" }).waitFor();
    const calls = await page.evaluate(() => window.fixture.calls);
    assert.deepEqual(calls.map(row => row.kind), ["create", "check", "create"]);
    assert.deepEqual(calls.map(row => row.intent), [original.intent, original.intent, original.intent]);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), rawBefore);
    note("explicit absent check and uncertain retry reuse the same complete original request");
    await page.screenshot({ path: path.join(output, label + "-pending.png"), fullPage: true });
    await page.evaluate(() => { window.fixture.checkMode = "confirmed"; });
    await page.getByRole("button", { name: "Check result" }).click();
    await page.waitForFunction(() => window.fixture.navigation.length === 1);
    assert.deepEqual(await page.evaluate(() => window.fixture.navigation), ["/characters/" + TARGET + "/builder/first-class"]);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), null);
    note("matching simulated owned confirmation alone clears and routes to the saved character");

    await fresh(); const beforeSwitch = await createPending();
    await page.evaluate(id => window.fixture.changeAccount(id), B);
    await page.waitForFunction(id => window.fixture.account === id, B);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), null);
    // Observe B's restored form before seeding a separate B original; this
    // avoids racing that form's initial storage-read effect.
    await page.getByRole("textbox", { name: "What will they be called?" }).waitFor();
    await page.evaluate(intent => window.fixture.seedCurrentPending(intent), beforeSwitch.intent);
    const nextBytes = await page.evaluate(key => sessionStorage.getItem(key), pendingKey(B));
    assert.equal(await page.evaluate(() => { try { window.fixture.staleWrite(); return false; } catch { return true; } }), true);
    // Await real browser render turns after releasing the simulated response;
    // an immediate assertion that navigation is empty would race the callback.
    await page.evaluate(async () => {
      window.fixture.deferred[0].resolve();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(B)), nextBytes);
    assert.deepEqual(await page.evaluate(() => window.fixture.navigation), []);
    note("A-to-B invalidates old writes and a late A confirmation cannot clear B's original");

    await fresh(); await createPending();
    const beforeSignOut = await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A));
    await page.evaluate(() => window.fixture.failSignOut());
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), beforeSignOut);
    note("failed sign-out attempt preserves the unresolved operation");
    await page.evaluate(() => window.fixture.confirmSignOut());
    await page.getByRole("status").filter({ hasText: "Fixture signed out" }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), null);
    assert.equal(await page.evaluate(() => { try { window.fixture.staleWrite(); return false; } catch { return true; } }), true);
    await page.evaluate(async () => {
      window.fixture.deferred[0].resolve();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.deepEqual(await page.evaluate(() => window.fixture.navigation), []);
    note("confirmed sign-out clears and prevents old writes/late navigation");

    const enterClass = async () => {
      await fresh();
      await page.evaluate(() => { window.fixture.createMode = "confirmed"; });
      await page.getByRole("textbox", { name: "What will they be called?" }).fill("Elara");
      await page.getByRole("button", { name: "Open the notebook" }).click();
      await page.getByRole("combobox", { name: "First class", exact: true }).waitFor();
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey(A)), null);
    };
    const saveClass = async () => {
      await page.getByRole("combobox", { name: "First class", exact: true }).selectOption("10000000-0000-4000-8000-000000000005");
      await page.getByRole("button", { name: "Save first class", exact: true }).click();
      await page.waitForFunction(() => window.fixture.calls.some(row => row.kind === "class-save"));
      return JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)));
    };
    await enterClass();
    const classOriginal = await saveClass();
    assert.equal(classOriginal.intent.fields.content_version, 1);
    assert.equal(classOriginal.intent.expected_action_revision, "0");
    const classBytes = await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A));
    await page.reload();
    await page.getByRole("button", { name: "Check class save" }).waitFor();
    assert.equal(await page.getByRole("combobox").count(), 0);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), classBytes);
    note("creation proceeds to real first-class form; complete class intent survives actual reload");
    await page.evaluate(() => window.fixture.hideCatalog());
    await page.getByRole("button", { name: "Check class save" }).click();
    await page.getByRole("status").filter({ hasText: "No saved result was found yet" }).waitFor();
    await page.evaluate(() => { window.fixture.classMode = "unavailable"; });
    await page.getByRole("button", { name: "Retry original class save" }).click();
    await page.getByRole("status").filter({ hasText: "The class save is not confirmed yet" }).waitFor();
    const classCalls = (await page.evaluate(() => window.fixture.calls)).filter(row => row.kind.startsWith("class-"));
    assert.deepEqual(classCalls.map(row => row.kind), ["class-save", "class-check", "class-save"]);
    assert.deepEqual(classCalls.map(row => row.intent), [classOriginal.intent, classOriginal.intent, classOriginal.intent]);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), classBytes);
    note("absent class result and uncertain retry retain the same original even without today's catalog");
    await page.evaluate(() => { window.fixture.classCheckMode = "mismatch"; });
    await page.getByRole("button", { name: "Check class save" }).click();
    await page.getByRole("status").filter({ hasText: "did not match your original class choice" }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), classBytes);
    note("confirmation for a different character cannot clear the original class save");
    await page.screenshot({ path: path.join(output, label + "-class-pending.png"), fullPage: true });
    await page.evaluate(() => { window.fixture.classCheckMode = "confirmed"; });
    await page.getByRole("button", { name: "Check class save" }).click();
    await page.getByRole("link", { name: "View saved class" }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), null);
    note("matching simulated class receipt alone clears the retained class request");

    await enterClass(); const classBeforeSwitch = await saveClass();
    await page.evaluate(id => window.fixture.changeAccount(id), B);
    await page.getByRole("combobox", { name: "First class", exact: true }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), null);
    await page.evaluate(intent => window.fixture.seedClassPending(intent), classBeforeSwitch.intent);
    const nextClassBytes = await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(B));
    assert.equal(await page.evaluate(() => { try { window.fixture.staleWrite(); return false; } catch { return true; } }), true);
    await page.evaluate(async () => {
      window.fixture.deferred[0].resolve();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(B)), nextClassBytes);
    assert.equal(await page.getByRole("link", { name: "View saved class" }).count(), 0);
    note("account transition invalidates old class writes and ignores the late previous-account receipt");

    await enterClass(); await saveClass();
    const classBeforeSignout = await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A));
    await page.evaluate(() => window.fixture.failSignOut());
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), classBeforeSignout);
    note("failed sign-out preserves the unfinished class save");
    await page.evaluate(() => window.fixture.confirmSignOut());
    await page.getByRole("status").filter({ hasText: "Fixture signed out" }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingClassKey(A)), null);
    assert.equal(await page.evaluate(() => { try { window.fixture.staleWrite(); return false; } catch { return true; } }), true);
    await page.evaluate(async () => {
      window.fixture.deferred[0].resolve();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.equal(await page.getByRole("link", { name: "View saved class" }).count(), 0);
    note("confirmed sign-out clears class originals and prevents late accepted callbacks");
    await context.close();

    const denied = await browser.newContext({ viewport, serviceWorkers: "block" });
    await denied.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) {
        blockedRemoteRequests.push({ viewport: label, url: route.request().url() }); return route.abort();
      }
      return route.continue();
    });
    await denied.addInitScript(() => {
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("inkborne:pending-creation:v1:") || key.startsWith("inkborne:pending-first-class:v1:")) throw new DOMException("Simulated denial", "QuotaExceededError");
        return originalSet.call(this, key, value);
      };
    });
    const deniedPage = await denied.newPage();
    deniedPage.on("pageerror", error => pageErrors.push({ viewport: label, message: error.message }));
    await deniedPage.goto(origin);
    await deniedPage.getByRole("textbox", { name: "What will they be called?" }).fill("Elara");
    await deniedPage.getByRole("button", { name: "Open the notebook" }).click();
    await deniedPage.getByRole("status").filter({ hasText: "No new request was sent" }).waitFor();
    assert.deepEqual(await deniedPage.evaluate(() => window.fixture.calls), []);
    await deniedPage.screenshot({ path: path.join(output, label + "-storage-denied.png"), fullPage: true });
    note("storage failure blocks the first action entirely");
    await deniedPage.evaluate(() => window.fixture.navigate('/characters/10000000-0000-4000-8000-000000000003/builder/first-class'));
    await deniedPage.getByRole("combobox", { name: "First class", exact: true }).selectOption("10000000-0000-4000-8000-000000000005");
    await deniedPage.getByRole("button", { name: "Save first class", exact: true }).click();
    await deniedPage.getByRole("status").filter({ hasText: "No new save was sent" }).waitFor();
    assert.deepEqual(await deniedPage.evaluate(() => window.fixture.calls), []);
    note("class-intent storage failure sends no class action");
    await denied.close();
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedRemoteRequests, []);
  result = { ...result, status: "passed" };
} catch (error) {
  result = { ...result, status: "failed", error: String(error) };
  process.exitCode = 1;
} finally {
  const cleanup = { browserClosed: false, browserProcessExited: false, httpClosed: false, portClosed: false, controlPortClosed: false };
  const portClosed = port => new Promise(resolve => {
    const probe = net.createConnection({ host: "127.0.0.1", port });
    probe.once("connect", () => { probe.destroy(); resolve(false); });
    probe.once("error", error => resolve(error.code === "ECONNREFUSED"));
    probe.setTimeout(2000, () => { probe.destroy(); resolve(false); });
  });
  const cleanupErrors = [];
  try {
    if (browser) await browser.close();
  } catch (error) { cleanupErrors.push(String(error)); }
  try {
    if (browserServer) {
      await browserServer.close(); cleanup.browserClosed = true;
      let timer;
      try {
        const exit = await Promise.race([browserExit, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Owned browser did not exit")), 10000); })]);
        cleanup.browserProcessExited = exit !== undefined;
      } finally { clearTimeout(timer); }
      cleanup.controlPortClosed = await portClosed(browserControlIdentity.listeningPort);
    }
  } catch (error) { cleanupErrors.push(String(error)); }
  try {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      cleanup.httpClosed = !server.listening;
      cleanup.portClosed = await portClosed(serverIdentity.listeningPort);
    }
  } catch (error) { cleanupErrors.push(String(error)); }
  if ((browserServer && (!cleanup.browserClosed || !cleanup.browserProcessExited || !cleanup.controlPortClosed))
    || (server && (!cleanup.httpClosed || !cleanup.portClosed))) cleanupErrors.push("Owned resource cleanup not confirmed");
  if (cleanupErrors.length) { result = { ...result, status: "failed", cleanupErrors }; process.exitCode = 1; }
  const finalEvidence = JSON.stringify({ ...result, evidence, pageErrors, blockedRemoteRequests,
    ownedHttpServer: serverIdentity, ownedBrowser: browserIdentity, ownedBrowserControl: browserControlIdentity,
    cleanup, finishedUtc: new Date().toISOString(), output }, null, 2);
  await fs.writeFile(evidencePath, finalEvidence);
  // Keep every run, including failures; this is only the latest-run index.
  await fs.writeFile(path.join(outputRoot, "evidence.json"), finalEvidence);
  if (await fs.readFile(lockPath, "utf8") === lockText) await fs.unlink(lockPath);
  console.log(JSON.stringify({ status: result.status, checks: evidence.length, output, cleanup }));
}
