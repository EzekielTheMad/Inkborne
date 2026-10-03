/** Real installed Next App Router, page-owned provider and actual RestDialog.
 * Offline-only local API, no auth/env file, no hosted writes. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { restAfterSettledBack } from "../e2e/bounded/rest-recovery.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "next-rest-local");
const project = path.join(output, "app-fixture");
const write = async (name, text) => { const file = path.join(project, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); };
await fs.mkdir(project, { recursive: true });
try { await fs.symlink(path.join(root, "node_modules"), path.join(project, "node_modules"), "junction"); }
catch (error) { if (error.code !== "EEXIST") throw error; }
await write("package.json", JSON.stringify({ name: "inkborne-offline-route-fixture", private: true }));
await write("next.config.mjs", "export default { experimental: { serverActions: { bodySizeLimit: '6mb' } } };\n");
await write("app/layout.jsx", "export default function Layout({children}){return <html><body><main>{children}</main></body></html>}\n");
await write("state.mjs", `const key=Symbol.for('inkborne.local.route.state');export function state(){return globalThis[key]??={current_hp:10,temp_hp:0,hit_dice_spent:{barbarian:1}}}export function patch(value){Object.assign(state(),value)}\n`);
await write("app/api/state/route.js", `import {state,patch} from '../../../state.mjs';export const dynamic='force-dynamic';export function GET(){return Response.json(state())}export async function POST(request){patch(await request.json());return Response.json(state())}\n`);
await write("app/characters/[id]/page.jsx", `import Fixture from './fixture-client.js';import {state} from '../../../state.mjs';export const dynamic='force-dynamic';export default function Page(){return <Fixture initialState={JSON.parse(JSON.stringify(state()))}/>}\n`);
await write("app/characters/[id]/builder/page.jsx", `import Link from 'next/link';export default function Page(){return <><h1>Local builder</h1><Link href='/characters/local-character'>View Character</Link></>}\n`);
const stubs = {
  "@/lib/sheet/update-state": `export async function updateCharacterState(id,patch){const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});if(!r.ok)throw new Error('Known local rejection')}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(){}export async function updateInventoryItem(){}export async function removeInventoryItem(){}export async function unequipAllArmor(){}`,
  "@/lib/supabase/spells": `export async function addCharacterSpell(){}export async function updateCharacterSpell(){}export async function removeCharacterSpell(){}`,
  "@/lib/supabase/rolls": `export async function insertRoll(){throw new Error('No rolls permitted in this local rest test')}`,
};
await build({ stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-next-rest-client.tsx", contents: `
  import React,{useEffect,useRef,useState} from 'react';import Link from 'next/link';
  import {CharacterProvider,useCharacterState} from '@/lib/character/character-context';
  import {RestButton} from '@/components/sheet/rest-button';import {HPTracker} from '@/components/sheet/hp-tracker';
  const character={id:'local-character',user_id:'local-owner',level:1,choices:{classes:[{slug:'barbarian',level:1}]},base_stats:{constitution:14},narrative:{}};
  const schema={ability_scores:[],proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
  function Sheet(){const {state,patchState,patchActionState}=useCharacterState();const ref=useRef(null);const [session,setSession]=useState('');useEffect(()=>{const e=window.localNextEvidence??={next:0,events:[]};ref.current??=String(++e.next);setSession(ref.current);e.events.push({kind:'mount',session:ref.current});return()=>e.events.push({kind:'unmount',session:ref.current})},[]);return <><output aria-label='Page session'>{session}</output><Link href='/characters/local-character/builder'>Edit character</Link><HPTracker currentHp={state.current_hp} tempHp={state.temp_hp} maxHp={14} patchState={patchState} patchActionState={patchActionState}/><RestButton/><output aria-label='Current HP'>{state.current_hp}</output><output aria-label='Spent dice'>{state.hit_dice_spent?.barbarian??0}</output></>}
  export default function Fixture({initialState}){return <><h1>Local character sheet</h1><CharacterProvider character={character} schema={schema} contentRefs={[]} initialState={initialState} initialInventory={[]} initialSpells={[]} initialRolls={[]} classData={{barbarian:{slug:'barbarian',data:{hit_die:12}}}} allEffects={[]} baseStatsWithLevel={{constitution:14,level:1}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={14} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></>}
` }, outfile: path.join(project, "app/characters/[id]/fixture-client.js"), bundle: true,
  format: "esm", platform: "browser", jsx: "automatic", banner: { js: '"use client"; import * as __fixtureReact from "react";' },
  external: ["react", "react/*", "react-dom", "react-dom/*", "next/*"],
  plugins: [{ name: "offline-persistence", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(sheet\/update-state|supabase\/(inventory|spells|rolls))$/ }, args => ({ path: args.path, namespace: "offline" }));
    builder.onLoad({ filter: /.*/, namespace: "offline" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } }],
});
// Preserve one React instance when bundled CommonJS shims require React.
const clientFile = path.join(project,"app/characters/[id]/fixture-client.js");
await fs.writeFile(clientFile,(await fs.readFile(clientFile,"utf8")).replaceAll('__require("react")','__fixtureReact'));
const cssNames = (await fs.readdir(path.join(root, ".next/static/chunks"))).filter(name => name.endsWith(".css"));
const css = (await Promise.all(cssNames.map(name => fs.readFile(path.join(root, ".next/static/chunks", name), "utf8")))).join("\n");
await write("app/fixture.css", css);
await fs.mkdir(path.join(project,"media"),{recursive:true});
for(const name of await fs.readdir(path.join(root,".next/static/media")))if(name.endsWith(".woff2"))await fs.copyFile(path.join(root,".next/static/media",name),path.join(project,"media",name));
await write("app/layout.jsx", "import './fixture.css';export default function Layout({children}){return <html><body><main>{children}</main></body></html>}\n");
const portProbe = net.createServer();await new Promise(resolve => portProbe.listen(0,"127.0.0.1",resolve));
const port = portProbe.address().port;await new Promise(resolve => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env={...process.env,NEXT_TELEMETRY_DISABLED:"1"};
for(const key of Object.keys(env))if(/SUPABASE|^E2E_|^INKBORNE_/.test(key))delete env[key];
// Webpack avoids external node_modules junction restrictions in this isolated project.
// It changes only this fixture's bundler, not the app's cache/navigation configuration.
const server = spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"dev",project,"--webpack","--hostname","127.0.0.1","--port",String(port)],{cwd:project,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let serverLog="";server.stdout.on("data",data=>{serverLog+=data});server.stderr.on("data",data=>{serverLog+=data});
let browser;let release;const evidence={version:"Next 16.2.10",cacheComponents:false,bundler:"webpack",origin,events:[],remoteRequests:[],errors:[]};
try {
  const started=Date.now();while(true){if(server.exitCode!==null)throw new Error("Local Next exited before ready");try{const r=await fetch(origin+"/api/state");if(r.ok)break}catch{}if(Date.now()-started>180000)throw new Error("Local Next readiness failed");await new Promise(resolve=>setTimeout(resolve,250))}
  browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  await context.route("**/*",route=>{if(new URL(route.request().url()).origin!==origin){evidence.remoteRequests.push(route.request().url());return route.abort()}return route.continue()});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);page.on("pageerror",e=>evidence.errors.push(e.message));
  assert.equal((await page.goto(origin+"/characters/local-character")).status(),200);
  const session=page.getByLabel("Page session");await session.waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Page session"]').textContent!=='');
  evidence.initialSession=await session.textContent();
  let requests=0,settled=0;let mode="hold-reject";const gate=new Promise(resolve=>{release=resolve});
  await page.route(origin+"/api/state",async route=>{if(route.request().method()!=="POST")return route.continue();requests++;if(mode==="hold-reject"){await gate;await route.fulfill({status:403,contentType:"application/json",body:'{"error":"Injected before forwarding"}'});settled++;return}return route.continue()});
  const rest=page.getByRole("dialog",{name:"Rest",exact:true});
  await page.getByRole("button",{name:"Rest",exact:true}).click();await rest.getByRole("button",{name:"Take Long Rest",exact:true}).click();
  await rest.waitFor();assert.equal(await rest.getAttribute("aria-busy"),"true");assert.equal(await rest.getByRole("button",{name:"Take Long Rest",exact:true}).isDisabled(),true);assert.match(await rest.getByRole("status").textContent(),/Saving this rest action/);
  await expect.poll(()=>requests,{timeout:12000}).toBe(1);
  await fs.writeFile(path.join(output,"pending-sheet.txt"),await page.locator("body").ariaSnapshot());
  await page.getByRole("link",{name:"Edit character",includeHidden:true}).evaluate(node=>node.click());await page.waitForURL("**/characters/local-character/builder");
  await page.getByRole("heading",{name:"Local builder",exact:true}).waitFor();
  const response=page.waitForResponse(r=>r.url()===origin+"/api/state"&&r.request().method()==="POST");release();release=undefined;
  assert.equal(await (await response).finished(),null);assert.equal(settled,1);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  evidence.persistedAfterReject=await (await fetch(origin+"/api/state")).json();assert.deepEqual(evidence.persistedAfterReject,{current_hp:10,temp_hp:0,hit_dice_spent:{barbarian:1}});
  await page.goBack();await page.getByRole("heading",{name:"Local character sheet",exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Page session"]').textContent!=='');
  evidence.backSession=await session.textContent();evidence.dialogsAfterBack=await rest.count();evidence.events=await page.evaluate(()=>window.localNextEvidence.events);
  await fs.writeFile(path.join(output,"back-sheet.txt"),await page.locator("body").ariaSnapshot());
  assert.notEqual(evidence.backSession,evidence.initialSession);assert.equal(evidence.dialogsAfterBack,0);
  assert.equal(await page.getByLabel("Current HP").textContent(),"10");assert.equal(await page.getByLabel("Spent dice").textContent(),"1");
  const recovery=await restAfterSettledBack(page);assert.equal(recovery.lifecycle,"dialog-reopened");evidence.lifecycle=recovery.lifecycle;assert.equal(requests,1);
  mode="pass";await rest.getByRole("button",{name:"Take Long Rest",exact:true}).click();await rest.waitFor({state:"hidden"});
  evidence.persistedAfterExplicitRetry=await (await fetch(origin+"/api/state")).json();assert.equal(evidence.persistedAfterExplicitRetry.current_hp,14);assert.equal(evidence.persistedAfterExplicitRetry.hit_dice_spent.barbarian,0);assert.equal(requests,2);
  await page.reload();assert.equal(await page.getByLabel("Current HP").textContent(),"14");assert.equal(await page.getByLabel("Spent dice").textContent(),"0");
  evidence.passed=true;evidence.requests=requests;evidence.blindRetries=0;assert.deepEqual(evidence.remoteRequests,[]);assert.deepEqual(evidence.errors,[]);
  await fs.writeFile(path.join(output,"evidence.json"),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
} finally {
  release?.();if(browser)await browser.close();
  if(server.exitCode===null){const killer=spawn("taskkill",["/PID",String(server.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});await new Promise(resolve=>killer.once("exit",resolve));}
  await fs.writeFile(path.join(output,"server.log"),serverLog);
}
