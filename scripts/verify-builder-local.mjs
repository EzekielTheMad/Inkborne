/** Offline browser fixture: real editor/components, simulated router/persistence.
 * Never imports the project's hosted Playwright config or environment files.
 * Run: node scripts/verify-builder-local.mjs
 * Requires existing esbuild, Playwright and installed Chrome; installs nothing.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "builder-local");
await fs.mkdir(output, { recursive: true });
const runStartedUtc = new Date().toISOString();
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({
  simulated: true, liveSupabase: false, status: "running", runStartedUtc,
}, null, 2));
const stubs = {
  "next/navigation": `export function useRouter(){return {push:to=>window.dispatchEvent(new CustomEvent('fixture-navigation',{detail:to})),refresh:()=>{if(location.pathname==='/fresh-race')window.dispatchEvent(new Event('fixture-refresh'))}}}`,
  "@/lib/supabase/client": `export function createClient(){return {
    auth:{onAuthStateChange:callback=>{window.fixture.authChange=callback;return {data:{subscription:{unsubscribe(){window.fixture.authChange=null}}}}}},
    rpc:async(name,args)=>{
      if(name!=='save_character_abilities')throw new Error('Unexpected local RPC');
      window.fixture.calls.push({id:args.target_character_id,method:args.ability_method,scores:args.ability_scores,expectedMethod:args.expected_method,expectedScores:args.expected_scores});
      if(window.fixture.mode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolve=resolve;window.fixture.reject=()=>reject(new Error('Simulated local ability failure'))});
      const saved=window.fixture.abilitySaved;
      if(args.expected_method!==saved.method||JSON.stringify(args.expected_scores)!==JSON.stringify(saved.scores))return {data:null,error:{code:'P0001',message:'ABILITY_SCORES_CHANGED'}};
      window.fixture.abilitySaved={method:args.ability_method,scores:args.ability_scores};
      return {data:[{saved_method:args.ability_method,saved_scores:args.ability_scores}],error:null};
    }
  }}`,
  "@/lib/supabase/character-client": `
    export async function updateCharacterAndReturn(id,patch){window.fixture.classCalls.push(patch);await new Promise(resolve=>{window.fixture.resolveClass=resolve});return {choices:patch.choices,level:patch.level}}
    export async function updateCharacter(id,patch){if(location.pathname==='/fresh-race'){window.fixture.raceCalls.push(patch);window.fixture.raceChoices=patch.choices;return}if(location.pathname==='/low-con'){window.fixture.hpCalls.push(patch);return}if(location.pathname==='/hp-recovery'){window.fixture.hpCalls.push(patch);if(window.fixture.hpMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveHp=resolve;window.fixture.rejectHp=()=>reject(new Error('private HP detail'))});return}if(location.pathname==='/feature-recovery') {window.fixture.classChoiceCalls.push(patch);return}if(location.pathname==='/language-category'){window.fixture.backgroundCalls.push(patch);return}if(location.pathname==='/empty-class'){window.fixture.classChoiceCalls.push(patch);return}if(location.pathname==='/background'||location.pathname==='/invalid-choice'||location.pathname==='/note-replacement'){window.fixture.backgroundCalls.push(patch);if(window.fixture.backgroundMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveBackground=resolve;window.fixture.rejectBackground=()=>reject(new Error('private note detail'))});return}if(location.pathname!=='/equipment')throw new Error('Simulated private database failure');window.fixture.equipmentCalls.push(patch);if(window.fixture.equipmentMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveEquipment=resolve;window.fixture.rejectEquipment=()=>reject(new Error('private selection detail'))})}
  `,
  "@/lib/supabase/background-selection-client": `export async function setCharacterBackground(id,contentId,version){if(location.pathname!=='/note-replacement')throw new Error('Fixture does not replace backgrounds');window.fixture.backgroundReplacements.push({contentId,version});return {savedChoices:{background:'scholar',ideals:[]},selectedContentId:contentId,selectedContentVersion:version}}`,
  "@/lib/supabase/content-refs-client": `export async function insertContentRef(params){if(location.pathname==='/fresh-race'){window.fixture.raceRefCalls.push(params);window.fixture.raceRefs.push({id:'fresh-race-pin',content_id:params.contentId,content_version:params.contentVersion,context:params.context,choice_source:null,content_definitions:window.fixture.freshRace})}} export async function removeContentRefById(){}`,
  "equipment-actions": `export async function confirmStartingEquipment(request){window.fixture.grants.push(request);return window.fixture.awardMode === 'recovered' ? {status:'awarded',receipt:{grant_id:'local-grant',inventory_ids:['local-item'],awarded_at:'local-simulated',plan:{items:[{content_id:null,content_version:null,name:'Recorded warhammer',quantity:1,content_type:'item'}],currency:{gp:15}}}} : {status:'uncertain'}}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(id,grant){window.fixture.grants.push(grant);if(window.fixture.grants.length===2)throw new Error("private grant detail");return {id:"local-grant"}}`,
  "@/lib/sheet/update-state": `export async function updateCharacterState(){throw new Error("Fixture does not save currency")}`,
  "class-actions": `export async function reconcileClassFeatureRefsAction(){window.fixture.recoveryCalls.push({});if(window.fixture.recoveryMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveRecovery=resolve;window.fixture.rejectRecovery=()=>reject(new Error('private recovery detail'))});return {status:'success',refs:window.fixture.recoveryRefs}}
    export async function searchUsableFeatsAction(){return {status:"success",feats:[]}} export async function setCharacterAsiChoiceAction(){throw new Error("Fixture does not save class choices")}`,
  "@/components/builder/stat-preview": `export function StatPreview(){return null}`,
};
await build({
  stdin: {
    resolveDir: root, loader: "tsx", sourcefile: "local-builder-fixture.tsx",
    contents: `
      import React,{Activity,useEffect,useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {AbilitiesStepClient} from '@/app/(app)/characters/[id]/builder/abilities/abilities-step-client';
      import {RaceStepClient} from '@/app/(app)/characters/[id]/builder/race/race-step-client';
      import {ClassStepClient} from '@/app/(app)/characters/[id]/builder/class/class-step-client';
      import {BackgroundStepClient} from '@/app/(app)/characters/[id]/builder/background/background-step-client';
      import {EquipmentStepClient} from '@/app/(app)/characters/[id]/builder/equipment/equipment-step-client';
      window.fixture={raceCalls:[],raceRefCalls:[],raceChoices:{},raceRefs:[],recoveryCalls:[],recoveryMode:'pending',recoveryRefs:[],backgroundReplacements:[],mode:'pending',calls:[],resolve:null,classCalls:[],resolveClass:null,equipmentCalls:[],equipmentMode:'pending',resolveEquipment:null,rejectEquipment:null,grants:[],hpCalls:[],hpMode:'pending',resolveHp:null,rejectHp:null,classChoiceCalls:[],backgroundCalls:[],backgroundMode:'pending',resolveBackground:null,rejectBackground:null};
      const character={id:'local-character',level:1,choices:{ability_method:'manual'},base_stats:{strength:10,dexterity:10}};
      window.fixture.abilitySaved={method:'manual',scores:{...character.base_stats}};
      window.fixture.authChange=null;
      const schema={ability_scores:[{slug:'strength',name:'Strength',abbr:'STR'},{slug:'dexterity',name:'Dexterity',abbr:'DEX'}],
        proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
      const human={id:'human',name:'Human',slug:'human',content_type:'race',data:{description:'Local simulated content only.'},effects:[],version:1,source:'srd'};
      const pinnedHuman={...human,name:'Pinned Human',data:{description:'Authorized pinned race description.',traits:['tool-training']},effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'pinned-skill'}]};
      const pinnedTrait={...human,id:'tool-training',slug:'tool-training',name:'Pinned Tool Training',content_type:'trait',effects:[{type:'choice',choose:1,from:['tool-smith'],grant_type:'proficiency',choice_id:'tool-training'}]};
      const newerTrait={...pinnedTrait,name:'Catalog Tool Training',version:2,effects:[{type:'choice',choose:1,from:['tool-dice'],grant_type:'proficiency',choice_id:'tool-training'}]};
      const newerHuman={...human,version:2,data:{description:'New catalog race description.'},effects:[{type:'choice',choose:1,from:['skill-stealth'],grant_type:'proficiency',choice_id:'new-skill'}]};
      const pinnedFighter={...human,id:'fighter',slug:'fighter',name:'Pinned Fighter',content_type:'class',data:{hit_die:10,levels:[{level:1,features:['second-wind']}]}};
      const emptyFighter={...pinnedFighter,name:'Choice Fighter',data:{hit_die:10,levels:[{level:1,features:[]}]},effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'fighter-skill'}]};
      const styleGate={...human,id:'fighting-style',slug:'fighting-style',name:'Fighting Style',content_type:'feature',data:{class:'fighter',feature_type:'fighting_style'}};
      const pinnedDefense={...styleGate,id:'defense',slug:'defense',name:'Pinned Defense',data:{class:'fighter',feature_type:'fighting_style',description:'Authorized defense.'}};
      const archetype={...styleGate,id:'archetype',slug:'archetype',name:'Martial Archetype',data:{class:'fighter',feature_type:'subclass'}};
      const pinnedChampion={...human,id:'champion',slug:'champion',name:'Pinned Champion',content_type:'subclass',data:{parent_class:'fighter',levels:[]}};
      const styleFighter={...pinnedFighter,data:{hit_die:10,levels:[{level:1,features:[styleGate.slug,archetype.slug]}]}};
      const pinnedWind={...human,id:'second-wind',slug:'second-wind',name:'Pinned Second Wind',content_type:'feature',data:{description:'Authorized pinned recovery.'}};
      const courier={...human,id:'courier',slug:'courier',name:'Courier',content_type:'background',data:{ideals:[],bonds:[],flaws:[],personality_traits:[]}};
      const choiceCourier={...courier,effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'courier-skill'}]};
      const recoveryWind={...pinnedWind,effects:[{type:'choice',choose:1,from:['old-option'],grant_type:'proficiency',choice_id:'training'}]};
      const recoveryPins=[pinnedFighter,recoveryWind].map(content=>({id:'pin-'+content.id,content_id:content.id,content_version:1,context:{},choice_source:null,content_definitions:content}));
      const recoveryStart=[recoveryPins[0]];
      window.fixture.recoveryRefs=recoveryPins;
      const languageBackground={...courier,effects:[{type:'choice',choose:1,from:'any',grant_type:'language',choice_id:'language'}]};
      const freshRace={...human,name:'Fresh Human',data:{traits:['fresh-training'],languages:['common']},effects:[{type:'choice',choose:1,from:'any',grant_type:'language',choice_id:'race-language'}]};
      const freshTrait={...human,id:'fresh-training',slug:'fresh-training',name:'Fresh Training',content_type:'trait',effects:[{type:'choice',choose:1,from:['tool-dice'],grant_type:'proficiency',choice_id:'race-tool'}]};
      window.fixture.freshRace=freshRace;
      function App(){
        const [route,setRoute]=useState(location.pathname);
        const [,forceRefresh]=useState(0);
        useEffect(()=>{const refresh=()=>forceRefresh(value=>value+1);window.addEventListener('fixture-refresh',refresh);return()=>window.removeEventListener('fixture-refresh',refresh)},[]);
        function navigate(to){history.pushState({fixture:true},'',to);setRoute(to)}
        useEffect(()=>{const pop=()=>setRoute(location.pathname);const go=e=>navigate(e.detail);window.addEventListener('popstate',pop);window.addEventListener('fixture-navigation',go);return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('fixture-navigation',go)}},[]);
        return <><h1>Isolated builder fixture</h1><p>Simulated history and persistence; real editor and selection components.</p>
          <nav><a href='/overview' onClick={e=>{e.preventDefault();navigate('/overview')}}>Overview</a> | <a href='/abilities' onClick={e=>{e.preventDefault();navigate('/abilities')}}>Abilities</a> | <a href='/race' onClick={e=>{e.preventDefault();navigate('/race')}}>Race</a> | <a href='/background' onClick={e=>{e.preventDefault();navigate('/background')}}>Background</a> | <a href='/equipment' onClick={e=>{e.preventDefault();navigate('/equipment')}}>Equipment</a> | <a href='/pinned-class' onClick={e=>{e.preventDefault();navigate('/pinned-class')}}>Pinned Class</a> | <a href='/pinned-race' onClick={e=>{e.preventDefault();navigate('/pinned-race')}}>Pinned Race</a></nav>
          <Activity mode={route==='/feature-recovery'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,choices:{classes:[{slug:'fighter',level:1}]}}} classes={[{...pinnedFighter,name:'Current Fighter',version:2}]} subclasses={[]} features={[{...recoveryWind,name:'Current Feature',version:2,effects:[]}]} feats={[]} spells={[]} contentRefs={recoveryStart} schema={undefined}/></Activity>
          <Activity mode={route==='/language-category'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier'}}} backgrounds={[languageBackground]} contentRefs={[languageBackground,{...human,data:{languages:['common']}}].map(content=>({id:'pin-'+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} availableLanguages={['common','elvish']} schema={undefined}/></Activity>
          {route==='/fresh-race'&&<RaceStepClient characterId='local-character' character={{...character,choices:window.fixture.raceChoices}} races={[freshRace]} subraces={[]} traits={[freshTrait]} contentRefs={window.fixture.raceRefs} availableLanguages={['common','elvish']} schema={undefined}/>}
          {route==='/overview'&&<h2>Overview fixture</h2>}
          {route==='/abilities'&&<AbilitiesStepClient ownerId='local-owner' characterId='local-character' character={{...character,base_stats:window.fixture.abilitySaved.scores,choices:{...character.choices,ability_method:window.fixture.abilitySaved.method}}} contentRefs={[]} schema={schema}/>}
          <Activity mode={route==='/pinned-race'?'visible':'hidden'}><RaceStepClient characterId='local-character' character={{...character,choices:{race:'human'}}} races={[newerHuman]} subraces={[]} traits={[newerTrait]} contentRefs={[pinnedHuman,pinnedTrait].map(content=>({id:'pin-'+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/></Activity>
          <Activity mode={route==='/invalid-choice'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier',resolved_choices:{'courier-skill':['skill-removed']}}}} backgrounds={[choiceCourier]} contentRefs={[{id:'choice-pin',content_id:'courier',context:{},choice_source:null,content_definitions:choiceCourier}]} schema={undefined}/></Activity>
          <Activity mode={route==='/note-replacement'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier'}}} backgrounds={[{...courier,id:'scholar',slug:'scholar',name:'Scholar',data:{ideals:['Study old maps']}}]} contentRefs={[{id:'background-pin',content_id:'courier',context:{},choice_source:null,content_definitions:courier}]} schema={undefined}/></Activity>
          <Activity mode={route==='/background'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier'}}} backgrounds={[courier]} contentRefs={[{id:'background-pin',content_id:'courier',context:{},choice_source:null,content_definitions:courier}]} schema={undefined}/></Activity>
          <Activity mode={route==='/equipment'?'visible':'hidden'}><EquipmentStepClient characterId='local-character' character={{id:'local-character',level:1,choices:{starting_equipment:{selections:{'class:0':'a'},picks:{}}},state:null}} classContent={{id:'class',slug:'fighter',name:'Fighter',version:1,data:{equipment:'A mace or a warhammer; a shield'}}} backgroundContent={null} catalog={[{id:'mace',slug:'mace',name:'Mace',version:1,content_type:'weapon',weapon_category:'Simple',weapon_range:'Melee'},{id:'warhammer',slug:'warhammer',name:'Warhammer',version:1,content_type:'weapon',weapon_category:'Martial',weapon_range:'Melee'},{id:'shield',slug:'shield',name:'Shield',version:1,content_type:'armor',weapon_category:null,weapon_range:null}]}/></Activity>
          {route==='/rolled-legacy'&&<ClassStepClient characterId='local-character' character={{...character,level:2,choices:{classes:[{slug:'wizard',level:2}],hp_rolls:{'wizard-2':{method:'manual',value:3}}},campaigns:{hp_rule:'rolled_only'}}} classes={[{...emptyFighter,id:'wizard',slug:'wizard',name:'Legacy Wizard',effects:[],data:{hit_die:6,levels:[{level:1,features:[]},{level:2,features:[]}]}}]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>}
          {route==='/low-con'&&<ClassStepClient characterId='local-character' character={{...character,base_stats:{constitution:3},choices:{classes:[{slug:'wizard',level:1}]}}} classes={[{...emptyFighter,id:'wizard',slug:'wizard',name:'Low CON Wizard',effects:[],data:{hit_die:6,levels:[{level:1,features:[]},{level:2,features:[]}]}}]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>}
          {(route==='/locked-average'||route==='/locked-max')&&<ClassStepClient characterId='local-character' character={{...character,name:'Locked HP fighter',choices:{classes:[{slug:'fighter',level:1}]},campaigns:{hp_rule:route==='/locked-average'?'average_only':'max_for_all'}}} classes={[{...emptyFighter,effects:[],data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}}]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>}
          <Activity mode={route==='/hp-recovery'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,name:'Recovery fighter',choices:{classes:[{slug:'fighter',level:1}]}}} classes={[{...emptyFighter,effects:[],data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}}]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/></Activity>
          <Activity mode={route==='/empty-class'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,name:'Choice fighter',choices:{classes:[{slug:'fighter',level:1}]}}} classes={[emptyFighter]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{id:'empty-class-pin',content_id:'fighter',context:{},choice_source:null,content_definitions:emptyFighter}]} schema={undefined}/></Activity>
          <Activity mode={route==='/pinned-style'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,choices:{classes:[{slug:'fighter',level:1,subclass:'champion'}],resolved_choices:{'fighting-style':['defense']}}}} classes={[styleFighter]} subclasses={[{...pinnedChampion,name:'Catalog Champion',version:2,data:{parent_class:'wizard',levels:[]}}]} features={[styleGate,archetype,{...pinnedDefense,name:'Catalog Defense',version:2,data:{class:'wizard',feature_type:'fighting_style'}}]} feats={[]} spells={[]} contentRefs={[styleFighter,styleGate,pinnedDefense,archetype,pinnedChampion].map(content=>({id:'pin-'+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/></Activity>
          <Activity mode={route==='/pinned-class'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,name:'Fixture fighter',choices:{classes:[{slug:'fighter',level:1}]}}} classes={[{...pinnedFighter,name:'Catalog Fighter',version:2,data:{hit_die:12,levels:[]}}]} subclasses={[]} features={[{...pinnedWind,name:'Catalog Second Wind',version:2}]} feats={[]} spells={[]} contentRefs={[pinnedFighter,pinnedWind].map(content=>({id:'pin-'+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/></Activity>
          <Activity mode={route==='/race'?'visible':'hidden'}><RaceStepClient characterId='local-character' character={{...character,choices:{}}} races={[human]} subraces={[]} traits={[]} contentRefs={[]} schema={undefined}/></Activity>
        </>
      }
      createRoot(document.getElementById('root')).render(<App/>);
    `,
  },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "isolated-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /^(next\/navigation|@\/lib\/supabase\/(client|character-client|content-refs-client|background-selection-client)|@\/components\/builder\/stat-preview)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({filter: /^@\/lib\/(supabase\/inventory|sheet\/update-state)$/}, args=>({path:args.path,namespace:"fixture"}));
      builder.onResolve({filter: /^\.\/actions$/}, args => args.importer.endsWith("class-step-client.tsx") ? {path:"class-actions",namespace:"fixture"} : args.importer.endsWith("equipment-step-client.tsx") ? {path:"equipment-actions",namespace:"fixture"} : undefined);
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js" }));
    },
  }],
});
const cssFiles = (await fs.readdir(path.join(root, ".next/static/chunks"))).filter(name => name.endsWith(".css"));
const css = (await Promise.all(cssFiles.map(name => fs.readFile(path.join(root, ".next/static/chunks", name), "utf8")))).join("\n");
const server = http.createServer(async (request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Local builder fixture</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px;max-width:1000px;margin:auto"><div id="root"></div></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
console.log(JSON.stringify({ taskProcess: { pid: process.pid, parentPid: process.ppid, command: 'node scripts/verify-builder-local.mjs', cwd: root, startTime: new Date().toISOString(), listeningPort: server.address().port } }));
let browser;
let page;
const evidence = [];
const blockedRequests = [];
const errors = [];
try {
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/overview");
  await page.getByRole("link", { name: "Abilities", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Strength score" }).fill("18");
  await page.waitForFunction(() => window.fixture.calls.length === 1);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(new URL(page.url()).pathname, "/abilities");
  evidence.push("Declining same-window navigation preserves the pending draft.");
  await page.screenshot({ path: path.join(output, "pending-navigation.png"), fullPage: true });
  await page.goBack();
  await page.getByRole("heading", { name: "Overview fixture" }).waitFor();
  await page.evaluate(() => window.fixture.reject());
  await page.goForward();
  await page.getByRole("alert").filter({ hasText: "Could not save ability scores" }).waitFor();
  assert.equal(await page.getByRole("spinbutton", { name: "Strength score" }).inputValue(), "18");
  await page.evaluate(() => { window.fixture.mode = "success"; });
  await page.getByRole("button", { name: "Retry save" }).click();
  await page.getByRole("status").filter({ hasText: "Changes save automatically." }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls[1]), await page.evaluate(() => window.fixture.calls[0]));
  evidence.push("Native Back/Forward with SPA remount restores the failed draft and retries the exact CAS snapshot.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Race", exact: true }).click();
  const preview = page.getByRole("button", { name: "Preview Human" });
  await preview.focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Add Race" }).click();
  await page.getByRole("alert").filter({ hasText: "race change could not be confirmed" }).waitFor();
  await page.screenshot({ path: path.join(output, "race-failure-mobile.png"), fullPage: true });
  evidence.push("Keyboard Enter opens the real preview dialog; simulated race failure renders a readable mobile alert.");
  await page.getByRole("link", { name: "Pinned Race", exact: true }).click();
  await page.getByText("Authorized pinned race description.", { exact: true }).waitFor();
  assert.equal(await page.getByText("New catalog race description.", { exact: true }).isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "Athletics", exact: true }).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Stealth", exact: true }).isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "Tool Smith", exact: true }).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Tool Dice", exact: true }).isVisible(), false);
  await page.screenshot({ path: path.join(output, "pinned-race-mobile.png"), fullPage: true });
  evidence.push("Saved race and referenced trait UI display pinned data and choices against newer catalog entries.");
  await page.getByRole("link", { name: "Abilities", exact: true }).click();
  await page.evaluate(() => { window.fixture.mode = "pending"; });
  await page.getByRole("spinbutton", { name: "Strength score" }).fill("20");
  await page.waitForFunction(() => window.fixture.calls.length === 3);
  let unloadPrompt = false;
  page.once("dialog", async dialog => { unloadPrompt = dialog.type() === "beforeunload"; await dialog.accept(); });
  await page.reload();
  await page.getByRole("spinbutton", { name: "Strength score" }).waitFor();
  assert.equal(unloadPrompt, true);
  assert.equal(await page.getByRole("spinbutton", { name: "Strength score" }).inputValue(), "10");
  evidence.push("Chrome refresh presents a beforeunload prompt after user input; accepting refresh discards the fixture draft.");
  await page.goto(origin + "/background");
  await page.getByRole("textbox", {name:"Ideals",exact:true}).fill("Keep promises");
  assert.equal(await page.evaluate(()=>window.fixture.backgroundCalls.length),0);
  await page.getByRole("textbox", {name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===1);
  assert.equal(await page.getByRole("button", {name:"Saving...",exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.fixture.rejectBackground());
  await page.getByRole("alert").filter({hasText:"background choices could not be confirmed"}).waitFor();
  assert.equal(await page.getByRole("textbox", {name:"Ideals",exact:true}).inputValue(),"Keep promises");
  await page.getByRole("textbox", {name:"Ideals",exact:true}).focus();
  await page.getByRole("textbox", {name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===2);
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("link",{name:"Overview",exact:true}).click();
  await page.getByRole("heading",{name:"Overview fixture"}).waitFor();
  await page.evaluate(()=>window.fixture.resolveBackground());
  await page.goBack();
  await page.getByRole("button",{name:"Change Background",exact:true}).waitFor();
  assert.equal(await page.getByRole("textbox", {name:"Ideals",exact:true}).inputValue(),"Keep promises");
  assert.equal(await page.getByText(/You have unsaved notes/).count(),0);
  await page.screenshot({path:path.join(output,"background-note-mobile.png"),fullPage:true,animations:"disabled"});
  evidence.push({check:"background note blur save failure, explicit retry and hidden Activity completion",passed:true});
  await page.getByRole("textbox",{name:"Ideals",exact:true}).fill("");
  await page.getByRole("textbox",{name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===3);
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[2].choices.ideals),[]);
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("link",{name:"Overview",exact:true}).click();
  await page.getByRole("heading",{name:"Overview fixture"}).waitFor();
  await page.evaluate(()=>window.fixture.rejectBackground());
  await page.goBack();
  await page.getByRole("alert").filter({hasText:"background choices could not be confirmed"}).waitFor();
  assert.equal(await page.getByRole("textbox",{name:"Ideals",exact:true}).inputValue(),"");
  await page.locator("p:visible").filter({hasText:/^Ideals \(0\/1\)$/}).waitFor();
  await page.getByRole("textbox",{name:"Ideals",exact:true}).focus();
  await page.getByRole("textbox",{name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===4);
  await page.evaluate(()=>window.fixture.resolveBackground());
  await page.getByText(/You have unsaved notes/).waitFor({state:"hidden"});
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[3].choices.ideals),[]);
  evidence.push({check:"explicit custom note clearing survives hidden failure and confirms an empty selection on retry",passed:true});
  await page.goto(origin + "/note-replacement");
  await page.getByRole("textbox",{name:"Ideals",exact:true}).fill("Protect my village");
  await page.getByRole("textbox",{name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===1);
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("link",{name:"Overview",exact:true}).click();
  await page.getByRole("heading",{name:"Overview fixture"}).waitFor();
  await page.evaluate(()=>window.fixture.rejectBackground());
  await page.goBack();
  await page.getByRole("alert").filter({hasText:"background choices could not be confirmed"}).waitFor();
  await page.getByRole("button",{name:"Change Background",exact:true}).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("textbox",{name:"Ideals",exact:true}).inputValue(),"Protect my village");
  assert.equal(await page.getByRole("button",{name:"Preview Scholar",exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.fixture.backgroundReplacements.length),0);
  await page.getByRole("alert").filter({hasText:"Save your unconfirmed notes"}).waitFor();
  await page.screenshot({path:path.join(output,"background-replacement-recovery-mobile.png"),fullPage:true});
  await page.getByRole("textbox",{name:"Ideals",exact:true}).focus();
  await page.getByRole("textbox",{name:"Ideals",exact:true}).press("Tab");
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===2);
  await page.evaluate(()=>window.fixture.resolveBackground());
  await page.getByRole("button",{name:"Change Background",exact:true}).click();
  await page.getByRole("button",{name:"Preview Scholar",exact:true}).click();
  await page.getByRole("button",{name:"Add Background",exact:true}).click();
  await page.getByRole("button",{name:"Study old maps",exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[1].choices.ideals),["Protect my village"]);
  assert.equal(await page.evaluate(()=>window.fixture.backgroundReplacements.length),1);
  assert.equal(await page.getByText(/You have unsaved notes/).count(),0);
  evidence.push({check:"failed custom note remains accessible until saved before replacing with preset background",passed:true});
  await page.goto(origin + "/invalid-choice");
  await page.evaluate(()=>{window.fixture.backgroundMode='success'});
  assert.equal(await page.getByRole("button",{name:"Athletics",exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.backgroundCalls.length),0);
  await page.getByRole("button",{name:"Clear saved selections",exact:true}).click();
  await page.getByRole("button",{name:"Clear saved selections",exact:true}).waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Athletics",exact:true}).click();
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===2);
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[0].choices.resolved_choices),{'courier-skill':[]});
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[1].choices.resolved_choices),{'courier-skill':['skill-athletics']});
  await page.screenshot({path:path.join(output,"invalid-choice-recovery-mobile.png"),fullPage:true,animations:"disabled"});
  evidence.push({check:"unavailable pinned choice requires explicit clearing before a replacement selection",passed:true});
  await page.goto(origin + "/empty-class");
  await page.getByRole("button",{name:/^Level 1:/}).click();
  await page.getByRole("button",{name:"Athletics",exact:true}).click();
  await page.locator('[aria-label="Choice made"]:visible').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.fixture.classChoiceCalls[0].choices.resolved_choices),{'fighter-skill':['skill-athletics']});
  evidence.push({check:"first-level class choice remains usable with no feature rows",passed:true});
  await page.goto(origin + "/hp-recovery");
  await page.getByRole("button",{name:/Level up Choice Fighter to level 2/i}).click();
  const hpDrawer=page.getByRole("dialog");
  await page.getByRole("radio",{name:"Manual",exact:true}).click();
  await page.getByRole("spinbutton",{name:"Manual HP value",exact:true}).fill("3.5");
  await page.getByRole("spinbutton",{name:"Manual HP value",exact:true}).press("Enter");
  await hpDrawer.getByRole("alert").filter({hasText:"whole number from 1 to 10"}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.hpCalls.length),0);
  assert.equal(await page.getByRole("button",{name:/Confirm level 2/i}).isDisabled(),true);
  await page.getByRole("spinbutton",{name:"Manual HP value",exact:true}).fill("3");
  await page.getByRole("spinbutton",{name:"Manual HP value",exact:true}).press("Enter");
  await page.waitForFunction(()=>window.fixture.hpCalls.length===1);
  await hpDrawer.getByRole("status",{name:"",exact:true}).filter({hasText:"Saving this class change"}).waitFor();
  await page.screenshot({path:path.join(output,"class-hp-pending-mobile.png"),fullPage:true,animations:"disabled"});
  assert.equal(await hpDrawer.getByRole("radio",{name:/^Manual/}).isDisabled(),true);
  await page.evaluate(()=>window.fixture.rejectHp());
  await hpDrawer.getByRole("alert").filter({hasText:"class change could not be confirmed"}).waitFor();
  await page.screenshot({path:path.join(output,"class-hp-failure-mobile.png"),fullPage:true,animations:"disabled"});
  assert.equal(await page.getByRole("button",{name:/Confirm level 2/i}).isDisabled(),true);
  assert.equal(await page.getByRole("radio",{name:"Manual",exact:true}).getAttribute("aria-checked"),"false");
  await page.evaluate(()=>{window.fixture.hpMode='success'});
  await page.getByRole("radio",{name:/Average/i}).click();
  await page.waitForFunction(()=>window.fixture.hpCalls.length===2);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.offsetParent && /Confirm level 2/i.test(button.textContent) && !button.disabled));
  assert.equal(await page.getByRole("button",{name:/Confirm level 2/i}).isEnabled(),true);
  assert.deepEqual(await page.evaluate(()=>window.fixture.hpCalls[1].choices.hp_rolls),{'fighter-2':{method:'average',value:6}});
  evidence.push({check:"failed mobile level-up HP save removes draft completion and permits explicit retry",passed:true});
  for (const route of ["locked-average","locked-max"]) {
    await page.goto(origin + "/" + route);
    await page.getByRole("button",{name:/Level up Choice Fighter to level 2/i}).click();
    assert.equal(await page.getByRole("radio").count(),0);
    assert.equal(await page.getByRole("button",{name:/Confirm level 2/i}).isEnabled(),true);
    await page.getByRole("button",{name:/Confirm level 2/i}).click();
    await page.waitForFunction(()=>window.fixture.classCalls.length===1);
    assert.deepEqual(await page.evaluate(()=>window.fixture.classCalls[0]),{choices:{classes:[{slug:'fighter',level:2}]},level:2});
    await page.evaluate(()=>window.fixture.resolveClass());
    await page.getByRole("status").filter({hasText:"Saving this class change"}).waitFor({state:"hidden"});
    evidence.push({check:route+" permits deterministic HP confirmation without a fabricated record",passed:true});
  }
  await page.goto(origin + "/rolled-legacy");
  await page.getByRole("button",{name:/Level 2/}).click();
  await page.getByRole("radio",{name:"Roll d6",exact:true}).waitFor();
  assert.equal(await page.getByRole("spinbutton",{name:"Manual HP value",exact:true}).count(),0);
  assert.equal(await page.getByText(/Total HP gain this level:/).textContent(),"Total HP gain this level: +3");
  assert.equal(await page.evaluate(()=>window.fixture.hpCalls.length),0);
  evidence.push({check:"rolled-only controls preserve the existing manual record as read-only",passed:true});
  await page.goto(origin + "/low-con");
  await page.getByRole("button",{name:/Level up Low CON Wizard to level 2/i}).click();
  await page.getByRole("radio",{name:"Average (+1)",exact:true}).click();
  await page.waitForFunction(()=>window.fixture.hpCalls.length===1);
  assert.deepEqual(await page.evaluate(()=>window.fixture.hpCalls[0].choices.hp_rolls),{'wizard-2':{method:'average',value:4}});
  await page.getByText(/Total HP gain this level:/).waitFor();
  assert.equal(await page.getByText(/Total HP gain this level:/).textContent(),"Total HP gain this level: +1");
  evidence.push({check:"mobile HP preview uses the existing minimum gain while preserving raw die contribution",passed:true});
  await page.setViewportSize({width:1280,height:900});
  await page.goto(origin + "/pinned-style");
  const selectedStyle=page.getByRole("button",{name:/Pinned Defense/});
  await selectedStyle.waitFor();
  assert.equal(await selectedStyle.getAttribute("aria-pressed"),"true");
  assert.equal(await page.getByText("Catalog Defense",{exact:true}).count(),0);
  await selectedStyle.click();
  assert.equal(await page.getByRole("alert").count(),0);
  assert.equal(await page.evaluate(()=>window.fixture.classCalls.length),0);
  assert.equal(await selectedStyle.getAttribute("aria-pressed"),"true");
  evidence.push({check:"selected fighting style preserves its compatible pinned snapshot and does not resave",passed:true});
  const selectedSubclass=page.getByRole("button",{name:/Pinned Champion/});
  assert.equal(await selectedSubclass.getAttribute("aria-pressed"),"true");
  assert.equal(await page.getByText("Catalog Champion",{exact:true}).count(),0);
  await selectedSubclass.click();
  assert.equal(await page.getByRole("alert").count(),0);
  assert.equal(await page.evaluate(()=>window.fixture.classCalls.length),0);
  assert.equal(await selectedSubclass.getAttribute("aria-pressed"),"true");
  evidence.push({check:"selected subclass preserves its pinned definition and does not resave",passed:true});
  await page.goto(origin + "/pinned-class");
  await page.getByRole("button", { name: "Remove Pinned Fighter", exact: true }).waitFor();
  assert.equal(await page.getByText("Catalog Fighter", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Pinned Second Wind", { exact: true }).count() > 0, true);
  assert.equal(await page.getByText("Catalog Second Wind", { exact: true }).count(), 0);
  await page.screenshot({path:path.join(output,"pinned-class-desktop.png"),fullPage:true,animations:"disabled"});
  evidence.push({check:"pinned class/feature rail survives newer catalog content",passed:true});
  await page.getByRole("combobox", {name:"Set level for Pinned Fighter",exact:true}).selectOption("2");
  await page.getByRole("status").waitFor();
  assert.equal(await page.getByRole("button", {name:"Remove Pinned Fighter",exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole("button", {name:"Next: Abilities",exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole("combobox", {name:"Set level for Pinned Fighter",exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.classCalls.length),1);
  await page.evaluate(()=>window.fixture.resolveClass());
  await page.getByRole("status").filter({hasText:"Saving this class change."}).waitFor({state:"hidden"});
  assert.equal(await page.getByRole("combobox", {name:"Set level for Pinned Fighter",exact:true}).inputValue(),"2");
  assert.equal(await page.getByRole("button", {name:"Next: Abilities",exact:true}).isEnabled(),true);
  evidence.push({check:"pending canonical class save locks competing controls and releases after confirmation",passed:true});
  await page.goto(origin+"/equipment");
  await page.getByRole("button", {name:/warhammer/i}).click();
  await page.getByRole("status").filter({hasText:"Saving equipment selection."}).waitFor();
  assert.equal(await page.getByRole("button", {name:"Confirm Equipment",exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole("button", {name:/a mace/i}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.grants.length),0);
  await page.evaluate(()=>window.fixture.rejectEquipment());
  await page.getByRole("alert").filter({hasText:"selection could not be confirmed"}).waitFor();
  assert.equal(await page.getByRole("alert").textContent().then(text=>text.includes("private selection detail")),false);
  assert.equal(await page.getByRole("button", {name:/a mace/i}).getAttribute("aria-pressed"),"true");
  await page.evaluate(()=>{window.fixture.equipmentMode='success'});
  await page.getByRole("button", {name:/warhammer/i}).click();
  await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
  await page.getByRole("button", {name:"Confirm Equipment",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"Check the saved award"}).waitFor();
  assert.equal(await page.getByRole("alert").textContent().then(text=>text.includes("private grant detail")),false);
  assert.equal(await page.getByRole("button", {name:"Confirm Equipment",exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.grants.length),1);
  evidence.push({check:"equipment selection save/retry and uncertain atomic response block blind confirmation",passed:true});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{window.fixture.awardMode='recovered'});
  await page.getByRole('button',{name:'Check saved equipment award'}).click();
  await page.getByText('Added to inventory',{exact:true}).waitFor();
  await page.getByText('Recorded warhammer',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.fixture.grants[1]),await page.evaluate(()=>window.fixture.grants[0]));
  assert.equal(await page.getByRole('button',{name:/a mace/i}).isDisabled(),true);
  await page.screenshot({path:path.join(output,'equipment-receipt-recovery-mobile.png'),fullPage:true,animations:'disabled'});
  evidence.push({check:'explicit mobile recovery reuses exact request and displays original receipt without sequential item/currency writes',passed:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/feature-recovery');
  await page.getByRole('button',{name:'Restore saved class features'}).click();
  assert.equal(await page.getByRole('button',{name:'Restore saved class features'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.recoveryCalls.length),1);
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.evaluate(()=>window.fixture.rejectRecovery());
  await page.goBack();
  await page.getByRole('alert').filter({hasText:'could not be restored'}).waitFor();
  assert.equal(await page.getByRole('alert').filter({hasText:'could not be restored'}).textContent().then(text=>text.includes('private recovery detail')),false);
  await page.evaluate(()=>{window.fixture.recoveryMode='success'});
  await page.getByRole('button',{name:'Restore saved class features'}).click();
  await page.getByRole('button',{name:'Restore saved class features'}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:/^Level 1:/}).click();
  await page.getByRole('button',{name:'Old Option',exact:true}).waitFor();
  assert.equal(await page.getByText('Current Feature',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Old Option',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.classChoiceCalls.length===1);
  assert.deepEqual(await page.evaluate(()=>window.fixture.classChoiceCalls[0].choices.resolved_choices),{training:['old-option']});
  await page.screenshot({path:path.join(output,'feature-recovery-mobile.png'),fullPage:true,animations:'disabled'});
  evidence.push({check:'mobile retained Activity feature recovery settles hidden, retries, and restores historical feature choices',passed:true});
  await page.goto(origin+'/language-category');
  await page.getByRole('button',{name:'Elvish',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Common',exact:true}).count(),0);
  await page.getByRole('button',{name:'Elvish',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.backgroundCalls.length===1);
  assert.deepEqual(await page.evaluate(()=>window.fixture.backgroundCalls[0].choices.resolved_choices),{language:['elvish']});
  evidence.push({check:'authoring-defined any-language category excludes fixed grants and persists an accessible language',passed:true});
  await page.goto(origin+'/fresh-race');
  await page.getByRole('button',{name:'Preview Fresh Human',exact:true}).click();
  await page.getByRole('button',{name:'Add Race',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Trait versions were not recorded'}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.raceRefCalls.length),1);
  assert.equal(await page.evaluate(()=>window.fixture.raceRefs.length),1);
  assert.equal(await page.getByRole('alert').count(),0);
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.goBack();
  await page.getByText('Fresh Training (current catalog): Choose 1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Elvish',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.raceCalls.length===2&&!document.querySelector('[aria-busy="true"]'));
  await page.getByRole('button',{name:'Tool Dice',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.raceCalls.length===3&&!document.querySelector('[aria-busy="true"]'));
  assert.deepEqual(await page.evaluate(()=>window.fixture.raceChoices.resolved_choices),{'race-language':['elvish'],'race-tool':['tool-dice']});
  assert.equal(await page.evaluate(()=>window.fixture.raceRefCalls.length),1);
  await page.screenshot({path:path.join(output,'fresh-race-traits-mobile.png'),fullPage:true,animations:'disabled'});
  evidence.push({check:'fresh race selection persists only the parent pin, refresh/Back keeps unpinned trait choices usable with current-catalog disclosure',passed:true});
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await page.goto(origin + "/overview");
  await page.getByRole("link", { name: "Abilities", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Strength score" }).fill("16");
  await page.waitForFunction(() => window.fixture.calls.length === 1);
  await page.getByRole("spinbutton", { name: "Dexterity score" }).fill("18");
  await page.getByRole("button", { name: "Point Buy", exact: true }).click();
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
  await page.evaluate(() => { window.fixture.mode = "success"; window.fixture.resolve(); });
  await page.getByRole("status").filter({ hasText: "Changes save automatically." }).waitFor();
  const orderedCalls = await page.evaluate(() => window.fixture.calls);
  assert.equal(orderedCalls.length, 3);
  assert.deepEqual(orderedCalls[1].expectedScores, { strength: 16, dexterity: 10 });
  assert.deepEqual(orderedCalls[2].expectedScores, { strength: 16, dexterity: 18 });
  assert.equal(orderedCalls[2].method, "point_buy");
  assert.deepEqual(orderedCalls[2].scores, { strength: 8, dexterity: 8 });
  evidence.push({ check: "rapid ability edits and method switch serialize against the last canonical response", passed: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.fixture.mode = "pending"; });
  await page.getByRole("button", { name: "Increase Strength", exact: true }).click();
  await page.waitForFunction(() => window.fixture.calls.length === 4);
  await page.evaluate(() => {
    window.fixture.abilitySaved = { method: "point_buy", scores: { strength: 10, dexterity: 8 } };
    window.fixture.resolve();
  });
  await page.getByRole("alert").filter({ hasText: "changed in another editor" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Next: Background", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Retry save", exact: true }).count(), 0);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/abilities");
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 4);
  await page.screenshot({ path: path.join(output, "ability-conflict-mobile.png"), fullPage: true });
  evidence.push({ check: "mobile stale ability CAS blocks edits, retry and declined same-window navigation", passed: true });

  await page.evaluate(() => window.fixture.authChange("SIGNED_OUT", null));
  await page.getByRole("alert").filter({ hasText: "sign-in session changed" }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Strength score", exact: true }).inputValue(), "");
  const warnedAfterSignout = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(warnedAfterSignout, false);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("heading", { name: "Overview fixture", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 4);
  evidence.push({ check: "sign-out clears private ability draft and navigation warning without replaying a save", passed: true });

  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ simulated: true, liveSupabase: false, status: "passed", runStartedUtc, browser: "installed Chrome", evidence, pageErrors: errors, blockedRemoteRequests: blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: evidence.length, evidence, output }, null, 2));
} catch (error) {
  const failure = {
    simulated: true, liveSupabase: false, status: "failed", runStartedUtc, error: String(error),
    pageErrors: errors, blockedRemoteRequests: blockedRequests, completedChecks: evidence,
  };
  await Promise.allSettled([
    fs.writeFile(path.join(output, "failure.json"), JSON.stringify(failure, null, 2)),
    fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(failure, null, 2)),
    ...(page ? [
      page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }),
      page.content().then(html => fs.writeFile(path.join(output, "failure.html"), html)),
    ] : []),
  ]);
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
