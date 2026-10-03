/** Actual provider, conditional dispatcher and state-only controls; local CAS model only.
 * Installed Chrome, retained React Activity and real history Back; no hosted config. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "state-controls-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from "react"; export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`,
  "next/navigation": `export function useRouter(){return {push(){},refresh(){}}}export function usePathname(){return '/sheet'}`,
  "@/components/sheet/content-tabs": `export function ContentTabs(){return null}`,
  "@/components/character/narrative-panel": `export function NarrativePanel(){return null}`,
  "@/lib/supabase/client": `export function createClient(){return {rpc:(name,args)=>window.fixtureRpc(name,args)}}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(){} export async function updateInventoryItem(){} export async function removeInventoryItem(){} export async function unequipAllArmor(){}`,
  "@/lib/supabase/spells": `export async function addCharacterSpell(){} export async function updateCharacterSpell(){} export async function removeCharacterSpell(){}`,
  "@/lib/supabase/rolls": `export async function insertRoll(){throw new Error('Unexpected roll persistence in state-only recovery')}`,
};
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-state-controls-fixture.tsx", contents: `
    import React,{Activity,useEffect,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {CharacterProvider,useCharacterState,useInventory} from '@/lib/character/character-context';
    import {CharacterShell} from '@/components/character/character-shell';
    import {CurrencyTracker} from '@/components/sheet/inventory/currency-tracker';
    const raw=window.fixture.raw;
    const character={id:'local-character',user_id:'local-user',name:'Local Character',level:5,state:raw,choices:{classes:[{slug:'wizard',level:3},{slug:'fighter',level:1},{slug:'barbarian',level:1}]},base_stats:{},narrative:{}};
    const schema={ability_scores:[],proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
    const refs=[{content_definitions:{id:'ar',slug:'arcane-recovery',name:'Arcane Recovery',content_type:'feature',data:{class:'wizard',level:1,usages:1,recovery:'long rest'},effects:[]}},{content_definitions:{id:'wind',slug:'second-wind',name:'Second Wind',content_type:'feature',data:{class:'fighter',level:1,usages:3,recovery:'short rest'},effects:[]}}];
    const spell={id:'local-spell',name:'Local Focus',class_slug:'wizard',content_definitions:{id:'focus',slug:'focus',name:'Local Focus',data:{level:1,duration:'1 minute',concentration:true,attack_type:'ranged'},effects:[]}};
    function Sheet(){const saves=useCharacterState();const inventory=useInventory();window.fixture.saves=saves;return <><pre aria-label='Character state' style={{fontSize:8,maxHeight:32,overflow:'hidden'}}>{JSON.stringify(saves.state)}</pre><CharacterShell campaignPageBacklinks={[]} timelineEvents={[]} relationships={[]}/><CurrencyTracker currency={inventory.currency} onChange={inventory.setCurrency}/></>}
    function App(){const [route,setRoute]=useState(location.pathname);useEffect(()=>{const pop=()=>setRoute(location.pathname);window.addEventListener('popstate',pop);window.fixture.away=()=>{history.pushState({},'','/away');setRoute('/away')};return()=>window.removeEventListener('popstate',pop)},[]);return <><h1>Local conditional state controls fixture</h1><p>Simulated CAS persistence and history; actual provider, dispatcher and dialogs.</p>{route==='/away'&&<h2>Away fixture</h2>}<Activity mode={route==='/sheet'?'visible':'hidden'}><CharacterProvider character={character} schema={schema} contentRefs={refs} initialState={{...raw,temp_hp:0}} initialInventory={[]} initialSpells={[spell]} classData={{wizard:{slug:'wizard',data:{hit_die:6,spellcasting:{type:'full',ability:'intelligence'}}},fighter:{slug:'fighter',data:{hit_die:10}},barbarian:{slug:'barbarian',data:{hit_die:12}}}} allEffects={[]} baseStatsWithLevel={{level:4,constitution:10,intelligence:10}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></Activity></>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/(link|navigation)|@\/components\/(sheet\/content-tabs|character\/narrative-panel)|@\/lib\/supabase\/(client|inventory|spells|rolls))$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } }],
});
const guard={id:'guard',slug:'guard',name:'Guarded',source:'custom',content_id:null,concentration:false,duration:{type:'special'},effects:[],applied_at:'2026-10-03T00:00:00Z',expires_at:null};
const linked={...guard,id:'old',slug:'old',name:'Old Focus',source:'spell',concentration:true};
const baseline={current_hp:0,conditions:['Poisoned'],exhaustion:1,death_saves:{successes:0,failures:1},inspiration:false,rage_active:false,seen_sheet_first_time:true,active_effects:[guard,linked],concentrating_on:{spell_slug:'old',spell_name:'Old Focus',slot_level:1,started_at:linked.applied_at},currency:{pp:0,gp:10,ep:0,sp:2,cp:3},quick_notes:'keep'};
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
  browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const errors=[]; const remoteRequests=[];
  await context.route("**/*",route=>{if(new URL(route.request().url()).origin!==origin){remoteRequests.push(route.request().url());return route.abort()}return route.continue()});
  await context.exposeBinding("fixtureRpc",async({page},name,args)=>{
    calls.push({page:page.url(),name,args:structuredClone(args)});
    if(holdConditional&&name==='patch_character_state_if_current') return new Promise(resolve=>held.push(outcome=>resolve(settle(name,args,outcome))));
    return settle(name,args);
  });
  const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  async function reset(mobile=false){assert.equal(held.length,0);stored=structuredClone(baseline);calls.length=0;holdConditional=false;await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});await page.goto(origin+'/sheet');await page.getByRole('button',{name:mobile?'Inspiration inactive':'Grant inspiration',exact:true}).waitFor()}
  async function settled(){await page.waitForFunction(()=>!window.fixture.saves.patchState.hasPendingWrites());await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'))}
  async function state(target=page){return JSON.parse(await target.getByLabel('Character state').textContent())}
  async function click(name,target=page){await target.getByRole('button',{name,exact:true}).click()}
  async function reload(target=page){await Promise.all([target.waitForEvent('domcontentloaded'),click('Reload character',target)]);await target.getByLabel('Character state').waitFor();await target.waitForFunction(()=>window.fixture?.saves!==undefined)}
  async function trigger(surface,mobile=true,target=page){
    if(surface==='currency'){await target.getByLabel('GP amount').fill('15');await click('Save currency',target);return}
    const names={conditions:'Remove Poisoned',death:'Success 1 (empty)',effects:'Remove Old Focus (ends concentration)',badge:'End concentration',inspiration:mobile?'Inspiration inactive':'Grant inspiration',activation:'Rage'};
    await click(names[surface],target);
  }
  for(const mobile of [false,true]){
    await reset(mobile);
    await trigger('inspiration',mobile);await settled();assert.equal(stored.inspiration,true);
    await trigger('conditions',mobile);await settled();assert.deepEqual(stored.conditions,[]);
    await click('Add Condition');await click('Blinded');await settled();assert.deepEqual(stored.conditions,['Blinded']);
    await click('Increase exhaustion');await settled();assert.equal(stored.exhaustion,2);
    await click('Decrease exhaustion');await settled();assert.equal(stored.exhaustion,1);
    await trigger('activation',mobile);await settled();assert.equal(stored.rage_active,true);
    await trigger('death',mobile);await settled();assert.deepEqual(stored.death_saves,{successes:1,failures:1});
    await click('Failure 2 (empty)');await settled();assert.deepEqual(stored.death_saves,{successes:1,failures:2});
    await trigger('effects',mobile);await settled();assert.equal(stored.concentrating_on,null);assert.deepEqual(stored.active_effects.map(effect=>effect.id),['guard']);
    await click('Add effect');await page.getByLabel('Custom effect name').fill('Half cover');await click('Add custom effect');await settled();assert.deepEqual(stored.active_effects.map(effect=>effect.name),['Guarded','Half cover']);
    await click('Add effect');await click('Local Focus');await settled();assert.equal(stored.concentrating_on.spell_slug,'focus');assert.equal(stored.active_effects.length,3);
    await trigger('currency',mobile);await settled();assert.equal(stored.currency.gp,15);assert.equal(stored.currency.sp,2);
    assert.equal(calls.length,12);assert.equal(calls.every(call=>call.name==='patch_character_state_if_current'),true);assert.deepEqual(calls[0].args.expected_state,baseline);
    await page.screenshot({path:path.join(output,`controls-${mobile?'mobile':'desktop'}.png`),fullPage:true});
    evidence.push({check:`actual responsive CharacterShell/SheetPanel/${mobile?'MobileSheet':'StatRibbon'} state-only controls plus currency; 12 guarded actions`,passed:true});
  }
  await reset();holdConditional=true;const other=await context.newPage();other.on('pageerror',error=>errors.push(error.message));await other.goto(origin+'/sheet');
  await trigger('conditions',false);await trigger('activation',false,other);assert.equal(held.length,2);assert.deepEqual(calls.map(call=>call.args.expected_state),[baseline,baseline]);
  held.shift()();await settled();const winner=structuredClone(stored);held.shift()();await other.getByRole('alert').filter({hasText:'Reload before choosing a new action'}).last().waitFor();
  assert.deepEqual(stored,winner);assert.equal((await state(other)).rage_active,false);await trigger('activation',false,other);await other.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));assert.equal(calls.length,2);
  await reload(other);assert.deepEqual(await state(other),{...stored,temp_hp:0});assert.equal(calls.length,2);holdConditional=false;
  await trigger('activation',false,other);await other.waitForFunction(()=>!window.fixture.saves.patchState.hasPendingWrites());assert.equal(stored.rage_active,true);assert.equal(calls.length,3);await other.close();
  evidence.push({check:'two actual shells reject stale competing condition/activation intent; explicit reload then newly chosen action',passed:true});

  for(const surface of ['conditions','death','effects','badge','inspiration','activation','currency']){
    for(const outcome of ['conflict','response-lost']){
      await reset(true);holdConditional=true;await trigger(surface);assert.equal(held.length,1);
      await page.evaluate(()=>{window.fixture.notes=window.fixture.saves.patchState({quick_notes:'independent draft'})});
      await page.evaluate(()=>window.fixture.away());await page.getByRole('heading',{name:'Away fixture'}).waitFor();
      if(outcome==='conflict')stored={...stored,exhaustion:2};held.shift()(outcome);await page.evaluate(()=>window.fixture.notes);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.goBack();
      await page.getByRole('alert').filter({hasText:outcome==='conflict'?'Reload before choosing a new action':'The character save could not be confirmed'}).last().waitFor();
      await settled();assert.equal((await state()).quick_notes,'independent draft');assert.equal(stored.quick_notes,'independent draft');assert.equal(calls.length,2);assert.equal(calls[1].name,'patch_character_state');
      if(surface==='currency')assert.equal(await page.getByLabel('GP amount').inputValue(),'15');
      await trigger(surface);await settled();assert.equal(calls.length,2);
      await reload();assert.deepEqual(await state(),{...stored,temp_hp:0});assert.equal(calls.length,2);
      evidence.push({check:`actual mobile ${surface} hidden ${outcome}: typed recovery, notes preserved, explicit reload and no replay`,passed:true});
    }
  }
  await reset(true);holdConditional=true;await click('Add effect');await page.getByLabel('Custom effect name').fill('Half cover');await page.getByLabel('Modified stat').selectOption('armor_class');await page.getByLabel('Modifier value').fill('2');await click('Add custom effect');assert.equal(held.length,1);
  await page.evaluate(()=>window.fixture.away());await page.getByRole('heading',{name:'Away fixture'}).waitFor();stored={...stored,exhaustion:2};held.shift()();await page.goBack();
  await page.getByRole('alert').filter({hasText:'Reload before choosing a new action'}).last().waitFor();assert.equal(await page.getByLabel('Custom effect name').inputValue(),'Half cover');assert.equal(await page.getByLabel('Modifier value').inputValue(),'2');
  await click('Add custom effect');await settled();assert.equal(calls.length,1);await page.screenshot({path:path.join(output,'custom-effect-draft-mobile.png'),fullPage:true});
  evidence.push({check:'actual mobile effect editor retains failed name/modifier draft, no replay',passed:true});
  assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify({simulated:true,endpointModelOnly:true,evidence,errors,remoteRequests},null,2));console.log(JSON.stringify(evidence,null,2));
}finally{while(held.length)held.shift()();try{if(browser)await browser.close()}finally{await new Promise(resolve=>server.close(resolve))}}
