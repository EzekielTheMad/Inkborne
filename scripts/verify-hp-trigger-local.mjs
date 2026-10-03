/** Actual SheetPanel, StatRibbon, MobileSheet, HPTracker and tabs with local persistence.
 * Narrative/content tabs, Next navigation and persistence are isolated; no hosted config.
 * Run with installed Chrome: node scripts/verify-hp-trigger-local.mjs */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { hpTrigger } from "../e2e/bounded/sheet-locators.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "hp-trigger-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  "next/navigation": `export function useRouter(){return {push(){},refresh(){}}}export function usePathname(){return "/sheet"}`,
  "@/components/sheet/content-tabs": `export function ContentTabs(){return null}`,
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
    import {SheetPanel} from '@/components/character/sheet-panel';
    import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
    import {ActiveEffectsWidget} from '@/components/sheet/active-effects-widget';
    import {RestDialog} from '@/components/sheet/rest-dialog';
    import {CastDialog} from '@/components/sheet/spells/cast-dialog';
    window.fixture={defer:false,calls:[],rolls:0,resolve:null,reject:null};
    const character={id:'local-character',user_id:'local-user',level:1,choices:{classes:[{slug:'fighter',level:1},{slug:'wizard',level:1}]},base_stats:{constitution:10,intelligence:10},narrative:{}};
    const schema={ability_scores:[{slug:'strength',abbr:'STR',name:'Strength'},{slug:'dexterity',abbr:'DEX',name:'Dexterity'},{slug:'constitution',abbr:'CON',name:'Constitution'},{slug:'intelligence',abbr:'INT',name:'Intelligence'},{slug:'wisdom',abbr:'WIS',name:'Wisdom'},{slug:'charisma',abbr:'CHA',name:'Charisma'}],proficiency_levels:[],derived_stats:[],skills:[],resources:[],content_types:[],currencies:[],creation_steps:[],sheet_sections:[]};
    const spell={id:'local-spell',name:'Magic Missile',class_slug:'wizard',content_definitions:{id:'magic-missile',slug:'magic-missile',name:'Magic Missile',data:{level:1,duration:'Instantaneous'},effects:[]}};
    function Sheet(){return <Tabs defaultValue="sheet"><TabsList><TabsTrigger value="sheet">Character Sheet</TabsTrigger><TabsTrigger value="narrative">Narrative</TabsTrigger></TabsList><TabsContent value="sheet"><SheetPanel/></TabsContent><TabsContent value="narrative">Local narrative</TabsContent></Tabs>}
    function App(){const [route,setRoute]=useState(location.pathname);useEffect(()=>{const pop=()=>setRoute(location.pathname);window.addEventListener('popstate',pop);window.fixture.away=()=>{history.pushState({},'','/away');setRoute('/away')};return()=>window.removeEventListener('popstate',pop)},[]);return <><h1>Local save recovery fixture</h1><p>Simulated history and persistence; actual provider and dialogs.</p>{route==='/away'&&<h2>Away fixture</h2>}<Activity mode={route==='/sheet'?'visible':'hidden'}><CharacterProvider character={character} schema={schema} contentRefs={[]} initialState={{current_hp:10,active_effects:[{id:'existing',name:'Guarded',slug:'guarded',source:'custom',content_id:null,effects:[],duration:{type:'special'},concentration:false,applied_at:'2026-10-02T18:00:00.000Z',expires_at:null}]}} initialInventory={[]} initialSpells={[]} classData={{fighter:{slug:'fighter',data:{hit_die:10}},wizard:{slug:'wizard',data:{hit_die:6,spellcasting:{type:'full',ability:'intelligence'}}}}} allEffects={[]} baseStatsWithLevel={{constitution:10,intelligence:10,level:1}} structuredSources={{}} isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={()=>{}}><Sheet/></CharacterProvider></Activity></>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "local-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(next\/(link|navigation)|@\/components\/sheet\/content-tabs|@\/lib\/(sheet\/update-state|supabase\/(inventory|spells|rolls)|dice\/roller))$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "jsx", resolveDir: root }));
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
  for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + "/sheet");
    const panel=page.getByRole('tabpanel',{name:'Character Sheet',exact:true});
    await panel.waitFor();
    const exact=page.getByRole('button',{name:'HP tracker - click to heal or damage',exact:true});
    const robust=hpTrigger(page);
    await robust.waitFor();
    const dom=await page.locator('[aria-label^="HP tracker"]').evaluateAll(nodes=>nodes.map(node=>({tag:node.tagName,label:node.getAttribute('aria-label'),codepoints:[...node.getAttribute('aria-label')].map(c=>c.charCodeAt(0)),display:getComputedStyle(node).display,visible:!!(node.getClientRects().length),ancestors:[...function*(el){while(el.parentElement){el=el.parentElement;yield {tag:el.tagName,role:el.getAttribute('role'),hidden:el.hidden,display:getComputedStyle(el).display}}}(node)]})));
    const item={viewport,route:'/sheet',exactCount:await exact.count(),robustCount:await robust.count(),dom};
    await fs.writeFile(path.join(output,'snapshot-'+viewport.width+'.txt'),await page.locator('body').ariaSnapshot());
    assert.equal(await exact.count(),0);
    assert.equal(await robust.count(),1);
    await robust.click();
    await page.getByPlaceholder('Amount',{exact:true}).waitFor();
    await page.getByPlaceholder('Amount',{exact:true}).fill('2');
    await page.getByRole('button',{name:'Damage',exact:true}).click();
    await page.waitForFunction(()=>window.fixture.calls.length===1);
    assert.equal(await page.evaluate(()=>window.fixture.calls[0].current_hp),8);
    item.openedAndSaved=true;evidence.push(item);
    await page.screenshot({path:path.join(output,'sheet-'+viewport.width+'.png'),fullPage:true});
  }
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ simulated: true, evidence, errors, remoteRequests }, null, 2));
  console.log(JSON.stringify(evidence.map(({viewport,exactCount,robustCount,openedAndSaved,dom})=>({viewport,exactCount,robustCount,openedAndSaved,labels:dom.map(x=>x.label)})),null,2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
