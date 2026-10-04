import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Locator, type Route } from "@playwright/test";
import { OneAttemptManifest } from "../one-attempt-manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
import { captureOwnedRows } from "../owned-rows";

import type { Json } from "@/lib/supabase/database.types";

type State = Record<string, Json>;
type Capture = { expected: State; patch: State; response?: unknown; settled: boolean };
type Surface = "condition" | "exhaustion" | "inspiration" | "activation" | "death" | "effect" | "custom" | "badge" | "prompt" | "currency" | "cast" | "slots" | "resource" | "card" | "short" | "long";
test("ninth fixture: actual state controls, conflict and committed response-loss recovery", async ({page,context,browser})=>{
 test.setTimeout(900000);
 page.setDefaultTimeout(20000);
 page.setDefaultNavigationTimeout(30000);
 const settings=readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
 const accounts=await verifyExistingAccounts(settings);
 const runId=process.env.INKBORNE_BOUNDED_RUN_ID!,dir=runDirectory(runId);
 let manifest:OneAttemptManifest;
 try{manifest=new OneAttemptManifest(path.join(dir,"fixtures.jsonl"),runId)}catch(error){await accounts.close();throw error}
 const resultFile=path.join(dir,"state-controls-results.json");
 const clientErrors:string[]=[];
 page.on("pageerror",error=>{let message=error.message;for(const value of Object.values(settings))message=message.replaceAll(value,"[redacted]");clientErrors.push(message)});
 let results:Array<Record<string,unknown>>=[];
 try{if(existsSync(resultFile))results=JSON.parse(readFileSync(resultFile,"utf8")).results}catch(error){try{manifest.close()}finally{await accounts.close()}throw error}
 let phase="setup",failed=false,abandon=false;
 let release:(()=>void)|undefined;
 let mode:"pass"|"conflict"|"lost"|"reject"="pass";
 let gate:Promise<void>=Promise.resolve();const captures:Capture[]=[];
 const fixture=manifest.attempts.find(a=>a.characterId&&!a.cleaned);
 if(!fixture||manifest.attempts.length!==1||fixture.ownerId!==accounts.ownerId){manifest.close();await accounts.close();throw new Error("Requires the exact approved ninth fixture")}
 const id=fixture.characterId!,sheet="/characters/"+id;
 const rpcUrl=settings.NEXT_PUBLIC_SUPABASE_URL+"/rest/v1/rpc/patch_character_state_if_current";
 const record=(scenario:string,detail:Record<string,unknown>={})=>{
  results.push({scenario,status:"accepted",...detail});
  writeFileSync(path.join(dir,"state-controls-results.json"),JSON.stringify({runId,characterId:id,phase,results,clientErrors},null,2)+"\n");
  console.log("Accepted: "+scenario);
 };
 const read=async()=>{
  const r=await accounts.primary.from("characters").select("id,user_id,name,state,choices,visibility,campaign_id").eq("id",id).single();
  expect(r.error).toBeNull();expect(r.data?.user_id).toBe(fixture.ownerId);expect(r.data?.name).toBe(fixture.name);
  expect(r.data?.visibility).toBe("private");expect(r.data?.campaign_id).toBeNull();return r.data!;
 };
 const state=async()=>(await read()).state as State;
 const seed=async(patch:State)=>{
  const before=await state();const r=await accounts.primary.rpc("patch_character_state_if_current",{character_id:id,expected_state:before,state_patch:patch});
  expect(r.error).toBeNull();expect(r.data).toEqual([{status:"applied",resulting_state:{...before,...patch}}]);
  expect(await state()).toEqual({...before,...patch});
 };
 const click=async(name:string,scope:Locator=page.locator("body"))=>scope.getByRole("button",{name,exact:true}).locator("visible=true").first().click();
 let mobile=false,spellName="",spellSlug="",spellId="";
 const panel=()=>page.getByRole("tabpanel");
 const hpTrigger=(target:typeof page)=>target.getByRole("tabpanel").getByRole("button",{name:/^HP tracker\b/});
 const hpReading=async(target:typeof page)=>{const values=(await hpTrigger(target).innerText()).match(/(\d+)\s*\/\s*(\d+)/);if(!values)throw new Error("HP pair unavailable");return {current:Number(values[1]),maximum:Number(values[2])}};
 const mobileRoot=()=>panel().locator("div.md\\:hidden").first();
 const stats=()=>mobile?mobileRoot().locator("section.snap-start").nth(0):panel().locator("div.md\\:grid");
 const tab=async(name:"Spells"|"Inventory"|"Features")=>{
  if(mobile){await click(name,mobileRoot().locator("nav"));const index={Spells:3,Inventory:4,Features:5}[name];return mobileRoot().locator("section.snap-start").nth(index)}
  await click(name,panel().locator("div.md\\:grid"));return panel().locator("div.md\\:grid");
 };
 const baseline=()=>({current_hp:0,temp_hp:0,conditions:["Poisoned"],exhaustion:1,inspiration:false,rage_active:false,death_saves:{successes:0,failures:1},
  currency:{pp:0,gp:10,ep:0,sp:2,cp:3},quick_notes:"baseline notes",seen_sheet_first_time:true,spell_slots_used:{"1":1,"2":0},
  feature_uses:{"second-wind":1,"arcane-recovery":0},hit_dice_spent:{wizard:0,fighter:0,barbarian:0},
  concentrating_on:{spell_slug:spellSlug,spell_name:spellName,slot_level:1,started_at:"2026-10-04T00:00:00.000Z"},
  active_effects:[{id:"ninth-linked",slug:spellSlug,name:spellName,source:"spell",content_id:spellId,effects:[],duration:{type:"minutes",value:10},concentration:true,applied_at:"2026-10-04T00:00:00.000Z",expires_at:null}]}) as unknown as State;
 const load=async(isMobile=false)=>{mobile=isMobile;mode="pass";await seed(baseline());await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});await page.goto(sheet);await expect(hpTrigger(page)).toBeVisible();await expect.poll(async()=>(await hpReading(page)).current).toBe(0);
  // SSR controls are visible before hydration. Prove a harmless local state toggle first.
  const reminder=stats().getByPlaceholder("Quick reminders, initiative order, HP tracking...");
  await expect.poll(async()=>{if(await reminder.isVisible())return true;await stats().getByRole("button",{name:"Quick Notes",exact:true}).click();return reminder.isVisible()}).toBe(true);
  await click("Quick Notes",stats());await expect(reminder).toHaveCount(0);
 };
 const prepare=async(surface:Surface)=>{
  if(mobile)await click("Stats",mobileRoot().locator("nav"));
  if(surface==="currency"){const scope=await tab("Inventory");await scope.getByLabel("GP amount").fill("15");return ()=>click("Save currency",scope)}
  if(surface==="slots"){const scope=await tab("Spells");return ()=>click("Mark 1st slot used",scope)}
  if(surface==="cast"){const scope=await tab("Spells");await click("Cast "+spellName,scope);return ()=>click("Cast",page.getByRole("dialog"))}
  if(surface==="card"){const scope=await tab("Features");return ()=>click("Restore one Second Wind",scope)}
  if(surface==="resource")return ()=>click("Use one Rage",stats());
  if(surface==="short"||surface==="long"){
   await click("Rest");const dialog=page.getByRole("dialog",{name:"Rest",exact:true});
   if(surface==="short")await click("Recover one more 1st-level slot",dialog);
   return ()=>click(surface==="short"?"Take Short Rest":"Take Long Rest",dialog);
  }
  if(surface==="prompt"){
   await seed({current_hp:10});await page.reload();await expect.poll(async()=>(await hpReading(page)).current).toBe(10);
   await hpTrigger(page).click();await page.getByPlaceholder("Amount",{exact:true}).fill("1");await click("Damage");
   await expect.poll(async()=>(await state()).current_hp).toBe(9);
   await expect(page.getByRole("dialog").getByRole("button",{name:"Drop",exact:true})).toBeVisible();
   return ()=>click("Drop",page.getByRole("dialog"));
  }
  if(surface==="custom"){await click("Add effect",stats());await stats().getByLabel("Custom effect name").fill("Ninth half cover");return ()=>click("Add custom effect",stats())}
  const names={condition:"Remove Poisoned",exhaustion:"Increase exhaustion",inspiration:mobile?"Inspiration inactive":"Grant inspiration",activation:"Rage",death:"Success 1 (empty)",effect:"Remove "+spellName+" (ends concentration)",badge:"End concentration"};
  return ()=>click(names[surface]);
 };
 const uiAction=async(surface:Surface)=>{
  const trigger=await prepare(surface);const before=captures.length;await trigger();
  await expect.poll(()=>captures.length).toBe(before+1);await expect.poll(()=>captures[before].settled).toBe(true);
  expect(captures[before].response).toMatchObject([{status:"applied"}]);
  expect(await state()).toEqual({...captures[before].expected,...captures[before].patch});
  await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0);
  const saved=await state();
  if(surface==="effect"||surface==="badge"||surface==="prompt"){expect(saved.concentrating_on).toBeNull();expect(saved.active_effects).toEqual([])}
  if(surface==="cast"){expect(saved.concentrating_on).toMatchObject({spell_slug:spellSlug});expect(saved.spell_slots_used).toMatchObject({"1":2});expect(saved.active_effects).toHaveLength(1);await click("Done")}
  if(surface==="currency")expect(saved.currency).toEqual({pp:0,gp:15,ep:0,sp:2,cp:3});
  if(surface==="death")expect(saved.death_saves).toEqual({successes:1,failures:1});
  const follow=async(name:string,scope?:Locator)=>{const n=captures.length;await click(name,scope);await expect.poll(()=>captures.length).toBe(n+1);await expect.poll(()=>captures[n].settled).toBe(true);expect(captures[n].response).toMatchObject([{status:"applied"}]);expect(await state()).toEqual({...captures[n].expected,...captures[n].patch});await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0)};
  if(surface==="condition"){expect(saved.conditions).toEqual([]);await click("Add Condition",stats());await follow("Blinded",stats());expect((await state()).conditions).toEqual(["Blinded"])}
  if(surface==="exhaustion"){expect(saved.exhaustion).toBe(2);await follow("Decrease exhaustion",stats());expect((await state()).exhaustion).toBe(1)}
  if(surface==="inspiration"){expect(saved.inspiration).toBe(true);await follow(mobile?"Inspiration active":"Remove inspiration");expect((await state()).inspiration).toBe(false)}
  if(surface==="activation"){expect(saved.rage_active).toBe(true);await follow("Rage (Active)");expect((await state()).rage_active).toBe(false)}
  if(surface==="death"){for(const name of ["Failure 2 (empty)","Success 2 (empty)","Success 3 (empty)","Success 1 (filled)","Failure 3 (empty)","Failure 1 (filled)"])await follow(name);expect((await state()).death_saves).toEqual({successes:0,failures:0})}
  if(surface==="card"){expect(saved.feature_uses).toMatchObject({"second-wind":0});await follow("Use one Second Wind",await tab("Features"));expect((await state()).feature_uses).toMatchObject({"second-wind":1})}
  if(surface==="slots"){expect(saved.spell_slots_used).toMatchObject({"1":2});await follow("Restore 1st slot",await tab("Spells"));expect((await state()).spell_slots_used).toMatchObject({"1":1})}
  if(surface==="short"){expect(saved.spell_slots_used).toMatchObject({"1":0});expect(saved.feature_uses).toMatchObject({"second-wind":0,"arcane-recovery":1})}
  if(surface==="long"){expect(saved.current_hp).toBe((await hpReading(page)).maximum);expect(saved.concentrating_on).toBeNull();expect(saved.active_effects).toEqual([]);expect(saved.exhaustion).toBe(0)}
 };
 try{
  const current=await read();
  const system=await accounts.primary.from("game_systems").select("id").eq("slug","dnd-5e-2014").eq("status","published").single();expect(system.error).toBeNull();
  const definitions=await accounts.primary.from("content_definitions").select("id,slug,name,version,content_type,data,effects").eq("system_id",system.data!.id).eq("source","srd").eq("scope","platform").in("slug",["wizard","fighter","barbarian","expeditious-retreat"]);expect(definitions.error).toBeNull();expect(definitions.data).toHaveLength(4);
  const classes=[{slug:"wizard",level:3},{slug:"fighter",level:2},{slug:"barbarian",level:1}];
  const updated=await accounts.primary.from("characters").update({choices:{...(current.choices as object),classes},level:6,base_stats:{strength:14,dexterity:14,constitution:14,intelligence:14,wisdom:12,charisma:10}}).eq("id",id).eq("user_id",fixture.ownerId).eq("name",fixture.name).select("id");expect(updated.error).toBeNull();expect(updated.data).toHaveLength(1);
  const existingRefs=await accounts.primary.from("character_content_refs").select("id,content_id,content_version").eq("character_id",id);expect(existingRefs.error).toBeNull();
  for(const cls of classes){const def=definitions.data!.find(row=>row.slug===cls.slug)!;expect(def.content_type).toBe("class");const pinned=existingRefs.data!.filter(row=>row.content_id===def.id);expect(pinned.length).toBeLessThanOrEqual(1);
   if(pinned.length){expect(pinned[0].content_version).toBe(def.version)}else{const ref=await accounts.primary.from("character_content_refs").insert({character_id:id,content_id:def.id,content_version:def.version,context:{source:"class"}}).select("id").single();expect(ref.error).toBeNull();}
  }
  const synced=await accounts.primary.rpc("sync_character_feature_refs",{target_character_id:id});expect(synced.error).toBeNull();
  const spell=definitions.data!.find(row=>row.slug==="expeditious-retreat")!;spellName=spell.name;spellSlug=spell.slug;spellId=spell.id;
  const existingSpells=await accounts.primary.from("character_spells").select("id,content_version").eq("character_id",id).eq("content_id",spell.id);expect(existingSpells.error).toBeNull();expect(existingSpells.data!.length).toBeLessThanOrEqual(1);
  if(existingSpells.data!.length){expect(existingSpells.data![0].content_version).toBe(spell.version)}else{const added=await accounts.primary.from("character_spells").insert({character_id:id,content_id:spell.id,content_version:spell.version,name:spell.name,class_slug:"wizard",is_known:true,is_prepared:true,in_spellbook:true,source:"selection",custom_data:null}).select("id").single();expect(added.error).toBeNull();}
  await captureOwnedRows(manifest,accounts.admin,path.join(dir,"owned-rows.json"));
  record("setup",{syntheticClasses:classes,noRolledHpRecords:true,definitionVersions:definitions.data!.map(row=>({slug:row.slug,id:row.id,version:row.version}))});
  await browserLogin(page,settings);
  await context.route("**/rest/v1/character_rolls*",async route=>{if(route.request().method()==="POST"){await route.abort("failed");throw new Error("Forbidden roll attempted");}await route.continue()});
  await context.route("**/rest/v1/character_inventory*",async route=>{if(route.request().method()!=="GET"&&route.request().method()!=="OPTIONS"){await route.abort("failed");throw new Error("Forbidden inventory mutation attempted");}await route.continue()});
  await page.route(rpcUrl,async(route:Route)=>{
   if(route.request().method()!=="POST"||route.request().postDataJSON().character_id!==id)return route.continue();
   const body=route.request().postDataJSON();const entry:Capture={expected:body.expected_state,patch:body.state_patch,settled:false};captures.push(entry);const requestMode=mode;
   if(requestMode!=="pass")await gate;
   if(abandon){await route.abort("failed");entry.settled=true;return}
   if(requestMode==="reject"){await route.fulfill({status:403,contentType:"application/json",headers:{"access-control-allow-origin":new URL(page.url()).origin},body:JSON.stringify({code:"42501",message:"Injected before forwarding"})});entry.settled=true;return}
   const response=await route.fetch({maxRetries:0,timeout:20000});expect(response.ok()).toBe(true);entry.response=await response.json();
   if(requestMode==="lost"){expect(entry.response).toMatchObject([{status:"applied"}]);expect(await state()).toEqual({...entry.expected,...entry.patch});await route.abort("failed")}else await route.fulfill({response});entry.settled=true;
  });
  const surfaces:Surface[]=["condition","exhaustion","inspiration","activation","death","effect","custom","badge","prompt","currency","cast","slots","resource","card","short","long"];
  for(const viewport of [false,true])for(const surface of surfaces){phase=(viewport?"mobile":"desktop")+"-"+surface;await load(viewport);await uiAction(surface);await page.reload();await expect(hpTrigger(page)).toBeVisible();record(phase,{persistedReadback:true,reload:true});}
  phase="two-actual-owner-tabs";await load();const other=await context.newPage();try{
   await other.goto(sheet);await expect(hpTrigger(other)).toBeVisible();const base=await state();
   await uiAction("condition");const winner=await state();expect(winner).toEqual({...base,conditions:[]});
   await other.getByRole("button",{name:"Rage",exact:true}).click();await expect(other.getByRole("button",{name:"Reload character",exact:true})).toBeVisible();expect(await state()).toEqual(winner);
   await other.getByRole("button",{name:"Rage",exact:true}).click();expect(await state()).toEqual(winner);
   await other.getByRole("button",{name:"Reload character",exact:true}).click();await expect(hpTrigger(other)).toBeVisible();
   await other.getByRole("button",{name:"Rage",exact:true}).click();await expect.poll(async()=>(await state()).rage_active).toBe(true);
   record(phase,{winnerUnchanged:true,explicitReloadThenNewIntent:true});
  }finally{await other.close()}
  for(const surface of surfaces)for(const outcome of ["conflict","lost"] as const){
   phase="mobile-"+surface+"-hidden-"+outcome;await load(true);
   const trigger=await prepare(surface);
   // Expand the actual note caller without dismissing an already prepared modal.
   await stats().getByRole("button",{name:"Quick Notes",exact:true}).evaluate((node:HTMLButtonElement)=>node.click());
   const note=stats().getByPlaceholder("Quick reminders, initiative order, HP tracking...");await expect(note).toBeVisible();
   const before=await state();const count=captures.length;
   gate=new Promise<void>(resolve=>{release=resolve});mode=outcome;await trigger();await expect.poll(()=>captures.length).toBe(count+1);
   // Native input event invokes React's actual QuickNotes debounce without closing a pending modal.
   await note.evaluate((node:HTMLTextAreaElement)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(node,"ninth independent draft");node.dispatchEvent(new Event("input",{bubbles:true}));});
   await page.waitForTimeout(650);
   if(outcome==="conflict")await seed({exhaustion:2});const persistedBefore=await state();
   await page.locator(`a[href="${sheet}/builder"]:visible`).evaluate((node:HTMLAnchorElement)=>node.click());await page.waitForURL("**"+sheet+"/builder");
   release!();release=undefined;await expect.poll(()=>captures[count].settled).toBe(true);
   await expect.poll(async()=>(await state()).quick_notes).toBe("ninth independent draft");
   const persisted=await state();expect(persisted).toEqual({...(outcome==="conflict"?persistedBefore:{...before,...captures[count].patch}),quick_notes:"ninth independent draft"});
   if(outcome==="conflict")expect(captures[count].response).toMatchObject([{status:"conflict"}]);
   await page.goBack();await expect(hpTrigger(page)).toBeVisible();await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0);
   const boundary=page.getByRole("button",{name:"Reload character",exact:true});const retained=await boundary.isVisible();
   if(retained){await expect(page.getByRole("alert").first()).toContainText(outcome==="conflict"?"changed in another tab":"could not be confirmed");
    if(surface==="currency")await expect((await tab("Inventory")).getByLabel("GP amount")).toHaveValue("15");
    if(surface==="custom")await expect(stats().getByLabel("Custom effect name")).toHaveValue("Ninth half cover");
    await boundary.click();await expect(hpTrigger(page)).toBeVisible();
   }else{await page.reload();await expect(hpTrigger(page)).toBeVisible();}
   expect(captures.length).toBe(count+1);expect(await state()).toEqual(persisted);mode="pass";
   await click(persisted.inspiration?"Inspiration active":"Inspiration inactive");await expect.poll(()=>captures.length).toBe(count+2);await expect.poll(()=>captures[count+1].settled).toBe(true);
   expect(captures[count+1].response).toMatchObject([{status:"applied"}]);expect(captures[count+1].expected).toEqual(persisted);expect(await state()).toEqual({...persisted,inspiration:!persisted.inspiration});
   record(phase,{navigationLifecycle:retained?"retained-boundary":"remounted-explicit-reload",notesPreserved:true,failedActionRequests:1,replay:0,persistedReadback:true,explicitNewActionAfterReload:true});
  }
  phase="known-pre-forward-rejection";await load();const trigger=await prepare("inspiration");const before=await state(),count=captures.length;gate=Promise.resolve();mode="reject";await trigger();await expect.poll(()=>captures.length).toBe(count+1);await expect.poll(()=>captures[count].settled).toBe(true);await expect(page.getByRole("button",{name:"Reload character",exact:true})).toBeVisible();expect(await state()).toEqual(before);record(phase,{forwarded:0,baselineUnchanged:true});mode="pass";
  phase="access-and-empty-side-effects";
  const preserved=await state();const nonowner=await accounts.secondary.rpc("patch_character_state_if_current",{character_id:id,expected_state:preserved,state_patch:{inspiration:true}});expect(nonowner.error).toBeNull();expect(nonowner.data).toEqual([{status:"missing",resulting_state:null}]);
  const anon=createClient(settings.NEXT_PUBLIC_SUPABASE_URL,settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const denied=await anon.rpc("patch_character_state_if_current",{character_id:id,expected_state:preserved,state_patch:{inspiration:true}});expect(denied.error?.code).toBe("42501");
  const missing=await accounts.primary.rpc("patch_character_state_if_current",{character_id:randomUUID(),expected_state:{},state_patch:{inspiration:true}});expect(missing.error).toBeNull();expect(missing.data).toEqual([{status:"missing",resulting_state:null}]);
  for(const client of [accounts.secondary,anon]){const r=await client.from("characters").select("id").eq("id",id);expect(r.error).toBeNull();expect(r.data).toEqual([])}
  expect(await state()).toEqual(preserved);
  const nonownerContext=await browser.newContext({baseURL:new URL(page.url()).origin});try{const other=await nonownerContext.newPage();await browserLogin(other,settings,"secondary");await other.goto(sheet);await expect(other.getByText("This page could not be found.", {exact:false})).toBeVisible();}finally{await nonownerContext.close()}
  const anonContext=await browser.newContext();try{const other=await anonContext.newPage();await other.goto(new URL(sheet,page.url()).href);await other.waitForURL("**/login");}finally{await anonContext.close()}
  for(const table of ["character_rolls","character_inventory"]){const r=await accounts.primary.from(table).select("id").eq("character_id",id);expect(r.error).toBeNull();expect(r.data).toEqual([])}
  expect((await read()).choices.hp_rolls).toBeUndefined();record(phase,{ownerUnchanged:true,nonownerAndAnonymousDenied:true,missingRejected:true,rolls:0,inventory:0});phase="complete";
 }catch(error){failed=true;results.push({scenario:phase,status:"failed",detail:"See sanitized runner log; no automatic retry or second creation"});throw error}
 finally{abandon=true;release?.();try{
  try{await page.unrouteAll({behavior:"wait"})}finally{await captureOwnedRows(manifest,accounts.admin,path.join(dir,"owned-rows.json"))}
 }catch(error){if(!failed)throw error}finally{
  try{writeFileSync(path.join(dir,"state-controls-results.json"),JSON.stringify({runId,characterId:id,phase,results,clientErrors},null,2)+"\n")}finally{try{manifest.close()}finally{await accounts.close()}}
 }}
});
