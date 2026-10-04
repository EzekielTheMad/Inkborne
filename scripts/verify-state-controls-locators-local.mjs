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
const output = path.join(root, "test-results", "state-controls-locators-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from "react"; export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`,
  "next/navigation": `export function useRouter(){return {push(){},refresh(){}}}export function usePathname(){return '/sheet'}`,
  "@/components/character/narrative-panel": `export function NarrativePanel(){return null}`,
  "@/lib/supabase/client": `export function createClient(){return {rpc:(name,args)=>window.fixtureRpc(name,args)}}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(){} export async function updateInventoryItem(){} export async function removeInventoryItem(){} export async function unequipAllArmor(){} export async function searchItems(){throw new Error("Unexpected inventory search")}`,
  "@/lib/supabase/spells": `export async function addCharacterSpell(){} export async function updateCharacterSpell(){} export async function removeCharacterSpell(){} export async function searchSpells(){throw new Error("Unexpected spell search")}`,
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
    const spell={id:'local-spell',name:'Local Focus',class_slug:'wizard',is_known:true,is_prepared:true,in_spellbook:true,content_definitions:{id:'focus',slug:'focus',name:'Local Focus',data:{level:1,duration:'1 minute',concentration:true,attack_type:'ranged'},effects:[]}};
    function Sheet(){const saves=useCharacterState();const inventory=useInventory();window.fixture.saves=saves;return <><pre aria-label='Character state' style={{fontSize:8,maxHeight:32,overflow:'hidden'}}>{JSON.stringify(saves.state)}</pre><CharacterShell campaignPageBacklinks={[]} timelineEvents={[]} relationships={[]}/></>}
    function App(){const [route,setRoute]=useState(location.pathname);useEffect(()=>{const pop=()=>setRoute(location.pathname);window.addEventListener('popstate',pop);window.fixture.away=()=>{history.pushState({},'','/away');setRoute('/away')};return()=>window.removeEventListener('popstate',pop)},[]);return <><h1>Local conditional state controls fixture</h1><p>Simulated CAS persistence and history; actual provider, dispatcher and dialogs.</p>{route==='/away'&&<h2>Away fixture</h2>}<Activity mode={route==='/sheet'?'visible':'hidden'}><CharacterProvider character={character} schema={schema} contentRefs={refs} initialState={{...raw,temp_hp:0}} initialInventory={[]} initialSpells={[spell]} classData={{wizard:{slug:'wizard',data:{hit_die:6,spellcasting:{type:'full',ability:'intelligence'}}},fighter:{slug:'fighter',data:{hit_die:10}},barbarian:{slug:'barbarian',data:{hit_die:12}}}} allEffects={[]} baseStatsWithLevel={{level:4,constitution:10,intelligence:10}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></Activity></>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/(link|navigation)|@\/components\/(character\/narrative-panel)|@\/lib\/supabase\/(client|inventory|spells|rolls))$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js", resolveDir: root }));
  } }],
});
const guard={id:'guard',slug:'guard',name:'Guarded',source:'custom',content_id:null,concentration:false,duration:{type:'special'},effects:[],applied_at:'2026-10-03T00:00:00Z',expires_at:null};
const linked={...guard,id:'old',slug:'old',name:'Expeditious Retreat',source:'spell',concentration:true};
const baseline={current_hp:0,conditions:['Poisoned'],exhaustion:1,death_saves:{successes:0,failures:1},inspiration:false,rage_active:false,seen_sheet_first_time:true,active_effects:[linked],concentrating_on:{spell_slug:'old',spell_name:'Expeditious Retreat',slot_level:1,started_at:linked.applied_at},currency:{pp:0,gp:10,ep:0,sp:2,cp:3},quick_notes:'keep'};
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
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Local short rest</title><link rel="stylesheet" href="/style.css"></head><body><header class="sticky top-0 z-40 border-b border-border bg-background"><div class="h-14">Local app header</div></header><main style="padding:24px"><div id="root"></div></main><script>window.fixture={raw:'+JSON.stringify(stored)+'}</script><script src="/fixture.js"></script></body></html>'); }
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
  for(const initialMobile of [false,true]){
    let mobile=initialMobile;await reset(mobile);
    if(mobile){
      const inspiration=page.getByRole('button',{name:'Inspiration inactive',exact:true});
      const unobstructed=await inspiration.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===node||node.contains(hit)});
      assert.equal(unobstructed,true,'long concentration text must not intercept mobile inspiration');
      const list=page.getByRole('tab',{name:'Character Sheet',exact:true}).locator('..');
      const badge=page.getByRole('button',{name:'End concentration',exact:true}).locator('..');
      const listRect=await list.boundingBox(),badgeRect=await badge.boundingBox();
      assert.ok(badgeRect.y>=listRect.y&&badgeRect.y+badgeRect.height<=listRect.y+listRect.height+1,'tools must fit inside the auto-height mobile tab row');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      evidence.push({check:'390px long Expeditious Retreat concentration badge and actual RollLayer stay in their mobile tool row; inspiration receives pointer hit and document does not overflow',passed:true});
    }
    const panel=page.getByRole('tabpanel');
    const mobileRoot=panel.locator('div.md\\:hidden').first();
    const stats=mobile?mobileRoot.locator('section.snap-start').nth(0):panel.locator('div.md\\:grid');
    const click=async(name,scope=page.locator('body'))=>{const button=scope.getByRole('button',{name,exact:true}).locator('visible=true').first();await button.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest'}));await button.click()};
    const tab=async(name)=>{if(mobile){await click(name,mobileRoot.locator('nav'));return mobileRoot.locator('section.snap-start').nth({Spells:3,Inventory:4,Features:5}[name])}await click(name,panel.locator('div.md\\:grid'));return panel.locator('div.md\\:grid')};
    await click('Quick Notes',stats);const note=stats.getByPlaceholder('Quick reminders, initiative order, HP tracking...');
    await note.evaluate(node=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,'local queued note');node.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.waitForFunction(()=>window.fixture.saves.state.quick_notes==='local queued note');await settled();await click('Quick Notes',stats);
    await click(mobile?'Inspiration inactive':'Grant inspiration');await settled();assert.equal(stored.inspiration,true);await click(mobile?'Inspiration active':'Remove inspiration');await settled();assert.equal(stored.inspiration,false);
    const slotsBefore=structuredClone(stored.spell_slots_used);await click('Add effect',stats);await click('Local Focus',stats);await settled();assert.equal(stored.concentrating_on.spell_slug,'focus');assert.deepEqual(stored.spell_slots_used,slotsBefore);await click('Remove Local Focus (ends concentration)',stats);await settled();assert.equal(stored.concentrating_on,null);
    await click('Use one Second Wind',stats);await settled();assert.equal(stored.feature_uses['second-wind'],1);await click('Restore one Second Wind',stats);await settled();assert.equal(stored.feature_uses['second-wind'],0);
    let scope=await tab('Spells');await click('Mark 1st slot used',scope);await settled();assert.equal(stored.spell_slots_used['1'],1);
    await click('Cast Local Focus',scope);
    const background=mobile?page.locator('[role="tabpanel"]').locator('div.md\\:hidden').first().locator('section.snap-start').nth(0):page.locator('[role="tabpanel"]').locator('div.md\\:grid');
    await background.getByRole('button',{name:'Quick Notes',exact:true,includeHidden:true}).evaluate(node=>node.click());await background.getByPlaceholder('Quick reminders, initiative order, HP tracking...').waitFor();
    await click('Cast',page.getByRole('dialog'));await settled();await click('Done');assert.equal(stored.spell_slots_used['1'],2);
    scope=await tab('Inventory');await scope.getByLabel('GP amount').fill('15');await click('Save currency',scope);await settled();assert.equal(stored.currency.gp,15);
    await scope.getByLabel('GP amount').fill('17');let count=calls.length;await click('Discard currency draft',scope);assert.equal(await scope.getByLabel('GP amount').inputValue(),'15');assert.equal(calls.length,count);await scope.getByLabel('GP amount').fill('17');
    mobile=!initialMobile;await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});scope=await tab('Inventory');await scope.getByLabel('GP amount').fill('20');await click('Save currency',scope);await settled();assert.equal(stored.currency.gp,20);
    mobile=initialMobile;await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});scope=await tab('Inventory');assert.equal(await scope.getByLabel('GP amount').inputValue(),'17');count=calls.length;await click('Save currency',scope);await scope.getByRole('alert').filter({hasText:'Currency changed while you were editing'}).waitFor();assert.equal(calls.length,count);assert.equal(stored.currency.gp,20);await click('Discard currency draft',scope);assert.equal(await scope.getByLabel('GP amount').inputValue(),'20');
    scope=await tab('Features');await click('Use one Second Wind',scope);await settled();assert.equal(stored.feature_uses['second-wind'],1);await click('Restore one Second Wind',scope);await settled();assert.equal(stored.feature_uses['second-wind'],0);await click('Use one Second Wind',scope);await settled();
    if(mobile)await click('Stats',mobileRoot.locator('nav'));
    await click('Rage');await settled();assert.equal(stored.rage_active,true);await click('Rage (Active)');await settled();assert.equal(stored.rage_active,false);
    await click('Rest');await click('Recover one more 1st-level slot',page.getByRole('dialog'));await click('Take Short Rest',page.getByRole('dialog'));await settled();assert.equal(stored.spell_slots_used['1'],1);assert.equal(stored.feature_uses['arcane-recovery'],1);
    evidence.push({check:`${mobile?'mobile':'desktop'} hosted-run scope selectors, actual tabs/cast/slot/card/currency/Arcane Recovery and native note event`,passed:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify({simulated:true,evidence,errors,remoteRequests},null,2));console.log(JSON.stringify(evidence,null,2));
}finally{while(held.length)held.shift()();try{if(browser)await browser.close()}finally{await new Promise(resolve=>server.close(resolve))}}
