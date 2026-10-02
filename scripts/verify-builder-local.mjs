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
    export async function updateCharacter(){throw new Error('Simulated private database failure')}
  `,
  "@/lib/supabase/content-refs-client": `export async function insertContentRef(){} export async function removeContentRefById(){}`,
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
      window.fixture={mode:'pending',calls:[],resolve:null};
      const character={id:'local-character',level:1,choices:{ability_method:'manual'},base_stats:{strength:10,dexterity:10}};
      const schema={ability_scores:[{slug:'strength',name:'Strength',abbr:'STR'},{slug:'dexterity',name:'Dexterity',abbr:'DEX'}]};
      const human={id:'human',name:'Human',slug:'human',content_type:'race',data:{description:'Local simulated content only.'},effects:[],version:1,source:'srd'};
      const pinnedHuman={...human,name:'Pinned Human',data:{description:'Authorized pinned race description.'},effects:[{type:'choice',choose:1,from:['skill-athletics'],grant_type:'proficiency',choice_id:'pinned-skill'}]};
      const newerHuman={...human,version:2,data:{description:'New catalog race description.'},effects:[{type:'choice',choose:1,from:['skill-stealth'],grant_type:'proficiency',choice_id:'new-skill'}]};
      function App(){
        const [route,setRoute]=useState(location.pathname);
        function navigate(to){history.pushState({fixture:true},'',to);setRoute(to)}
        useEffect(()=>{const pop=()=>setRoute(location.pathname);const go=e=>navigate(e.detail);window.addEventListener('popstate',pop);window.addEventListener('fixture-navigation',go);return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('fixture-navigation',go)}},[]);
        return <><h1>Isolated builder fixture</h1><p>Simulated history and persistence; real editor and selection components.</p>
          <nav><a href='/overview' onClick={e=>{e.preventDefault();navigate('/overview')}}>Overview</a> | <a href='/abilities' onClick={e=>{e.preventDefault();navigate('/abilities')}}>Abilities</a> | <a href='/race' onClick={e=>{e.preventDefault();navigate('/race')}}>Race</a> | <a href='/pinned-race' onClick={e=>{e.preventDefault();navigate('/pinned-race')}}>Pinned Race</a></nav>
          {route==='/overview'&&<h2>Overview fixture</h2>}
          <Activity mode={route==='/abilities'?'visible':'hidden'}><AbilitiesStepClient characterId='local-character' character={character} contentRefs={[]} schema={schema}/></Activity>
          <Activity mode={route==='/pinned-race'?'visible':'hidden'}><RaceStepClient characterId='local-character' character={{...character,choices:{race:'human'}}} races={[newerHuman]} subraces={[]} traits={[]} contentRefs={[{id:'pin',content_id:'human',context:{},choice_source:null,content_definitions:pinnedHuman}]} schema={undefined}/></Activity>
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
      builder.onResolve({ filter: /^(next\/navigation|@\/lib\/supabase\/(character-client|content-refs-client)|@\/components\/builder\/stat-preview)$/ }, args => ({ path: args.path, namespace: "fixture" }));
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
  await page.screenshot({ path: path.join(output, "pinned-race-mobile.png"), fullPage: true });
  evidence.push("Saved race UI displays pinned data and choices, preserving an older authorized snapshot against a newer catalog entry.");
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
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify({ simulated: true, liveSupabase: false, browser: "installed Chrome", evidence, pageErrors: errors, blockedRemoteRequests: blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: evidence.length, evidence, output }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
