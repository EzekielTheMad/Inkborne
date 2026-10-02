/** Real provider/dialogs with local deferred persistence; no hosted config or secrets. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "play-save-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "@/lib/sheet/update-state": `export async function updateCharacterState(id,patch){window.fixture.calls.push(patch);if(window.fixture.defer){window.fixture.defer=false;await new Promise((resolve,reject)=>{window.fixture.resolve=resolve;window.fixture.reject=()=>reject(new Error('Simulated offline save'))})}}`,
  "@/lib/supabase/inventory": `export async function addInventoryItem(){} export async function updateInventoryItem(){} export async function removeInventoryItem(){} export async function unequipAllArmor(){}`,
  "@/lib/supabase/spells": `export async function addCharacterSpell(){} export async function updateCharacterSpell(){} export async function removeCharacterSpell(){}`,
  "@/lib/supabase/rolls": `export async function insertRoll(){}`,
  "@/lib/dice/roller": `export function executeRoll(request){window.fixture.rolls++;return {request,total:3,groups:[],modifier:0,natural:null,rolled_at:new Date().toISOString()}}`,
};
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-play-save-fixture.tsx", contents: `
    import React,{Activity,useEffect,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {CharacterProvider,useCharacterState} from '@/lib/character/character-context';
    import {HPTracker} from '@/components/sheet/hp-tracker';
    import {ActiveEffectsWidget} from '@/components/sheet/active-effects-widget';
    import {RestDialog} from '@/components/sheet/rest-dialog';
    import {CastDialog} from '@/components/sheet/spells/cast-dialog';
    window.fixture={defer:true,calls:[],rolls:0,resolve:null,reject:null};
    const character={id:'local-character',user_id:'local-user',level:1,choices:{classes:[{slug:'fighter',level:1},{slug:'wizard',level:1}]},base_stats:{constitution:10,intelligence:10},narrative:{}};
    const schema={ability_scores:[],proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
    const spell={id:'local-spell',name:'Magic Missile',class_slug:'wizard',content_definitions:{id:'magic-missile',slug:'magic-missile',name:'Magic Missile',data:{level:1,duration:'Instantaneous'},effects:[]}};
    function Sheet(){const {state,patchState,patchActionState}=useCharacterState();const [rest,setRest]=useState(false);const [cast,setCast]=useState(false);return <><button onClick={()=>setRest(true)}>Open rest</button><button onClick={()=>setCast(true)}>Open cast</button><HPTracker currentHp={state.current_hp??20} tempHp={state.temp_hp??0} maxHp={20} patchState={patchState} patchActionState={patchActionState}/><output aria-label='Current HP'>{state.current_hp}</output><output aria-label='Spent dice'>{state.hit_dice_spent?.fighter??0}</output><RestDialog open={rest} onClose={()=>setRest(false)}/><CastDialog spell={spell} castability='full' open={cast} onClose={()=>setCast(false)}/><ActiveEffectsWidget/></>}
    function App(){const [route,setRoute]=useState(location.pathname);useEffect(()=>{const pop=()=>setRoute(location.pathname);window.addEventListener('popstate',pop);window.fixture.away=()=>{history.pushState({},'','/away');setRoute('/away')};return()=>window.removeEventListener('popstate',pop)},[]);return <><h1>Local save recovery fixture</h1><p>Simulated history and persistence; actual provider and dialogs.</p>{route==='/away'&&<h2>Away fixture</h2>}<Activity mode={route==='/sheet'?'visible':'hidden'}><CharacterProvider character={character} schema={schema} contentRefs={[]} initialState={{current_hp:10,active_effects:[{id:'existing',name:'Guarded',slug:'guarded',source:'custom',content_id:null,effects:[],duration:{type:'special'},concentration:false,applied_at:'2026-10-02T18:00:00.000Z',expires_at:null}]}} initialInventory={[]} initialSpells={[]} classData={{fighter:{slug:'fighter',data:{hit_die:10}},wizard:{slug:'wizard',data:{hit_die:6,spellcasting:{type:'full',ability:'intelligence'}}}}} allEffects={[]} baseStatsWithLevel={{constitution:10,intelligence:10,level:1}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></Activity></>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-boundaries", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(sheet\/update-state|supabase\/(inventory|spells|rolls)|dice\/roller)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js" }));
  } }],
});
const cssFiles = (await fs.readdir(path.join(root, ".next/static/chunks"))).filter(name => name.endsWith(".css"));
const css = (await Promise.all(cssFiles.map(name => fs.readFile(path.join(root, ".next/static/chunks", name), "utf8")))).join("\n");
const server = http.createServer(async (request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Local save fixture</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px"><div id="root"></div></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const evidence = [];
try {
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const remoteRequests = [];
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) { remoteRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/sheet");
  await page.getByRole("button", { name: /HP tracker/i }).click();
  await page.getByPlaceholder("Amount").fill("5");
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await page.getByRole("button", { name: "Open rest", exact: true }).click();
  await page.getByRole("button", { name: /spend & roll/i }).first().click();
  await page.getByText("The hit die could not be spent. Please try again.").waitFor();
  assert.equal(await page.evaluate(() => window.fixture.rolls), 0);
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
  await page.evaluate(() => window.fixture.reject());
  await page.waitForFunction(() => document.querySelector('[aria-label="Current HP"]').textContent === '10');
  await page.getByRole("button", { name: /spend & roll/i }).first().click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Current HP"]').textContent === '13');
  assert.equal(await page.getByLabel("Spent dice").textContent(), "1");
  assert.equal((await page.evaluate(() => window.fixture.calls.at(-1))).current_hp, 13);
  evidence.push({ check: "failed UI damage / gated hit die / explicit retry saves HP 13 and one die", passed: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const settleHidden of [true, false]) {
    await page.goto(origin + "/sheet");
    await page.getByRole("button", { name: "Open cast", exact: true }).click();
    await page.getByRole("button", { name: "Cast", exact: true }).click();
    await page.evaluate(() => window.fixture.away());
    await page.getByRole("heading", { name: "Away fixture" }).waitFor();
    if (settleHidden) await page.evaluate(() => window.fixture.resolve());
    await page.goBack();
    if (!settleHidden) {
      assert.equal(await page.getByRole("button", { name: "Cast", exact: true }).isDisabled(), true);
      await page.evaluate(() => window.fixture.resolve());
    }
    await page.getByRole("button", { name: "Done", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
    evidence.push({ check: `cast Activity Back / settleHidden=${settleHidden}`, passed: true });
  }
  await page.goto(origin + "/sheet");
  await page.getByRole("button", { name: "Open rest", exact: true }).click();
  await page.getByRole("button", { name: /take long rest/i }).click();
  await page.evaluate(() => window.fixture.away());
  await page.getByRole("heading", { name: "Away fixture" }).waitFor();
  await page.evaluate(() => window.fixture.resolve());
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
  evidence.push({ check: "rest Activity Back delivers confirmed close once", passed: true });
  await page.goto(origin + "/sheet");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open rest", exact: true }).click();
  await page.getByRole("button", { name: /spend & roll/i }).first().click();
  await page.evaluate(() => window.fixture.away());
  await page.getByRole("heading", { name: "Away fixture" }).waitFor();
  await page.evaluate(() => window.fixture.reject());
  await page.goBack();
  await page.getByText("The hit die could not be spent. Please try again.").waitFor();
  assert.equal(await page.getByRole("button", { name: /spend & roll/i }).first().isEnabled(), true);
  await page.screenshot({ path: path.join(output, "hit-die-back-mobile.png"), fullPage: true, animations: "disabled" });
  evidence.push({ check: "mobile hit-die failure / Activity Back / explicit recovery", passed: true });
  await page.goto(origin + "/sheet");
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Add effect",exact:true}).click();
  await page.getByLabel("Custom effect name").fill("Half cover");
  await page.getByLabel("Modified stat").selectOption("armor_class");
  await page.getByLabel("Modifier value").fill("2");
  await page.getByRole("button",{name:"Add custom effect",exact:true}).click();
  await page.waitForFunction(()=>window.fixture.calls.length===1);
  assert.equal(await page.getByRole("button",{name:"Add effect",exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel("Custom effect name").isDisabled(),true);
  await page.evaluate(()=>window.fixture.away());
  await page.getByRole("heading",{name:"Away fixture"}).waitFor();
  await page.evaluate(()=>window.fixture.reject());
  await page.goBack();
  await page.getByRole("alert").filter({hasText:"This effect could not be confirmed"}).waitFor();
  assert.equal(await page.getByLabel("Custom effect name").inputValue(),"Half cover");
  assert.equal(await page.getByLabel("Modifier value").inputValue(),"2");
  await page.screenshot({path:path.join(output,"effect-recovery-mobile.png"),fullPage:true});
  await page.getByRole("button",{name:"Add custom effect",exact:true}).click();
  await page.getByLabel("Custom effect name").waitFor({state:"hidden"});
  assert.equal(await page.evaluate(()=>window.fixture.calls.length),2);
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls[1].active_effects.map(effect=>effect.name)),["Guarded","Half cover"]);
  evidence.push({check:"actual effect editor preserves hidden failed save draft and confirms retry once",passed:true});
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ simulated: true, evidence, errors, remoteRequests }, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
