/** Actual provider, conditional dispatcher and rest dialog; local CAS model only.
 * Installed Chrome, retained React Activity and real history Back; no hosted config. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "short-rest-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "@/lib/supabase/client": `export function createClient(){return {rpc:(name,args)=>window.fixtureRpc(name,args)}}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(){} export async function updateInventoryItem(){} export async function removeInventoryItem(){} export async function unequipAllArmor(){}`,
  "@/lib/supabase/spells": `export async function addCharacterSpell(){} export async function updateCharacterSpell(){} export async function removeCharacterSpell(){}`,
  "@/lib/supabase/rolls": `export async function insertRoll(){throw new Error('Unexpected roll persistence in state-only recovery')}`,
};
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-short-rest-fixture.tsx", contents: `
    import React,{Activity,useEffect,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {CharacterProvider,useCharacterState,useRest} from '@/lib/character/character-context';
    import {RestDialog} from '@/components/sheet/rest-dialog';
    const raw=window.fixture.raw;
    const character={id:'local-character',state:raw,choices:{classes:[{slug:'wizard',level:3},{slug:'fighter',level:1}]},base_stats:{},narrative:{}};
    const schema={ability_scores:[],proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
    const refs=[{content_definitions:{id:'ar',slug:'arcane-recovery',name:'Arcane Recovery',content_type:'feature',data:{class:'wizard',level:1,usages:1,recovery:'long rest'},effects:[]}},{content_definitions:{id:'wind',slug:'second-wind',name:'Second Wind',content_type:'feature',data:{class:'fighter',level:1,usages:1,recovery:'short rest'},effects:[]}}];
    function Sheet(){const saves=useCharacterState();const rest=useRest();const [open,setOpen]=useState(false);window.fixture.saves=saves;window.fixture.rest=rest;return <><button onClick={()=>setOpen(true)}>Open rest</button><output aria-label='Character state'>{JSON.stringify(saves.state)}</output><RestDialog open={open} onClose={()=>setOpen(false)}/></>}
    function App(){const [route,setRoute]=useState(location.pathname);useEffect(()=>{const pop=()=>setRoute(location.pathname);window.addEventListener('popstate',pop);window.fixture.away=()=>{history.pushState({},'','/away');setRoute('/away')};return()=>window.removeEventListener('popstate',pop)},[]);return <><h1>Local conditional short-rest fixture</h1><p>Simulated CAS persistence and history; actual provider, dispatcher and dialogs.</p>{route==='/away'&&<h2>Away fixture</h2>}<Activity mode={route==='/sheet'?'visible':'hidden'}><CharacterProvider character={character} schema={schema} contentRefs={refs} initialState={{...raw,temp_hp:0}} initialInventory={[]} initialSpells={[]} classData={{wizard:{slug:'wizard',data:{hit_die:6,spellcasting:{type:'full',ability:'intelligence'}}},fighter:{slug:'fighter',data:{hit_die:10}}}} allEffects={[]} baseStatsWithLevel={{level:4,constitution:10,intelligence:10}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></Activity></>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-boundaries", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/supabase\/(client|inventory|spells|rolls)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } }],
});
const baseline = { current_hp: 20, spell_slots_used: { pact: 1, "1": 2 }, feature_uses: { "second-wind": 1 }, quick_notes: "old" };
let stored = structuredClone(baseline);
let holdConditional = false;
const held = [];
const calls = [];
function settle(name, args, outcome = "normal") {
  if (name === "patch_character_state_if_current") {
    if (JSON.stringify(args.expected_state) !== JSON.stringify(stored)) return { error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] };
    stored = { ...stored, ...args.state_patch };
    if (outcome === "response-lost") return { error: { message: "Simulated committed response loss" }, data: null };
    return { error: null, data: [{ status: "applied", resulting_state: structuredClone(stored) }] };
  }
  assert.equal(name, "patch_character_state");
  stored = { ...stored, ...args.state_patch };
  return { error: null };
}
const cssFiles = (await fs.readdir(path.join(root, ".next/static/chunks"))).filter(name => name.endsWith(".css"));
const css = (await Promise.all(cssFiles.map(name => fs.readFile(path.join(root, ".next/static/chunks", name), "utf8")))).join("\n");
const server = http.createServer(async (request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Local short rest</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px"><div id="root"></div></main><script>window.fixture={raw:'+JSON.stringify(stored)+'}</script><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const evidence = [];
try {
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const remoteRequests = []; const errors = [];
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) { remoteRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await context.exposeBinding("fixtureRpc", async ({ page }, name, args) => {
    calls.push({ page: page.url(), name, args: structuredClone(args) });
    if (holdConditional && name === "patch_character_state_if_current") {
      return new Promise(resolve => held.push(outcome => resolve(settle(name, args, outcome))));
    }
    return settle(name, args);
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  async function reset(viewport = {width:1280,height:900}) {
    assert.equal(held.length, 0); stored = structuredClone(baseline); calls.length = 0; holdConditional = false;
    await page.setViewportSize(viewport); await page.goto(origin + "/sheet");
    await page.getByRole("button", {name:"Open rest",exact:true}).waitFor();
  }
  async function open(picks = 0, target = page) {
    await target.getByRole("button", {name:"Open rest",exact:true}).click();
    for (let i = 0; i < picks; i++) await target.getByRole("button", {name:"Recover one more 1st-level slot",exact:true}).click();
  }
  async function away() { await page.evaluate(()=>window.fixture.away()); await page.getByRole("heading", {name:"Away fixture"}).waitFor(); }
  async function localState(target = page) { return JSON.parse(await target.getByLabel("Character state").textContent()); }
  await reset(); await open();
  await page.getByRole("button", {name:"Take Short Rest",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"hidden"});
  assert.equal(calls.length, 1); assert.equal(calls[0].name, "patch_character_state_if_current");
  assert.deepEqual(calls[0].args.expected_state, baseline);
  assert.equal("current_hp" in calls[0].args.state_patch, false);
  assert.deepEqual(stored.spell_slots_used, {pact:0,"1":2});
  assert.deepEqual(stored.feature_uses, {"second-wind":0});
  evidence.push({check:"actual full-HP pact/resource recovery uses raw CAS without HP patch",passed:true});

  await reset(); await open(2);
  await page.getByRole("button", {name:"Take Short Rest",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"hidden"});
  assert.equal(calls.length, 1); assert.deepEqual(stored.spell_slots_used,{pact:0,"1":0});
  assert.deepEqual(stored.feature_uses,{"second-wind":0,"arcane-recovery":1});
  evidence.push({check:"actual Arcane Recovery picker combines slots and resource reset in one conditional save",passed:true});

  await reset(); holdConditional = true; const other = await context.newPage(); other.on("pageerror", error => errors.push(error.message));
  await other.goto(origin + "/sheet"); await open(1); await open(2,other);
  await page.getByRole("button",{name:"Take Short Rest",exact:true}).click();
  await other.getByRole("button",{name:"Take Short Rest",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[role="status"]')!==null);
  assert.equal(held.length, 2); assert.deepEqual(calls.map(call=>call.args.expected_state),[baseline,baseline]);
  held.shift()(); await page.getByRole("dialog").waitFor({state:"hidden"});
  held.shift()(); await other.getByRole("alert").filter({hasText:"Reload before choosing a new action"}).last().waitFor();
  assert.deepEqual(stored.spell_slots_used,{pact:0,"1":1});
  assert.deepEqual((await localState(other)).spell_slots_used,baseline.spell_slots_used);
  await other.getByRole("button",{name:"Take Short Rest",exact:true}).click();
  await other.getByRole("status").waitFor({state:"hidden"}); assert.equal(calls.length,2);
  await other.getByRole("button",{name:"Close",exact:true}).click();
  await other.getByRole("button",{name:"Reload character",exact:true}).click();
  await other.waitForFunction(()=>window.fixture?.raw?.spell_slots_used?.pact===0);
  assert.deepEqual((await localState(other)).spell_slots_used,stored.spell_slots_used); assert.equal(calls.length,2);
  await other.close();
  evidence.push({check:"two actual providers reject competing recovery, preserve winner, reload without replay",passed:true});

  for (const outcome of ["success","conflict","response-lost"]) {
    await reset({width:390,height:844}); holdConditional = true; await open(1);
    await page.getByRole("button",{name:"Take Short Rest",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[role="status"]')!==null); assert.equal(held.length,1);
    if (outcome !== "success") await page.evaluate(()=>{window.fixture.notes=window.fixture.saves.patchState({quick_notes:'independent draft'})});
    await away();
    if (outcome === "conflict") stored={...stored,current_hp:19};
    held.shift()(outcome);
    if (outcome !== "success") await page.evaluate(()=>window.fixture.notes);
    // Allow the retained session to receive settlement while Activity is hidden.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.goBack();
    if (outcome === "success") {
      await page.getByRole("dialog").waitFor({state:"hidden"}); assert.equal(calls.length,1);
      assert.deepEqual(stored.spell_slots_used,{pact:0,"1":1});
    } else {
      await page.getByRole("alert").filter({hasText:outcome==='conflict'?'Reload before choosing a new action':'The character save could not be confirmed'}).last().waitFor();
      await page.getByRole("status").waitFor({state:"hidden"});
      assert.equal(await page.getByLabel("1 1st-level slot selected").count(),1);
      assert.equal((await localState()).quick_notes,'independent draft'); assert.equal(stored.quick_notes,'independent draft');
      assert.equal(calls.length,2); assert.equal(calls[1].name,'patch_character_state');
      await page.screenshot({path:path.join(output,`hidden-${outcome}-mobile.png`),fullPage:true});
      await page.getByRole("button",{name:"Take Short Rest",exact:true}).click();
      await page.getByRole("status").waitFor({state:"hidden"}); assert.equal(calls.length,2);
      await page.getByRole("button",{name:"Close",exact:true}).click();
      await page.getByRole("button",{name:"Reload character",exact:true}).click();
      await page.waitForFunction(()=>window.fixture?.raw?.quick_notes==='independent draft');
      assert.deepEqual((await localState()).spell_slots_used,stored.spell_slots_used); assert.equal(calls.length,2);
    }
    evidence.push({check:`mobile retained Activity short rest / hidden ${outcome} / notes and no replay`,passed:true});
  }
  assert.deepEqual(errors,[]); assert.deepEqual(remoteRequests,[]);
  await fs.writeFile(path.join(output,"evidence.json"),JSON.stringify({simulated:true,endpointModelOnly:true,evidence,errors,remoteRequests},null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {
  // Release any held bindings before closing Chromium, including assertion failures.
  while (held.length) held.shift()();
  try {
    if (browser) await browser.close();
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
}
