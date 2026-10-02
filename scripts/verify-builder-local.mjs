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
const stubs = {
  "next/navigation": `export function useRouter(){return {push:to=>window.dispatchEvent(new CustomEvent('fixture-navigation',{detail:to})),refresh:()=>{}}}`,
  "@/lib/supabase/character-client": `
    export async function saveCharacterAbilityScores(id,method,scores,signal){
      window.fixture.calls.push({method,scores});
      if(window.fixture.mode==='success')return;
      await new Promise((resolve,reject)=>{
        window.fixture.resolve=resolve;
        signal.addEventListener('abort',()=>reject(new DOMException('Interrupted','AbortError')),{once:true});
      });
    }
    export async function updateCharacterAndReturn(id,patch){window.fixture.classCalls.push(patch);await new Promise(resolve=>{window.fixture.resolveClass=resolve});return {choices:patch.choices,level:patch.level}}
    export async function updateCharacter(id,patch){if(location.pathname==='/hp-recovery'){window.fixture.hpCalls.push(patch);if(window.fixture.hpMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveHp=resolve;window.fixture.rejectHp=()=>reject(new Error('private HP detail'))});return}if(location.pathname==='/empty-class'){window.fixture.classChoiceCalls.push(patch);return}if(location.pathname==='/background'||location.pathname==='/invalid-choice'){window.fixture.backgroundCalls.push(patch);if(window.fixture.backgroundMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveBackground=resolve;window.fixture.rejectBackground=()=>reject(new Error('private note detail'))});return}if(location.pathname!=='/equipment')throw new Error('Simulated private database failure');window.fixture.equipmentCalls.push(patch);if(window.fixture.equipmentMode==='pending')await new Promise((resolve,reject)=>{window.fixture.resolveEquipment=resolve;window.fixture.rejectEquipment=()=>reject(new Error('private selection detail'))})}
  `,
  "@/lib/supabase/background-selection-client": `export async function setCharacterBackground(){throw new Error("Fixture does not replace backgrounds")}`,
  "@/lib/supabase/content-refs-client": `export async function insertContentRef(){} export async function removeContentRefById(){}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(id,grant){window.fixture.grants.push(grant);if(window.fixture.grants.length===2)throw new Error("private grant detail");return {id:"local-grant"}}`,
  "@/lib/sheet/update-state": `export async function updateCharacterState(){throw new Error("Fixture does not save currency")}`,
  "class-actions": `export async function searchUsableFeatsAction(){return {status:"success",feats:[]}} export async function setCharacterAsiChoiceAction(){throw new Error("Fixture does not save class choices")}`,
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
      window.fixture={mode:'pending',calls:[],resolve:null,classCalls:[],resolveClass:null,equipmentCalls:[],equipmentMode:'pending',resolveEquipment:null,rejectEquipment:null,grants:[],hpCalls:[],hpMode:'pending',resolveHp:null,rejectHp:null,classChoiceCalls:[],backgroundCalls:[],backgroundMode:'pending',resolveBackground:null,rejectBackground:null};
      const character={id:'local-character',level:1,choices:{ability_method:'manual'},base_stats:{strength:10,dexterity:10}};
      const schema={ability_scores:[{slug:'strength',name:'Strength',abbr:'STR'},{slug:'dexterity',name:'Dexterity',abbr:'DEX'}]};
      const human={id:'human',name:'Human',slug:'human',content_type:'race',data:{description:'Local simulated content only.'},effects:[],version:1,source:'srd'};
      const pinnedHuman={...human,name:'Pinned Human',data:{description:'Authorized pinned race description.',traits:['tool-training']},effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'pinned-skill'}]};
      const pinnedTrait={...human,id:'tool-training',slug:'tool-training',name:'Pinned Tool Training',content_type:'trait',effects:[{type:'choice',choose:1,from:['tool-smith'],grant_type:'proficiency',choice_id:'tool-training'}]};
      const newerTrait={...pinnedTrait,name:'Catalog Tool Training',version:2,effects:[{type:'choice',choose:1,from:['tool-dice'],grant_type:'proficiency',choice_id:'tool-training'}]};
      const newerHuman={...human,version:2,data:{description:'New catalog race description.'},effects:[{type:'choice',choose:1,from:['skill-stealth'],grant_type:'proficiency',choice_id:'new-skill'}]};
      const pinnedFighter={...human,id:'fighter',slug:'fighter',name:'Pinned Fighter',content_type:'class',data:{hit_die:10,levels:[{level:1,features:['second-wind']}]}};
      const emptyFighter={...pinnedFighter,name:'Choice Fighter',data:{hit_die:10,levels:[{level:1,features:[]}]},effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'fighter-skill'}]};
      const pinnedWind={...human,id:'second-wind',slug:'second-wind',name:'Pinned Second Wind',content_type:'feature',data:{description:'Authorized pinned recovery.'}};
      const courier={...human,id:'courier',slug:'courier',name:'Courier',content_type:'background',data:{ideals:[],bonds:[],flaws:[],personality_traits:[]}};
      const choiceCourier={...courier,effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'courier-skill'}]};
      function App(){
        const [route,setRoute]=useState(location.pathname);
        function navigate(to){history.pushState({fixture:true},'',to);setRoute(to)}
        useEffect(()=>{const pop=()=>setRoute(location.pathname);const go=e=>navigate(e.detail);window.addEventListener('popstate',pop);window.addEventListener('fixture-navigation',go);return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('fixture-navigation',go)}},[]);
        return <><h1>Isolated builder fixture</h1><p>Simulated history and persistence; real editor and selection components.</p>
          <nav><a href='/overview' onClick={e=>{e.preventDefault();navigate('/overview')}}>Overview</a> | <a href='/abilities' onClick={e=>{e.preventDefault();navigate('/abilities')}}>Abilities</a> | <a href='/race' onClick={e=>{e.preventDefault();navigate('/race')}}>Race</a> | <a href='/background' onClick={e=>{e.preventDefault();navigate('/background')}}>Background</a> | <a href='/equipment' onClick={e=>{e.preventDefault();navigate('/equipment')}}>Equipment</a> | <a href='/pinned-class' onClick={e=>{e.preventDefault();navigate('/pinned-class')}}>Pinned Class</a> | <a href='/pinned-race' onClick={e=>{e.preventDefault();navigate('/pinned-race')}}>Pinned Race</a></nav>
          {route==='/overview'&&<h2>Overview fixture</h2>}
          <Activity mode={route==='/abilities'?'visible':'hidden'}><AbilitiesStepClient characterId='local-character' character={character} contentRefs={[]} schema={schema}/></Activity>
          <Activity mode={route==='/pinned-race'?'visible':'hidden'}><RaceStepClient characterId='local-character' character={{...character,choices:{race:'human'}}} races={[newerHuman]} subraces={[]} traits={[newerTrait]} contentRefs={[pinnedHuman,pinnedTrait].map(content=>({id:'pin-'+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/></Activity>
          <Activity mode={route==='/invalid-choice'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier',resolved_choices:{'courier-skill':['skill-removed']}}}} backgrounds={[choiceCourier]} contentRefs={[{id:'choice-pin',content_id:'courier',context:{},choice_source:null,content_definitions:choiceCourier}]} schema={undefined}/></Activity>
          <Activity mode={route==='/background'?'visible':'hidden'}><BackgroundStepClient characterId='local-character' character={{...character,choices:{background:'courier'}}} backgrounds={[courier]} contentRefs={[{id:'background-pin',content_id:'courier',context:{},choice_source:null,content_definitions:courier}]} schema={undefined}/></Activity>
          <Activity mode={route==='/equipment'?'visible':'hidden'}><EquipmentStepClient characterId='local-character' character={{id:'local-character',level:1,choices:{starting_equipment:{selections:{'class:0':'a'},picks:{}}},state:null}} classContent={{id:'class',slug:'fighter',name:'Fighter',data:{equipment:'A mace or a warhammer; a shield'}}} backgroundContent={null} catalog={[{id:'mace',slug:'mace',name:'Mace',version:1,content_type:'weapon',weapon_category:'Simple',weapon_range:'Melee'},{id:'warhammer',slug:'warhammer',name:'Warhammer',version:1,content_type:'weapon',weapon_category:'Martial',weapon_range:'Melee'},{id:'shield',slug:'shield',name:'Shield',version:1,content_type:'armor',weapon_category:null,weapon_range:null}]}/></Activity>
          <Activity mode={route==='/hp-recovery'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,name:'Recovery fighter',choices:{classes:[{slug:'fighter',level:1}]}}} classes={[{...emptyFighter,effects:[],data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}}]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/></Activity>
          <Activity mode={route==='/empty-class'?'visible':'hidden'}><ClassStepClient characterId='local-character' character={{...character,name:'Choice fighter',choices:{classes:[{slug:'fighter',level:1}]}}} classes={[emptyFighter]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{id:'empty-class-pin',content_id:'fighter',context:{},choice_source:null,content_definitions:emptyFighter}]} schema={undefined}/></Activity>
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
      builder.onResolve({ filter: /^(next\/navigation|@\/lib\/supabase\/(character-client|content-refs-client|background-selection-client)|@\/components\/builder\/stat-preview)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({filter: /^@\/lib\/(supabase\/inventory|sheet\/update-state)$/}, args=>({path:args.path,namespace:"fixture"}));
      builder.onResolve({filter: /^\.\/actions$/}, args => args.importer.endsWith("class-step-client.tsx") ? {path:"class-actions",namespace:"fixture"} : undefined);
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
let browser;
const evidence = [];
try {
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blockedRequests = [];
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
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
  await page.goForward();
  await page.getByRole("alert").filter({ hasText: "not confirmed saved" }).waitFor();
  assert.equal(await page.getByRole("spinbutton", { name: "Strength score" }).inputValue(), "18");
  await page.evaluate(() => { window.fixture.mode = "success"; });
  await page.getByRole("button", { name: "Retry save" }).click();
  await page.getByRole("status").filter({ hasText: "Ability scores saved." }).waitFor();
  evidence.push("Native Back/Forward with Activity retention restores the unconfirmed draft and explicit retry succeeds.");
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
  await page.setViewportSize({width:1280,height:900});
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
  await page.getByRole("alert").filter({hasText:"may already have been added"}).waitFor();
  assert.equal(await page.getByRole("alert").textContent().then(text=>text.includes("private grant detail")),false);
  assert.equal(await page.getByRole("button", {name:"Confirm Equipment",exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.fixture.grants.length),2);
  evidence.push({check:"equipment selection save/retry and partial grant failure block blind confirmation",passed:true});
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ simulated: true, liveSupabase: false, browser: "installed Chrome", evidence, pageErrors: errors, blockedRemoteRequests: blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: evidence.length, evidence, output }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
