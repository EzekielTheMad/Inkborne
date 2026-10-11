/** T1: actual current components/pages, mocked auth/data/action boundaries.
 * Does not load .env, hosted Playwright config or provider fixture helpers. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "test-results", "e2e-drift-local");
await fs.mkdir(output, { recursive: true });
const stubs = {
  "next/link": `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  "next/navigation": `export function useRouter(){return {push(){},refresh(){window.fixture.refreshes++}}}export function redirect(){throw Error('unexpected redirect')}export function notFound(){throw Error('unexpected notFound')}`,
  "@/lib/supabase/server": `export async function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'local-owner'}}})},from(table){const chain={select(){return chain},eq(){return chain},is(){return chain},order:async()=>({data:[],error:null}),single:async()=>({data:{id:'local-campaign',name:'Local campaign',owner_id:'local-owner',invite_code:'LOCAL',system_id:'local-system',game_systems:{name:'Local rules'}},error:null})};return chain}}}`,
  "@/lib/supabase/homebrew-spells-server": `export async function listOwnedHomebrewSpells(){return []}`,
  "@/lib/supabase/homebrew-feats-server": `export async function listOwnedHomebrewFeats(){return []}`,
  "@/lib/supabase/homebrew-backgrounds-server": `export async function listOwnedHomebrewBackgrounds(){return []}`,
  "@/app/(app)/campaigns/actions": `export async function assignCharacterToCampaign(){throw Error('unexpected action')}export async function leaveCampaign(){throw Error('unexpected action')}export async function unassignCharacterFromCampaign(){throw Error('unexpected action')}`,
  "@/lib/supabase/character-client": `export async function updateCharacter(){throw Error('unexpected character write')}export async function updateCharacterAndReturn(){throw Error('unexpected character write')}`,
  "@/lib/supabase/content-refs-client": `export async function insertContentRef(){throw Error('unexpected pin write')}export async function removeContentRefById(){throw Error('unexpected pin write')}`,
  "class-actions": `export async function reconcileClassFeatureRefsAction(){throw Error('unexpected recovery')}export async function searchUsableFeatsAction(request){window.fixture.searches.push(request);return {status:'success',feats:[window.fixture.feat]}}export async function setCharacterAsiChoiceAction(request){window.fixture.saves.push(request);return {status:'success',choices:{classes:[{slug:'wizard',level:4}],asi_choices:{'wizard-asi-4':{...request.choice,featName:window.fixture.feat.name}}}}}`,
  "@/components/builder/stat-preview": `export function StatPreview(){return null}`,
  "@/components/sheet/tabs/actions-tab": `export function ActionsTab(){return <p>Actions fixture boundary</p>}`,
  "@/components/sheet/tabs/spells-tab": `export function SpellsTab(){return <p>Spells fixture boundary</p>}`,
  "@/components/sheet/tabs/inventory-tab": `export function InventoryTab(){return null}`,
  "@/components/sheet/tabs/features-tab": `export function FeaturesTab(){return null}`,
  "@/components/sheet/tabs/notes-tab": `export function NotesTab(){return null}`,
};
for (const [module, name] of [
  ["ability-card", "AbilityCard"], ["combat-stats", "CombatStats"], ["hp-tracker", "HPTracker"],
  ["rest-button", "RestButton"], ["saving-throws", "SavingThrows"], ["passive-senses", "PassiveSenses"],
  ["defenses", "Defenses"], ["resources-widget", "ResourcesWidget"], ["active-effects-widget", "ActiveEffectsWidget"],
  ["conditions", "Conditions"], ["death-saves", "DeathSaves"], ["quick-notes", "QuickNotes"],
  ["proficiencies", "Proficiencies"], ["activation-toggles", "ActivationToggles"], ["skills-list", "SkillsList"],
]) stubs[`@/components/sheet/${module}`] = `export function ${name}(){return null}`;
await build({
  stdin: { resolveDir: root, loader: "tsx", sourcefile: "local-e2e-drift-fixture.tsx", contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import CampaignPage from '@/app/(app)/campaigns/[id]/page';
    import HomebrewPage from '@/app/(app)/homebrew/page';
    import {ContentTabs} from '@/components/sheet/content-tabs';
    import {MobileSheet} from '@/components/sheet/mobile-sheet';
    import {ClassStepClient} from '@/app/(app)/characters/[id]/builder/class/class-step-client';
    window.fixture={searches:[],saves:[],refreshes:0,feat:{id:'local-feat',name:'__e2e__ Lantern Keeper',description:'Synthetic option',version:1,source:'homebrew',scope:'personal',prerequisiteMet:true,prerequisiteReason:null}};
    const wizard={id:'wizard',slug:'wizard',name:'Wizard',content_type:'class',data:{hit_die:6,levels:[{level:1,features:[]},{level:2,features:[]},{level:3,features:[]},{level:4,features:['wizard-asi-4']}]},effects:[],version:1,source:'srd'};
    const asi={...wizard,id:'asi',slug:'wizard-asi-4',name:'Ability Score Improvement',content_type:'feature',data:{class:'wizard',level:4,feature_type:'asi'}};
    const pin=d=>({id:d.id+'-pin',content_id:d.id,content_version:1,context:{},choice_source:null,content_definitions:d});
    async function mount(){let content;switch(location.pathname){
      case '/campaign':content=await CampaignPage({params:Promise.resolve({id:'local-campaign'}),searchParams:Promise.resolve({})});break;
      case '/created':content=await HomebrewPage({searchParams:Promise.resolve({created:'local-spell'})});break;
      case '/updated':content=await HomebrewPage({searchParams:Promise.resolve({updated:'local-spell'})});break;
      case '/spells':const sheetProps={character:{choices:{classes:[]}},schema:{ability_scores:[]},evalResult:{stats:{},computed:{},grants:{}},contentRefs:[],state:{current_hp:10},patchState:async()=>true,maxHp:10};content=<><div className='hidden md:block'><ContentTabs {...sheetProps}/></div><MobileSheet {...sheetProps}/></>;break;
      default:content=<ClassStepClient characterId='local-character' character={{id:'local-character',name:'Local wizard',level:4,base_stats:{strength:10,dexterity:10,constitution:10,intelligence:16,wisdom:10,charisma:10},choices:{classes:[{slug:'wizard',level:4}]}}} classes={[wizard]} subclasses={[]} features={[asi]} feats={[]} spells={[]} contentRefs={[pin(wizard),pin(asi)]} schema={undefined}/>;
    }createRoot(document.getElementById('root')).render(content)}mount();
  ` },
  outfile: path.join(output, "fixture.js"), bundle: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "offline-drift-boundaries", setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: "fixture" };
      if (args.path === "./actions" && args.importer.endsWith("class-step-client.tsx")) return { path: "class-actions", namespace: "fixture" };
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: root }));
  } }],
});
// Reuse already-built integration CSS read-only; record exact CSS hashes below.
const cssRoot = process.env.INKBORNE_OFFLINE_CSS_ROOT ?? path.join(root, "..", "equipment-verification", ".next", "static", "chunks");
const cssFiles = (await fs.readdir(cssRoot)).filter(name => name.endsWith(".css"));
assert.ok(cssFiles.length, "Existing production CSS is required");
const css = (await Promise.all(cssFiles.map(name => fs.readFile(path.join(cssRoot, name), "utf8")))).join("\n");
const server = http.createServer(async (request, response) => {
  if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(output, "fixture.js"))); }
  else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
  else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><title>Offline T1</title><link rel="stylesheet" href="/style.css"></head><body><main style="padding:24px"><div id="root"></div></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const processReceipt = { pid: process.pid, parentPid: process.ppid, command: "node scripts/verify-e2e-drift-local.mjs", cwd: root, port, startTime: new Date().toISOString() };
console.log(JSON.stringify(processReceipt));
let browser;
const evidence = []; const pageErrors = []; const remoteRequests = [];
try {
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const context = await browser.newContext();
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) { remoteRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(); page.on("pageerror", error => pageErrors.push(error.message));
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + "/campaign");
    await page.getByRole("heading", { name: "Local campaign", exact: true }).waitFor();
    evidence.push({ viewport, case: "campaign heading", outcome: "existing exact selector passes" });
    await page.goto(origin + "/created");
    await page.getByRole("status").waitFor();
    assert.equal(await page.getByRole("status").textContent(), "Private homebrew created.");
    assert.notEqual(await page.getByRole("status").textContent(), "Private spell created.");
    evidence.push({ viewport, case: "homebrew create", outcome: "old spell-only expectation differs from actual current notice" });
    await page.goto(origin + "/updated");
    await page.getByRole("status").waitFor();
    assert.equal(await page.getByRole("status").textContent(), "A new homebrew version was saved. Existing character pins are unchanged.");
    assert.equal((await page.getByRole("status").textContent()).includes("new spell version"), false);
    evidence.push({ viewport, case: "homebrew update", outcome: "old spell-only expectation differs from actual current notice" });
    await page.goto(origin + "/spells");
    await page.getByRole("button", { name: "Spells", exact: true }).first().waitFor();
    const spellMatches = await page.getByRole("button", { name: "Spells", exact: true }).count();
    assert.equal(spellMatches, viewport.width < 768 ? 6 : 1);
    if (spellMatches > 1) await assert.rejects(
      () => page.getByRole("button", { name: "Spells", exact: true }).click(),
      /strict mode violation/,
    );
    await page.getByRole("button", { name: "Spells", exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Spells fixture boundary", { exact: true }).first().waitFor();
    evidence.push({ viewport, case: "Spells label", spellMatches, outcome: "current label retained; actual responsive sheet navigation reveals selector multiplicity; bodies stubbed" });
    await page.goto(origin + "/asi");
    await page.getByRole("button", { name: /^Level 4:/ }).click();
    await page.getByRole("heading", { name: "Ability Score Improvement", exact: true }).waitFor();
    await page.getByRole("group", { name: "Improvement type" }).getByRole("button", { name: "Feat", exact: true }).click();
    await page.getByPlaceholder("Search available feats").fill("__e2e__ Lantern Keeper");
    const featOption = page.getByRole("button").filter({ hasText: "__e2e__ Lantern Keeper" });
    await featOption.waitFor();
    assert.match(await featOption.textContent(), /v1/);
    assert.match(await featOption.textContent(), /Your homebrew/);
    await featOption.click();
    await page.getByLabel("Choice made", { exact: true }).waitFor();
    const calls = await page.evaluate(() => ({ searches: window.fixture.searches, saves: window.fixture.saves }));
    assert.equal(calls.saves.length, 1);
    evidence.push({ viewport, case: "MPMB feat navigation", outcome: "Level4 → ASI → Feat path passes; old Private option assertion differs from actual Your homebrew provenance", calls });
    await page.screenshot({ path: path.join(output, `asi-${viewport.width}.png`), fullPage: true });
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(remoteRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ liveSupabase: false, processReceipt, cssRoot, cssFiles, cssSha256: createHash("sha256").update(css).digest("hex"), evidence, pageErrors, remoteRequests }, null, 2));
  console.log(JSON.stringify({ passed: evidence.length, liveSupabase: false, pageErrors, remoteRequests }));
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.equal(server.listening, false);
  console.log(JSON.stringify({ stopped: process.pid, portClosed: port }));
}
